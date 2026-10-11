#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const root = path.resolve(arg('--root', process.cwd()));
const sbomPath = path.join(root, 'manifests', 'sbom.json');
const noticesPath = path.join(root, 'THIRD_PARTY_NOTICES.md');
const components = [];

const lockFile = path.join(root, 'package-lock.json');
if (fs.existsSync(lockFile)) {
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  for (const [location, value] of Object.entries(lock.packages || {})) {
    if (!location || !value?.version) continue;
    components.push({
      type: 'library',
      name: value.name || location.replace(/^node_modules\//, ''),
      version: value.version,
      license: value.license || '',
      source: 'package-lock.json',
      hash: value.integrity || ''
    });
  }
}

const catalogFile = path.join(root, 'manifests', 'plugin-catalog.json');
if (fs.existsSync(catalogFile)) {
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  for (const item of catalog.items || []) {
    components.push({
      type: 'plugin',
      name: item.packageName || item.id,
      version: item.version || '',
      license: item.license || '',
      source: item.sourcePath,
      hash: item.packageJsonSha256 || ''
    });
  }
}

const offlineSums = path.join(root, 'offline', 'npm', 'SHA256SUMS.txt');
if (fs.existsSync(offlineSums)) {
  for (const line of fs.readFileSync(offlineSums, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([0-9a-f]{64})\s+(.+)$/i);
    if (!match) continue;
    components.push({
      type: 'offline-package',
      name: match[2],
      version: '',
      license: '',
      source: 'offline/npm/SHA256SUMS.txt',
      hash: `sha256:${match[1].toLowerCase()}`
    });
  }
}

const unique = new Map();
for (const component of components) {
  const key = `${component.type}\0${component.name}\0${component.version}\0${component.source}`;
  if (!unique.has(key)) unique.set(key, component);
}

const sbom = {
  schemaVersion: '1.0',
  format: 'WorkbenchSBOM',
  generatedAt: new Date().toISOString(),
  root,
  componentCount: unique.size,
  components: [...unique.values()].sort((a, b) => a.name.localeCompare(b.name))
};
fs.mkdirSync(path.dirname(sbomPath), { recursive: true });
fs.writeFileSync(sbomPath, JSON.stringify(sbom, null, 2), 'utf8');

const missingLicense = sbom.components.filter((item) => !item.license);
const notices = [
  '# Third-Party Notices',
  '',
  `Generated from package-lock.json, offline SHA256SUMS.txt, and the optional plugin catalog on ${sbom.generatedAt}.`,
  '',
  `- Components: ${sbom.componentCount}`,
  `- Components without an extracted license field: ${missingLicense.length}`,
  '',
  'This file is an inventory gate, not a substitute for the license text shipped by each upstream package.',
  'Before publishing stable, review every non-empty license field and add required upstream notices to the immutable release directory.',
  ''
].join('\n');
fs.writeFileSync(noticesPath, notices, 'utf8');
process.stdout.write(`${JSON.stringify({ ok: true, componentCount: sbom.componentCount, missingLicense: missingLicense.length, sbom: 'manifests/sbom.json' }, null, 2)}\n`);
