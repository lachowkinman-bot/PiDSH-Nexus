#!/usr/bin/env node
// engine-skill-runner.mjs — U18 整合深度参考实现（015 v2.2 §15.1）
// 职责：工作流 skill 节点经 pi / dsh 引擎 CLI 执行（替代 2.0 的"本地确定性 JS"路径）；
//       审计事件 engine.run；断网/引擎不可用时降级本地并标注 fallback=offline（降级率>50%=U18 FAIL）
// 用法：
//   node scripts/engine-skill-runner.mjs --run <skill> "<prompt>"   # 经引擎执行一次 skill 节点
//   node scripts/engine-skill-runner.mjs --both <skill> "<prompt>"  # 双引擎各跑一次（U18 双引擎口径）
//   node scripts/engine-skill-runner.mjs --self-test                # 干跑自检（不发真实请求）
//
// 【成功判据 — 2026-09-29 修正】原实现以"子进程退出码 0"判定成功。实测 pi 在内部模型调用
//   401 失败时仍 exit 0，故该判据会把"模型实际未执行"记成 fallback=false（U18 假绿）。
//   现改为**模型级判据**：pi 要求 JSON 流中以 stopReason=stop 结束且 totalTokens>0 的 assistant 消息；
//   dsh 要求 stdout 非空且不含鉴权失败特征。二者不满足即视为该引擎失败，继续降级链。
//
// 凭据：key 取自环境变量 DEEPSEEK_API_KEY（不落盘、不进命令行字符串，经子进程 env 传递）。
// 引擎：dsh（本机 `.dsh-home/profiles/exec`，由 `dsh exec --from-default-profile headless` 生成）
//       → pi（--provider deepseek --model <WORKBENCH_ENGINE_MODEL|deepseek-v4-flash>）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const AUDIT_DIR = path.join(ROOT, 'templates/workspace/audit');
const TMP_DIR = path.join(ROOT, 'reports/.tmp');
const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'runner-profile.json'), 'utf8'));
const MODEL = process.env.WORKBENCH_ENGINE_MODEL || 'deepseek-v4-flash';

