#!/usr/bin/env node
// Universal Workbench 插件 · Node 半面（宿主进程内运行）
// 职责（015 v2.2 §15 + 016 v3.0）：scenes/apply/switch/save/engine-run/audit
//   + 3.0 复盘增补（2026-09-29，修复用户复盘指出的四类问题）：
//   P1 数据层：/data（每域真实 CSV 资产）、/submit（提交→deliverables 落盘+审计）
//   P2 工作流：/workflows（index.json 78 条）、/workflow-run（发起→标准产物）
//   P3 交付产物：/deliverables（清单）；workflow-run/submit 均产标准交付物
//   P4 按钮三件套：/tools-versions、/rollback-dryrun、/preset-new、/preset-edit、/buttons
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const PLUGIN_ROOT = path.dirname(fileURLToPath(import.meta.url));
function resolveBundleRoot() {
  const candidates = [
    process.env.UNIVERSAL_WORKBENCH_ROOT,
    process.cwd(),
    path.resolve(PLUGIN_ROOT, '../..'),
    path.resolve(PLUGIN_ROOT, '../../../..'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'manifests/domain-delivery.json'))) return path.resolve(candidate);
  }
  return path.resolve(PLUGIN_ROOT, '../..');
}
const BUNDLE_ROOT = resolveBundleRoot();
const SCENES = path.join(BUNDLE_ROOT, 'manifests/scenes');
const STATE = path.join(BUNDLE_ROOT, 'templates/workspace/system/preset-state');
const AUDIT = path.join(BUNDLE_ROOT, 'templates/workspace/audit');
const DATA = path.join(BUNDLE_ROOT, 'templates/workspace/data');
const DELIV = path.join(BUNDLE_ROOT, 'templates/workspace/deliverables');
const WF_INDEX = path.join(BUNDLE_ROOT, 'manifests/workflows/index.json');
const TOOLS_VERSIONS = path.join(BUNDLE_ROOT, 'tools-versions.txt');
export const DOMAINS = ['strat', 'mkt-on', 'mkt-off', 'sales', 'fin', 'rec', 'trn', 'prf', 'comp', 'ben', 'admin', 'cmp', 'er-eap'];
const DELIVERY_FORMATS = ['md', 'csv', 'html', 'xlsx', 'docx', 'pptx', 'pdf'];
let DELIVERY_SERVICE = null;
let DELIVERY_MODULE = null;
async function deliveryService() {
  if (!DELIVERY_MODULE) DELIVERY_MODULE = await import('./delivery-service.cjs');
  if (!DELIVERY_SERVICE) DELIVERY_SERVICE = DELIVERY_MODULE.createDeliveryService({ root: BUNDLE_ROOT, audit });
  return DELIVERY_SERVICE;
}

