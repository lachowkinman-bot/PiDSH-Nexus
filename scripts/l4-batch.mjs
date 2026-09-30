#!/usr/bin/env node
// l4-batch.mjs — U3 L4 独立性批量执行：对 P0/P1 全部插件逐包 remove→boot→add→boot（dod-run.mjs l4-one 的批量编排）
// 用法：node scripts/l4-batch.mjs
// 证据：reports/l4-independence.csv（pkg,phase,boot_root,boot_workbench,ts）
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const NODE_DIR = path.join(ROOT, 'offline/node/node-v24.21.0-win-x64');
const rows = fs.readFileSync(path.join(ROOT, 'manifests/packages.manifest.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
  .map((l) => l.split(',')).filter((c) => (c[0] === 'P0' || c[0] === 'P1') && c[3] !== '@deepseek-ai/dsh');
const env = { ...process.env };
env.PATH = `${NODE_DIR}${path.delimiter}${env.PATH || ''}`;
env.DSH_HOME = env.DSH_HOME || path.join(ROOT, '.dsh-home');

let i = 0;
for (const c of rows) {
  i++;
  const name = c[2], tgz = path.join(ROOT, 'offline/npm', c[13]);
  console.log(`[L4 ${i}/${rows.length}] ${name} start`);
  const r = spawnSync('node', [path.join(ROOT, 'scripts/dod-run.mjs'), 'l4-one', name, tgz], {
    env, cwd: ROOT, encoding: 'utf8', timeout: 420000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  console.log(`[L4 ${i}/${rows.length}] ${name} → ${r.stdout?.trim().split('\n').pop() || 'exit=' + r.status}`);
}
console.log('L4_BATCH_DONE');
