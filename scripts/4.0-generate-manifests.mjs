#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const root = path.resolve(arg('--root', process.cwd()));
const quick = process.argv.includes('--quick');
const supportRootOverride = arg('--support-root', '');

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function walk(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [{ file: target, size: stat.size }];
  const files = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push({ file: full, size: fs.statSync(full).size });
  }
  return files;
}

async function fileEntries(target) {
  if (!fs.existsSync(target)) return [];
  const entries = walk(target);
  const result = [];
  for (const item of entries) {
    result.push({
      path: path.relative(root, item.file).replace(/\\/g, '/'),
      bytes: item.size,
      sha256: await sha256File(item.file)
    });
  }
  return result;
}

function directoryStats(target) {
  if (!fs.existsSync(target)) return { fileCount: 0, bytes: 0 };
  let fileCount = 0;
  let bytes = 0;
  const stack = [target];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        fileCount += 1;
        bytes += fs.statSync(full).size;
      }
    }
  }
  return { fileCount, bytes };
}

async function runtimeEntry(relative, id) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) return null;
  const stat = fs.statSync(file);
  return {
    id,
    path: relative.replace(/\\/g, '/'),
    bytes: stat.size,
    sha256: quick ? null : await sha256File(file)
  };
}

async function buildInputBom() {
  const original = await fileEntries(path.join(root, 'inputs/original-scheme'));
  const retroFiles = [];
  const retroRoots = [
    'docs/retro/RETRO-PRD.md',
    'docs/retro/README.md',
    'reports/desktop-acceptance.md',
    '015-Universal-Workbench-通用工作台交付任务书.md',
    '016-插件化交付增补-v3.0.md'
  ];
  for (const relative of retroRoots) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) continue;
    retroFiles.push({
      path: relative.replace(/\\/g, '/'),
      bytes: fs.statSync(file).size,
      sha256: quick ? null : await sha256File(file)
    });
  }
  const adrRoot = path.join(root, 'docs/retro/adr');
  if (fs.existsSync(adrRoot)) {
    for (const entry of fs.readdirSync(adrRoot)) {
      const file = path.join(adrRoot, entry);
      if (!fs.statSync(file).isFile()) continue;
      retroFiles.push({
        path: path.relative(root, file).replace(/\\/g, '/'),
        bytes: fs.statSync(file).size,
        sha256: quick ? null : await sha256File(file)
      });
    }
  }

  const runtime = [];
  for (const [relative, id] of [
    ['offline-3.0/runtime-web.zip', 'runtime-web'],
    ['installer-output/UniversalWorkbench-Setup.exe', 'windows-installer'],
    ['offline-3.0/deepseek-ai-dsh-0.1.7-rc.2.tgz', 'dsh-engine'],
    ['offline/npm/pnpm-10.32.1.tgz', 'pnpm']
  ]) {
    const item = await runtimeEntry(relative, id);
    if (item) runtime.push(item);
  }

  const supportRoot = supportRootOverride
    ? path.resolve(supportRootOverride)
    : path.join(root, 'packs/support-source-pack/Pi_DSH_support');
  const supportArchive = path.join(root, 'packs/support-source-pack/support-source-pack.7z');
  const support = {
    path: 'packs/support-source-pack/Pi_DSH_support',
    exists: fs.existsSync(supportRoot),
    archivePath: 'packs/support-source-pack/support-source-pack.7z',
    archiveExists: fs.existsSync(supportArchive),
    archiveBytes: fs.existsSync(supportArchive) ? fs.statSync(supportArchive).size : 0,
    archiveSha256: fs.existsSync(supportArchive) && !quick ? await sha256File(supportArchive) : null,
    catalogSource: supportRootOverride
      ? 'packs/support-source-pack/support-source-pack.7z'
      : 'packs/support-source-pack/Pi_DSH_support',
    subdirectories: {}
  };
  if (support.exists) {
    for (const name of fs.readdirSync(supportRoot)) {
      const full = path.join(supportRoot, name);
      if (fs.statSync(full).isDirectory()) support.subdirectories[name] = directoryStats(full);
    }
  }

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    root,
    sourceOfTruth: [
      'docs/retro/RETRO-PRD.md',
      'docs/retro/adr/',
      'progress.md',
      'reports/',
      'manifests/'
    ],
    originalSchemeFiles: original,
    retrospectiveEvidence: retroFiles,
    runtimeArtifacts: runtime,
    supportSource: support,
    hashMode: quick ? 'metadata-only' : 'sha256'
  };
}

async function pluginEntry(kind, dir, logicalSourcePath) {
  const packageJson = path.join(dir, 'package.json');
  if (!fs.existsSync(packageJson)) return null;
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  } catch {
    return null;
  }
  const stats = quick ? { fileCount: null, bytes: null } : directoryStats(dir);
  return {
    id: path.basename(dir),
    kind,
    packageName: pkg.name || path.basename(dir),
    version: pkg.version || '',
    license: pkg.license || pkg.licenses || '',
    dependencies: Object.keys(pkg.dependencies || {}),
    peerDependencies: Object.keys(pkg.peerDependencies || {}),
    sourcePath: logicalSourcePath,
    packageJsonSha256: quick ? null : await sha256File(packageJson),
    fileCount: stats.fileCount,
    bytes: stats.bytes
  };
}

async function buildPluginCatalog() {
  const base = supportRootOverride
    ? path.resolve(supportRootOverride)
    : path.join(root, 'packs/support-source-pack/Pi_DSH_support');
  const items = [];
  for (const [kind, subdir] of [['dsh-plugin', 'dsh-plugins'], ['pi-package', 'pi-packages']]) {
    const parent = path.join(base, subdir);
    if (!fs.existsSync(parent)) continue;
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const item = await pluginEntry(
        kind,
        path.join(parent, entry.name),
        `packs/support-source-pack/Pi_DSH_support/${subdir}/${entry.name}`
      );
      if (item) items.push(item);
    }
  }
  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    policy: 'selected-only',
    sourceRoot: 'packs/support-source-pack/Pi_DSH_support',
    count: items.length,
    items
  };
}

function writeJson(relative, value) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

const [inputBom, pluginCatalog] = await Promise.all([buildInputBom(), buildPluginCatalog()]);
writeJson('reports/4.0/input-bom.json', inputBom);
writeJson('manifests/input-bom.json', inputBom);
writeJson('manifests/plugin-catalog.json', pluginCatalog);
process.stdout.write(`${JSON.stringify({
  ok: true,
  inputBom: 'reports/4.0/input-bom.json',
  portableInputBom: 'manifests/input-bom.json',
  pluginCatalog: 'manifests/plugin-catalog.json',
  originalFiles: inputBom.originalSchemeFiles.length,
  pluginCount: pluginCatalog.count,
  support: inputBom.supportSource
}, null, 2)}\n`);
