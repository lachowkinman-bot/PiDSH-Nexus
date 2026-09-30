#!/usr/bin/env node
// pkg-func-smoke.mjs — U16 逐包四级 DoD 编排器（015 v2.1 §14.2，修复"安装退出码=可用"）
// 用法：
//   node scripts/pkg-func-smoke.mjs --list                 # 列出 DoD 定义
//   node scripts/pkg-func-smoke.mjs --run --only <pkg>     # 对单包跑四级 DoD（需 dsh 运行时）
//   node scripts/pkg-func-smoke.mjs --self-test            # 内置自检（无 dsh 依赖）
// 四级：L1 安装退出码 → L2 运行时装载行 → L3 功能调用（UI 类包=界面入口截图）→ L4 独立性禁用/启用
// 证据：reports/pkg-func-smoke.md（每包一行四级状态；缺任一级=NOT-PROVEN）
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const DEF = path.join(ROOT, 'manifests/pkg-smoke-definitions.csv');

export function loadDefs() {
  return fs.readFileSync(DEF, 'utf8').trim().split(/\r?\n/).slice(1)
    .map((l) => l.split(','))
    .map(([pkg, kind, l3_invocation, ui_entry]) => ({ pkg, kind, l3_invocation, ui_entry }));
}
export function runOne(d) {
  // L1/L2/L3 依赖 dsh 运行时；本编排器产出逐级状态，供 Agent 在 U16 实跑时回填
  const res = { pkg: d.pkg, L1_install: 'TODO', L2_loaded: 'TODO', L3_function: 'TODO', L4_independence: 'TODO' };
  return res;
}
function selfTest() {
  const defs = loadDefs();
  if (defs.length < 24) throw new Error(`DoD 定义 ${defs.length} < 24`);
  const r = runOne(defs[0]);
  if (r.L1_install !== 'TODO') throw new Error('self-test: 状态机异常');
  const ui = defs.filter((d) => d.ui_entry === 'yes');
  if (ui.length < 5) throw new Error(`self-test: UI 类包 ${ui.length} < 5`);
  console.log(`SELF_TEST_OK defs=${defs.length} ui-entry=${ui.length}（实跑需 dsh 运行时，U16 逐包回填四级状态）`);
}
const args = process.argv.slice(2);
if (args.includes('--self-test')) { try { selfTest(); } catch (e) { console.error('SELF_TEST_FAIL:', e.message); process.exit(1); } }
else if (args.includes('--list')) console.table(loadDefs());
else if (args.includes('--run')) {
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const out = loadDefs().filter((d) => !only || d.pkg === only).map(runOne);
  fs.writeFileSync(path.join(ROOT, 'reports/pkg-func-smoke.md'), `# 逐包四级 DoD 状态\n\n\`\`\`\n${JSON.stringify(out, null, 1)}\n\`\`\`\n> TODO 项须在 dsh 运行时实跑后回填；未回填=NOT-PROVEN（U16 不通过）。\n`);
  console.log('RUN_DONE → reports/pkg-func-smoke.md（TODO 待实跑回填）');
} else console.log('用法：--list | --run [--only <pkg>] | --self-test');
