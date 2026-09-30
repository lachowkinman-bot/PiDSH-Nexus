#!/usr/bin/env node
// build-app.mjs — P1/P3：把域模型 + 数据 + 源码内联成单文件 app.html（设计 v2 的 D2）
// 用法：node scripts/build-app.mjs [--out app.html]
// 纪律：
//   ① 数据必须内联——file:// 下浏览器不允许 fetch 本地 JSON/CSV，"双击即用"与"数据外置"互斥；
//   ② 构建即门禁：先跑 gen-domain-model --check，违规即中止（不让坏模型进入产物）；
//   ③ 内联 JSON 须转义 `<`，避免数据里出现 `</script>` 提前闭合脚本。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'app.html';

// ① 构建即门禁
try {
  const g = execFileSync('node', ['scripts/gen-domain-model.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  if (/violations=[1-9]/.test(g)) { console.error('BUILD_ABORT 域模型校验未通过\n' + g); process.exit(1); }
} catch (e) { console.error('BUILD_ABORT 域模型校验失败：\n' + (e.stdout || e.message)); process.exit(1); }

const MODEL_DIR = path.join(ROOT, 'manifests/domain-model');
const DELIVERY = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/domain-delivery.json'), 'utf8'));
const ORDER = fs.readdirSync(MODEL_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
const MODELS = {}, DATA = {};
// CSV 解析必须按逗号（含引号转义）——原先误用 markdown 表格的按 `|` 切分，
// 导致整行被当成一个单元格（实测台账只渲染出 1 列）。2026-09-29 修正。
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}
for (const d of ORDER) {
  MODELS[d] = JSON.parse(fs.readFileSync(path.join(MODEL_DIR, `${d}.json`), 'utf8'));
  DATA[d] = { __header: {} };
  const dir = path.join(ROOT, 'templates/workspace/data', d);
  for (const f of (fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.csv')) : [])) {
    const rows = parseCsv(fs.readFileSync(path.join(dir, f), 'utf8'));
    DATA[d].__header[f] = rows[0] || [];
    DATA[d][f] = rows.slice(1);
    // 构建期校验：CSV 表头必须与域模型声明的列逐字一致（不一致即中止，避免界面与模型漂移）
    const declared = (MODELS[d].tables.find((t) => t.file === f) || {}).columns || [];
    if (declared.length && declared.join('|') !== DATA[d].__header[f].join('|')) {
      console.error(`BUILD_ABORT 表头不一致 ${d}/${f}\n  模型：${declared.join(',')}\n  实际：${DATA[d].__header[f].join(',')}`);
      process.exit(1);
    }
  }
}

const esc = (s) => JSON.stringify(s).replace(/</g, '\\u003c');
// ② 源码语法门禁：语法错的 app.js 也曾被打包出去（2026-09-29 实测），此处前置拦截
for (const f of ['src/app.js', 'src/theme.css']) {
  if (!fs.existsSync(path.join(ROOT, f))) { console.error(`BUILD_ABORT 缺源文件 ${f}`); process.exit(1); }
}
try { execFileSync('node', ['--check', 'src/app.js'], { cwd: ROOT, encoding: 'utf8' }); }
catch (e) { console.error('BUILD_ABORT src/app.js 语法错误：\n' + (e.stderr || e.message)); process.exit(1); }
const css = fs.readFileSync(path.join(ROOT, 'src/theme.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
const pages = ORDER.reduce((s, d) => s + MODELS[d].pages.length, 0);

const html = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="ocean" data-density="comfortable">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>PiDSH Nexus · 全能工作台 — 13 域驾驶舱</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script>
window.__DOMAIN_ORDER__ = ${esc(ORDER)};
window.__DOMAIN_MODELS__ = ${esc(MODELS)};
window.__DATA__ = ${esc(DATA)};
window.__DELIVERY__ = ${esc(DELIVERY)};
</script>
<script>
${js}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, OUT), html, 'utf8');
const kb = (fs.statSync(path.join(ROOT, OUT)).size / 1024).toFixed(0);
console.log(`BUILD_OK ${OUT}  domains=${ORDER.length} pages=${pages + 3} size=${kb}KB（PRD 上限 1500KB）`);
console.log(`  双击 ${OUT} 即可离线运行（file:// 无需服务）`);
