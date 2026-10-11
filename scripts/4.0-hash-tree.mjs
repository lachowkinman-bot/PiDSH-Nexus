#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const target = path.resolve(arg('--tree', process.cwd()));
const out = path.resolve(arg('--out', path.join(process.cwd(), 'reports', '4.0', 'tree-hash.json')));
if (!fs.existsSync(target)) throw new Error(`tree missing: ${target}`);

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const files = walk(target).sort();
const manifest = [];
let bytes = 0;
for (const file of files) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(file);
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  const size = fs.statSync(file).size;
  bytes += size;
  manifest.push({
    path: path.relative(target, file).replace(/\\/g, '/'),
    bytes: size,
    sha256: hash.digest('hex')
  });
}
const treeHash = crypto
  .createHash('sha256')
  .update(manifest.map((item) => `${item.path}\0${item.bytes}\0${item.sha256}`).join('\n'))
  .digest('hex');
const report = {
  schemaVersion: '1.0',
  target,
  fileCount: manifest.length,
  bytes,
  treeHash,
  files: manifest,
  generatedAt: new Date().toISOString()
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
process.stdout.write(`${JSON.stringify({ ok: true, fileCount: manifest.length, bytes, treeHash, out }, null, 2)}\n`);
