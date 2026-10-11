#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const root = path.resolve(arg('--root', process.cwd()));
const reportDir = path.join(root, 'reports', '4.0');
const paths = {
  input: path.join(reportDir, 'input-bom.json'),
  init: path.join(reportDir, 'init.json'),
  runtimeUi: path.join(reportDir, 'runtime-ui.json'),
  security: path.join(reportDir, 'security-scan.json'),
  model: path.join(reportDir, 'model-capability.json'),
  pathBoundary: path.join(reportDir, 'path-boundary.json'),
  workflow: path.join(reportDir, 'workflow-live.json'),
  selection: path.join(reportDir, 'plugin-selection-verification.json'),
  upgrade: path.join(reportDir, 'upgrade-rollback.json'),
  devRebuild: path.join(reportDir, 'dev-rebuild.json')
};

function read(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const reports = Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, read(file)]));
const gateDefs = [
  ['H1', 'input-integrity', 'input', reports.input?.hashMode === 'sha256'],
  ['H2', 'runtime-offline-install', 'init', Boolean(reports.init?.steps?.some((item) => item.id === 'runtime-install' && item.status === 'PASS'))],
  ['H3', 'runtime-offline-launch-and-navigation', 'runtimeUi', Boolean(reports.runtimeUi?.ok)],
  ['H4', 'path-boundary', 'pathBoundary', Boolean(reports.pathBoundary?.ok)],
  ['H5', 'secret-and-pii-scan', 'security', Boolean(reports.security?.ok)],
  ['H6', 'model-capability-probe', 'model', Boolean(reports.model?.ok && reports.model?.capabilities?.L1)],
  ['H7', 'live-workflow', 'workflow', Boolean(reports.workflow?.ok)],
  ['H8', 'plugin-selection', 'selection', Boolean(reports.selection?.ok)],
  ['H9', 'upgrade-and-rollback', 'upgrade', Boolean(reports.upgrade?.ok)],
  ['H10', 'development-rebuild', 'devRebuild', Boolean(reports.devRebuild?.ok)]
];
const gates = gateDefs.map(([id, name, evidenceKey, pass]) => {
  const evidence = reports[evidenceKey];
  return {
    id,
    name,
    status: pass ? 'PASS' : (evidence ? 'PARTIAL' : 'NOT_RUN'),
    evidence: paths[evidenceKey] || null
  };
});

const missing = gates.filter((gate) => gate.status !== 'PASS').map((gate) => gate.id);
const summary = {
  schemaVersion: '1.0',
  gate: 'evidence-summary',
  generatedAt: new Date().toISOString(),
  gates,
  allHardGatesPass: missing.length === 0,
  missing,
  releaseRecommendation: missing.length === 0 ? 'user-choice-preview-or-stable' : 'stage-report-only',
  ok: missing.length === 0
};
const out = path.join(reportDir, 'evidence-summary.json');
fs.writeFileSync(out, JSON.stringify(summary, null, 2), 'utf8');
const portableOut = path.join(root, 'manifests', 'evidence-summary.json');
fs.mkdirSync(path.dirname(portableOut), { recursive: true });
fs.writeFileSync(portableOut, JSON.stringify(summary, null, 2), 'utf8');
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (!summary.ok) process.exitCode = 2;
