#!/usr/bin/env node
// check-workbench-package.mjs — 工作台包 v2 校验（目录或 .tgz）
// 用法：
//   node scripts/custom/check-workbench-package.mjs --dir <包目录>
//   node scripts/custom/check-workbench-package.mjs --tgz <包文件>
// 退出码：0 = 通过；1 = 未通过（逐条列出问题）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validatePackageV2, listTarEntries, imageSize } from '../../workbench-ui-plugin/lib/workbench-package.mjs';

const argv = process.argv.slice(2);
const argOf = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
};
const dirArg = argOf('--dir');
const tgzArg = argOf('--tgz');
if (!dirArg && !tgzArg) {
  console.error('用法：--dir <包目录> 或 --tgz <包文件>');
  process.exit(2);
}

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
let problems = [];
let manifest = null;

if (dirArg) {
  const dir = path.resolve(dirArg);
  manifest = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, 'workbench.json'), 'utf8')); } catch { return null; }
  })();
  const result = validatePackageV2({ manifest, dir });
  problems = result.problems;
} else {
  const tgz = path.resolve(tgzArg);
  const entries = listTarEntries(fs.readFileSync(tgz));
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const manifestEntry = byName.get('package/workbench.json');
  if (!manifestEntry) {
    console.error('WORKBENCH_PACKAGE FAIL 包内缺少 workbench.json');
    process.exit(1);
  }
  manifest = JSON.parse(manifestEntry.data.toString('utf8'));
  const stagingChecks = [];
  const need = (condition, message) => { if (!condition) stagingChecks.push(message); };
  need(manifest.schema === 'pids-nexus/workbench-package/v2', 'schema 必须是 pids-nexus/workbench-package/v2');
  need(typeof manifest.id === 'string' && !!manifest.id, '缺少 id');
  need(typeof manifest.name === 'string' && !!manifest.name, '缺少 name');
  need(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(manifest.version || '')), 'version 必须是完整 SemVer');
  need(typeof manifest.license === 'string' && !!manifest.license, '缺少 license');
  need(typeof manifest.category === 'string' && !!manifest.category, '缺少 category');
  need(manifest.description && manifest.description.zh && manifest.description.en, '缺少 description.zh / description.en');
  for (const file of manifest.files || []) {
    const entry = byName.get(`package/${manifest.assets || 'assets'}/${file.path}`);
    if (!entry) { stagingChecks.push(`资产缺失：${file.path}`); continue; }
    if (file.sha256 !== sha256(entry.data)) stagingChecks.push(`资产哈希不一致：${file.path}`);
  }
  for (const shot of manifest.screenshots || []) {
    const entry = byName.get(`package/${shot.file}`);
    if (!entry) { stagingChecks.push(`截图缺失：${shot.file}`); continue; }
    if (shot.sha256 !== sha256(entry.data)) stagingChecks.push(`截图哈希不一致：${shot.file}`);
    const size = imageSize(entry.data);
    if (!size || size.width !== shot.width || size.height !== shot.height) stagingChecks.push(`截图尺寸不一致：${shot.file}`);
  }
  need(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 1, '至少需要一张截图');
  problems = stagingChecks;
}

console.log(`WORKBENCH_PACKAGE ${problems.length === 0 ? 'PASS' : 'FAIL'} id=${manifest?.id || '-'} version=${manifest?.version || '-'} files=${(manifest?.files || []).length} screenshots=${(manifest?.screenshots || []).length}`);
for (const problem of problems) console.log(`  - ${problem}`);
process.exitCode = problems.length === 0 ? 0 : 1;
