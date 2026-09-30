#!/usr/bin/env node
// benchmark-run.mjs — U17 质量对标执行器（015 §14.4 + docs/benchmark-comparison-protocol.md）
// 同一任务集（manifests/benchmark-tasks.csv，10 条固定）由工作台与可核验基准 agent 分别执行，
// 产物留档 reports/benchmark-artifacts/<agent>/<T>/，脚本按五维 rubric 判分（0-5），人工抽检列单独留位。
// 用法：
//   node scripts/benchmark-run.mjs --arms workbench,pi,dsh,codex [--tasks T1,T5] [--model M]
//   node scripts/benchmark-run.mjs --score      # 依据已落档产物重算分并出报告骨架
// 判分纪律（§5 同一数据/同一判定人；脚本判 + 人工抽检双轨）：
//   correctness=产物是否含该任务的关键要素（逐任务要素表）；quality=结构完整度（标题/要点/数字）；
//   usability=是否一次跑成（无重试）；approval_behavior=任务要求审批/脱敏时是否体现（不该停的乱停也扣）；
//   cost=token 分位折算。semantica/muzz 类不可核验基准不进对比集（V8）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const ART = path.join(ROOT, 'reports/benchmark-artifacts');
const MODEL = process.env.WORKBENCH_ENGINE_MODEL || 'deepseek-v4-flash';

