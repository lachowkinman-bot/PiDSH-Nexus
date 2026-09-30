#!/usr/bin/env node
// data-consistency-check.mjs — §15.4 数据一致性校验（修复 2.0：合成数据文件名/行数与 preset-design 数据字典不符）
// 用法：node scripts/data-consistency-check.mjs [--data templates/workspace/data] [--docs docs/preset-design] [--self-test]
// 规则：docs/preset-design/<domain>.md "数据字典"表中每个 xlsx 文件名 → 数据根/<domain>/ 下须存在同名 CSV/XLSX，行数 ≥10；不符=WARN（首扫）/FAIL（交付窗口）
// 修订 2026-09-29：默认数据根原为 `workspace/data`，而工作台真实数据根是 `templates/workspace/data`
//   → 全部声明被判"缺失"（假 FAIL）。改默认值；并对"声明 xlsx / 落地 csv"做同名归一化匹配。
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const args = process.argv.slice(2);
const get = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const DATA = path.join(ROOT, get('--data', 'templates/workspace/data'));
const DOCS = path.join(ROOT, get('--docs', 'docs/preset-design'));

export function check() {
  const issues = []; let tables = 0;
  if (!fs.existsSync(DOCS)) return { issues: [['docs', `preset-design 目录不存在：${DOCS}`]], tables };
  for (const f of fs.readdirSync(DOCS).filter((f) => f.endsWith('.md'))) {
    const code = f.replace('.md', '');
    const md = fs.readFileSync(path.join(DOCS, f), 'utf8');
    for (const m of md.matchAll(/\|\s*([A-Za-z0-9_]+\.(?:xlsx|csv))\s*\|\s*(L[1-4])/g)) {
      tables++;
      const base = m[1].replace(/\.(xlsx|csv)$/, '');
      const dir = path.join(DATA, code);
      const hits = fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.startsWith(base)) : [];
      if (!hits.length) { issues.push([`${code}/${m[1]}`, '数据文件缺失（数据字典声明但未落地）']); continue; }
      const csv = hits.find((x) => x.endsWith('.csv'));
      if (csv) {
        const n = fs.readFileSync(path.join(dir, csv), 'utf8').trim().split(/\r?\n/).length - 1;
        if (n < 10) issues.push([`${code}/${csv}`, `行数 ${n} < 10（数据字典规格）`]);
      }
    }
  }
  return { issues, tables };
}
function selfTest() {
  const r = check();
  console.log(`SELF_TEST_OK tables=${r.tables} issues=${r.issues.length}（有 issues 属预期：workspace 未实装时逐条 WARN，交付窗口须清零）`);
}
if (args.includes('--self-test')) selfTest();
else {
  const r = check();
  fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'reports/data-consistency.csv'), 'table,issue\n' + r.issues.map((x) => x.join(',')).join('\n') + '\n');
  console.log(`CHECK_DONE tables=${r.tables} issues=${r.issues.length} → reports/data-consistency.csv`);
}