function audit(event, detail) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  fs.appendFileSync(path.join(AUDIT_DIR, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`),
    JSON.stringify({ ts: new Date().toISOString(), action: event, ...detail }) + '\n');
}
// prompt 落临时文件、key 走子进程 env：避免多行 prompt 的 shell 转义问题与命令行泄密
function runViaBash(cmd, { prompt, extraEnv = {}, timeoutMs = 180000 }) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const pf = path.join(TMP_DIR, `engine-prompt-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(pf, prompt, 'utf8');
  const rel = path.relative(ROOT, pf).replace(/\\/g, '/');
  try {
    return execFileSync('bash', ['-lc', cmd(rel)], {
      encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, cwd: ROOT,
      env: { ...process.env, ...extraEnv },
    });
  } finally { try { fs.unlinkSync(pf); } catch { /* 清理失败不影响判定 */ } }
}
function parsePiStream(stream) {
  let final = null;
  for (const l of String(stream).trim().split(/\r?\n/)) {
    let j; try { j = JSON.parse(l); } catch { continue; }
    if (j.type === 'message_end' && j.message && j.message.role === 'assistant' && j.message.stopReason !== 'pending') final = j.message;
  }
  if (!final) throw new Error('无 assistant 消息');
  if (final.errorMessage) throw new Error(String(final.errorMessage).slice(0, 140));
  if (final.stopReason !== 'stop') throw new Error(`stopReason=${final.stopReason}`);
  if (!(final.usage && final.usage.totalTokens > 0)) throw new Error('totalTokens=0（未发生真实模型调用）');
  const text = (final.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ');
  if (!text.trim()) throw new Error('模型正文为空');
  return { text, tokens: final.usage.totalTokens, cost: (final.usage.cost && final.usage.cost.total) || 0, model: final.model };
}
function viaDsh(skill, prompt) {
  // dsh headless 的 agent 会真实探索工作区，耗时可达数分钟；超时过短会把"慢"误判成"不可用"
  const out = runViaBash((rel) => `dsh exec "$(cat "${rel}")"`,
    { prompt: `执行技能 ${skill}：${prompt}`, timeoutMs: 420000 });
  const t = String(out).trim();
  if (!t) throw new Error('dsh stdout 为空');
  if (/Authentication Fails|invalid|401|403/.test(t)) throw new Error('dsh 鉴权/请求失败：' + t.slice(0, 120));
  return { engine: 'dsh', output: t.slice(0, 4000), model: 'dsh-headless/0.1.7-rc.2' };
}
// 解析场景声明的技能文件（templates/skills-domain/<域>/SKILL-<skill>.md）——
// 引擎必须装载该文件，"执行技能 X" 才是真的执行了技能 X 而不是只提了个名字
function skillFileFor(skill) {
  const base = path.join(ROOT, 'templates/skills-domain');
  if (!fs.existsSync(base)) return null;
  for (const d of fs.readdirSync(base)) {
    const p = path.join(base, d, `SKILL-${skill}.md`);
    if (fs.existsSync(p)) return path.relative(ROOT, p).replace(/\\/g, '/');
  }
  return null;
}
function viaPi(skill, prompt) {
  const key = process.env.DEEPSEEK_API_KEY || '';
  if (!key) throw new Error('缺少 DEEPSEEK_API_KEY（pi 的全局凭据已失效，需显式传入）');
  const sf = skillFileFor(skill);
  const skillArg = sf ? ` --skill "${sf}"` : '';
  const out = runViaBash(
    (rel) => `pi --provider deepseek --model ${MODEL} --api-key "$GT_KEY" --tools read,write${skillArg} -p --mode json "$(cat "${rel}")"`,
    { prompt: `执行技能 ${skill}：${prompt}`, extraEnv: { GT_KEY: key } });
  const r = parsePiStream(out);
  return { engine: 'pi', output: r.text.slice(0, 4000), model: r.model, tokens: r.tokens, cost: r.cost, skill_file: sf };
}
export function runSkill(skill, prompt, { allowFallback = true, engines: only } = {}) {
  const chain = profile.runner === 'dsh' ? [viaDsh, viaPi] : [viaPi, viaDsh];
  const engines = only ? chain.filter((f) => f.name === only) : chain;
  const tried = [];
  for (const fn of engines) {
    try {
      const r = fn(skill, prompt);
      audit('engine.run', { engine: r.engine, skill, ok: true, model: r.model, tokens: r.tokens });
      return { ...r, fallback: false, tried };
    } catch (e) {
      const msg = String(e.message).slice(0, 140);
      tried.push(`${fn.name}:${msg}`);
      audit('engine.run', { engine: fn.name.replace('via', '').toLowerCase(), skill, ok: false, err: msg });
    }
  }
  if (!allowFallback) throw new Error('ENGINE_UNAVAILABLE :: ' + tried.join(' | '));
  audit('engine.run', { engine: 'local', skill, fallback: 'offline', tried });
  return { engine: 'local', fallback: true, tried, output: '[offline fallback] 本地确定性执行（U18 降级路径，降级率须 <50%）' };
}
function selfTest() {
  audit('engine.run', { engine: 'dry-run', skill: 'self-test', ok: true });
  const line = fs.readFileSync(path.join(AUDIT_DIR, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`), 'utf8').trim().split('\n').pop();
  if (!line.includes('engine.run')) throw new Error('审计通道故障');
  console.log(`SELF_TEST_OK runner=${profile.runner} model=${MODEL} 判据=模型级(stop+totalTokens>0) audit=engine.run`);
}
const args = process.argv.slice(2);
if (args.includes('--self-test')) { try { selfTest(); } catch (e) { console.error('SELF_TEST_FAIL:', e.message); process.exit(1); } }
else if (args.includes('--both')) {
  const skill = args[args.indexOf('--both') + 1], prompt = args[args.indexOf('--both') + 2] || '';
  for (const e of ['viaDsh', 'viaPi']) {
    try { console.log(e, JSON.stringify(runSkill(skill, prompt, { engines: e })).slice(0, 300)); }
    catch (err) { console.log(e, 'FAIL ' + err.message); }
  }
} else if (args.includes('--run')) {
  try { console.log(JSON.stringify(runSkill(args[args.indexOf('--run') + 1], args[args.indexOf('--run') + 2] || ''), null, 1)); }
  catch (e) { console.error('RUN_FAIL', e.message); process.exit(1); }
} else console.log('用法：--run <skill> "<prompt>" | --both <skill> "<prompt>" | --self-test');
