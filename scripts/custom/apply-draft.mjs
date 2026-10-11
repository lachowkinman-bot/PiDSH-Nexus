#!/usr/bin/env node
// apply-draft.mjs — 把草稿合入包应用到 PiDSH 源树（幂等、可回滚；默认 dry-run）
// 用法：
//   node scripts/custom/apply-draft.mjs --draft <合入包目录或草稿目录> --root <源树> [--yes]
// 说明：--yes 才会真正写文件；被覆盖文件备份到 reports/custom/rollback/<draft>/。
import fs from 'node:fs';
import path from 'node:path';
import { applyDraft, CONSOLIDATION_SCHEMA } from '../../workbench-ui-plugin/lib/custom-drafts.mjs';

const argv = process.argv.slice(2);
const argOf = (name, fallback = null) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};

const draftArg = argOf('--draft');
const rootArg = argOf('--root');
if (!draftArg || !rootArg) {
  console.error('用法：node scripts/custom/apply-draft.mjs --draft <合入包目录> --root <源树> [--yes]');
  process.exit(2);
}
const yes = argv.includes('--yes');

function resolveConsolidationDir(value) {
  const direct = path.resolve(value);
  if (fs.existsSync(path.join(direct, 'manifest.json'))) return direct;
  const nested = path.join(direct, 'consolidation');
  if (fs.existsSync(path.join(nested, 'manifest.json'))) return nested;
  throw new Error(`找不到合入包 manifest.json：${value}`);
}

const consolidationDir = resolveConsolidationDir(draftArg);
const root = path.resolve(rootArg);
if (!fs.existsSync(path.join(root, 'manifests', 'domain-delivery.json'))) {
  console.error(`源树非法（缺 manifests/domain-delivery.json）：${root}`);
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(path.join(consolidationDir, 'manifest.json'), 'utf8'));
if (manifest.schema !== CONSOLIDATION_SCHEMA) {
  console.error(`合入包 schema 非法：${manifest.schema}`);
  process.exit(2);
}

const result = applyDraft({ draftDir: consolidationDir, root, dryRun: !yes });
console.log(`${result.dry_run ? 'APPLY_DRY_RUN' : 'APPLY_OK'} draft=${manifest.draft_id} root=${root}`);
for (const item of result.plan) console.log(`  ${item.action.padEnd(10)} ${item.path}`);
if (result.dry_run) {
  console.log('  加 --yes 才会真正写入（被覆盖文件自动备份到 reports/custom/rollback/）。');
  console.log('  后续门禁：design:verify → verify:workflow-contracts → verify:workflow-delivery → build:app → 4.0:verify');
}
