#!/usr/bin/env node
// download-catalog.mjs — 目录层下载器（跨平台；015 目录扩展：报告推荐包 → offline/catalog/）
// 用法：node scripts/download-catalog.mjs   （读取 scripts/_catalog-verified.json；幂等，重跑只补缺失）
// 安全：仅 http/https；host 白名单；拒绝回环/私有/保留地址；SHA256 记录，空哈希=失败
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const VER = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/_catalog-verified.json'), 'utf8'));
const BUNDLED = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'offline/npm/pkgmeta.json'), 'utf8')).map(r => r.base));
const ALLOWED = ['registry.npmjs.org', 'registry.npmmirror.com', 'mirrors.tencent.com', 'mirrors.cloud.tencent.com'];
const MIRROR = process.env.CATALOG_MIRROR || 'https://registry.npmjs.org';
const OUT = path.join(ROOT, 'offline/catalog');
fs.mkdirSync(OUT, { recursive: true });

const checkHost = (u) => {
  if (!/^https?:\/\//.test(u)) return false;
  const h = new URL(u).host;
  return ALLOWED.includes(h) && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?)/.test(h);
};
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const rows = []; const fail = []; let idx = 0;
const CONC = 6;
async function worker() {
  while (idx < VER.real.length) {
    const r = VER.real[idx++];
    const base = r.name.replace(/^@/, '').replace('/', '-');
    const file = `${base}-${r.version}.tgz`;
    const dest = path.join(OUT, file);
    let buf;
    try {
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { buf = fs.readFileSync(dest); }
      else {
        let url = r.tarball;
        if (MIRROR !== 'https://registry.npmjs.org') url = url.replace('https://registry.npmjs.org', MIRROR);
        if (!checkHost(url)) { fail.push([r.name, 'REJECT-HOST']); continue; }
        const res = await fetch(url);
        if (!res.ok) { fail.push([r.name, `HTTP ${res.status}`]); continue; }
        buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) { fail.push([r.name, 'EMPTY']); continue; }
        fs.writeFileSync(dest, buf);
      }
      rows.push({ name: r.name, version: r.version, file, sha256: sha256(buf), bytes: buf.length, bundled: BUNDLED.has(base) ? 'P0/P1 重叠' : 'CATALOG' });
    } catch (e) { fail.push([r.name, String(e.message).slice(0, 80)]); }
  }
}
await Promise.all(Array.from({ length: CONC }, worker));

// —— 生成目录清单 CSV ——
const csv = ['tier,rank,name,npm_name,version,tarball,sha256,bytes,overlap_with_core,status']
  .concat(rows.map((r, i) => ['CATALOG', String(i + 1).padStart(2, '0'), r.name.replace(/[/@]/g, (c) => (c === '/' ? '-' : '')), r.name, r.version, r.file, r.sha256, r.bytes, r.bundled, 'PRESET_OK'].join(',')))
  .join('\n') + '\n';
fs.writeFileSync(path.join(ROOT, 'manifests/catalog-packages.manifest.csv'), csv);
fs.writeFileSync(path.join(ROOT, 'offline/catalog/SHA256SUMS.txt'), rows.map(r => `${r.file}  ${r.sha256}`).join('\n') + '\n');
console.log(`catalog: ${rows.length} tarballs → offline/catalog/（重叠核心包 ${rows.filter(r => r.bundled !== 'CATALOG').length}，新增 ${rows.filter(r => r.bundled === 'CATALOG').length}）`);
if (fail.length) { console.log('FAILED:'); for (const [n, why] of fail) console.log(` - ${n}: ${why}`); fs.writeFileSync(path.join(ROOT, 'reports/catalog-download-failures.md'), `# catalog 下载失败登记\n\n| 包 | 原因 |\n|---|---|\n${fail.map(([n, w]) => `| ${n} | ${w} |`).join('\n')}\n`); }
