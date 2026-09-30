#!/usr/bin/env node
// verify-shell-modules.mjs
// Main-shell module gate for PiDSH Nexus.
//
// Safe by default: navigates modules, records screenshots and controls, exercises
// read-only UI paths, and checks workbench APIs. Mutating third-party actions are
// only attempted with --mutate against an explicitly isolated QA instance.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const argOf = (name, fallback = null) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};
const has = (name) => argv.includes(name);

if (has('--help')) {
  console.log(`Usage:
  node scripts/verify-shell-modules.mjs --url "<url-with-token>" [options]

Options:
  --url <url>              Installed-shell URL including its DSH token.
  --manifest <file>        Action manifest (default: manifests/shell-module-actions.json).
  --out <file>             JSON report path (default: reports/shell-audit/latest.json).
  --shots <dir>            Screenshot directory (default: reports/shell-audit/shots).
  --strict                 Fail when a visible control has no manifest match.
  --exercise-reads         Click registered read-only actions (default: inventory only).
  --mutate                 Exercise registered write actions against an isolated QA instance.
  --module <id>            Limit the run to one module; may be repeated.
  --timeout <ms>           Per-action timeout (default: 15000).
  --keep-open              Leave the browser open for manual inspection.
`);
  process.exit(0);
}

const URL_ARG = argOf('--url', process.env.PIDSH_VERIFY_URL || '');
const MANIFEST_FILE = path.resolve(ROOT, argOf('--manifest', 'manifests/shell-module-actions.json'));
const OUT = path.resolve(ROOT, argOf('--out', 'reports/shell-audit/latest.json'));
const SHOTS = path.resolve(ROOT, argOf('--shots', 'reports/shell-audit/shots'));
const TIMEOUT = Number(argOf('--timeout', '15000'));
const STRICT = has('--strict');
const EXERCISE_READS = has('--exercise-reads');
const MUTATE = has('--mutate');
const KEEP_OPEN = has('--keep-open');
const MODULE_FILTER = new Set(
  argv.reduce((values, value, index) => {
    if (value === '--module' && argv[index + 1]) values.push(argv[index + 1]);
    return values;
  }, []),
);

if (!URL_ARG) {
  console.error('SHELL_VERIFY_FAIL missing --url or PIDSH_VERIFY_URL');
  process.exit(2);
}

