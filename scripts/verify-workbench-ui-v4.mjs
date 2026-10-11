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

async function ensureOperators() {
  const base = new URL(URL_ARG);
  const endpoint = new URL('/workbench/api/operators/upsert', base).toString();
  for (const operator of [
    { id: 'QA-BIZ', displayName: 'QA 业务审批人', roles: ['用人经理', '业务负责人', '部门负责人'] },
    { id: 'QA-RISK', displayName: 'QA 风险审批人', roles: ['风险负责人', 'HRD'] },
  ]) {
    const response = await page.request.post(endpoint, { data: operator });
    if (!response.ok()) throw new Error(`审批身份创建失败：${operator.id} http=${response.status()}`);
  }
}

async function openRec() {
  await page.getByRole('button', { name: '13 域工作台', exact: true }).click({ timeout: 10000 });
  await page.getByText('招聘 REC', { exact: false }).first().waitFor({ timeout: 10000 });
  await page.getByText('招聘 REC', { exact: false }).first().click({ timeout: 10000 });
  await page.getByText('工作模块', { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText('需求与招聘标准', { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText('业务脉搏', { exact: true }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  await dismiss();
  const moduleSnapshot = await page.locator('body').innerText();
  rec('ui.domain.modules-and-items', moduleSnapshot.includes('需求与招聘标准') && moduleSnapshot.includes('JD 与岗位能力模型') && moduleSnapshot.includes('工作事项'), 'module hierarchy visible');
}

async function verifyDomainClosure() {
  const details = page.getByText(/查看 \d+ 个环节标准与数据契约/).first();
  await details.click({ timeout: 10000 });
  await page.getByText(/输入 Schema：/).first().waitFor({ timeout: 10000 });
  await page.getByText(/输出 Schema：/).first().waitFor({ timeout: 10000 });
  await page.getByText(/TypeDict：/).first().waitFor({ timeout: 10000 });
  await page.getByText(/阶段契约与规则/).first().click({ timeout: 10000 });
  await page.locator('body').getByText(/条/).first().waitFor({ timeout: 10000 });
  rec('ui.domain.stage-contracts', true, 'stage schema, TypeDict, and business rules visible');
  for (const tab of ['待办与风险', '审批', '成效复盘', '数据台账', '交付物', '运行记录', '工作模块']) {
    await page.getByRole('button', { name: tab, exact: true }).last().click({ timeout: 10000 });
    await page.waitForTimeout(250);
  }
  rec('ui.domain.tabs', true, 'all seven domain surfaces navigable');
}

async function runWithoutApproval() {
  const card = page.getByText('rec.funnel-weekly@1.0.0', { exact: true }).first();
  await card.waitFor({ timeout: 10000 });
  await card.locator('xpath=ancestor::div[contains(@style,"border")][1]').getByRole('button', { name: '发起工作流' }).click();
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
  await card.locator('xpath=ancestor::div[contains(@style,"border")][1]').getByRole('button', { name: '发起工作流' }).click();
  await page.getByRole('button', { name: '填入示例' }).click();
  await page.getByRole('button', { name: '提交输入并校验' }).click();
  await page.getByText('3. 人工审批（角色 + 操作者签名）', { exact: true }).waitFor({ timeout: 30000 });
  rec('ui.workflow.approval.blocked-before-signature', true, 'awaiting approval rendered');
  const roleInput = page.getByLabel('审批角色');
  const operatorInput = page.getByLabel('审批操作者');
  const commentInput = page.getByPlaceholder('通过原因；驳回时必填');
  await operatorInput.selectOption('QA-BIZ');
  await roleInput.selectOption('业务负责人');
  await commentInput.fill('业务审批通过');
  await page.getByRole('button', { name: '通过', exact: true }).click();
  await page.getByText(/状态 awaiting_approval/).waitFor({ timeout: 15000 });
  await operatorInput.selectOption('QA-RISK');
  await roleInput.selectOption('风险负责人');
  await commentInput.fill('风险审批通过');
  await page.getByRole('button', { name: '通过', exact: true }).click();
  await page.getByText('4. 产出与证据', { exact: true }).waitFor({ timeout: 30000 });
  const artifacts = await page.locator('a[href*="/workbench/api/instance-artifact"],a[href*="/workbench/api/artifact"]').count();
  rec('ui.workflow.approval.complete', artifacts >= 2, `artifactLinks=${artifacts}`);
  await dismiss();
  await page.screenshot({ path: path.join(SHOTS, 'rec-offer-approved.png'), fullPage: true });
}

// —— 4.0.0-dev8 集成层旅程：独立驾驶舱链接 / 自定义工作台闭环 / 升级与兼容 / 集成中心 ——
async function openStandaloneLink() {
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 15000 }),
    page.getByRole('button', { name: /打开独立驾驶舱/ }).click({ timeout: 10000 }),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.getByText('主驾驶舱', { exact: false }).first().waitFor({ timeout: 15000 });
  const url = popup.url();
  rec('ui.integration.standalone-link', url.includes('/workbench/api/app-page'), `url=${url.replace(/token=[^&]+/i, 'token=***')}`);
  const standaloneNav = await popup.locator('body').innerText();
  rec('ui.integration.standalone-nav', ['工作台市场', '自定义工作台', '升级与兼容'].every((label) => standaloneNav.includes(label)), 'market + custom + upgrade entries visible in standalone app');
  // 独立应用的三个新页面必须真实可渲染（此前 #/custom 因变量重命名遗漏整页崩溃，file:// 诊断才暴露）
  await popup.getByRole('button', { name: '自定义工作台', exact: true }).click({ timeout: 10000 });
  await popup.getByText('第一步 · 新建草稿', { exact: true }).waitFor({ timeout: 15000 });
  rec('ui.integration.standalone-custom-page', true, 'standalone custom page rendered');
  await popup.getByRole('button', { name: '工作台市场', exact: true }).click({ timeout: 10000 });
  await popup.getByText('工作台市场', { exact: true }).first().waitFor({ timeout: 15000 });
  await popup.getByText('dsh-plugin-upgrade-skill', { exact: false }).first().waitFor({ timeout: 15000 });
  rec('ui.integration.standalone-hub-page', true, 'standalone market page rendered with sources');
  await popup.screenshot({ path: path.join(SHOTS, 'standalone-dashboard.png'), fullPage: false });
  await popup.close();
}

async function _retiredCustomWorkbenchJourney() {
  await page.getByRole('button', { name: '自定义工作台', exact: true }).click({ timeout: 10000 });
  await page.getByText('第一步 · 新建草稿', { exact: true }).waitFor({ timeout: 15000 });
  const title = `QA 定制草稿 ${Date.now()}`;
  await page.getByPlaceholder('例如：招聘域新增台账表').fill(title);
  await page.getByPlaceholder(/例如：招聘团队需要/).fill('QA 旅程：验证自定义工作台草稿闭环（校验/预览/门禁闸口）。');
  await page.getByRole('button', { name: '创建草稿', exact: true }).click({ timeout: 10000 });
  await page.getByText(title, { exact: false }).first().waitFor({ timeout: 15000 });
  rec('ui.custom.draft-create', true, title);
  const card = page.getByText(title, { exact: false }).first().locator('xpath=ancestor::section[1]');
  await card.getByRole('button', { name: '运行校验', exact: true }).click({ timeout: 10000 });
  await page.getByText(/校验完成：/).first().waitFor({ timeout: 120000 });
  rec('ui.custom.verify', true, 'fast verify finished');
  await card.getByRole('button', { name: '构建预览', exact: true }).click({ timeout: 10000 });
  await page.getByText(/预览已构建/).first().waitFor({ timeout: 120000 });
  rec('ui.custom.preview-build', true, 'staging preview built');
  const [preview] = await Promise.all([
    page.waitForEvent('popup', { timeout: 15000 }),
    card.getByRole('button', { name: /打开预览/ }).click({ timeout: 10000 }),
  ]);
  await preview.waitForLoadState('domcontentloaded');
  await preview.getByText('草稿预览（未固化）', { exact: false }).first().waitFor({ timeout: 15000 });
  rec('ui.custom.preview-banner', preview.url().includes('draft='), 'preview banner rendered');
  await preview.screenshot({ path: path.join(SHOTS, 'custom-preview.png'), fullPage: false });
  await preview.close();
  await card.getByRole('button', { name: '导出合入包', exact: true }).click({ timeout: 10000 });
  await page.getByText(/完整基线门禁|heavy=/).first().waitFor({ timeout: 30000 });
  rec('ui.custom.consolidation-gated', true, 'consolidation blocked until heavy gates pass');
  await card.getByRole('button', { name: /完整门禁/ }).click({ timeout: 10000 });
  await page.getByText(/完整门禁已在后台启动|完整门禁运行中/).first().waitFor({ timeout: 30000 });
  rec('ui.custom.heavy-background', true, 'heavy gates started in background');
  await page.screenshot({ path: path.join(SHOTS, 'custom-workbench.png'), fullPage: true });
}

async function upgradeCenterJourney() {
  await page.getByRole('button', { name: '升级与兼容', exact: true }).click({ timeout: 10000 });
  await page.getByText('引擎与锁定', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('走廊覆盖（vendor 技能 vs 当前版本）', { exact: true }).waitFor({ timeout: 15000 });
  const text = await page.locator('body').innerText();
  rec('ui.upgrade.center', text.includes('0.2.0-rc.2') && text.includes('精确豁免'), 'engine lock and exemptions visible');
  await page.screenshot({ path: path.join(SHOTS, 'upgrade-center.png'), fullPage: true });
}

async function integrationHubJourney() {
  await page.getByRole('button', { name: '工作台市场', exact: true }).click({ timeout: 10000 });
  await page.getByText('关于 / 来源追溯', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '展开', exact: true }).click({ timeout: 10000 });
  const text = await page.locator('body').innerText();
  rec('ui.market.about-sources', ['dsh-plugin-upgrade-skill', 'dataelement/dsh-desktop', 'anywhere-labs/dsh-desktop'].every((name) => text.includes(name)), 'three projects with adoption traces visible inside market about section');
  await page.screenshot({ path: path.join(SHOTS, 'market-about.png'), fullPage: false });
}

async function marketJourney() {
  await page.getByRole('button', { name: '工作台市场', exact: true }).first().click({ timeout: 10000 });
  await page.getByText('离线优先：本地目录', { exact: false }).first().waitFor({ timeout: 15000 });
  await page.getByText('学习运营工作台（样例）', { exact: false }).first().waitFor({ timeout: 15000 });
  rec('ui.market.open', true, 'market v2 rendered with catalog card');
  await page.getByRole('button', { name: '☆' }).first().click({ timeout: 10000 });
  await page.getByRole('button', { name: '我的收藏', exact: true }).click({ timeout: 10000 });
  await page.getByText('学习运营工作台（样例）', { exact: false }).first().waitFor({ timeout: 15000 });
  rec('ui.market.favorite', true, 'favorite toggled and visible in favorites tab');
  await page.getByRole('button', { name: '检查更新', exact: true }).click({ timeout: 10000 });
  await page.getByText(/检查更新：/).first().waitFor({ timeout: 30000 });
  rec('ui.market.check-updates', true, 'update check executed');
  await page.getByRole('button', { name: '已安装', exact: true }).click({ timeout: 10000 });
  await page.getByText('运行时包 · 即装即用', { exact: false }).first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '卸载', exact: true }).first().click({ timeout: 10000 });
  await page.getByText('确认卸载', { exact: true }).first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '取消', exact: true }).click({ timeout: 10000 });
  rec('ui.market.uninstall-confirm', true, 'uninstall confirm dialog shown and cancelled');
  await page.getByRole('button', { name: '工作台市场', exact: true }).first().click({ timeout: 10000 });
  await page.getByPlaceholder('例如 cust-learning').fill('cust-learning');
  await page.getByPlaceholder('例如 enrollments 或 enrollments.csv').fill('enrollments');
  await page.getByPlaceholder(/learner_masked,course,status/).fill('learner_masked,course,status,hours,updated_at\nQA**,课程QA,completed,6,2026-10-11');
  await page.getByRole('button', { name: '先预览校验', exact: true }).click({ timeout: 10000 });
  await page.getByText(/校验通过：预览/).first().waitFor({ timeout: 30000 });
  rec('ui.market.import-preview', true, 'strict import validation preview');
  await page.getByRole('button', { name: '确认导入', exact: true }).click({ timeout: 10000 });
  await page.getByText(/校验通过：已写入/).first().waitFor({ timeout: 30000 });
  rec('ui.market.import-write', true, 'strict import written to workspace data root');
  await page.screenshot({ path: path.join(SHOTS, 'market.png'), fullPage: true });
}

