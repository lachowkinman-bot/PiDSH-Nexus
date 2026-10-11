// workbench-package.mjs — 工作台包 v2（校验 / .tgz 读写 / 导出 / 目录登记）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const PACKAGE_SCHEMA = 'pids-nexus/workbench-package/v2';
export const PACKAGE_MAX_BYTES = 8 * 1024 * 1024;

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const semver = (value) => typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);

export function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
export function jpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}
export function imageSize(buffer) {
  return pngSize(buffer) || jpegSize(buffer);
}

export function validatePackageV2({ manifest, dir }) {
  const problems = [];
  const need = (condition, message) => { if (!condition) problems.push(message); };
  need(manifest && typeof manifest === 'object', '包缺少 workbench.json');
  if (manifest && typeof manifest === 'object') {
    need(manifest.schema === PACKAGE_SCHEMA, `workbench.json schema 必须是 ${PACKAGE_SCHEMA}`);
    need(typeof manifest.id === 'string' && (/^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*$/.test(manifest.id) || /^pids:[a-z][a-z0-9-]{1,63}$/.test(manifest.id)), 'id 必须是 owner/repo 或 pids:<domain>');
    need(typeof manifest.name === 'string' && manifest.name.trim() !== '', '缺少 name');
    need(semver(manifest.version), 'version 必须是完整 SemVer（如 1.2.0）');
    need(typeof manifest.license === 'string' && manifest.license.trim() !== '', '缺少 license');
    need(typeof manifest.category === 'string' && manifest.category.trim() !== '', '缺少 category');
    need(manifest.description && typeof manifest.description.zh === 'string' && typeof manifest.description.en === 'string', '缺少 description.zh / description.en');
    need(Array.isArray(manifest.files), '缺少 files（资产清单：path/sha256/bytes）');
    need(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 1, '至少需要一张 screenshots（file/alt/sha256/width/height/bytes）');
  }
  if (!problems.length) {
    const assetsDir = path.join(dir, manifest.assets || 'assets');
    if (!fs.existsSync(assetsDir)) problems.push(`资产目录不存在：${manifest.assets || 'assets'}`);
    for (const file of manifest.files) {
      const target = path.join(assetsDir, file.path);
      if (!fs.existsSync(target)) { problems.push(`资产缺失：${file.path}`); continue; }
      const buffer = fs.readFileSync(target);
      if (file.sha256 !== sha256(buffer)) problems.push(`资产哈希不一致：${file.path}`);
      if (Number.isFinite(file.bytes) && file.bytes !== buffer.length) problems.push(`资产字节数不一致：${file.path}`);
    }
    for (const shot of manifest.screenshots) {
      const target = path.join(dir, shot.file);
      if (!fs.existsSync(target)) { problems.push(`截图缺失：${shot.file}`); continue; }
      const buffer = fs.readFileSync(target);
      if (shot.sha256 !== sha256(buffer)) problems.push(`截图哈希不一致：${shot.file}`);
      if (Number.isFinite(shot.bytes) && shot.bytes !== buffer.length) problems.push(`截图字节数不一致：${shot.file}`);
      const size = imageSize(buffer);
      if (!size) { problems.push(`截图不是受支持的 PNG/JPEG：${shot.file}`); continue; }
      if (shot.width !== size.width || shot.height !== size.height) problems.push(`截图尺寸不一致：${shot.file}（声明 ${shot.width}x${shot.height}，实际 ${size.width}x${size.height}）`);
      if (typeof shot.alt !== 'string' || !shot.alt.trim()) problems.push(`截图缺少 alt：${shot.file}`);
    }
  }
  return { ok: problems.length === 0, problems, schema: PACKAGE_SCHEMA };
}

