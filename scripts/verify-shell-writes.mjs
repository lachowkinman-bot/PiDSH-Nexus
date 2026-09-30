#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const URL_ARG = process.argv[2] || process.env.PIDSH_VERIFY_URL;
const OUT = process.argv[3] || 'reports/shell-audit/write-verification.json';
const SHOTS = path.join(ROOT, 'reports', 'shell-audit', 'shots-writes');
if (!URL_ARG) throw new Error('usage: node scripts/verify-shell-writes.mjs <url-with-token> [out]');

const browserCandidates = [
  'C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = browserCandidates.find((file) => fs.existsSync(file));
if (!executablePath) throw new Error('找不到 Chromium/Edge');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(ROOT, OUT)), { recursive: true });

const records = [];
const rec = (id, pass, note = '') => {
  records.push({ id, pass: !!pass, note: String(note) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${note}`);
};
const origin = new URL(URL_ARG).origin;
const headers = {
  Origin: origin,
  'sec-fetch-site': 'same-origin',
  'content-type': 'application/json',
};
const requestId = () => crypto.randomUUID();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();

async function openModule(label) {
  await page.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5500);
  for (const dismissLabel of ['知道了', '跳过向导', '保留当前显示', '稍后配置']) {
    try {
      const target = page.getByText(dismissLabel, { exact: false }).first();
      if (await target.isVisible({ timeout: 400 })) await target.click({ timeout: 800 });
    } catch {}
  }
  const candidates = [
    page.locator('aside').getByText(label, { exact: true }).first(),
    page.locator('aside').getByText(label, { exact: false }).first(),
    page.getByText(label, { exact: false }).first(),
  ];
  let opened = false;
  for (const target of candidates) {
    try {
      if (await target.isVisible({ timeout: 2500 })) {
        await target.click({ timeout: 5000 });
        opened = true;
        break;
      }
    } catch {}
  }
  if (!opened) throw new Error(`module entry not found: ${label}`);
  await sleep(1000);
}

async function taskBoardWriteGate() {
  await openModule('任务看板');
  const stateResponse = await page.request.get(new URL('/api/task-board/state', origin).toString(), { headers });
  rec('task-board.state.read', stateResponse.ok(), `http=${stateResponse.status()}`);
  const title = `QA Shell Task ${Date.now()}`;
  const taskId = crypto.randomUUID();
  const create = await page.request.post(new URL('/api/task-board/action', origin).toString(), {
    headers,
    data: {
      requestId: requestId(),
      action: {
        kind: 'create',
        id: taskId,
        input: {
          title,
          description: 'PiDSH shell write verification',
          prompt: '只做本地记录，不执行模型调用。',
          permission: 'read-only',
        },
      },
    },
  });
  rec('task-board.create', create.ok(), `http=${create.status()}`);
  let state = await (await page.request.get(new URL('/api/task-board/state', origin).toString(), { headers })).json();
  rec('task-board.create.persisted', JSON.stringify(state).includes(taskId), `revision=${state.revision}`);
  const action = async (kind, extra = {}) => page.request.post(new URL('/api/task-board/action', origin).toString(), {
    headers,
    data: { requestId: requestId(), action: { kind, taskId, ...extra } },
  });
  const move = await action('move', { status: 'todo' });
  rec('task-board.move', move.ok(), `http=${move.status()}`);
  const archive = await action('archive');
  rec('task-board.archive', archive.ok(), `http=${archive.status()}`);
  const restore = await action('restore');
  rec('task-board.restore', restore.ok(), `http=${restore.status()}`);
  const remove = await action('delete');
  rec('task-board.delete', remove.ok(), `http=${remove.status()}`);
  await page.screenshot({ path: path.join(SHOTS, 'task-board.png') });
}

async function skillCenterWriteGate() {
  await openModule('技能中心');
  await page.getByPlaceholder('按名称或描述筛选').waitFor({ timeout: 120000 });
  const skillName = `qa-shell-${Date.now()}`;
  const createPayload = {
    root: 'user',
    name: skillName,
    description: 'QA shell write verification',
    whenToUse: 'Only during isolated PiDSH shell verification.',
    content: '# QA shell skill\n\nThis file is created and removed by automated verification.\n',
    cwd: ROOT,
  };
  let create = await page.request.post(new URL('/api/dsh-skill-explorer/create', origin).toString(), {
    headers,
    timeout: 120000,
    data: createPayload,
  }).catch(() => null);
  if (!create || !create.ok()) {
    await sleep(1500);
    create = await page.request.post(new URL('/api/dsh-skill-explorer/create', origin).toString(), {
      headers,
      timeout: 120000,
      data: createPayload,
    }).catch(() => null);
  }
  if (!create) throw new Error('skill create request failed');
  const created = await create.json().catch(() => ({}));
  rec('skills.create', create.ok() && created.path, `http=${create.status()} path=${created.path || ''}`);
  const skillPath = created.path;
  if (!skillPath) return;
  const disabled = await page.request.post(new URL('/api/dsh-skill-explorer/set-enabled', origin).toString(), {
    headers,
    data: { name: skillName, path: skillPath, enabled: false },
  });
  rec('skills.disable', disabled.ok(), `http=${disabled.status()}`);
  const update = await page.request.post(new URL('/api/dsh-skill-explorer/update', origin).toString(), {
    headers,
    data: {
      name: skillName,
      path: skillPath,
      description: 'QA shell write verification updated',
      whenToUse: 'Only during isolated PiDSH shell verification.',
      content: '# QA shell skill\n\nUpdated and preserved disabled state.\n',
    },
  });
  rec('skills.update', update.ok(), `http=${update.status()}`);
  const remove = await page.request.post(new URL('/api/dsh-skill-explorer/delete', origin).toString(), {
    headers,
    data: { name: skillName, path: skillPath },
  });
  rec('skills.trash', remove.ok(), `http=${remove.status()}`);
  rec('skills.file.removed', !fs.existsSync(skillPath), skillPath);
  await page.screenshot({ path: path.join(SHOTS, 'skill-center.png') });
}

async function usageExportGate() {
  await openModule('用量/余额');
  const endpoints = [
    ['daily', '/api/usage-stats/export/daily.csv', 'text/csv'],
    ['sessions', '/api/usage-stats/export/sessions.csv', 'text/csv'],
    ['json', '/api/usage-stats/export.json', 'application/json'],
  ];
  for (const [id, endpoint, expectedType] of endpoints) {
    const response = await page.request.get(new URL(endpoint, origin).toString(), { headers });
    const text = await response.text();
    const contentType = response.headers()['content-type'] || '';
    const safe = !/(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]+|api[_-]?key["':=]\s*["'][^"']+)/i.test(text);
    rec(`usage.export.${id}`, response.ok() && contentType.includes(expectedType) && safe, `http=${response.status()} bytes=${Buffer.byteLength(text)} safe=${safe}`);
  }
  await page.screenshot({ path: path.join(SHOTS, 'usage.png') });
}

try {
  await taskBoardWriteGate();
  await skillCenterWriteGate();
  await usageExportGate();
} catch (error) {
  rec('shell.writes.exception', false, String(error.stack || error.message || error));
} finally {
  await browser.close();
}

const passed = records.filter((item) => item.pass).length;
const report = {
  schema: 'pids-nexus/shell-write-verification/v1',
  generated_at: new Date().toISOString(),
  url: URL_ARG.replace(/token=[^&]+/i, 'token=***'),
  pass: passed === records.length,
  passed,
  total: records.length,
  records,
};
fs.writeFileSync(path.resolve(ROOT, OUT), `${JSON.stringify(report, null, 2)}\n`);
console.log(`SHELL_WRITE_VERIFY ${report.pass ? 'PASS' : 'FAIL'} ${passed}/${records.length} -> ${OUT}`);
if (!report.pass) process.exit(1);
