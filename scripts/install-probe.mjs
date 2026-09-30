#!/usr/bin/env node
// install-probe.mjs — U3/U16 安装状态三源探测（015 v2.2 §15.5，修复 2.0 probeInstalled 路径错位）
// 三源交叉：① npm prefix -g + npm ls -g --depth=0 --json ② dsh profile package.json 依赖 ③ manifest 期望清单
// 禁止单一 `npm root -g` 判定（2.0 实测 managed-node 路径错位 → 1/24 结论不可信）
// 用法：node scripts/install-probe.mjs [--manifest manifests/packages.manifest.csv] [--out reports/install-probe.json] [--self-test]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const args = process.argv.slice(2);
function sh(cmd) { try { return execSync(cmd, { encoding: 'utf8', timeout: 60000, maxBuffer: 4e6 }); } catch (e) { return e.stdout || ''; } }

export function probe() {
  const sources = {};
  // 源①：npm 全局真实清单（以 npm 自己报告的 prefix 为准，不猜路径）
  const prefix = sh('npm prefix -g').trim();
  const lsRaw = sh('npm ls -g --depth=0 --json');
  const global = {};
  try { for (const [k, v] of Object.entries(JSON.parse(lsRaw || '{}').dependencies || {})) global[k] = v.version || '?'; } catch { }
  sources['npm-global'] = { prefix, packages: global };
  // 源②：dsh profile 依赖（APPDATA/DSH_HOME 下 profile package.json，多候选枚举）
  const candidates = [
    process.env.DSH_HOME && path.join(process.env.DSH_HOME, 'profiles/web/package.json'),
    path.join(process.env.APPDATA || '', 'dsh/profiles/web/package.json'),
    path.join(process.env.HOME || '', '.dsh/profiles/web/package.json'),
  ].filter(Boolean);
  const profile = {};
  for (const c of candidates) if (fs.existsSync(c)) { try { Object.assign(profile, JSON.parse(fs.readFileSync(c, 'utf8')).dependencies || {}); } catch { } }
  sources['dsh-profile'] = { candidates, packages: profile };
  // ③ 期望清单
  const manifest = path.join(ROOT, args.includes('--manifest') ? args[args.indexOf('--manifest') + 1] : 'manifests/packages.manifest.csv');
  const expect = fs.readFileSync(manifest, 'utf8').trim().split(/\r?\n/).slice(1)
    .filter((l) => l.startsWith('P0') || l.startsWith('P1'))
    .map((l) => { const c = l.split(','); return { npm: c[3], want: c[12] }; });
  // 三源交叉判定
  const out = expect.map((e) => {
    const inGlobal = global[e.npm] || (global[e.npm.split('/')[1]] && global[e.npm] ) || null;
    const inProfile = profile[e.npm] || null;
    const version = inGlobal || inProfile || '';
    const status = version ? 'INSTALLED' : 'ABSENT';
    const evidence = [inGlobal && 'npm-global', inProfile && 'dsh-profile'].filter(Boolean).join('|') || 'none';
    return { npm: e.npm, want: e.want, found: version, status, evidence };
  });
  return { prefix, sources, results: out };
}
function selfTest() {
  const p = probe();
  if (!p.results.length) throw new Error('期望清单为空');
  if (!p.sources['npm-global'].prefix) throw new Error('npm prefix 未取得');
  console.log(`SELF_TEST_OK expect=${p.results.length} installed=${p.results.filter((r) => r.status === 'INSTALLED').length}（三源交叉，非单一 npm root -g）`);
}
if (args.includes('--self-test')) { try { selfTest(); } catch (e) { console.error('SELF_TEST_FAIL:', e.message); process.exit(1); } }
else {
  const p = probe();
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'reports/install-probe.json';
  fs.writeFileSync(path.join(ROOT, out), JSON.stringify(p, null, 1));
  console.log(`PROBE_DONE installed=${p.results.filter((r) => r.status === 'INSTALLED').length}/${p.results.length} → ${out}（INSTALLED 须三源中至少一源命中且版本记录在案）`);
}
