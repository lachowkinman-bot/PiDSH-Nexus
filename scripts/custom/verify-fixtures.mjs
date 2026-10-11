#!/usr/bin/env node
// verify-fixtures.mjs — 自定义工作台夹具验证（正例必须通过、反例必须给出机器可读缺口）
// 用法：node scripts/custom/verify-fixtures.mjs [--root <bundle 根>] [--workspace <隔离数据根>]
// 说明：在隔离 QA 数据根里生成草稿并运行快检链；不污染产品基线，不写 bundle 资产。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkspaceRoot } from '../../workbench-ui-plugin/lib/platform.mjs';
import { createDraft, verifyDraft, draftPath } from '../../workbench-ui-plugin/lib/custom-drafts.mjs';
import { installWorkbenchFromDraft, installSample, listInstalled, uninstallWorkbench } from '../../workbench-ui-plugin/lib/runtime-workbenches.mjs';
import { importDomainData } from '../../workbench-ui-plugin/lib/data-plane.mjs';

const argv = process.argv.slice(2);
const argOf = (name, fallback = null) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};

function resolveRoot() {
  const explicit = argOf('--root');
  const candidates = [explicit, process.cwd(), path.resolve(fileURLToPath(import.meta.url), '../../..')].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'manifests', 'domain-delivery.json'))) return path.resolve(candidate);
  }
  throw new Error('找不到 bundle 根（需 manifests/domain-delivery.json）');
}

