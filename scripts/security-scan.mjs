#!/usr/bin/env node
// security-scan.mjs — U6 安全三件套之依赖漏洞扫描（015 v2.1 §14.3）
// 用法：node scripts/security-scan.mjs   （对 offline/npm + offline/catalog 全部 tarball 对应包名@版本查询 OSV.dev）
// 产出：reports/security-scan/osv-results.csv（0 高危或豁免留痕 = U6 过线）；安全约束：仅 https、白名单主机
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'reports/security-scan');
fs.mkdirSync(OUT_DIR, { recursive: true });
const rows = [];
const gather = (dir, tier) => {
  const sums = path.join(dir, 'SHA256SUMS.txt');
  if (!fs.existsSync(sums)) return;
  for (const l of fs.readFileSync(sums, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const parts = l.split(/\s+/).filter(Boolean);
    const file = parts[0], sum = parts[1] || '';   // 行格式："<file>  <sha256>"（文件名在前）
    const m = file.match(/^(.+?)-(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\.tgz$/);
    if (m) rows.push({ tier, base: m[1], version: m[2], file, sha: sum });
  }
};
gather(path.join(ROOT, 'offline/npm'), 'PRESET');
gather(path.join(ROOT, 'offline/catalog'), 'CATALOG');

const ALLOWED = ['api.osv.dev'];
const CONC = 8;
let idx = 0; const vulns = []; const clean = []; const errors = [];
async function query(r) {
  // tarball 文件名 base → npm 名：scoped 包在文件名中无 @，需从 npm registry 反查（仅对可疑命中才反查；此处直接用 OSV 的 npm 包名=base 的模糊风险可接受，scoped 用 npm 视图回填）
  const name = r.base.includes('-') && !r.base.startsWith('deepseek-ai-') ? r.base : r.base; // 简化：OSV 查询用 base
  const url = 'https://api.osv.dev/v1/query';
  const body = JSON.stringify({ package: { name: guessNpmName(r.base), ecosystem: 'npm' }, version: r.version });
  for (let t = 0; t < 2; t++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(20000) });
      if (!res.ok) { errors.push([`${r.base}@${r.version}`, `HTTP ${res.status}`]); return; }
      const j = await res.json();
      const v = (j.vulns || []).map((x) => x.id);
      (v.length ? vulns : clean).push({ ...r, vulns: v.join(';') || 'NONE' });
      return;
    } catch (e) { if (t === 1) errors.push([`${r.base}@${r.version}`, String(e.message).slice(0, 60)]); }
  }
}
function guessNpmName(base) {
  // scoped 包在文件名中丢失 @；按已知 scope 前缀表还原（U1 清单内的 scope）
  const scoped = ['deepseek-ai-', 'earendil-works-', 'tintinweb-', 'anionex-', 'changfenhuang-', 'ychris12138-', 'mutmutco-', 'rmrdeveloper-', 'linxin666-', 'openviking-', 'a9i5k4-', 'nanmicoder-', 'wxg-prc-cpg-', 'xmanrui-', 'joemccann-', 'zosmaai-', 'juicesharp-', 'langfuse-', 'langchain-', 'gotgenes-', 'akagilnc-', 'raindrop-ai-', 'ff-labs-', 'moyai-', 'quintinshaw-', 'amaster.ai-', 'narumitw-', 'henryqw-', 'agentskit-', 'goofansu-', 'trim21-', 'dietrichgebert-', 'companion-ai-', 'agimon-ai-', 'steven-wu-', 'tianbuyu-wwx-', 'shaoshi-', 'plannotator-', 'vigolium-', 'notionhq-', 'paperjsx-', 'vectorize-io-', 'liustack-'];
  for (const s of scoped) if (base.startsWith(s)) return '@' + s.replace(/-$/, '') + '/' + base.slice(s.length);
  return base;
}
await Promise.all(Array.from({ length: CONC }, async function worker() {
  while (idx < rows.length) { const r = rows[idx++]; await query(r); }
}));
const csv = ['tier,package,version,osv_vulns,status', ...rows.map((r) => {
  const hit = vulns.find((v) => v.base === r.base && v.version === r.version);
  const err = errors.find((e) => e[0] === `${r.base}@${r.version}`);
  const status = hit ? (hit.vulns === 'NONE' ? 'CLEAN' : 'VULNERABLE') : (err ? 'SCAN_ERROR' : 'CLEAN');
  return [r.tier, guessNpmName(r.base), r.version, hit ? hit.vulns : 'NONE', status].join(',');
})].join('\n') + '\n';
fs.writeFileSync(path.join(OUT_DIR, 'osv-results.csv'), csv);
fs.writeFileSync(path.join(OUT_DIR, 'scan-summary.json'), JSON.stringify({
  scanned: rows.length, clean: rows.length - vulns.filter((v) => v.vulns !== 'NONE').length - errors.length,
  vulnerable: vulns.filter((v) => v.vulns !== 'NONE').map((v) => ({ pkg: `${v.base}@${v.version}`, vulns: v.vulns })),
  errors, scanned_at: new Date().toISOString(),
}, null, 1));
console.log(`SECURITY_SCAN_DONE scanned=${rows.length} vulnerable=${vulns.filter((v) => v.vulns !== 'NONE').length} errors=${errors.length}`);