// —— Scene 解析（与 scripts/scene-loader.mjs 同一子集语义）——
export function parseYaml(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  let i = 0;
  const ind = (l) => l.length - l.trimStart().length;
  const scalar = (s) => {
    if (/^-?\d+$/.test(s)) return Number(s);
    if (s === 'true') return true;
    if (s === 'false') return false;
    return s.replace(/^["']|["']$/g, '');
  };
  function val(raw, keyIndent) {
    const t = raw.trim();
    if (t !== '') {
      const s = t.split(' #')[0].trim();
      if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1).split(',').map((x) => scalar(x.trim())).filter((x) => x !== '');
      return scalar(s);
    }
    return node(keyIndent);
  }
  function node(parentIndent) {
    if (i >= lines.length) return null;
    const base = ind(lines[i]);
    if (base <= parentIndent) return null;
    const isArr = lines[i].trim().startsWith('- ');
    const out = isArr ? [] : {};
    while (i < lines.length) {
      const line = lines[i], d = ind(line), t = line.trim();
      if (d <= parentIndent) break;
      if (isArr && t.startsWith('- ') && d === base) {
        i++;
        const kv = t.slice(2).trim().match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
        if (kv) {
          const item = {};
          item[kv[1]] = val(kv[2], d);
          while (i < lines.length) {
            const l2 = lines[i], d2 = ind(l2), t2 = l2.trim();
            if (d2 <= d || t2.startsWith('- ')) break;
            const m2 = t2.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/); if (!m2) { i++; continue; }
            i++; item[m2[1]] = val(m2[2], d2);
          }
          out.push(item);
        } else out.push(scalar(t.slice(2)));
        continue;
      }
      if (isArr) { i++; continue; }
      const m = t.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/); if (!m) { i++; continue; }
      i++; out[m[1]] = val(m[2], d);
    }
    return out;
  }
  return node(-1);
}
export function listScenes() {
  return fs.readdirSync(SCENES).filter((f) => f.endsWith('.yaml')).map((f) => {
    const y = parseYaml(fs.readFileSync(path.join(SCENES, f), 'utf8'));
    return { scene_id: y.scene_id, domain: y.domain, min_level: y.policies?.permission?.min_level, dual: !!y.policies?.permission?.dual_approval, gts: (y.golden_tasks || []).length };
  });
}
// scene_id 形如 `admin.procurement@1.0.0`，而文件名是 `admin.procurement.yaml` → 必须反查映射
export function resolveSceneId(id) {
  if (!id) throw new Error('missing scene id');
  if (fs.existsSync(path.join(SCENES, `${id}.yaml`))) return id;
  for (const f of fs.readdirSync(SCENES).filter((x) => x.endsWith('.yaml'))) {
    const y = parseYaml(fs.readFileSync(path.join(SCENES, f), 'utf8'));
    if (y.scene_id === id || y.scene_id === `${id}@${(y.scene_id || '').split('@')[1] || ''}` || f.replace('.yaml', '') === String(id).split('@')[0]) return f.replace('.yaml', '');
  }
  throw new Error(`scene not found: ${id}`);
}
export function applyScene(id) {
  const y = parseYaml(fs.readFileSync(path.join(SCENES, `${resolveSceneId(id)}.yaml`), 'utf8'));
  fs.mkdirSync(STATE, { recursive: true });
  const ctx = { applied_at: new Date().toISOString(), scene_id: y.scene_id, domain: y.domain,
    permission: y.policies?.permission || {}, redact: y.policies?.redact?.fields || [],
    memory_exclude: y.policies?.memory?.exclude || [], workflows: y.workflows || [] };
  fs.writeFileSync(path.join(STATE, `runtime-context-${id}.json`), JSON.stringify(ctx, null, 1));
  fs.writeFileSync(path.join(STATE, 'current-preset.json'), JSON.stringify({ current: id, applied_at: ctx.applied_at }, null, 1));
  audit('preset.apply', { scene: id });
  return ctx;
}
export function switchScene(id) {
  const from = current()?.current || 'none';
  const ctx = applyScene(id);
  audit('preset.switch', { from, to: id });     // v2.2 U15：switch 必须产生独立审计事件
  return { from, to: id, ctx };
}
export function savePreset() {
  const cur = current();
  fs.mkdirSync(STATE, { recursive: true });
  fs.writeFileSync(path.join(STATE, `saved-${cur.current}-${Date.now()}.json`), JSON.stringify(cur, null, 1));
  audit('preset.save', { scene: cur.current }); // v2.2 U15：save 必须产生独立审计事件
  return cur.current;
}
export function current() {
  const f = path.join(STATE, 'current-preset.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { current: null };
}
export function audit(action, detail) {
  fs.mkdirSync(AUDIT, { recursive: true });
  fs.appendFileSync(path.join(AUDIT, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`),
    JSON.stringify({ ts: new Date().toISOString(), action, ...detail }) + '\n');
}
// —— 引擎整合（U18）：skill 节点经 pi/dsh CLI 执行；本地 JS 仅断网降级且标注 fallback ——
// 判据修正（2026-09-29）：**不得以"子进程退出码 0"判定成功**——pi 在内部模型调用 401 失败时同样
// exit 0，会把"模型实际未执行"记成 fallback=false（假绿）。pi 分支改为解析 JSON 流并要求
// stopReason=stop 且 totalTokens>0 且有正文；dsh 分支要求 stdout 非空且不含鉴权失败特征。
// 顺序：pi（约 1 分钟）→ dsh（headless，分钟级且为阻塞调用）。本地 JS 只在两者皆不可用时兜底。
const ENGINE_MODEL = process.env.WORKBENCH_ENGINE_MODEL || 'deepseek-v4-flash';
const ENGINE_TMP = path.join(BUNDLE_ROOT, 'reports/.tmp');
function skillFileFor(skill) {
  const base = path.join(BUNDLE_ROOT, 'templates/skills-domain');
  if (!fs.existsSync(base)) return null;
  for (const d of fs.readdirSync(base)) {
    const p = path.join(base, d, `SKILL-${skill}.md`);
    if (fs.existsSync(p)) return path.relative(BUNDLE_ROOT, p).replace(/\\/g, '/');
  }
  return null;
}
function bashRun(cmd, prompt, extraEnv, timeoutMs) {
  fs.mkdirSync(ENGINE_TMP, { recursive: true });
  const pf = path.join(ENGINE_TMP, `engine-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(pf, prompt, 'utf8');
  try {
    return execFileSync('bash', ['-lc', cmd], {
      encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, cwd: BUNDLE_ROOT,
      env: { ...process.env, ...extraEnv, GT_PROMPT: path.relative(BUNDLE_ROOT, pf).replace(/\\/g, '/') },
    });
  } finally { try { fs.unlinkSync(pf); } catch { /* 清理失败不影响判定 */ } }
}
export function engineRun(skill, prompt) {
  const engines = [
    ['pi', () => {
      const key = process.env.DEEPSEEK_API_KEY || '';
      if (!key) throw new Error('缺少 DEEPSEEK_API_KEY（pi 全局凭据已失效，须显式传入）');
      const sf = skillFileFor(skill);
      const out = bashRun(`pi --provider deepseek --model ${ENGINE_MODEL} --api-key "$GT_KEY" --tools read,write${sf ? ` --skill "${sf}"` : ''} -p --mode json "$(cat "$GT_PROMPT")"`,
        `执行技能 ${skill}：${prompt}`, { GT_KEY: key }, 240000);
      const fin = String(out).trim().split(/\r?\n/).map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter((j) => j && j.type === 'message_end' && j.message && j.message.role === 'assistant' && j.message.stopReason !== 'pending').pop();
      if (!fin) throw new Error('无 assistant 消息');
      if (fin.message.errorMessage) throw new Error(String(fin.message.errorMessage).slice(0, 120));
      if (fin.message.stopReason !== 'stop' || !(fin.message.usage && fin.message.usage.totalTokens > 0)) {
        throw new Error(`模型未真实执行（stop=${fin.message.stopReason} tokens=${fin.message.usage && fin.message.usage.totalTokens}）`);
      }
      const text = (fin.message.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ');
      return { out: text, model: fin.message.model, tokens: fin.message.usage.totalTokens };
    }],
    ['dsh', () => {
      const out = bashRun('dsh exec "$(cat "$GT_PROMPT")"', `执行技能 ${skill}：${prompt}`, {}, 240000);
      const t = String(out).trim();
      if (!t) throw new Error('dsh stdout 为空');
      if (/Authentication Fails|invalid|401|403/.test(t)) throw new Error('dsh 鉴权/请求失败：' + t.slice(0, 100));
      return { out: t, model: 'dsh-headless' };
    }],
  ];
  for (const [name, fn] of engines) {
    try {
      const r = fn();
      audit('engine.run', { engine: name, skill, ok: true, model: r.model, tokens: r.tokens });
      return { engine: name, output: String(r.out).slice(0, 4000), model: r.model, fallback: false };
    } catch (e) { audit('engine.run', { engine: name, skill, ok: false, err: String(e.message).slice(0, 120) }); }
  }
  audit('engine.run', { engine: 'local', skill, fallback: 'offline' });
  return { engine: 'local', fallback: true, output: '[offline fallback：引擎不可达或凭据无效——已按断网降级记录]' };
}

// —— P1 数据层：每域真实数据资产（templates/workspace/data/<domain>/*.csv）——
function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!lines.length) return { head: [], rows: [] };
  const split = (l) => {
    const out = []; let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur); return out;
  };
  return { head: split(lines[0]), rows: lines.slice(1).map(split) };
}
export function domainData(domain) {
  const dir = path.join(DATA, domain);
  if (!fs.existsSync(dir)) return { domain, tables: [], source_note: '无数据资产' };
  const tables = fs.readdirSync(dir).filter((f) => f.endsWith('.csv')).map((f) => {
    const { head, rows } = parseCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { name: f.replace('.csv', ''), head, rows };
  });
  return { domain, tables, source_note: '合成冷启动数据（与 Type-Dict 脱敏口径一致；真实数据就位后替换）' };
}
// —— P1/P3 提交与产物：任何提交/运行都落 deliverables/<domain>/ + 审计 ——
export function writeDeliverable(domain, kind, doc) {
  const dir = path.join(DELIV, domain);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${kind}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  const body = { domain, kind, created_at: new Date().toISOString(), ...doc };
  fs.writeFileSync(path.join(dir, file), JSON.stringify(body, null, 1), 'utf8');
  audit('deliverable.create', { domain, kind, file, fields: Object.keys(doc.fields || doc).length });
  return { file: `${domain}/${file}`, path: `templates/workspace/deliverables/${domain}/${file}` };
}
export function submitDeliverable(domain, kind, payload) {
  return writeDeliverable(domain, kind, { fields: payload || {}, status: 'submitted' });
}
export function listDeliverables() {
  const out = {};
  if (!fs.existsSync(DELIV)) return out;
  for (const d of fs.readdirSync(DELIV)) {
    const dir = path.join(DELIV, d);
    if (!fs.statSync(dir).isDirectory()) continue;
    out[d] = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
      const st = fs.statSync(path.join(dir, f));
      return { file: f, bytes: st.size, mtime: st.mtime.toISOString() };
    }).sort((a, b) => b.mtime.localeCompare(a.mtime));
  }
  return out;
}
// —— P2 工作流：读 index.json（gen-workflows.mjs 生成），发起即产标准交付物 ——
// —— 独立应用托管（P5 桥接）：把构建产物 app.html 经同源路由递出去 ——
// 动机：壳页面在 http://127.0.0.1:3810，浏览器禁止从 http 页跳 file://，故面板无法直接打开本地 app.html。
// 由插件（与壳同源）托管它，面板即可用相对路径打开，用户不必手动找文件。
export function appPage() {
  const p = path.join(BUNDLE_ROOT, 'app.html');
  if (!fs.existsSync(p)) return '<!DOCTYPE html><meta charset="utf-8"><body style="font:15px system-ui;padding:24px">app.html 尚未构建：请先运行 <code>node scripts/build-app.mjs</code></body>';
  return fs.readFileSync(p, 'utf8');
}