function copyTree(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function evaluate(report, expect) {
  const problems = [];
  if (typeof expect.ok === 'boolean' && report.ok !== expect.ok) problems.push(`ok=${report.ok}，期望 ${expect.ok}`);
  if (typeof expect.domainOk === 'boolean' && report.domain_checks.ok !== expect.domainOk) {
    problems.push(`domain_checks.ok=${report.domain_checks.ok}，期望 ${expect.domainOk}`);
  }
  if (expect.baselineStatus && report.baseline_gates.status !== expect.baselineStatus) {
    problems.push(`baseline=${report.baseline_gates.status}，期望 ${expect.baselineStatus}`);
  }
  if (typeof expect.baselinePending === 'boolean' && !!report.baseline_pending !== expect.baselinePending) {
    problems.push(`baseline_pending=${report.baseline_pending}，期望 ${expect.baselinePending}`);
  }
  const haystack = [
    ...(report.gaps || []),
    ...(report.domain_checks.steps || []).map((step) => `${step.stdout_tail}\n${step.stderr_tail}`),
    ...(report.baseline_gates.steps || []).map((step) => `${step.stdout_tail}\n${step.stderr_tail}`),
  ].join('\n');
  for (const pattern of expect.gapsLike || []) {
    if (!new RegExp(pattern, 'i').test(haystack)) problems.push(`缺口未出现：/${pattern}/`);
  }
  return problems;
}

const root = resolveRoot();
const fixturesDir = path.join(root, 'scripts', 'custom', 'fixtures');
if (!fs.existsSync(fixturesDir)) throw new Error(`缺少夹具目录：${fixturesDir}`);
const workspaceRoot = path.resolve(argOf('--workspace') || path.join(root, '.work', `custom-fixtures-${Date.now()}`));

const records = [];
for (const name of fs.readdirSync(fixturesDir).sort()) {
  const fixtureDir = path.join(fixturesDir, name);
  const specFile = path.join(fixtureDir, 'fixture.json');
  if (!fs.existsSync(specFile)) continue;
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const entry = { fixture: name, draft: null, problems: [] };
  try {
    if (spec.action === 'sample-install') {
      const result = installSample({ bundleRoot: root, workspaceRoot, sampleId: spec.sampleId });
      entry.installed = result.id;
      entry.install = { ok: result.ok, kind: result.kind, checks: (result.evidence.checks || []).length };
      const installed = listInstalled(workspaceRoot).map((item) => item.install);
      if (!installed.some((item) => item.id === spec.sampleId && item.status === 'installed')) entry.problems.push('安装后未出现在已安装清单');
      if (spec.expect?.definitionsFor) {
        const platformModule = await import('../../workbench-ui-plugin/lib/platform.mjs');
        const service = platformModule.createWorkbenchPlatform({ root, workspaceRoot, audit: () => {} });
        const defs = service.definitions().filter((item) => item.domain === spec.expect.definitionsFor);
        entry.definitions = defs.length;
        if (!defs.length || defs.some((item) => !item.stages || !item.stages.length)) entry.problems.push('运行时域缺少工作流定义/阶段');
      }
      records.push({ ...entry, pass: entry.problems.length === 0 });
      continue;
    }
    if (spec.action === 'uninstall') {
      const result = uninstallWorkbench({ workspaceRoot, id: spec.id });
      const still = listInstalled(workspaceRoot).some((item) => item.install.id === spec.id);
      if (still) entry.problems.push('卸载后仍在已安装清单');
      entry.uninstall = { ok: result.ok, data_kept: result.data_kept };
      records.push({ ...entry, pass: entry.problems.length === 0 });
      continue;
    }
    if (spec.action === 'import') {
      const result = await importDomainData({ bundleRoot: root, workspaceRoot, body: spec.import });
      entry.import = { ok: result.ok, preview: !!result.preview, rows: result.rows || 0, mode: result.mode };
      const expect = spec.expect || {};
      if (typeof expect.ok === 'boolean' && result.ok !== expect.ok) entry.problems.push(`import.ok=${result.ok}，期望 ${expect.ok}`);
      if (expect.missingLike) {
        const missing = (result.validation && result.validation.missing) || [];
        if (!missing.some((item) => String(item).includes(expect.missingLike))) entry.problems.push(`缺失列未出现：${expect.missingLike}`);
      }
      if (expect.extraLike) {
        const extra = (result.validation && result.validation.extra) || [];
        if (!extra.some((item) => String(item).includes(expect.extraLike))) entry.problems.push(`多余列未出现：${expect.extraLike}`);
      }
      records.push({ ...entry, pass: entry.problems.length === 0 });
      continue;
    }
    const draft = createDraft({
      workspaceRoot,
      bundleRoot: root,
      kind: spec.draft.kind,
      targetDomain: spec.draft.targetDomain || '',
      newDomain: spec.draft.newDomain || '',
      title: spec.draft.title || name,
      requirements: spec.draft.requirements || `夹具 ${name}`,
    });
    entry.draft = draft.id;
    const overlayTarget = path.join(draftPath(workspaceRoot, draft.id), 'overlay');
    copyTree(path.join(fixtureDir, 'overlay'), overlayTarget);
    const appendFile = path.join(fixtureDir, 'append.json');
    if (fs.existsSync(appendFile)) {
      const appends = JSON.parse(fs.readFileSync(appendFile, 'utf8'));
      for (const [rel, lines] of Object.entries(appends)) {
        const source = path.join(root, rel);
        const base = fs.existsSync(source) ? fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n') : '';
        const content = base.replace(/\n?$/, '\n') + lines.join('\n') + '\n';
        const target = path.join(overlayTarget, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, 'utf8');
      }
    }
    const report = verifyDraft({ bundleRoot: root, workspaceRoot, draftId: draft.id, full: false });
    entry.status = report.status;
    entry.verify = {
      ok: report.ok,
      domain_ok: report.domain_checks.ok,
      baseline: report.baseline_gates.status,
      baseline_pending: !!report.baseline_pending,
      heavy: report.heavy_gates.status,
      gaps: (report.gaps || []).slice(0, 6),
    };
    entry.problems = evaluate(report, spec.expect || {});
    if (!entry.problems.length && spec.runtime && spec.runtime.install) {
      const result = installWorkbenchFromDraft({ bundleRoot: root, workspaceRoot, draftId: draft.id });
      entry.installed = result.id;
      entry.install = { ok: result.ok, kind: result.kind };
      if (spec.runtime.definitionsFor) {
        const platformModule = await import('../../workbench-ui-plugin/lib/platform.mjs');
        const service = platformModule.createWorkbenchPlatform({ root, workspaceRoot, audit: () => {} });
        const defs = service.definitions().filter((item) => item.domain === spec.runtime.definitionsFor);
        entry.definitions = defs.length;
        if (!defs.length || defs.some((item) => !item.stages || !item.stages.length)) entry.problems.push('安装后运行时域缺少工作流定义/阶段');
      }
    }
  } catch (error) {
    entry.problems.push(String(error.message || error));
  }
  entry.pass = entry.problems.length === 0;
  records.push(entry);
}

const passed = records.filter((item) => item.pass).length;
console.log(`CUSTOM_FIXTURES ${passed === records.length ? 'PASS' : 'FAIL'} ${passed}/${records.length} workspace=${workspaceRoot.replace(/\\/g, '/')}`);
for (const item of records) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.fixture} draft=${item.draft || '-'} ${item.verify ? `ok=${item.verify.ok} domain=${item.verify.domain_ok} baseline=${item.verify.baseline}` : ''}`);
  for (const problem of item.problems) console.log(`   - ${problem}`);
  for (const gap of (item.verify && item.verify.gaps) || []) console.log(`   gap: ${gap}`);
}
try {
  fs.mkdirSync(path.join(root, 'reports', 'custom'), { recursive: true });
  fs.writeFileSync(path.join(root, 'reports', 'custom', 'fixtures.json'), JSON.stringify({
    schema: 'pids-nexus/custom-fixtures/v1',
    generated_at: new Date().toISOString(),
    workspace: workspaceRoot.replace(/\\/g, '/'),
    passed,
    total: records.length,
    records,
  }, null, 2), 'utf8');
} catch { /* 证据写入失败不影响判定 */ }
process.exitCode = passed === records.length ? 0 : 1;
