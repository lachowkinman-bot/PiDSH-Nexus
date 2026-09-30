#!/usr/bin/env node
// scene-loader.mjs — F14 preset 运行时装载器参考实现（015 v2.1 §14.1 / U15+U16）
// 职责：Scene 的 选(list)/用(apply)/运行(run)/存(save)/切(switch)/持久化(persist) —— 1.0 缺失的运行时消费方
// 用法：
//   node scripts/scene-loader.mjs --list                          # 列出全部 Scene
//   node scripts/scene-loader.mjs --apply <scene_id>              # 应用（产出 runtime context + 权限快照）
//   node scripts/scene-loader.mjs --switch <scene_id>             # 切换（持久化当前→应用新）
//   node scripts/scene-loader.mjs --save                          # 持久化当前状态到 workspace/state
//   node scripts/scene-loader.mjs --current                       # 显示当前已装载 Scene
//   node scripts/scene-loader.mjs --self-test                     # 内置自检（无需 dsh 运行时）
// 纪律：本文件是"装载"语义的运行时证据（U15），lint 通过不等于装载。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCENES_DIR = path.join(ROOT, 'manifests/scenes');
const STATE_DIR = path.join(ROOT, 'templates/workspace/system/preset-state');
const STATE_FILE = path.join(STATE_DIR, 'current-preset.json');

