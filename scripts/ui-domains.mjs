// ui-domains.mjs — 13 域逐域重拍（确定性选择器：第 i 个"进入域工作台"按钮 = 第 i 个域）
import { chromium } from 'playwright-core';
const URL = process.argv[2];
const DIR = process.argv[3] || 'reports/ui-walkthrough';
const browser = await chromium.launch({
  executablePath: 'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
try { await page.getByText('继续').last().click({ timeout: 4000 }); } catch { }
await page.getByText('⟡ 工作台').last().click();
await page.waitForTimeout(2500);
const ids = ['strat', 'mkt-on', 'mkt-off', 'sales', 'fin', 'rec', 'trn', 'prf', 'comp', 'ben', 'admin', 'cmp', 'er-eap'];
for (let i = 0; i < ids.length; i++) {
  await page.getByRole('button', { name: '进入域工作台' }).nth(i).click();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${DIR}/domain-${ids[i]}.png` });
  console.log('[domain]', ids[i]);
  await page.getByRole('button', { name: '← 返回域列表' }).click();
  await page.waitForTimeout(700);
}
await browser.close();
console.log('DOMAINS_DONE');
