#!/usr/bin/env node
// verify-draft.mjs — 自定义工作台草稿校验（staging 副本上跑既有生成/门禁链）
// 用法：
//   node scripts/custom/verify-draft.mjs --draft <草稿目录或草稿 id> [--root <bundle 根>] [--workspace <数据根>]
// 退出码：0 = 域级校验通过（新增域的基线缺口如实登记在 verify.json）；1 = 未通过。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkspaceRoot } from '../../workbench-ui-plugin/lib/platform.mjs';
import { verifyDraft, draftPath } from '../../workbench-ui-plugin/lib/custom-drafts.mjs';

const argv = process.argv.slice(2);
const argOf = (name, fallback = null) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};

function resolveRoot() {
  const explicit = argOf('--root');
  const candidates = [explicit, process.cwd(), path.resolve(fileURLToPath(import.meta.url), '../../..')].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'manifests', 'domain-delivery.json'))) return path.resolve(candidate);
  }
  throw new Error('找不到 PiDSH bundle 根（需包含 manifests/domain-delivery.json），用 --root 指定');
}

function resolveDraftId(workspaceRoot, value) {
  if (!value) throw new Error('缺少 --draft');
  const asPath = path.resolve(value);
  if (fs.existsSync(path.join(asPath, 'draft.json'))) return path.basename(asPath);
  return String(value).trim();
}

const root = resolveRoot();
const workspaceRoot = path.resolve(argOf('--workspace') || resolveWorkspaceRoot(root));
const draftId = resolveDraftId(workspaceRoot, argOf('--draft'));
const full = argv.includes('--full');
const report = verifyDraft({ bundleRoot: root, workspaceRoot, draftId, full });

const draftDir = draftPath(workspaceRoot, draftId);
console.log(`${report.ok ? 'VERIFY_OK' : 'VERIFY_FAIL'} draft=${draftId} kind=${report.kind} target=${report.target}`);
console.log(`  overlay_files=${report.overlay_files} domain_checks=${report.domain_checks.ok ? 'pass' : 'fail'} baseline_gates=${report.baseline_gates.status}${report.baseline_pending ? ' (baseline-pending: 13 域闭集门禁未覆盖新增域)' : ''}`);
console.log(`  heavy_gates=${report.heavy_gates.status}${report.heavy_gates.status === 'not-run' && report.kind !== 'new-domain' ? '（修订草稿导出合入包前需 --full 通过）' : ''}`);
for (const step of report.domain_checks.steps) console.log(`  [domain] ${step.id} exit=${step.exit} ms=${step.ms}`);
for (const step of report.baseline_gates.steps) console.log(`  [baseline] ${step.id} exit=${step.exit == null ? 'skipped' : step.exit} ms=${step.ms}`);
for (const step of report.heavy_gates.steps) console.log(`  [heavy] ${step.id} exit=${step.exit == null ? 'skipped' : step.exit} ms=${step.ms}`);
if (report.gaps.length) {
  console.log('  gaps:');
  for (const gap of report.gaps) console.log(`   - ${gap}`);
}
console.log(`  evidence=${path.join(draftDir, 'verify.json')}`);
process.exitCode = report.ok ? 0 : 1;