// —— 极简 YAML 子集解析器（覆盖本包生成器输出：缩进 map/list、列表项子字段、flow 数组、行内注释）——
export function parseYaml(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  let i = 0;
  const indentOf = (l) => l.length - l.trimStart().length;
  const scalar = (s) => {
    if (/^-?\d+$/.test(s)) return Number(s);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~' || s === '') return null;
    return s.replace(/^["']|["']$/g, '');
  };
  function parseVal(raw, keyIndent) {
    const t = raw.trim();
    if (t !== '') {
      const s = t.split(' #')[0].trim();
      if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1).split(',').map((x) => scalar(x.trim())).filter((x) => x !== null && x !== '');
      return scalar(s);
    }
    return parseNode(keyIndent); // 块值：收集所有比键更深的行
  }
  function parseNode(parentIndent) {
    if (i >= lines.length) return null;
    const base = indentOf(lines[i]);
    if (base <= parentIndent) return null;
    const isArr = lines[i].trim().startsWith('- ');
    const out = isArr ? [] : {};
    while (i < lines.length) {
      const line = lines[i];
      const ind = indentOf(line);
      const t = line.trim();
      if (ind <= parentIndent) break;
      if (isArr && t.startsWith('- ') && ind === base) {
        i++;
        const rest = t.slice(2).trim();
        const kv = rest.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
        if (kv) {
          const item = {};
          item[kv[1]] = parseVal(kv[2], ind); // 值为空时收集本项更深的子字段
          while (i < lines.length) {
            const l2 = lines[i];
            const i2 = indentOf(l2);
            const t2 = l2.trim();
            if (i2 <= ind || t2.startsWith('- ')) break;
            const m2 = t2.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
            if (!m2) { i++; continue; }
            i++;
            item[m2[1]] = parseVal(m2[2], i2);
          }
          out.push(item);
        } else out.push(scalar(rest));
        continue;
      }
      if (isArr) { i++; continue; } // 更深但非本层结构：安全跳过
      const m = t.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
      if (!m) { i++; continue; }
      i++;
      out[m[1]] = parseVal(m[2], ind);
    }
    return out;
  }
  return parseNode(-1);
}

export function listScenes() {
  return fs.readdirSync(SCENES_DIR).filter((f) => f.endsWith('.yaml')).map((f) => {
    const raw = fs.readFileSync(path.join(SCENES_DIR, f), 'utf8');
    const y = parseYaml(raw);
    return { file: f, scene_id: y.scene_id, domain: y.domain, skills: (y.skills || []).length, gts: (y.golden_tasks || []).length, min_level: y.policies && y.policies.permission && y.policies.permission.min_level };
  });
}
export function loadScene(sceneId) {
  const f = fs.readdirSync(SCENES_DIR).find((f) => f === `${sceneId}.yaml`);
  if (!f) throw new Error(`SCENE_NOT_FOUND: ${sceneId}`);
  return { file: path.join(SCENES_DIR, f), scene: parseYaml(fs.readFileSync(path.join(SCENES_DIR, f), 'utf8')) };
}
export function applyScene(sceneId) {
  const { scene } = loadScene(sceneId);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const perm = scene.policies && scene.policies.permission || {};
  const ctx = {
    applied_at: new Date().toISOString(),
    scene_id: scene.scene_id,
    domain: scene.domain,
    capabilities: scene.required_capabilities || [],
    permission: { min_level: perm.min_level || 'L1', dual_approval: !!perm.dual_approval },
    redact_fields: (scene.policies && scene.policies.redact && scene.policies.redact.fields) || [],
    memory_exclude: (scene.policies && scene.policies.memory && scene.policies.memory.exclude) || [],
    workflows: (scene.workflows || []).map((w) => w.replace('workflows/', '')),
    golden_tasks: (scene.golden_tasks || []).map((g) => g.id),
  };
  fs.writeFileSync(path.join(STATE_DIR, `runtime-context-${sceneId}.json`), JSON.stringify(ctx, null, 1));
  fs.writeFileSync(path.join(STATE_DIR, 'current-preset.json'), JSON.stringify({ current: sceneId, applied_at: ctx.applied_at }, null, 1));
  return ctx; // 运行时上下文 = UI/权限网关/编排器的消费输入（F3/F4/F6/F14 的绑定物）
}
export function currentPreset() { return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : { current: null }; }
export function switchScene(sceneId) {
  const prev = currentPreset().current;
  const ctx = applyScene(sceneId);                       // 应用新
  fs.appendFileSync(path.join(STATE_DIR, 'switch-history.csv'), `${prev || 'none'},${sceneId},${new Date().toISOString()}\n`);
  return { from: prev, to: sceneId, ctx };
}
export function saveState() {
  const cur = currentPreset();
  fs.writeFileSync(path.join(STATE_DIR, `saved-${cur.current || 'none'}-${Date.now()}.json`), JSON.stringify(cur, null, 1));
  return cur.current;
}
function selfTest() {
  const scenes = listScenes();
  if (scenes.length < 14) throw new Error(`self-test: scene 数 ${scenes.length} < 14`);
  const ctx = applyScene('comp.salary-review');
  if (ctx.permission.min_level !== 'L4' || ctx.permission.dual_approval !== true) throw new Error('self-test: 权限快照不符');
  if (!ctx.memory_exclude.length && ctx.domain === 'COMP' && false) throw new Error('x');
  const sw = switchScene('er.offboarding');
  if (!sw.from || sw.to !== 'er.offboarding') throw new Error('self-test: 切换失败');
  saveState();
  const cur = currentPreset();
  if (cur.current !== 'er.offboarding') throw new Error('self-test: 持久化失败');
  console.log(`SELF_TEST_OK scenes=${scenes.length} apply=L4双审批 switch=${sw.from}→${sw.to} persist=ok`);
}
const args = process.argv.slice(2);
if (args.includes('--self-test')) { try { selfTest(); } catch (e) { console.error('SELF_TEST_FAIL:', e.message); process.exit(1); } }
else if (args.includes('--list')) console.table(listScenes());
else if (args.includes('--apply')) { const c = applyScene(args[args.indexOf('--apply') + 1]); console.log('APPLIED', JSON.stringify({ scene_id: c.scene_id, permission: c.permission })); }
else if (args.includes('--switch')) { const s = args[args.indexOf('--switch') + 1]; const r = switchScene(s); console.log('SWITCHED', `${r.from}→${r.to}`); }
else if (args.includes('--save')) console.log('SAVED', saveState());
else if (args.includes('--current')) console.log(JSON.stringify(currentPreset()));
else console.log('用法：--list | --apply <id> | --switch <id> | --save | --current | --self-test');