async function wizardJourney() {
  await page.getByRole('button', { name: '制作我的工作台', exact: true }).first().click({ timeout: 10000 });
  await page.getByText('第一步 · 把开发指令交给 Agent', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('第二步 · 装到本机，自测确认能用', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('第三步 · 导出并登记（可选）', { exact: true }).waitFor({ timeout: 15000 });
  rec('ui.wizard.steps', true, 'three-step wizard rendered');
  const title = 'UI 向导草稿 ' + Date.now();
  await page.locator('select').first().selectOption('revise');
  await page.getByPlaceholder('例如：采购工作台').fill(title);
  await page.getByPlaceholder(/例如：采购团队需要三家比价/).fill('UI 向导：验证三步流程（校验、预览、导出登记与安装守卫）。');
  await page.getByRole('button', { name: '创建草稿', exact: true }).click({ timeout: 10000 });
  await page.getByText(title, { exact: false }).first().waitFor({ timeout: 15000 });
  rec('ui.wizard.draft-create', true, title);
  const card = page.getByText(title, { exact: false }).first().locator('xpath=ancestor::section[1]');
  await card.getByRole('button', { name: '复制开发指令', exact: true }).click({ timeout: 10000 });
  await page.getByText(/已复制|复制失败/).first().waitFor({ timeout: 15000 });
  rec('ui.wizard.copy-instruction', true, 'development instruction copy feedback');
  await card.getByRole('button', { name: '校验', exact: true }).click({ timeout: 10000 });
  await card.getByText(/域级 (通过|未通过)/).first().waitFor({ timeout: 120000 });
  const verified = /域级 通过/.test(await card.innerText());
  rec('ui.wizard.verify', verified, verified ? 'draft verify passed from wizard' : 'draft verify reported gaps honestly from wizard');
  await card.getByRole('button', { name: '构建预览', exact: true }).click({ timeout: 10000 });
  await page.getByText(/构建预览：完成/).first().waitFor({ timeout: 120000 });
  const [preview] = await Promise.all([
    page.waitForEvent('popup', { timeout: 15000 }),
    page.getByRole('button', { name: /打开预览/ }).first().click({ timeout: 10000 }),
  ]);
  await preview.waitForLoadState('domcontentloaded');
  await preview.getByText('草稿预览（未固化）', { exact: false }).first().waitFor({ timeout: 15000 });
  rec('ui.wizard.preview-banner', true, 'staging preview built and banner rendered');
  await preview.close();
  await card.getByRole('button', { name: '完整门禁（后台）', exact: true }).click({ timeout: 10000 });
  await page.getByText(/完整门禁运行中|完整门禁：完成/).first().waitFor({ timeout: 30000 });
  rec('ui.wizard.heavy-background', true, 'heavy gates started in background');
  if (verified) {
    await card.getByRole('button', { name: '安装（装上即用）', exact: true }).click({ timeout: 10000 });
    await page.getByText(/安装失败：|安装：完成/).first().waitFor({ timeout: 60000 });
    rec('ui.wizard.install-guard', true, 'install guard reported honestly (empty overlay cannot install)');
  }
  await page.screenshot({ path: path.join(SHOTS, 'wizard.png'), fullPage: true });
}

async function modeJourney() {
  await page.getByText('⟡ 工作台', { exact: false }).first().click({ timeout: 10000 });
  await page.getByText('战略总看板', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '工作台模式入口：学习运营工作台（样例）' }).first().click({ timeout: 10000 });
  await page.getByText(/已进入工作台模式/).first().waitFor({ timeout: 15000 });
  rec('ui.mode.enter', true, 'workbench mode entered (active persisted)');
  await page.getByRole('button', { name: /⧉ 学习运营/ }).first().click({ timeout: 10000 });
  await page.getByText('本地工作台（未固化）', { exact: false }).first().waitFor({ timeout: 20000 });
  rec('ui.market.sidebar-entry', true, 'installed workbench opened from its sidebar entry');
  await page.getByPlaceholder('工作台笔记（≤200KB，本地保存）').fill('UI 旅程笔记 ' + Date.now());
  await page.getByRole('button', { name: '保存笔记', exact: true }).click({ timeout: 10000 });
  await page.getByText(/已保存（本地/).first().waitFor({ timeout: 15000 });
  rec('ui.mode.notes', true, 'workbench notes saved (local)');
  await page.getByText('⟡ 工作台', { exact: false }).first().click({ timeout: 10000 });
  await page.getByRole('button', { name: '会话（未绑定）', exact: true }).click({ timeout: 10000 });
  await page.getByText(/已切回会话模式/).first().waitFor({ timeout: 15000 });
  rec('ui.mode.exit', true, 'switched back to unbound session mode');
}

async function standaloneFallbackJourney() {
  const fresh = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await fresh.goto(URL_ARG, { waitUntil: 'domcontentloaded' });
  await fresh.waitForTimeout(6000);
  await fresh.getByText('⟡ 工作台', { exact: false }).first().click({ timeout: 15000 });
  await fresh.getByText('战略总看板', { exact: true }).waitFor({ timeout: 20000 });
  await fresh.evaluate(() => { window.open = () => null; });
  await fresh.getByRole('button', { name: /打开独立驾驶舱/ }).first().click({ timeout: 10000 });
  await fresh.waitForURL(/workbench\/api\/app-page/, { timeout: 20000 });
  await fresh.getByText('主驾驶舱', { exact: false }).first().waitFor({ timeout: 20000 });
  rec('ui.integration.standalone-fallback', true, 'same-window fallback navigates when popups are blocked');
  await fresh.close();
}

try {
  await openWorkbench();
  await ensureOperators();
  rec('ui.workbench.open', true, 'strategy dashboard opened');
  await page.screenshot({ path: path.join(SHOTS, 'strategy-overview.png'), fullPage: true });
  await openRec();
  rec('ui.domain.rec.open', true, 'REC domain opened');
  await page.screenshot({ path: path.join(SHOTS, 'rec-domain.png'), fullPage: true });
  await verifyDomainClosure();
  await runWithoutApproval();
  await runApprovalFlow();
  await openStandaloneLink();
  await marketJourney();
  await wizardJourney();
  await modeJourney();
  await upgradeCenterJourney();
  await integrationHubJourney();
  await standaloneFallbackJourney();
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
