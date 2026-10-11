#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const root = path.resolve(arg('--root', process.cwd()));
const lockPath = path.resolve(arg('--lock', path.join(root, 'selection.lock')));
const catalogPath = path.resolve(arg('--catalog', path.join(root, 'manifests', 'plugin-catalog.json')));
const outPath = path.resolve(arg('--out', path.join(root, 'reports', '4.0', 'plugin-selection-verification.json')));

if (!fs.existsSync(lockPath)) throw new Error(`selection lock missing: ${lockPath}`);
if (!fs.existsSync(catalogPath)) throw new Error(`plugin catalog missing: ${catalogPath}`);

const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const byId = new Map((catalog.items || []).map((item) => [item.id, item]));
const byName = new Map();
for (const item of catalog.items || []) {
  const list = byName.get(item.packageName) || [];
  list.push(item);
  byName.set(item.packageName, list);
}

const selectedIds = new Set((lock.selected || []).map((item) => item.id));
const selectedNames = new Set();
const missing = [];
const unresolvedDependencies = [];
const unresolvedPeers = [];
const externalDependencies = [];

for (const selected of lock.selected || []) {
  const item = byId.get(selected.id);
  if (!item) {
    missing.push(selected.id);
    continue;
  }
  selectedNames.add(item.packageName);
}

for (const id of selectedIds) {
  const item = byId.get(id);
  if (!item) continue;
  for (const dependency of item.dependencies || []) {
    if (selectedNames.has(dependency)) continue;
    if (byName.has(dependency)) unresolvedDependencies.push({ id, dependency });
    else externalDependencies.push({ id, dependency });
  }
  for (const peer of item.peerDependencies || []) {
    if (selectedNames.has(peer)) continue;
    if (byName.has(peer)) unresolvedPeers.push({ id, peer });
  }
}

const report = {
  schemaVersion: '1.0',
  gate: 'plugin-selection-verification',
  lock: path.relative(root, lockPath).replace(/\\/g, '/'),
  catalog: path.relative(root, catalogPath).replace(/\\/g, '/'),
  selected: [...selectedIds],
  missing,
  unresolvedDependencies,
  unresolvedPeers,
  externalDependencies,
  policies: {
    selectedOnly: true,
    installAll: false
  },
  ok: missing.length === 0 && unresolvedPeers.length === 0,
  finishedAt: new Date().toISOString()
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 2;