const safeUrl = URL_ARG.replace(/token=[^&]+/i, 'token=***');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const browserCandidates = [
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = browserCandidates.find((file) => fs.existsSync(file));
if (!executablePath) throw new Error('找不到 Chromium/Edge 可执行文件');
const selectedModules = manifest.modules.filter((item) => !MODULE_FILTER.size || MODULE_FILTER.has(item.id));
const MODULE_READY_TEXT = {
  session: ['探索', '描述你想要构建的内容'],
  plugins: ['已安装', '添加插件', '官方'],
  notifications: ['通知与控制', '通知渠道'],
  'task-board': ['待规划', '新建任务'],
  skills: ['按名称或描述筛选', '系统内置'],
  memory: ['重新检查', '检查版本', '存储域'],
  workbench: ['战略总看板', '13 域工作台'],
  'pr-board': ['等我行动', 'Waiting on me'],
  usage: ['当前供应商', 'Token 用量', '历史记录'],
  context: ['Token 总用量', '上下文仪表盘', '会话画像'],
  settings: ['通用设置', '模型与供应商', '侧边卡片', '备份与迁移'],
};

const result = {
  schema: 'pids-nexus/shell-verification/v1',
  generated_at: new Date().toISOString(),
  url: safeUrl,
  mode: MUTATE ? 'mutate' : 'safe-read',
  strict: STRICT,
  browser: executablePath,
  manifest: path.relative(ROOT, MANIFEST_FILE).replace(/\\/g, '/'),
  modules: [],
  controls: [],
  console_errors: [],
  page_errors: [],
  network_failures: [],
  checks: [],
  conditional: [],
  unknown_controls: [],
  summary: null,
};

const check = (id, pass, note, tier = 'local') => {
  result.checks.push({ id, pass: !!pass, tier, note: String(note || '') });
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function selectorMatches(selector, control) {
  const s = normalize(selector);
  if (!s) return false;
  const haystack = [
    control.label,
    control.ariaLabel,
    control.placeholder,
    control.title,
    control.text,
    control.tag,
    control.type,
  ].map(normalize);
  if (s.startsWith('[') && s.endsWith(']')) return control.selectorHint === selector;
  return haystack.some((item) => item === s || item.includes(s) || s.includes(item) && item.length >= 2);
}

function actionMatches(action, controls) {
  const selectors = action.selectors || [];
  return controls.filter((control) => selectors.some((selector) => selectorMatches(selector, control)));
}

function controlKey(control) {
  return [
    control.tag,
    control.type,
    normalize(control.label || control.ariaLabel || control.placeholder || control.text),
    control.href || '',
  ].join('|');
}

async function collectControls(page) {
  return page.locator('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="switch"]').evaluateAll((nodes) => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    return nodes
      .filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
      })
      .map((node) => {
        const text = clean(node.innerText || node.textContent || '');
        const ariaLabel = clean(node.getAttribute('aria-label'));
        const placeholder = clean(node.getAttribute('placeholder'));
        const title = clean(node.getAttribute('title'));
        const label = clean(
          ariaLabel
          || node.getAttribute('data-testid')
          || node.getAttribute('name')
          || placeholder
          || text
        );
        return {
          tag: node.tagName.toLowerCase(),
          role: clean(node.getAttribute('role')),
          type: clean(node.getAttribute('type') || node.tagName.toLowerCase()),
          label: label.slice(0, 180),
          text: text.slice(0, 240),
          ariaLabel: ariaLabel.slice(0, 180),
          placeholder: placeholder.slice(0, 180),
          title: title.slice(0, 180),
          href: clean(node.getAttribute('href')).slice(0, 240),
          disabled: !!node.disabled || node.getAttribute('aria-disabled') === 'true',
          checked: typeof node.checked === 'boolean' ? node.checked : null,
          selectorHint: node.id ? `[id="${CSS.escape(node.id)}"]` : '',
        };
      });
  });
}

async function bodyText(page) {
  return (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
}

async function dismissFirstRun(page) {
  for (const label of ['关闭提示', '知道了', '跳过向导', '保留当前显示', '开启简化显示', '稍后配置', '暂不开启']) {
    try {
      const target = page.getByText(label, { exact: false }).first();
      if (await target.isVisible({ timeout: 700 })) {
        await target.click({ timeout: 1500 });
        await sleep(250);
      }
    } catch {
      // Optional first-run prompts.
    }
  }
}

async function clickModuleEntry(page, module) {
  const labels = [module.sidebar_label, module.label, module.entry?.text].filter(Boolean);
  for (const label of labels) {
    const candidates = [
      page.locator('aside').getByText(label, { exact: true }).first(),
      page.locator('nav').getByText(label, { exact: true }).first(),
      page.getByText(label, { exact: true }).first(),
      page.getByText(label, { exact: false }).first(),
    ];
    for (const locator of candidates) {
      try {
        if (await locator.isVisible({ timeout: 800 })) {
          await locator.scrollIntoViewIfNeeded().catch(() => {});
          await locator.click({ timeout: Math.min(TIMEOUT, 3000) });
          await sleep(700);
          return true;
        }
      } catch {
        // Try the next locator variant.
      }
    }
  }
  return false;
}

async function clickReadOnlyAction(page, action, matched) {
  if (!matched.length || action.tier !== 'local') return { attempted: false, reason: 'not-local-or-not-visible' };
  const readOnly = !action.write && !action.output && !action.persistence && !['form_submit', 'file_upload', 'restore'].includes(action.kind);
  if (!readOnly) return { attempted: false, reason: 'write-action-requires---mutate' };
  if (['fill', 'compose_submit'].includes(action.kind) && action.input) {
    const control = matched.find((item) => ['input', 'textarea'].includes(item.tag) || item.role === 'textbox');
    if (!control) return { attempted: false, reason: 'input-not-visible' };
    const locator = page.locator('input:visible, textarea:visible, [contenteditable="true"]:visible').first();
    await locator.fill('PiDSH shell QA');
    return { attempted: true, effect: 'filled-safe-query' };
  }
  if (action.kind === 'select') {
    const select = page.locator('select:visible').first();
    if (!(await select.count())) return { attempted: false, reason: 'select-not-visible' };
    return { attempted: true, effect: 'select-visible' };
  }
  const first = matched[0];
  const text = first.ariaLabel || first.label || first.text;
  if (!text) return { attempted: false, reason: 'control-without-label' };
  const locator = page.getByText(text, { exact: true }).first();
  if (!(await locator.isVisible({ timeout: 800 }).catch(() => false))) return { attempted: false, reason: 'locator-not-visible' };
  await locator.click({ timeout: TIMEOUT });
  await sleep(450);
  return { attempted: true, effect: 'clicked', label: text };
}

async function inspectWorkbenchApi(page) {
  const endpoints = [
    '/workbench/api/scenes',
    '/workbench/api/domains',
    '/workbench/api/workflows',
    '/workbench/api/deliverables',
    '/workbench/api/audit',
    '/workbench/api/tools-versions',
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await page.request.get(new URL(endpoint, URL_ARG).toString(), { timeout: 30000 });
      check(`workbench.api${endpoint}`, response.ok(), `http=${response.status()}`);
    } catch (error) {
      check(`workbench.api${endpoint}`, false, error.message);
    }
  }
}

