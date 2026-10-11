#!/usr/bin/env node
// verify-runtime-design.mjs — 运行时设计硬校验（结构 + 工作流一一对应 + 阶段可加载形状）
// 用法（在 staging 根运行）：node scripts/custom/verify-runtime-design.mjs --domain cust-learning --out-dir custom-out
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const argOf = (name, fallback = null) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};
const ROOT = process.cwd();
const domain = String(argOf('--domain', '')).trim();
const outDir = path.resolve(ROOT, argOf('--out-dir', 'custom-out'));

const problems = [];
const rec = (id, ok, note = '') => {
  if (!ok) problems.push(`${id}: ${note}`);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${note}`);
};

const designFile = path.join(outDir, 'design.json');
const entriesFile = path.join(outDir, 'workflow-entries.json');
rec('files.present', fs.existsSync(designFile) && fs.existsSync(entriesFile), `${designFile}`);
if (!fs.existsSync(designFile) || !fs.existsSync(entriesFile)) {
  console.error(`RUNTIME_DESIGN_VERIFY FAIL ${problems.length}`);
  process.exit(1);
}
const design = JSON.parse(fs.readFileSync(designFile, 'utf8'));
const entries = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));

rec('schema', design.schema === 'pids-nexus/domain-work-design/v1', design.schema);
rec('domain.match', design.domain === domain, `design=${design.domain}`);
rec('modules.count', Array.isArray(design.modules) && design.modules.length >= 1, `modules=${design.modules?.length}`);

const items = (design.modules || []).flatMap((module) => module.items || []);
const itemIds = items.map((item) => item.id);
rec('items.unique', new Set(itemIds).size === itemIds.length, `items=${items.length}`);
const mapped = items.map((item) => item.workflow?.id).filter(Boolean);
const entryIds = entries.map((entry) => entry.workflow_id);
const missing = entryIds.filter((id) => !mapped.includes(id));
const extra = mapped.filter((id) => !entryIds.includes(id));
rec('workflow.coverage', missing.length === 0 && extra.length === 0, `mapped=${mapped.length} missing=${missing.join(',')} extra=${extra.join(',')}`);

const ALLOWED = new Set(['data_intake', 'rule_gate', 'llm_task', 'quality_gate', 'human_approval', 'no_human_approval', 'writeback_and_delivery', 'outcome_evaluation', 'strategy_writeback']);
let stageProblems = 0;
for (const item of items) {
  const stages = item.stages || [];
  if (!stages.length) { stageProblems += 1; continue; }
  const ids = stages.map((stage) => stage.id);
  if (new Set(ids).size !== ids.length) stageProblems += 1;
  if (!ids.includes('intake')) stageProblems += 1;
  if (!ids.includes('strategy_rollup')) stageProblems += 1;
  for (const stage of stages) {
    if (!ALLOWED.has(stage.type)) stageProblems += 1;
    if (stage.type === 'human_approval' && !(stage.required_roles || []).length) stageProblems += 1;
  }
}
rec('stages.valid', stageProblems === 0, `issues=${stageProblems}`);

console.log(`RUNTIME_DESIGN_VERIFY ${problems.length === 0 ? 'PASS' : 'FAIL'} items=${items.length} workflows=${entryIds.length}`);
process.exitCode = problems.length === 0 ? 0 : 1;