export function workflowsIndex() {  if (!fs.existsSync(WF_INDEX)) return { count: 0, by_domain: {}, workflows: [] };
  return JSON.parse(fs.readFileSync(WF_INDEX, 'utf8'));
}
export function runWorkflow(id, payload) {
  const idx = workflowsIndex();
  const wf = (idx.workflows || []).find((w) => w.workflow_id === id || w.workflow_id.split('@')[0] === id);
  if (!wf) throw new Error(`workflow not found: ${id}`);
  // 交付物按 deliverable spec 生成：字段来自 payload + 域数据快照；引擎可执行时由 engineRun 补充结论
  const eng = engineRun(wf.skill, `${wf.description}（工作流 ${wf.workflow_id}）`);
  const doc = {
    workflow: wf.workflow_id, description: wf.description, fields: { ...(payload || {}) },
    deliverable_spec: wf.deliverable, engine: { name: eng.engine, fallback: !!eng.fallback, output: eng.fallback ? undefined : String(eng.output || '').slice(0, 1500) },
    data_snapshot: domainData(wf.domain).tables.map((t) => ({ table: t.name, rows: t.rows.length })),
  };
  const d = writeDeliverable(wf.domain, wf.workflow_id.split('@')[0].replace('.', '-'), doc);
  audit('workflow.run', { workflow: wf.workflow_id, engine: eng.engine, fallback: !!eng.fallback, deliverable: d.file });
  return { workflow: wf.workflow_id, engine: eng.engine, fallback: !!eng.fallback, deliverable: d, spec: wf.deliverable };
}
// —— P4 按钮三件套：tools-versions / 回退演练（dry-run）/ preset 新建·编辑 / 按钮清单 ——
export function toolsVersions() {
  return { content: fs.existsSync(TOOLS_VERSIONS) ? fs.readFileSync(TOOLS_VERSIONS, 'utf8') : '(missing)' };
}
export function rollbackDryRun() {
  const tv = toolsVersions().content;
  const plan = [
    { step: 1, action: '锁定当前版本快照（tools-versions.txt + 引擎 0.1.7-rc.2 + 插件 profile package.json）' },
    { step: 2, action: 'dsh savepoint create（pre-rollback 快照；dsh-undo-savepoint 已装入）' },
    { step: 3, action: '替换 offline/npm 引擎 tarball 为上一版本并 npm i -g 重装' },
    { step: 4, action: '重启 dsh web → 十要素冒烟（verify）→ GT 回归' },
    { step: 5, action: '失败则 savepoint restore 回到本步前状态（C5 卸载可逆）' },
  ];
  audit('rollback.dryrun', { steps: plan.length, tools_versions_bytes: tv.length });
  return { dry_run: true, plan, tools_versions_bytes: tv.length };
}
export function presetNew(base, name) {
  if (!name || !/^[A-Za-z0-9_.-]{3,40}$/.test(name)) throw new Error('preset 名称需 3-40 位字母数字.-_');
  const ctx = applyScene(base);
  const file = `derived-${name}-${Date.now()}.json`;
  const doc = { ...ctx, derived: true, base_scene: base, name, edited_at: ctx.applied_at };
  fs.writeFileSync(path.join(STATE, file), JSON.stringify(doc, null, 1));
  audit('preset.new', { base, name, file });
  return { file, name, base };
}
export function presetEdit(file, changes) {
  const p = path.join(STATE, path.basename(String(file || '')));
  if (!fs.existsSync(p)) throw new Error(`preset file not found: ${file}`);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(changes || {})) doc[k] = v;
  doc.edited_at = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(doc, null, 1));
  audit('preset.edit', { file: path.basename(p), keys: Object.keys(changes || {}) });
  return { file: path.basename(p), applied: Object.keys(changes || {}) };
}
// 按钮三件套清单（前端 F11 页渲染；新增按钮必须在此登记，缺 route/audit 不允许上屏）
export const BUTTON_MANIFEST = [
  { id: 'preset-apply', label: '选/用（apply）', route: 'POST /workbench/api/apply', audit: 'preset.apply' },
  { id: 'preset-save', label: '存（save）', route: 'POST /workbench/api/save', audit: 'preset.save' },
  { id: 'preset-switch', label: '切（switch）', route: 'POST /workbench/api/switch', audit: 'preset.switch' },
  { id: 'preset-new', label: '新建（派生 Scene）', route: 'POST /workbench/api/preset-new', audit: 'preset.new' },
  { id: 'preset-edit', label: '编辑当前 preset', route: 'POST /workbench/api/preset-edit', audit: 'preset.edit' },
  { id: 'gt-engine', label: '跑一次 GT（经引擎）', route: 'POST /workbench/api/engine-run', audit: 'engine.run' },
  { id: 'wf-run', label: '工作流·发起', route: 'POST /workbench/api/workflow-run', audit: 'workflow.run + deliverable.create' },
  { id: 'domain-submit', label: '域表单·提交', route: 'POST /workbench/api/submit', audit: 'deliverable.create' },
  { id: 'f7-check', label: 'F7 网络自检', route: 'GET /workbench/api/scenes', audit: '（读操作）' },
  { id: 'f8-tools', label: 'F8 查看 tools-versions', route: 'GET /workbench/api/tools-versions', audit: '（读操作）' },
  { id: 'f8-rollback', label: 'F8 回退演练（dry-run）', route: 'POST /workbench/api/rollback-dryrun', audit: 'rollback.dryrun' },
  { id: 'f11-report', label: 'F11 自检报告', route: 'GET /workbench/api/audit', audit: '（读操作）' },
  { id: 'delivery-all', label: '生成全部交付格式', route: 'POST /workbench/api/deliver', audit: 'deliverable.package.create' },
  { id: 'delivery-format', label: '生成单格式交付物', route: 'POST /workbench/api/deliver', audit: 'deliverable.package.create' },
];
export function buttonManifest() { return BUTTON_MANIFEST; }