export function buildPackageManifest({ id, name, version, license, category, description, audience, requirements, dir, assets = 'assets' }) {
  const assetsDir = path.join(dir, assets);
  const files = [];
  const walk = (target, base = assetsDir) => {
    if (!fs.existsSync(target)) return;
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      const full = path.join(target, entry.name);
      if (entry.isDirectory()) walk(full, base);
      else if (entry.isFile()) {
        const buffer = fs.readFileSync(full);
        files.push({ path: path.relative(base, full).replace(/\\/g, '/'), sha256: sha256(buffer), bytes: buffer.length });
      }
    }
  };
  walk(assetsDir);
  const screenshots = [];
  const shotsDir = path.join(dir, 'screenshots');
  if (fs.existsSync(shotsDir)) {
    for (const file of fs.readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name)).sort()) {
      const buffer = fs.readFileSync(path.join(shotsDir, file));
      const size = imageSize(buffer);
      if (!size) continue;
      screenshots.push({ file: `screenshots/${file}`, alt: `${name} ${file}`, sha256: sha256(buffer), width: size.width, height: size.height, bytes: buffer.length });
    }
  }
  return {
    schema: PACKAGE_SCHEMA,
    id,
    name,
    version,
    license,
    category,
    description,
    ...(audience ? { audience } : {}),
    ...(requirements ? { requirements } : {}),
    assets,
    files,
    screenshots,
  };
}

// —— .tgz 读写（npm 风格 package/ 前缀；不落地解压）——
export function readPackedManifest(tgzBuffer) {
  let tar;
  try { tar = zlib.gunzipSync(tgzBuffer, { maxOutputLength: 64 * 1024 * 1024 }); } catch { return null; }
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0[\s\S]*$/u, '').trim();
    const size = Number.parseInt(field(124, 12) || '0', 8);
    if (!Number.isSafeInteger(size) || size < 0) break;
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    if ((field(156, 1) === '0' || field(156, 1) === '') && name.split('/').slice(1).join('/') === 'package.json') {
      try { return JSON.parse(tar.subarray(offset + 512, offset + 512 + size).toString('utf8')); } catch { return null; }
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return null;
}

export function listTarEntries(tgzBuffer) {
  let tar;
  try { tar = zlib.gunzipSync(tgzBuffer, { maxOutputLength: 128 * 1024 * 1024 }); } catch { return []; }
  const entries = [];
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0[\s\S]*$/u, '').trim();
    const size = Number.parseInt(field(124, 12) || '0', 8);
    if (!Number.isSafeInteger(size) || size < 0) break;
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const type = field(156, 1);
    const data = (type === '0' || type === '') ? tar.subarray(offset + 512, offset + 512 + size) : Buffer.alloc(0);
    entries.push({ name, type: type || '0', size, data });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function tarHeader(name, size) {
  const header = Buffer.alloc(512);
  const write = (value, start, length) => { Buffer.from(value).copy(header, start, 0, Math.min(length, Buffer.byteLength(value))); };
  write(name.slice(0, 100), 0, 100);
  write('0000644', 100, 8);
  write('0000000', 108, 8);
  write('0000000', 116, 8);
  write(size.toString(8).padStart(11, '0'), 124, 12);
  write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0'), 136, 12);
  write('        ', 148, 8);
  header[156] = '0'.charCodeAt(0);
  write('ustar', 257, 6);
  write('00', 263, 2);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  write(checksum.toString(8).padStart(6, '0'), 148, 8);
  header[154] = 0;
  header[155] = 32;
  return header;
}

export function packTarGz(files) {
  const chunks = [];
  for (const file of files) {
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data), 'utf8');
    chunks.push(tarHeader(file.name, data.length), data);
    const padding = (512 - (data.length % 512)) % 512;
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(chunks), { level: 9 });
}

