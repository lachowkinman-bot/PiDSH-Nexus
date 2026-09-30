#!/usr/bin/env node
// catalog-install.mjs — U16 catalog 155 包三批安装执行器（015 §14.2 + 016）
// 批次语义：batch1=dsh web 插件 → batch2=pi 扩展（均经 dsh plugin --profile web add，pi2dsh 负责装载 pi 包）
//           batch3=工具类（npm i -g 离线 tgz）；其中 @deepseek-ai/dsh 行按 016 §2 重锁跳过（引擎已 0.1.7-rc.2，禁降级）
// 根因修复沿用 3.0 实测：每次 add 前清 profiles/web/package.json.lock 与 .lock.takeover-*；tarball 一律绝对路径。
// 幂等：reports/catalog-install-log.csv 已有 exit=0 的行自动跳过（可中断续跑）。
// 证据：reports/catalog-install-log.csv（batch,name,version,method,exit,seconds,ts）+ 失败原因 reports/catalog-install-failures.md
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const CSV_IN = path.join(ROOT, 'manifests/catalog-install-batches.csv');
const LOG = path.join(ROOT, 'reports/catalog-install-log.csv');
const FAILS = path.join(ROOT, 'reports/catalog-install-failures.md');
const NODE_DIR = path.join(ROOT, 'offline/node/node-v24.21.0-win-x64');
const DSH_HOME = process.env.DSH_HOME || path.join(ROOT, '.dsh-home');
const PROFILE = path.join(DSH_HOME, 'profiles/web');
const TIMEOUT_MS = 300000;

const rows = fs.readFileSync(CSV_IN, 'utf8').trim().split(/\r?\n/).slice(1)
  .filter(Boolean).map((l) => l.split(','))
  .map(([batch, tier, name, version, profile]) => ({ batch: +batch, tier, name, version, profile }));

const done = new Map();
if (fs.existsSync(LOG)) {
  for (const l of fs.readFileSync(LOG, 'utf8').trim().split(/\r?\n/).slice(1)) {
    const c = l.split(',');
    if (c.length >= 5 && (c[4] === '0' || c[4] === 'SKIP')) done.set(`${c[0]}|${c[1]}|${c[2]}`, c[4]);
  }
}
if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, 'batch,name,version,method,exit,seconds,ts\n');

const env = { ...process.env, DSH_HOME };
env.PATH = `${NODE_DIR}${path.delimiter}${env.PATH || ''}`;

function tarballOf(name, version) {
  const file = `${name.replace(/^@/, '').replace(/\//g, '-')}-${version}.tgz`;
  const p = path.join(ROOT, 'offline/catalog', file);
  return fs.existsSync(p) ? p : null;
}
function clearLocks() {
  for (const f of fs.readdirSync(PROFILE)) {
    if (f === 'package.json.lock' || f.startsWith('.lock.takeover-')) {
      try { fs.rmSync(path.join(PROFILE, f), { force: true }); } catch { }
    }
  }
}
function run(method, args) {
  const bin = method === 'npm-i-g' ? 'npm.cmd' : 'dsh.cmd';
  const t0 = Date.now();
  const r = spawnSync(bin, args, { env, cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT_MS, shell: true });
  return { code: r.status ?? 1, secs: ((Date.now() - t0) / 1000).toFixed(1), out: `${r.stderr || ''}\n${r.stdout || ''}`.slice(-600) };
}
function log(batch, name, version, method, exit, secs) {
  fs.appendFileSync(LOG, `${batch},${name},${version},${method},${exit},${secs},${new Date().toISOString()}\n`);
}
function failNote(batch, name, version, reason) {
  if (!fs.existsSync(FAILS)) fs.writeFileSync(FAILS, '# catalog 安装失败登记（U16 → disabled-packages.md 上游）\n\n| 批 | 包 | 版本 | 原因 |\n|---|---|---|---|\n');
  fs.appendFileSync(FAILS, `| ${batch} | ${name} | ${version} | ${reason.replace(/\|/g, '/').replace(/\n/g, ' ')} |\n`);
}

let ok = 0, fail = 0, skip = 0, resume = 0;
for (const r of rows) {
  const key = `${r.batch}|${r.name}|${r.version}`;
  if (done.has(key)) { resume++; continue; }
  if (r.name === '@deepseek-ai/dsh') {
    log(r.batch, r.name, r.version, 'skip-engine-lock-016', 'SKIP', '0');
    failNote(r.batch, r.name, r.version, '016 §2 重锁 0.1.7-rc.2：引擎已装 0.1.7-rc.2，禁按 catalog 行降装 0.1.5-rc.3');
    skip++; continue;
  }
  const tg = tarballOf(r.name, r.version);
  if (!tg) { log(r.batch, r.name, r.version, r.batch === 3 ? 'npm-i-g' : 'dsh-plugin-add', 127, '0'); failNote(r.batch, r.name, r.version, 'tarball 缺失 offline/catalog'); fail++; continue; }
  const method = r.batch === 3 ? 'npm-i-g' : 'dsh-plugin-add';
  clearLocks();
  let res = run(method, method === 'npm-i-g' ? ['i', '-g', tg, '--no-audit', '--no-fund'] : ['plugin', '--profile', 'web', 'add', tg]);
  if (res.code !== 0) { clearLocks(); res = run(method, method === 'npm-i-g' ? ['i', '-g', tg, '--no-audit', '--no-fund'] : ['plugin', '--profile', 'web', 'add', tg]); }
  if (res.code === 0) { log(r.batch, r.name, r.version, method, 0, res.secs); ok++; }
  else { log(r.batch, r.name, r.version, method, res.code, res.secs); failNote(r.batch, r.name, r.version, `exit=${res.code} ${res.out.replace(/\s+/g, ' ').slice(-260)}`); fail++; }
  process.stdout.write(`[${ok + fail + skip + resume}/${rows.length}] b${r.batch} ${r.name}@${r.version} exit=${res.code} ${res.secs}s\n`);
}
console.log(`CATALOG_INSTALL_DONE ok=${ok} fail=${fail} skip=${skip} resumed=${resume} total=${rows.length}`);
process.exit(fail > 0 ? 1 : 0);
