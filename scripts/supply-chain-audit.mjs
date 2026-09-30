#!/usr/bin/env node
// supply-chain-audit.mjs — U6 第三件套补充：tarball 包生命周期脚本/双bin盘点（代码级抽查的机械部分）
// 用法：node scripts/supply-chain-audit.mjs [offline/npm] [offline/catalog]
// 产物：reports/security-scan/lifecycle-inventory.csv（pkg,version,lifecycle_scripts,bins,tarball）
// 判读口径：preinstall/postinstall/prepare 属高关注项（安装期任意代码执行面）；无脚本行 = 仅声明式包
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'reports/security-scan/lifecycle-inventory.csv');
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['offline/npm', 'offline/catalog'];
const PAT = /^(pre|post)?install$|^prepare$|^prepack$|^postpack$/;

fs.writeFileSync(OUT, 'pkg,version,lifecycle_scripts,bins,tarball\n');
const toPosix = (p) => p.replace(/^([A-Za-z]):[\\/]/, (_m, d) => `/${d.toLowerCase()}/`);
let n = 0, risky = 0, bad = 0;
for (const d of dirs) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.tgz')).sort()) {
    let pkgJson = '';
    try { pkgJson = execSync(`tar -xzf "${toPosix(path.join(dir, f))}" -O package/package.json`, { encoding: 'utf8', timeout: 20000 }); } catch { }
    let name = f, ver = '', life = [], bins = 0;
    try {
      const p = JSON.parse(pkgJson);
      name = p.name || f; ver = p.version || '';
      life = Object.keys(p.scripts || {}).filter((k) => PAT.test(k.trim()));
      bins = Object.keys(p.bin || {}).length;
    } catch { name = `PARSE_FAIL:${f}`; bad++; }
    const flag = life.length ? 'REVIEW' : 'OK';
    if (life.length) risky++;
    fs.appendFileSync(OUT, `"${name}","${ver}","${life.join(';') || '-'}","${bins}","${d}/${f}"\n`);
    if (flag === 'REVIEW') console.log(`REVIEW ${name}@${ver}: ${life.join(',')}`);
    n++;
  }
}
console.log(`LIFECYCLE_INVENTORY_DONE total=${n} with_lifecycle_scripts=${risky} parse_fail=${bad} → reports/security-scan/lifecycle-inventory.csv`);
