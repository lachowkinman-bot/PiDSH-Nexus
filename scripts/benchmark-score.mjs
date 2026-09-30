#!/usr/bin/env node
// benchmark-score.mjs — U17 质量对标评分器（015 v2.1 §14.4）
// 用法：
//   node scripts/benchmark-score.mjs --tasks              # 列出基准任务集
//   node scripts/benchmark-score.mjs --score <agent> <dir>  # 对某 agent 的产物目录按 rubric 记分（人工判定录入）
//   node scripts/benchmark-score.mjs --self-test
// rubric 五维 0-5：correctness/usability/quality/approval_behavior/cost；通过标准见 docs/benchmark-comparison-protocol.md
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const TASKS = path.join(ROOT, 'manifests/benchmark-tasks.csv');

export function loadTasks() {
  return fs.readFileSync(TASKS, 'utf8').trim().split(/\r?\n/).slice(1)
    .map((l) => l.split(',')).map(([id, domain, task, dims]) => ({ id, domain, task, dims: dims.split(';') }));
}
export function scoreSheet(agent) {
  return { agent, scored_at: new Date().toISOString(), tasks: loadTasks().map((t) => ({ id: t.id, correctness: null, usability: null, quality: null, approval_behavior: null, cost: null, evidence: 'reports/benchmark-artifacts/' + agent + '/' + t.id })) };
}
function selfTest() {
  const ts = loadTasks();
  if (ts.length !== 10) throw new Error(`任务集 ${ts.length} ≠ 10`);
  if (!ts.every((t) => t.dims.length === 5)) throw new Error('rubric 维度 ≠ 5');
  console.log(`SELF_TEST_OK tasks=10 rubric=5`);
}
const args = process.argv.slice(2);
if (args.includes('--self-test')) { try { selfTest(); } catch (e) { console.error('SELF_TEST_FAIL:', e.message); process.exit(1); } }
else if (args.includes('--tasks')) console.table(loadTasks().map((t) => ({ id: t.id, domain: t.domain, task: t.task })));
else if (args.includes('--score')) {
  const agent = args[args.indexOf('--score') + 1];
  fs.writeFileSync(path.join(ROOT, `reports/benchmark-scoresheet-${agent}.json`), JSON.stringify(scoreSheet(agent), null, 1));
  console.log(`SCORE_SHEET → reports/benchmark-scoresheet-${agent}.json（按 rubric 录入 0-5 分与证据路径）`);
} else console.log('用法：--tasks | --score <agent> | --self-test');