// —— 域清单（U15 逐域差异化：与 manifests/domain-ui-checklist.csv 同源）——
export function domainChecklist() {
  const f = path.join(BUNDLE_ROOT, 'manifests/domain-ui-checklist.csv');
  if (!fs.existsSync(f)) return {};
  const out = {};
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const c = line.split(',');
    if (c.length < 2 || !c[0].trim()) continue;
    out[c[0].trim()] = c[1].split(';').map((s) => s.trim()).filter(Boolean);
  }
  return out;
}
export function auditTail(n = 200) {
  const dir = AUDIT;
  if (!fs.existsSync(dir)) return [];
  const day = new Date().toISOString().slice(0, 10);
  const f = path.join(dir, `audit-${day}.jsonl`);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).slice(-n).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
export function auditStats() {
  const rows = auditTail(5000);
  const s = {};
  for (const r of rows) s[r.action] = (s[r.action] || 0) + 1;
  return s;
}

// —— 宿主路由（真实注册：WebRoute = { kind, path, handler(req,res) }，经 ctx.webServer.register ——
const json = (res, code, body) => {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': buf.length });
  res.end(buf);
};
const readBody = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 2e6) req.destroy(); });
  req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
});
const query = (req, key) => { try { return new URL(req.url, 'http://x').searchParams.get(key) || ''; } catch { return ''; } };
function registerDeliveryTool(ctx) {
  if (!ctx?.tools || typeof ctx.tools.register !== 'function') return null;
  const disposer = ctx.tools.register({
    name: 'workbench_deliver',
    description: 'Generate a real multi-format delivery package for one Universal Workbench domain. Produces Markdown, CSV, HTML, XLSX, DOCX, PPTX and PDF files from the domain seed data and representative workflow, with a hashed manifest.',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', enum: DOMAINS, description: 'Workbench domain id.' },
        formats: {
          type: 'array',
          items: { type: 'string', enum: DELIVERY_FORMATS },
          description: 'Requested formats. Omit to generate all supported formats.',
        },
        workflowId: { type: 'string', description: 'Optional workflow id; defaults to the domain delivery profile.' },
        title: { type: 'string', description: 'Optional delivery package title.' },
      },
      required: ['domain'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render(_args, value) {
        const lines = [
          `交付包已生成：${value.domain} / ${value.runId}`,
          `清单：${value.manifestPath}`,
          ...((value.artifacts || []).map((item) => `${item.format.toUpperCase()} ${item.file} bytes=${item.bytes} sha256=${item.sha256}`)),
        ];
        return [{ type: 'text', text: lines.join('\n') }];
      },
    },
    execute: async (args) => (await deliveryService()).deliverDomain(args || {}),
  });
  audit('tool.register', { name: 'workbench_deliver', ok: true });
  return disposer;
}
export function makeRoutes() {
  const exact = (path, fn) => ({
    kind: 'exact', path,
    handler: async (req, res) => { try { await fn(req, res); } catch (e) { json(res, 500, { error: String(e && e.message || e) }); } },
  });
  return [
    exact('/workbench/api/scenes', (req, res) => json(res, 200, listScenes())),
    exact('/workbench/api/current', (req, res) => json(res, 200, current())),
    exact('/workbench/api/domains', (req, res) => json(res, 200, domainChecklist())),
    exact('/workbench/api/audit', (req, res) => json(res, 200, { stats: auditStats(), tail: auditTail(200) })),
    exact('/workbench/api/apply', async (req, res) => json(res, 200, applyScene((await readBody(req)).id))),
    exact('/workbench/api/switch', async (req, res) => json(res, 200, switchScene((await readBody(req)).id))),
    exact('/workbench/api/save', async (req, res) => json(res, 200, { saved: savePreset(), stats: auditStats() })),
    exact('/workbench/api/engine-run', async (req, res) => {
      const b = await readBody(req);
      json(res, 200, engineRun(b.skill || 'smoke', b.prompt || ''));
    }),
    // —— 3.0 复盘增补 ——
    exact('/workbench/api/data', (req, res) => json(res, 200, domainData(query(req, 'domain') || 'sales'))),
    exact('/workbench/api/submit', async (req, res) => {
      const b = await readBody(req);
      json(res, 200, submitDeliverable(b.domain || 'admin', b.kind || 'form-submit', b.payload || {}));
    }),
    exact('/workbench/api/workflows', (req, res) => json(res, 200, workflowsIndex())),
    exact('/workbench/api/workflow-run', async (req, res) => {
      const b = await readBody(req);
      json(res, 200, runWorkflow(b.id || '', b.payload || {}));
    }),
    exact('/workbench/api/deliverables', (req, res) => json(res, 200, listDeliverables())),
    exact('/workbench/api/tools-versions', (req, res) => json(res, 200, toolsVersions())),
    exact('/workbench/api/rollback-dryrun', async (req, res) => json(res, 200, rollbackDryRun())),
    exact('/workbench/api/preset-new', async (req, res) => {
      const b = await readBody(req);
      json(res, 200, presetNew(b.base || (current().current || 'sales.quote-approval'), b.name || ''));
    }),
    exact('/workbench/api/preset-edit', async (req, res) => {
      const b = await readBody(req);
      json(res, 200, presetEdit(b.file, b.changes || {}));
    }),
    exact('/workbench/api/buttons', (req, res) => json(res, 200, buttonManifest())),
    // —— 原生驾驶舱统一交付：HTTP 与聊天工具共用 delivery-service ——
    exact('/workbench/api/deliver', async (req, res) => {
      const b = await readBody(req);
      json(res, 200, await (await deliveryService()).deliverDomain(b || {}));
    }),
    exact('/workbench/api/artifacts', async (req, res) => json(res, 200, (await deliveryService()).listDeliveries(query(req, 'domain') || null))),
    exact('/workbench/api/artifact', async (req, res) => {
      const artifact = (await deliveryService()).resolveArtifact(query(req, 'id'));
      const encoded = encodeURIComponent(artifact.filename);
      res.writeHead(200, {
        'content-type': artifact.mime,
        'content-length': fs.statSync(artifact.file).size,
        'cache-control': 'private, max-age=60',
        'content-disposition': `attachment; filename="artifact.${artifact.format}"; filename*=UTF-8''${encoded}`,
      });
      fs.createReadStream(artifact.file).pipe(res);
    }),
    // —— P5 桥接：同源托管独立应用 ——
    // 壳页面在 http://127.0.0.1:3810，浏览器禁止 http 页跳 file://，面板无法直接打开本地 app.html；
    // 由壳同源托管后，面板用相对路径即可打开，用户不必自己去文件系统里找。用 res 直写以拿到 text/html。
    exact('/workbench/api/app-page', (req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(appPage());
    }),
  ];
}