export function exportWorkbenchPackage({ installedDir, outFile, name, version, license = 'Apache-2.0', category = 'local', description = null, audience = null, screenshotsDir = null }) {
  const install = JSON.parse(fs.readFileSync(path.join(installedDir, 'install.json'), 'utf8'));
  const staging = fs.mkdtempSync(path.join(installedDir, '.export-'));
  try {
    const assetsSource = fs.existsSync(path.join(installedDir, 'assets', 'templates'))
      || fs.existsSync(path.join(installedDir, 'assets', 'manifests'))
      ? path.join(installedDir, 'assets')
      : null;
    if (!assetsSource) throw new Error('该工作台没有可导出的资产（assets/ 为空）。');
    fs.mkdirSync(path.join(staging, 'screenshots'), { recursive: true });
    fs.cpSync(assetsSource, path.join(staging, 'assets'), { recursive: true });
    const shotsSource = screenshotsDir || path.join(installedDir, 'screenshots');
    if (fs.existsSync(shotsSource)) {
      for (const file of fs.readdirSync(shotsSource).filter((item) => /\.(png|jpe?g)$/i.test(item))) {
        fs.copyFileSync(path.join(shotsSource, file), path.join(staging, 'screenshots', file));
      }
    }
    const manifest = buildPackageManifest({
      id: install.catalog_id || `pids:${install.id}`,
      name: name || install.name || install.title || install.id,
      version: version || install.version || '1.0.0',
      license,
      category,
      description: description || { zh: `${install.title || install.id} 工作台包（导出）`, en: `${install.id} workbench package (exported)` },
      audience,
      dir: staging,
    });
    fs.writeFileSync(path.join(staging, 'workbench.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(staging, 'README.md'), `# ${manifest.name}\n\n- id: ${manifest.id}\n- version: ${manifest.version}\n- license: ${manifest.license}\n\n本包由 PiDSH Nexus 工作台市场导出；安装方式见 workbench.json 与 assets/。\n`, 'utf8');
    const files = [];
    const collect = (dir, prefix) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collect(full, `${prefix}${entry.name}/`);
        else files.push({ name: `package/${prefix}${entry.name}`, data: fs.readFileSync(full) });
      }
    };
    collect(staging, '');
    const tgz = packTarGz(files);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, tgz);
    return {
      ok: true,
      outFile: outFile.replace(/\\/g, '/'),
      bytes: tgz.length,
      sha256: sha256(tgz),
      manifest,
    };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

export function registerCatalogEntry({ workspaceRoot, entry }) {
  const catalogFile = path.join(workspaceRoot, 'custom', 'catalog-local.json');
  const doc = (() => {
    try { return JSON.parse(fs.readFileSync(catalogFile, 'utf8')); } catch {
      return { schemaVersion: 2, kind: 'catalog', categories: [{ id: 'local', name: '本地工作台' }], workbenches: [] };
    }
  })();
  if (!doc.categories.some((category) => category.id === entry.category)) {
    doc.categories.push({ id: entry.category, name: entry.category });
  }
  doc.workbenches = doc.workbenches.filter((item) => item.id !== entry.id);
  doc.workbenches.push(entry);
  fs.mkdirSync(path.dirname(catalogFile), { recursive: true });
  fs.writeFileSync(catalogFile, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  const sourcesFile = path.join(workspaceRoot, 'config', 'market-sources.json');
  const sources = (() => {
    try { return JSON.parse(fs.readFileSync(sourcesFile, 'utf8')); } catch { return { schema: 'pids-nexus/market-sources/v1', allowRemote: false, sources: [] }; }
  })();
  if (!sources.sources.some((source) => source.type === 'file' && String(source.path || '').endsWith('catalog-local.json'))) {
    sources.sources.push({ id: 'local', type: 'file', path: catalogFile, enabled: true });
  }
  fs.mkdirSync(path.dirname(sourcesFile), { recursive: true });
  fs.writeFileSync(sourcesFile, `${JSON.stringify(sources, null, 2)}\n`, 'utf8');
  return { ok: true, catalogFile: catalogFile.replace(/\\/g, '/'), sourcesFile: sourcesFile.replace(/\\/g, '/'), entries: doc.workbenches.length };
}