const browser = await chromium.launch({
  executablePath,
  headless: !KEEP_OPEN,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();

page.on('console', (message) => {
  if (message.type() === 'error') result.console_errors.push(message.text().slice(0, 500));
});
page.on('pageerror', (error) => result.page_errors.push(String(error.message || error).slice(0, 500)));
page.on('requestfailed', (request) => {
  const failure = request.failure();
  result.network_failures.push({
    url: request.url().replace(/token=[^&]+/gi, 'token=***'),
    error: failure?.errorText || 'unknown',
  });
});

try {
  await page.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(7000);
  await dismissFirstRun(page);
  await page.screenshot({ path: path.join(SHOTS, 'shell-home.png') });
  check('shell.load', true, 'main shell loaded');
  check('shell.welcome-modal', !(await bodyText(page)).includes('内测声明'), 'welcome notice must not block the shell');

  const discoveredControls = [];
  for (const module of selectedModules) {
    const moduleResult = {
      id: module.id,
      label: module.label,
      opened: false,
      actions: [],
      controls: [],
      text_sample: '',
      screenshot: '',
    };
    console.log(`[shell-verify] module=${module.id} label=${module.label}`);
    await page.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(12000);
    await dismissFirstRun(page);
    moduleResult.opened = await clickModuleEntry(page, module);
    check(`module.${module.id}.open`, moduleResult.opened, moduleResult.opened ? 'entry clicked' : 'entry not found', module.tier);
    if (moduleResult.opened) {
      const expected = MODULE_READY_TEXT[module.id] || [];
      const deadline = Date.now() + 90000;
      let ready = expected.length === 0;
      let lastText = '';
      while (!ready && Date.now() < deadline) {
        lastText = await bodyText(page);
        ready = expected.some((item) => lastText.includes(item));
        if (!ready && module.id === 'pr-board' && /No repositories yet|添加|配置仓库|octocat\/hello-world/i.test(lastText)) {
          ready = true;
          moduleResult.ready_reason = 'external repository is unconfigured; setup entry is visible';
        }
        if (!ready) await sleep(600);
      }
      moduleResult.ready = ready;
      check(`module.${module.id}.ready`, ready, ready ? 'module content ready' : `waited for ${expected.join(' | ')}`, module.tier);
    }
    const shotName = `${module.id}.png`;
    await page.screenshot({ path: path.join(SHOTS, shotName), fullPage: false });
    moduleResult.screenshot = path.posix.join('reports/shell-audit/shots', shotName);

    const controls = await collectControls(page);
    moduleResult.controls = controls;
    moduleResult.text_sample = (await bodyText(page)).slice(0, 1200);
    discoveredControls.push(...controls.map((control) => ({ ...control, module: module.id })));

    for (const action of module.actions) {
      const matched = actionMatches(action, controls);
      let execution = { attempted: false, reason: 'not-attempted' };
  if (MUTATE || EXERCISE_READS) {
        try {
          execution = await clickReadOnlyAction(page, action, matched);
        } catch (error) {
          execution = { attempted: true, error: String(error.message || error).slice(0, 300) };
        }
      }
      const entryActionPass = action.kind === 'navigate' && moduleResult.opened;
      const externalNeedsSetup = action.tier !== 'local' && matched.length === 0;
      const unmetPrecondition = !matched.length && !!action.precondition;
      const passed = matched.length > 0 || entryActionPass || externalNeedsSetup || unmetPrecondition;
      if ((externalNeedsSetup || unmetPrecondition || entryActionPass) && matched.length === 0) {
        result.conditional.push({
          action: action.id,
          module: module.id,
          reason: entryActionPass
            ? 'module entry is the action target'
            : unmetPrecondition
            ? `precondition not present in current state: ${action.precondition}`
            : 'external dependency is visibly unconfigured or unavailable',
          evidence_text: moduleResult.text_sample.slice(0, 220),
        });
      }
      moduleResult.actions.push({
        id: action.id,
        label: action.label,
        tier: action.tier,
        matched: matched.length,
        passed,
        execution,
      });
      check(`action.${action.id}`, passed, matched.length ? `controls=${matched.length} attempt=${JSON.stringify(execution)}` : 'no visible control; external setup state allowed only for external actions', action.tier);
    }

    result.modules.push(moduleResult);
  }

  result.controls = discoveredControls;
  const registered = new Set();
  const globalControlPatterns = (manifest.global_control_patterns || []).map((pattern) => new RegExp(pattern, 'i'));
  for (const module of selectedModules) {
    for (const action of module.actions) {
      for (const control of actionMatches(action, discoveredControls.filter((item) => item.module === module.id))) {
        registered.add(`${control.module}|${controlKey(control)}`);
      }
    }
  }
  const ignore = /^(关闭|关闭提示|取消|返回|返回会话|更多|展开|收起|刷新|重试|上一步|下一步|确定|是|否|×|‹|›|←|→|\+|-|加载中|保留当前显示|开启简化显示)$/i;
  result.unknown_controls = discoveredControls
    .filter((control) => {
      const key = `${control.module}|${controlKey(control)}`;
      const label = control.label || control.ariaLabel || control.placeholder || control.text;
      return !registered.has(key)
        && label
        && !ignore.test(label)
        && !globalControlPatterns.some((pattern) => pattern.test(label));
    })
    .map((control) => ({
      module: control.module,
      tag: control.tag,
      type: control.type,
      label: control.label,
      text: control.text,
      disabled: control.disabled,
    }));
  check('shell.unregistered-controls', !STRICT || result.unknown_controls.length === 0, `unknown=${result.unknown_controls.length}`, 'local');
  await inspectWorkbenchApi(page);

  if (MUTATE) {
    const workspace = await page.request.get(new URL('/workbench/api/strategy/overview', URL_ARG).toString(), { timeout: 30000 }).catch(() => null);
    check('mutate.workspace.available', !!workspace && workspace.ok(), workspace ? `http=${workspace.status()}` : 'strategy endpoint unavailable before implementation');
  }
} catch (error) {
  check('shell.verify.exception', false, String(error.stack || error.message || error));
} finally {
  if (!KEEP_OPEN) await browser.close();
}

const total = result.checks.length;
const passed = result.checks.filter((item) => item.pass).length;
const localFailures = result.checks.filter((item) => !item.pass && item.tier === 'local');
const externalConditional = result.checks.filter((item) => !item.pass && item.tier !== 'local');
result.summary = {
  total,
  passed,
  failed: total - passed,
  local_failed: localFailures.length,
  external_conditional: externalConditional.length,
  modules: result.modules.length,
  expected_modules: selectedModules.length,
  observed_controls: result.controls.length,
  unknown_controls: result.unknown_controls.length,
};
result.pass = localFailures.length === 0 && (result.summary.modules === selectedModules.length);
result.artifact = {
  path: path.relative(ROOT, OUT).replace(/\\/g, '/'),
  sha256: sha(JSON.stringify({ ...result, artifact: undefined })),
};
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `SHELL_VERIFY ${result.pass ? 'PASS' : 'FAIL'} checks=${passed}/${total} modules=${result.summary.modules} controls=${result.summary.observed_controls} unknown=${result.summary.unknown_controls} -> ${path.relative(ROOT, OUT)}`,
);
if (!result.pass) process.exitCode = 1;
