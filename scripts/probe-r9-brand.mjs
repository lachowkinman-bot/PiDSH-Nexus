#!/usr/bin/env node
// probe-r9-brand.mjs — 只取证左上角（侧栏品牌区）到底渲染了什么（R9 品牌验收专用）
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const URL_ARG = process.argv[2];
if (!URL_ARG) {
  console.error('usage: node scripts/probe-r9-brand.mjs <url-with-token>');
  process.exit(2);
}
const CANDIDATES = [
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1560, height: 950 } });
await page.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(9000);
const probe = await page.evaluate(() => {
  const rows = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.top > 90 || r.left > 340 || r.width < 40 || r.height < 8) continue;
    const text = (el.textContent || '').trim();
    const aria = el.getAttribute('aria-label') || '';
    const cls = typeof el.className === 'string' ? el.className : '';
    if (!text && !aria) continue;
    rows.push({
      tag: el.tagName,
      cls: cls.slice(0, 60),
      aria: aria.slice(0, 60),
      text: text.slice(0, 80),
      html: el.outerHTML.slice(0, 200),
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    });
    if (rows.length >= 12) break;
  }
  return rows;
});
const hasPids = JSON.stringify(probe).includes('PiDSH') || JSON.stringify(probe).includes('Nexus');
const hasLegacy = JSON.stringify(probe).toLowerCase().includes('deepseek');
await page.screenshot({ path: 'reports/ui-walkthrough/r9-03-brand-region.png', clip: { x: 0, y: 0, width: 420, height: 120 } });
fs.writeFileSync('reports/r9-brand-probe.json', `${JSON.stringify({ hasPids, hasLegacy, probe }, null, 2)}\n`);
console.log(`BRAND_PROBE pids=${hasPids} legacy=${hasLegacy}`);
for (const row of probe.slice(0, 6)) console.log(`  ${row.tag} rect=${row.rect.join(',')} aria="${row.aria}" text="${row.text}"`);
await browser.close();
