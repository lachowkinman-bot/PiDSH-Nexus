#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const URL_ARG = process.argv[2] || process.env.PIDSH_VERIFY_URL;
const OUT = process.argv[3] || 'reports/workbench-v4-ui.json';
const SHOTS = path.join(ROOT, 'reports', 'ui-walkthrough', 'v4');
if (!URL_ARG) throw new Error('usage: node scripts/verify-workbench-ui-v4.mjs <url-with-token> [out]');

const candidates = [
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = candidates.find((file) => fs.existsSync(file));
if (!executablePath) throw new Error('找不到 Chromium/Edge');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(ROOT, OUT)), { recursive: true });

const record = [];
const rec = (id, pass, note = '') => {
  record.push({ id, pass: !!pass, note: String(note) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${note}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error.message || error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

async function dismiss() {
  for (const label of ['知道了', '跳过向导', '保留当前显示', '稍后配置', '暂不开启']) {
    try {
      const target = page.getByText(label, { exact: false }).first();
      if (await target.isVisible({ timeout: 500 })) {
        await target.click({ timeout: 1000 });
        await sleep(150);
      }
    } catch {
      // Optional prompt.
    }
  }
}

async function openWorkbench() {
  await page.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6500);
  await dismiss();
  await page.getByText('⟡ 工作台', { exact: false }).first().click({ timeout: 15000 });
  await page.getByText('战略总看板', { exact: true }).waitFor({ timeout: 15000 });
  await dismiss();
  await page.getByText('13 域贡献', { exact: true }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await dismiss();
}

async function openRec() {
  await page.getByRole('button', { name: '13 域工作台', exact: true }).click({ timeout: 10000 });
  await page.getByText('招聘 REC', { exact: false }).first().waitFor({ timeout: 10000 });
  await page.getByText('招聘 REC', { exact: false }).first().click({ timeout: 10000 });
  await page.getByText('6 条流程', { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText('业务脉搏', { exact: true }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  await dismiss();
}

async function runWithoutApproval() {
  const card = page.getByText('rec.funnel-weekly@1.0.0', { exact: true }).first();
  await card.waitFor({ timeout: 10000 });
  await card.locator('xpath=ancestor::div[contains(@style,"border")][1]').getByRole('button', { name: '发起流程' }).click();
  await page.getByRole('button', { name: '填入示例' }).click();
  await page.getByRole('button', { name: '提交输入并校验' }).click();
  await page.getByText('4. 产出与证据', { exact: true }).waitFor({ timeout: 30000 });
  const artifacts = await page.locator('a[href*="/workbench/api/instance-artifact"],a[href*="/workbench/api/artifact"]').count();
  rec('ui.workflow.no-approval.complete', artifacts >= 2, `artifactLinks=${artifacts}`);
  await dismiss();
  await page.screenshot({ path: path.join(SHOTS, 'rec-funnel-complete.png'), fullPage: true });
}

async function runApprovalFlow() {
  await page.getByRole('button', { name: '返回工作流列表' }).click();
  const card = page.getByText('rec.offer-approve@1.0.0', { exact: true }).first();
  await card.waitFor({ timeout: 10000 });
  await card.locator('xpath=ancestor::div[contains(@style,"border")][1]').getByRole('button', { name: '发起流程' }).click();
  await page.getByRole('button', { name: '填入示例' }).click();
  await page.getByRole('button', { name: '提交输入并校验' }).click();
  await page.getByText('3. 人工审批（角色 + 操作者签名）', { exact: true }).waitFor({ timeout: 30000 });
  rec('ui.workflow.approval.blocked-before-signature', true, 'awaiting approval rendered');
  const roleInput = page.getByPlaceholder('例如：业务负责人');
  const operatorInput = page.getByPlaceholder('姓名或工号掩码');
  const commentInput = page.getByPlaceholder('通过原因；驳回时必填');
  await roleInput.fill('业务负责人');
  await operatorInput.fill('QA-BIZ');
  await commentInput.fill('业务审批通过');
  await page.getByRole('button', { name: '通过', exact: true }).click();
  await page.getByText(/状态 awaiting_approval/).waitFor({ timeout: 15000 });
  await roleInput.fill('风险负责人');
  await operatorInput.fill('QA-RISK');
  await commentInput.fill('风险审批通过');
  await page.getByRole('button', { name: '通过', exact: true }).click();
  await page.getByText('4. 产出与证据', { exact: true }).waitFor({ timeout: 30000 });
  const artifacts = await page.locator('a[href*="/workbench/api/instance-artifact"],a[href*="/workbench/api/artifact"]').count();
  rec('ui.workflow.approval.complete', artifacts >= 2, `artifactLinks=${artifacts}`);
  await dismiss();
  await page.screenshot({ path: path.join(SHOTS, 'rec-offer-approved.png'), fullPage: true });
}

try {
  await openWorkbench();
  rec('ui.workbench.open', true, 'strategy dashboard opened');
  await page.screenshot({ path: path.join(SHOTS, 'strategy-overview.png'), fullPage: true });
  await openRec();
  rec('ui.domain.rec.open', true, 'REC domain opened');
  await page.screenshot({ path: path.join(SHOTS, 'rec-domain.png'), fullPage: true });
  await runWithoutApproval();
  await runApprovalFlow();
  await page.setViewportSize({ width: 1100, height: 700 });
  await openWorkbench();
  const compact = await page.evaluate(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    workbenchVisible: document.body.innerText.includes('战略总看板'),
    keyButtons: ['13 域工作台', '审批中心', '交付物'].every((label) => document.body.innerText.includes(label)),
  }));
  rec('ui.viewport.1100x700', compact.noHorizontalOverflow && compact.workbenchVisible && compact.keyButtons, JSON.stringify(compact));
  await page.screenshot({ path: path.join(SHOTS, 'strategy-1100x700.png'), fullPage: false });
  rec('ui.console.no-page-errors', errors.filter((item) => !/sidebar\.brand\.mark|405/.test(item)).length === 0, errors.slice(0, 4).join(' | '));
} catch (error) {
  rec('ui.journey.exception', false, String(error.stack || error.message || error));
  await page.screenshot({ path: path.join(SHOTS, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const passed = record.filter((item) => item.pass).length;
const report = {
  schema: 'pids-nexus/workbench-ui-verification/v4',
  generated_at: new Date().toISOString(),
  url: URL_ARG.replace(/token=[^&]+/i, 'token=***'),
  pass: passed === record.length,
  passed,
  total: record.length,
  records: record,
  errors,
};
fs.writeFileSync(path.resolve(ROOT, OUT), `${JSON.stringify(report, null, 2)}\n`);
console.log(`WORKBENCH_UI_V4 ${report.pass ? 'PASS' : 'FAIL'} ${passed}/${record.length} hash=${sha(JSON.stringify(record))} -> ${OUT}`);
if (!report.pass) process.exit(1);