// 逐任务关键要素（correctness 判据）与"是否要求审批/脱敏行为"（approval_behavior 判据）
const SPEC = {
  T1: { need: ['漏斗', '转化', '周'], gate: false },
  T2: { need: ['带宽', '区间', '偏离'], gate: true },
  T3: { need: ['调薪', '审批', '双'], gate: true },
  T4: { need: ['入职', '培训', '绩效', '行政'], gate: false },
  T5: { need: ['EAP', '匿名', '转介'], gate: true },
  T6: { need: ['PPT', '大纲', '页'], gate: false },
  T7: { need: ['恢复', '续跑', '状态'], gate: false },
  T8: { need: ['熔断', '失败', '停'], gate: false },
  T9: { need: ['安装', '调用', '卸载'], gate: false },
  T10: { need: ['30 天', '计划', '里程碑'], gate: false },
};
const tasks = () => fs.readFileSync(path.join(ROOT, 'manifests/benchmark-tasks.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
  .map((l) => { const [id, domain, task] = l.match(/(".*?"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, '').replace(/^"|"$/g, '')); return { id, domain, task }; });

// 任务 → 工作台工作流映射。工作台臂必须走**工作台自己的层**（技能 + 交付规范 + 审批/脱敏 + 审计），
// 否则与裸 pi 臂同构、A/B 无意义（§14.6 禁"本地 JS=引擎整合"式同义替换）。
// 未映射的任务（平台级能力，如离线 PPTX/崩溃恢复/熔断/装包卸载/文档生成）需专用夹具，
// 未接入则该任务在工作台臂记为 not_applicable，如实进入报告，不得用 pi 臂冒名顶替。
const WB = { T1: 'rec.funnel-weekly@1.0.0', T2: 'comp.salary-adjust@1.0.0', T3: 'comp.queue-approve@1.0.0', T5: 'er-eap.eap-referral@1.0.0', T10: 'strat.weekly-report@1.0.0' };
async function viaWorkbenchApi(taskId, timeoutMs) {
  const wf = WB[taskId];
  if (!wf) return { ok: false, text: '(not_applicable：该任务无工作台工作流映射，平台级夹具未接入)', err: 'not_applicable', ms: 0 };
  const t0 = Date.now();
  try {
    const res = await fetch('http://127.0.0.1:3810/workbench/api/workflow-run', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: wf }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const j = await res.json();
    const ok = res.ok && j.engine && !j.fallback;
    // 工作台臂真正的"产物"是它落盘的交付物，而不是 API 的短 JSON 回执——按交付物判分才有意义
    return { ok, text: JSON.stringify(j, null, 1), err: ok ? null : `engine=${j.engine} fallback=${j.fallback}`, ms: Date.now() - t0, engine: j.engine, workflow: wf, deliverablePath: j.deliverable && j.deliverable.path };
  } catch (e) { return { ok: false, text: '(工作台 API 不可达)', err: String(e.message).slice(0, 120), ms: Date.now() - t0 }; }
}
// 逐任务的数据落点（**必须给出具体路径**：协议要求"同一数据"。
// 早期版本在 prompt 里写占位符 templates/workspace/data/<域>/，导致裸基准 agent 逐个猜测目录名
// （hr/recruiting/招聘/…）直至超时——那是夹具缺陷不是 agent 缺陷，会让 A/B 失去可比性。）
const DATA = {
  T1: ['templates/workspace/data/rec/'],
  T2: ['templates/workspace/data/comp/'],
  T3: ['templates/workspace/data/comp/'],
  T4: ['templates/workspace/data/rec/', 'templates/workspace/data/trn/', 'templates/workspace/data/prf/', 'templates/workspace/data/admin/'],
  T5: ['templates/workspace/data/er-eap/'],
  T6: [], T7: [], T8: [], T9: [], T10: [],
};
function dataHint(id) {
  const dirs = (DATA[id] || []).filter((d) => fs.existsSync(path.join(ROOT, d)));
  if (!dirs.length) return '本任务不依赖预置数据文件，请基于通用业务知识直接产出。';
  const files = dirs.flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.csv')).map((f) => d + f));
  return `本次任务可用的数据文件（请用 read 工具读取后再分析，结论须可追溯到这些文件）：${files.join('、')}`;
}
function runEngine(agent, prompt, timeoutMs) {
  const key = process.env.DEEPSEEK_API_KEY || '';
  const tmp = path.join(ROOT, 'reports/.tmp'); fs.mkdirSync(tmp, { recursive: true });
  const pf = path.join(tmp, `bench-${agent}-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(pf, prompt, 'utf8');
  const rel = path.relative(ROOT, pf).replace(/\\/g, '/');
  let cmd;
  if (agent === 'pi') cmd = `pi --provider deepseek --model ${MODEL} --api-key "$GT_KEY" --tools read,write -p "$(cat "${rel}")"`;
  else if (agent === 'dsh') cmd = `dsh exec "$(cat "${rel}")"`;
  else if (agent === 'codex') cmd = `codex exec "$(cat "${rel}")"`;
  else throw new Error(`未知基准臂：${agent}（禁止用其他臂冒名顶替）`);
  const t0 = Date.now();
  try {
    const out = execFileSync('bash', ['-lc', cmd], { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, cwd: ROOT, env: { ...process.env, GT_KEY: key } });
    return { ok: true, text: String(out), ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, text: String(e.stdout || ''), err: String(e.message).slice(0, 160), ms: Date.now() - t0 };
  } finally { try { fs.unlinkSync(pf); } catch { /* 清理失败不影响判定 */ } }
}
async function run(arms, only) {
  const list = tasks().filter((t) => !only.length || only.includes(t.id));
  for (const agent of arms) {
    for (const t of list) {
      const dir = path.join(ART, agent, t.id); fs.mkdirSync(dir, { recursive: true });
      const prompt = `你是企业工作台/agent。完成任务：${t.task}。\n${dataHint(t.id)}`
        + `\n请直接输出可交付的成果正文（中文 markdown），若涉及审批或脱敏请在文中明确说明。`;
      const timeoutMs = agent === 'dsh' ? 420000 : 240000;
      const r = agent === 'workbench' ? await viaWorkbenchApi(t.id, 300000) : runEngine(agent, prompt, timeoutMs);
      // 工作台臂以落盘交付物为判分对象；其余臂以引擎 stdout 为判分对象
      let judged = r.text;
      if (agent === 'workbench' && r.deliverablePath) {
        const dp = path.join(ROOT, r.deliverablePath);
        if (fs.existsSync(dp)) judged = fs.readFileSync(dp, 'utf8');
      }
      fs.writeFileSync(path.join(dir, 'output.md'), judged || '(空)', 'utf8');
      // 去噪：dsh 的 reasoning 流只留最终答复段
      const body = String(judged || '').replace(/^(?:[a-z]+: reasoning:[\s\S]*?)(?=\n[A-Z\u4e00-\u9fa5#*]|$)/gm, '');
      const need = SPEC[t.id].need;
      const hit = need.filter((k) => body.includes(k));
      const numbers = (body.match(/\d+(\.\d+)?/g) || []).length;
      const headings = (body.match(/^#{1,3}\s/gm) || []).length;
      const gate = SPEC[t.id].gate;
      const gateHit = gate ? /审批|脱敏|双签|双审批|匿名|redact/i.test(body) : !/无法|不能|拒绝/.test(body);
      const score = {
        correctness: Math.round(5 * hit.length / need.length),
        usability: r.ok ? 5 : 1,
        quality: Math.min(5, Math.max(1, Math.round((headings >= 3 ? 3 : headings) + Math.min(2, numbers / 10)))),
        approval_behavior: gateHit ? 5 : 1,
        cost: null,
      };
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ agent, task: t.id, ok: r.ok, err: r.err || null, ms: r.ms, chars: body.length, hits: hit, need, headings, numbers, scores: score, prompt, cmd: agent }, null, 1));
      console.log(`${agent.padEnd(10)} ${t.id.padEnd(4)} ${r.ok ? 'ok ' : 'ERR'} chars=${String(body.length).padStart(6)} hit=${hit.length}/${need.length} ${Math.round(r.ms / 1000)}s`);
    }
  }
}
function score() {
  const agents = fs.existsSync(ART) ? fs.readdirSync(ART) : [];
  const rows = [];
  for (const a of agents) for (const t of fs.readdirSync(path.join(ART, a)).sort()) {
    const mp = path.join(ART, a, t, 'meta.json'); if (!fs.existsSync(mp)) continue;
    const m = JSON.parse(fs.readFileSync(mp, 'utf8')); rows.push({ agent: a, task: t, ...m.scores, ms: m.ms, chars: m.chars, err: m.err });
  }
  // cost：按各 agent 平均耗时在全体中的分位折算（越快越高）
  const byAgent = {}; for (const r of rows) (byAgent[r.agent] = byAgent[r.agent] || []).push(r);
  const avg = Object.fromEntries(Object.entries(byAgent).map(([a, v]) => [a, v.reduce((s, x) => s + (x.ms || 0), 0) / v.length]));
  const times = Object.values(avg).sort((x, y) => x - y);
  for (const r of rows) { const p = times.indexOf(avg[r.agent]) / Math.max(1, times.length - 1); r.cost = Math.round(5 * (1 - p)); }
  fs.writeFileSync(path.join(ROOT, 'reports/benchmark-scores.json'), JSON.stringify({ generated_at: new Date().toISOString(), model: MODEL, avg_ms_by_agent: avg, rows }, null, 1));
  const dims = ['correctness', 'usability', 'quality', 'approval_behavior', 'cost'];
  const sum = {};
  for (const a of Object.keys(byAgent)) {
    const v = byAgent[a]; sum[a] = { n: v.length, mean: +(dims.reduce((s, d) => s + v.reduce((x, r) => x + (r[d] || 0), 0) / v.length, 0) / dims.length).toFixed(2), zero_dims: dims.filter((d) => v.some((r) => (r[d] || 0) === 0)) };
  }
  console.log('agent      n  mean  zero_dims');
  for (const [a, s] of Object.entries(sum)) console.log(`${a.padEnd(10)} ${s.n}  ${String(s.mean).padEnd(5)} ${s.zero_dims.join(',') || '-'}`);
  fs.writeFileSync(path.join(ROOT, 'reports/benchmark-summary.json'), JSON.stringify(sum, null, 1));
}
const args = process.argv.slice(2);
if (args.includes('--score')) score();
else {
  const arms = (args.includes('--arms') ? args[args.indexOf('--arms') + 1] : 'pi').split(',').filter(Boolean);
  const only = args.includes('--tasks') ? args[args.indexOf('--tasks') + 1].split(',') : [];
  run(arms, only).catch((e) => { console.error('RUN_FAIL', e.message); process.exit(1); });
}
