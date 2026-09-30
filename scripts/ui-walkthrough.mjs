// ui-walkthrough.mjs — U15 机械判据取证：dsh 壳内 workbench panel 全流程截图
// 用法：node scripts/ui-walkthrough.mjs "<url-with-token>" [shotsDir]
// 证据口径：截图必须含 dsh 壳元素（侧栏/顶栏），standalone 页面不构成证据（016 §1）。
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const URL = process.argv[2];
const DIR = process.argv[3] || 'reports/ui-walkthrough';
if (!URL) { console.error('usage: node scripts/ui-walkthrough.mjs <url> [dir]'); process.exit(2); }
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });

const log = (...a) => console.log('[walk]', ...a);
async function shot(name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${DIR}/${name}.png` });
  log('shot ->', name + '.png');
}
async function clickText(text, timeout = 8000) {
  const loc = page.getByText(text, { exact: false }).last();
  await loc.waitFor({ state: 'visible', timeout });
  await loc.click();
}

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
// 关闭内测声明弹窗（若出现）
try { await clickText('继续', 4000); log('intro dismissed'); } catch { log('no intro'); }
await page.waitForTimeout(1500);

// ① 打开工作台入口（壳内）
await clickText('⟡ 工作台', 10000);
await page.waitForTimeout(2500);
await shot('01-workbench-entry');

// ②③④⑤ preset 四操作：选 → 用(apply) → 存(save) → 切(switch)
const sel = page.locator('select').first();
await sel.waitFor({ state: 'visible', timeout: 10000 });
const options = await sel.locator('option').allTextContents();
log('preset options:', options.length);
const first = options[1] || options[0];
const second = options[2] || options[1];
await sel.selectOption({ index: 1 });
await shot('02-preset-selected');
await clickText('选/用（apply）');
await page.waitForTimeout(1800);
await shot('03-preset-applied');
await clickText('存（save）');
await page.waitForTimeout(1800);
await shot('04-preset-saved');
await sel.selectOption({ index: 2 });
await clickText('切（switch）');
await page.waitForTimeout(1800);
await shot('05-preset-switched');

// ⑥-⑱ 13 域逐域进入 + 截图（截图含壳侧栏，非 standalone）
const domainIds = ['strat', 'mkt-on', 'mkt-off', 'sales', 'fin', 'rec', 'trn', 'prf', 'comp', 'ben', 'admin', 'cmp', 'er-eap'];
for (const id of domainIds) {
  const card = page.locator('div', { has: page.getByText(id === 'er-eap' ? '员工关系/EAP' : id.toUpperCase()) }).locator('button', { hasText: '进入域工作台' });
  try {
    await card.first().click({ timeout: 8000 });
  } catch {
    // 兜底：按按钮文本逐个点
    const btns = page.getByRole('button', { name: '进入域工作台' });
    const n = await btns.count();
    const idx = domainIds.indexOf(id);
    if (idx < n) await btns.nth(idx).click();
    else { log('SKIP domain (button not found):', id); continue; }
  }
  await page.waitForTimeout(1200);
  await shot(`domain-${id}`);
  await clickText('← 返回域列表', 8000);
  await page.waitForTimeout(600);
}

// F7/F8/F11 三页（壳内可操作）
await clickText('F7 离线');
await page.waitForTimeout(1200);
await shot('F7-offline');
await clickText('F8 升级回退');
await page.waitForTimeout(1200);
await shot('F8-upgrade');
await clickText('F11 自检');
await page.waitForTimeout(1500);
await shot('F11-selfcheck');

// engine.run：在 strat 域跑一次 GT（经引擎）——放最后（可能耗时）
try {
  await clickText('业务域工作台', 5000);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '进入域工作台' }).first().click({ timeout: 8000 });
  await page.waitForTimeout(800);
  await clickText('跑一次 GT（经引擎）', 8000);
  log('engine-run clicked, waiting for result...');
  await page.waitForTimeout(15000);
  await shot('06-engine-run-pending');
  await page.waitForTimeout(60000);
  await shot('07-engine-run-result');
} catch (e) { log('engine-run flow error:', String(e).slice(0, 120)); }

// 审计查看器
try {
  await clickText('审计', 5000);
  await page.waitForTimeout(1500);
  await shot('08-audit-viewer');
} catch (e) { log('audit view error:', String(e).slice(0, 120)); }

fs.writeFileSync(`${DIR}/_console-errors.json`, JSON.stringify(errors, null, 1));
log('console errors:', errors.length);
await browser.close();
log('DONE');
