#!/usr/bin/env node
// verify-r9-ui.mjs — R9 安装态 UI 取证：品牌 / 内测声明 / 用户点名模块 / 工作台面板
// 用法：node scripts/verify-r9-ui.mjs "<url-with-token>" [outJson]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const URL_ARG = process.argv[2];
const OUT = process.argv[3] || 'reports/r9-ui-verify.json';
const SHOTS = 'reports/ui-walkthrough';
if (!URL_ARG) {
  console.error('usage: node scripts/verify-r9-ui.mjs <url-with-token> [outJson]');
  process.exit(2);
}

const CANDIDATES = [
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('找不到可用 Chromium/Edge 可执行文件');

fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

// 关键词 → 可接受的文本变体（安装态实际标签可能带分隔符，如「用量/余额」）
const MODULES = {
  插件: ['插件'],
  '通知与控制': ['通知与控制', '通知'],
  任务看板: ['任务看板'],
  技能中心: ['技能中心'],
  记忆系统: ['记忆系统', '记忆'],
  工作台: ['工作台'],
  'PR Board': ['PR Board'],
  用量余额: ['用量/余额', '用量余额'],
};
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1560, height: 950 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

const result = { url: URL_ARG.replace(/token=[^&]+/, 'token=***'), startedAt: new Date().toISOString() };
const shot = async (name) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

await page.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(9000);
// 关掉第三方首启提示（不构成证据的一部分，只为露出主界面与侧栏品牌）
for (const label of ['跳过向导', '保留当前显示', '稍后配置']) {
  try {
    const target = page.getByText(label, { exact: false }).first();
    if (await target.isVisible({ timeout: 1500 })) await target.click({ timeout: 3000 });
  } catch {
    /* 未出现即跳过 */
  }
}
await page.waitForTimeout(1500);
await shot('r9-01-shell-home');

const bodyText = async () => (await page.locator('body').innerText().catch(() => '')) || '';
let text = await bodyText();
result.welcomeModalVisible = text.includes('内测声明');
const brandText = await page
  .locator('header, aside, [class*="sidebar" i], [class*="brand" i]')
  .first()
  .innerText()
  .catch(() => '');
result.brandFound = text.includes('PiDSH Nexus') || brandText.includes('PiDSH Nexus');
result.brandSample = brandText.replace(/\s+/g, ' ').slice(0, 200);
result.brandLegacyFound = text.includes('DeepSeek Harness');
const hit = (t, variants) => variants.some((v) => t.includes(v));
result.modulesFirstPass = Object.fromEntries(Object.entries(MODULES).map(([k, v]) => [k, hit(text, v)]));

// 打开壳内工作台面板（若存在）
try {
  const entry = page.getByText('工作台', { exact: false }).first();
  await entry.click({ timeout: 8000 });
  await page.waitForTimeout(3500);
  await shot('r9-02-workbench-panel');
} catch (error) {
  result.workbenchClickError = String(error).slice(0, 160);
}

text = await bodyText();
const brandText2 = await page
  .locator('header, aside, [class*="sidebar" i], [class*="brand" i]')
  .first()
  .innerText()
  .catch(() => '');
result.brandFound = result.brandFound || text.includes('PiDSH Nexus') || brandText2.includes('PiDSH Nexus');
result.brandSample = (result.brandSample + ' | ' + brandText2.replace(/\s+/g, ' ')).slice(0, 300);
result.modulesSecondPass = Object.fromEntries(Object.entries(MODULES).map(([k, v]) => [k, hit(text, v)]));
result.modules = Object.fromEntries(
  Object.keys(MODULES).map((k) => [k, result.modulesSecondPass[k] || result.modulesFirstPass[k]]),
);
result.textSample = text.replace(/\s+/g, ' ').slice(0, 1500);
result.consoleErrors = consoleErrors.slice(0, 10);
result.finishedAt = new Date().toISOString();
result.pass = !result.welcomeModalVisible && result.brandFound && Object.keys(MODULES).every((m) => result.modules[m]);
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
const okCount = Object.keys(MODULES).filter((m) => result.modules[m]).length;
console.log(`R9_UI ${result.pass ? 'PASS' : 'FAIL'} brand=${result.brandFound} modal=${result.welcomeModalVisible} modules=${okCount}/${Object.keys(MODULES).length} → ${OUT}`);
await browser.close();
