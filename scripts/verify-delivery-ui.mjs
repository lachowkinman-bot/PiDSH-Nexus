#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};
const BASE = argOf('--base', 'http://127.0.0.1:3080');
const OUT = argOf('--out', 'reports/delivery-ui-verification.json');
const SHOTS = path.join(ROOT, 'reports/ui-walkthrough');
const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/domain-delivery.json'), 'utf8')).domains;
const records = [];
const rec = (item, pass, note = '') => records.push({ item, pass: !!pass, note: String(note) });

const edgeCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = edgeCandidates.find((file) => fs.existsSync(file));
if (!executablePath) {
  console.error('EDGE_NOT_FOUND');
  process.exit(1);
}

fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(`${BASE}/workbench/api/app-page`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByText('跨域交付中心', { exact: true }).waitFor({ timeout: 15000 });
  rec('主驾驶舱交付中心', true, '页面可访问');
  const selector = page.locator('select').filter({ has: page.locator('option[value="strat"]') });
  await selector.selectOption('strat');
  await page.getByRole('button', { name: '生成全部格式', exact: true }).click();
  await page.getByText(/已完成 7 个文件/).waitFor({ timeout: 180000 });
  rec('驾驶舱生成全部格式', true, '7 个产物');
  for (const format of ['MD', 'CSV', 'HTML', 'XLSX', 'DOCX', 'PPTX', 'PDF']) {
    const count = await page.getByRole('button', { name: format, exact: true }).count();
    rec(`产物下载按钮 ${format}`, count > 0, `count=${count}`);
  }
  await page.screenshot({ path: path.join(SHOTS, 'r7-delivery-main-cockpit.png'), fullPage: true });
} catch (error) {
  rec('主驾驶舱交付旅程', false, error.message);
}

for (const [domain, profile] of Object.entries(profiles)) {
  try {
    await page.evaluate((id) => { location.hash = `#/${id}`; }, domain);
    await page.getByText(`${profile.label} · 交付中心`, { exact: true }).waitFor({ timeout: 10000 });
    const body = await page.locator('.content').innerText();
    const ok = body.includes(profile.title) && body.includes('生成全部格式') && body.includes('代表工作流');
    rec(`域驾驶舱 ${domain}`, ok, ok ? '主/域驾驶舱同窗渲染' : '关键内容缺失');
    await page.screenshot({ path: path.join(SHOTS, `r7-domain-${domain}.png`), fullPage: true });
  } catch (error) {
    rec(`域驾驶舱 ${domain}`, false, error.message);
  }
}

rec('浏览器控制台无错误', errors.length === 0, errors.slice(0, 5).join(' | '));
const pass = records.filter((item) => item.pass).length;
const report = {
  generated_at: new Date().toISOString(),
  base: BASE,
  pass,
  total: records.length,
  fail: records.length - pass,
  errors,
  records,
};
fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(ROOT, OUT.replace(/\.json$/i, '.md')), [
  '# 驾驶舱 UI 交付验收',
  '',
  `- BASE：${BASE}`,
  `- 检查：${pass}/${records.length} PASS`,
  `- 失败：${report.fail}`,
  '',
  ...records.filter((item) => !item.pass).map((item) => `- FAIL ${item.item}: ${item.note}`),
  '',
].join('\n'));
console.log(`DELIVERY_UI ${pass}/${records.length} PASS fail=${report.fail} -> ${OUT}`);
await browser.close();
if (report.fail) process.exit(1);