// —— cordis 插件入口（契约：必须导出 apply；范本 lib/index.js:5656 `export { ..., apply }`）——
export function apply(ctx, config) {
  const disposers = [];
  const registerRoutes = (serverCtx) => {
    if (!serverCtx?.webServer || typeof serverCtx.webServer.register !== 'function') return;
    for (const route of makeRoutes()) disposers.push(serverCtx.webServer.register(route));
  };
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], registerRoutes);
    ctx.inject(['tools'], (toolsCtx) => {
      const toolDisposer = registerDeliveryTool(toolsCtx);
      if (toolDisposer) disposers.push(toolDisposer);
    });
  } else {
    registerRoutes(ctx);
    const toolDisposer = registerDeliveryTool(ctx);
    if (toolDisposer) disposers.push(toolDisposer);
  }
  audit('plugin.apply', { ok: true, disposers: disposers.length, mode: 'service-deferred' });
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => { while (disposers.length) { const d = disposers.pop(); try { if (typeof d === 'function') d(); } catch { /* ignore */ } } });
  }
}
export const inject = [];
export default { apply, inject, makeRoutes, listScenes, applyScene, switchScene, savePreset, engineRun, domainChecklist, auditStats, domainData, submitDeliverable, listDeliverables, workflowsIndex, runWorkflow, toolsVersions, rollbackDryRun, presetNew, presetEdit, buttonManifest, deliveryService };
