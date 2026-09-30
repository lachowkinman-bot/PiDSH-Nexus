// ui-probe.mjs — 探查 dsh web 壳 DOM：确认"⟡ 工作台"入口是否出现在壳内，并列出可点击元素
import { chromium } from 'playwright-core';
const URL = process.argv[2];
const OUT = process.argv[3] || 'reports/ui-walkthrough/_probe.png';
const browser = await chromium.launch({
  executablePath: 'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE_ERR:', m.text().slice(0, 160)); });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(9000);
await page.screenshot({ path: OUT, fullPage: false });
console.log('TITLE:', await page.title());
const txt = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log('--- BODY TEXT ---\n' + txt);
const els = await page.evaluate(() => Array.from(document.querySelectorAll('button,a,[role=button],li,span'))
  .map((e) => (e.innerText || '').trim()).filter((t) => t && t.length < 40).slice(0, 80));
console.log('--- CLICKABLE TEXT ---\n' + JSON.stringify(els, null, 0));
await browser.close();
