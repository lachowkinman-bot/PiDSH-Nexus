#!/usr/bin/env node
// verify-catalog.mjs — 候选包批量 npm 核验（015 §3.6 防幻觉纪律的工具化）
// 用法：node scripts/verify-catalog.mjs <candidates.txt> <out.json>
// 每行一个包名；输出 {real:[{name,version,tarball}], fake:[...], error:[...]}
import fs from 'node:fs';
import { exec } from 'node:child_process';

const [,, inFile, outFile] = process.argv;
const cands = [...new Set(fs.readFileSync(inFile, 'utf8').trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean))];
const CONC = 8;
const verify = (name) => new Promise((res) => {
  exec(`npm view ${JSON.stringify(name)} --json`, { encoding: 'utf8', timeout: 25000 }, (err, stdout) => {
    if (err) return res({ name, ok: false });
    try {
      const j = JSON.parse(stdout);
      const version = j.version || (j.versions && j.versions[j.versions.length - 1]) || '';
      const tarball = j.dist && j.dist.tarball || '';
      if (version) return res({ name, ok: true, version, tarball });
    } catch { /* fallthrough */ }
    res({ name, ok: false });
  });
});
const results = [];
let idx = 0;
async function pool() {
  const workers = Array.from({ length: CONC }, async () => {
    while (idx < cands.length) {
      const c = cands[idx++];
      results.push(await verify(c));
    }
  });
  await Promise.all(workers);
}
await pool();
const out = {
  verified_at: new Date().toISOString(),
  real: results.filter(r => r.ok).map(r => ({ name: r.name, version: r.version, tarball: r.tarball })),
  fake: results.filter(r => !r.ok).map(r => r.name),
};
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`verified ${cands.length} candidates: real=${out.real.length} fake=${out.fake.length}`);
console.log('REAL:', out.real.map(r => `${r.name}@${r.version}`).join(' '));
