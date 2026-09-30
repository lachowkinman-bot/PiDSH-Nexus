#!/usr/bin/env node
// gen-runtime-manifest.mjs — 由固定清单生成 runtime 的 package.json（构建期门禁，缺包即失败）
//
// 用法：
//   node scripts/gen-runtime-manifest.mjs                       # 由 manifests/runtime-bundles.json 生成 manifests/runtime-web.package.json
//   node scripts/gen-runtime-manifest.mjs --sync-from-profile   # 维护模式：从 .dsh-home/profiles/web 重算固定清单（去重规则见下）
//
// 去重规则（2026-09-30 用户决策）：同类插件在 bundle 列表里只保留版本较新的一个；
// 版本相同则保留带 scope 的包。被去重者仍进入依赖（随安装包分发），但不加载。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BUNDLES_FILE = path.join(ROOT, 'manifests/runtime-bundles.json');
const OUT_FILE = path.join(ROOT, 'manifests/runtime-web.package.json');
const PROFILE_PKG = path.join(ROOT, '.dsh-home/profiles/web/package.json');
const DSH_VERSION = '0.1.7-rc.2';
const BUILTIN = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@workbench/client-ui'];
// 同类插件对（首项为旧/被替换者）：去重时按版本较高者保留
const DUPLICATE_PAIRS = [
  ['dsh-auto-memory', '@a9i5k4/dsh-auto-memory'],
  ['dsh-genui', '@changfenhuang/dsh-genui'],
  ['@steven-wu/dsh-cost-meter', 'dsh-cost-meter'],
  ['dsh-git-graph', '@linxin666/dsh-client-ui-git-graph'],
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function tarballs() {
  const out = [];
  for (const dir of ['offline/catalog', 'offline/npm']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) if (f.endsWith('.tgz')) out.push({ dir, file: f });
  }
  return out;
}

function resolveSource(name, pool) {
  if (BUILTIN.includes(name)) return 'builtin';
  const slug = name.replace(/^@/, '').replace(/\//g, '-');
  const hit = pool.find((t) => t.file.startsWith(`${slug}-`));
  return hit ? `${hit.dir}/${hit.file}` : null;
}

function versionOf(name) {
  for (const base of ['.dsh-home/profiles/web/node_modules', '.work/runtime-web/node_modules']) {
    const file = path.join(ROOT, base, name, 'package.json');
    if (fs.existsSync(file)) return readJson(file).version || '0.0.0';
  }
  return null;
}

function newerVersion(a, b) {
  const pick = (v) => String(v).split(/[.-]/).slice(0, 3).map((x) => Number.parseInt(x, 10) || 0);
  const [pa, pb] = [pick(a), pick(b)];
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
}

function syncFromProfile() {
  const profile = readJson(PROFILE_PKG);
  const names = profile.dsh.profile.bundles;
  const pool = tarballs();
  const dropped = new Map();
  for (const [oldName, newName] of DUPLICATE_PAIRS) {
    if (!names.includes(oldName) || !names.includes(newName)) continue;
    const [va, vb] = [versionOf(oldName), versionOf(newName)];
    if (!va || !vb) throw new Error(`无法读取版本：${oldName}=${va} ${newName}=${vb}`);
    const cmp = newerVersion(va, vb);
    const keep = cmp === 0 ? (newName.startsWith('@') ? newName : oldName) : (cmp > 0 ? oldName : newName);
    const drop = keep === oldName ? newName : oldName;
    dropped.set(drop, { replaces: keep, reason: `${keep}@${keep === oldName ? va : vb} 较新` });
  }
  const entries = names.map((name) => {
    const source = resolveSource(name, pool);
    if (!source) throw new Error(`清单内包缺离线 tar 包：${name}`);
    const entry = { name, source, load: !dropped.has(name) };
    if (dropped.has(name)) entry.droppedBecause = dropped.get(name).reason;
    return entry;
  });
  const payload = {
    generatedFrom: '.dsh-home/profiles/web/package.json',
    generatedAt: new Date().toISOString(),
    dedupeRule: '同名同类插件保留版本较新者；版本相同保留 scope 包',
    total: entries.length,
    loaded: entries.filter((e) => e.load).length,
    entries,
  };
  fs.writeFileSync(BUNDLES_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function buildManifest() {
  if (!fs.existsSync(BUNDLES_FILE)) throw new Error(`缺少固定清单：${BUNDLES_FILE}`);
  const spec = readJson(BUNDLES_FILE);
  const pool = tarballs();
  const deps = { '@deepseek-ai/dsh': DSH_VERSION, '@workbench/client-ui': 'file:../../workbench-ui-plugin' };
  const bundles = [];
  const missing = [];
  for (const entry of spec.entries) {
    if (entry.source === 'builtin') {
      if (entry.load) bundles.push(entry.name);
      continue;
    }
    if (!fs.existsSync(path.join(ROOT, entry.source))) {
      missing.push(`${entry.name} → ${entry.source}`);
      continue;
    }
    deps[entry.name] = `file:../../${entry.source}`;
    if (entry.load) bundles.push(entry.name);
  }
  if (missing.length) throw new Error(`清单内包缺离线 tar 包：\n${missing.join('\n')}`);
  if (bundles.length !== spec.loaded) {
    throw new Error(`bundle 数量不一致：清单声明 ${spec.loaded}，实际 ${bundles.length}`);
  }
  const manifest = {
    name: 'universal-workbench-runtime-web',
    private: true,
    version: '3.0.0',
    type: 'module',
    dependencies: deps,
    overrides: {
      '@deepseek-ai/dsh-attachment': DSH_VERSION,
      '@deepseek-ai/dsh-sdk-protocol': DSH_VERSION,
    },
    dsh: { profile: { bundles } },
  };
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  return { bundles: bundles.length, deps: Object.keys(deps).length, shippedNotLoaded: spec.total - spec.loaded };
}

if (process.argv.includes('--sync-from-profile')) {
  const spec = syncFromProfile();
  console.log(`SYNC_OK total=${spec.total} loaded=${spec.loaded} → ${path.relative(ROOT, BUNDLES_FILE)}`);
} else {
  const r = buildManifest();
  console.log(`GEN_OK bundles=${r.bundles} deps=${r.deps} shippedNotLoaded=${r.shippedNotLoaded} → ${path.relative(ROOT, OUT_FILE)}`);
}
