#!/usr/bin/env node
// u1-bundle-audit.mjs — U1 资源包预置完整性：逐包 SHA256 复核（离线，不依赖任何凭据）
// 用法：node scripts/u1-bundle-audit.mjs
// 退出码：0=全部一致；1=存在 MISMATCH/MISSING
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const out = [];
const log = (s) => { console.log(s); out.push(s); };

function auditDir(dir, sumsFile) {
  const sumsPath = path.join(dir, sumsFile);
  if (!fs.existsSync(sumsPath)) { log(`MISSING_SUMS\t${sumsPath}`); return { ok: 0, bad: 1, missing: 0 }; }
  const lines = fs.readFileSync(sumsPath, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  let ok = 0, bad = 0, missing = 0;
  const badList = [];
  for (const line of lines) {
    // 实测格式：<文件名><空白><64 hex>（亦兼容 <hash><空白><文件名>）
    let m = line.trim().match(/^(\S+)\s+([0-9a-fA-F]{64})$/);
    let fileRaw, expect;
    if (m) { fileRaw = m[1]; expect = m[2]; }
    else {
      m = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(\S+)$/);
      if (!m) continue;
      expect = m[1]; fileRaw = m[2];
    }
    const file = path.join(dir, path.basename(fileRaw.replace(/^\.\//, '')));
    if (!fs.existsSync(file)) { missing++; bad++; badList.push(`MISSING\t${file}`); continue; }
    const actual = sha256(file);
    if (actual === expect.toLowerCase()) ok++;
    else { bad++; badList.push(`MISMATCH\t${file}\n  expect=${expect.toLowerCase()}\n  actual=${actual}`); }
  }
  // 反向：目录内 tgz 是否都被 SUMS 覆盖
  const covered = new Set(lines.map((l) => {
    const p = l.trim().split(/\s+/);
    return path.basename((p[0] || '').replace(/^\*/, ''));
  }));
  const orphans = fs.readdirSync(dir).filter((f) => f.endsWith('.tgz') && !covered.has(f));
  log(`\n## ${dir}`);
  log(`- 清单条目: ${lines.length} ｜ 校验通过: ${ok} ｜ 失败: ${bad}（缺文件 ${missing}）｜ 未被清单覆盖的 tgz: ${orphans.length}`);
  badList.forEach((b) => log(`- ${b}`));
  if (orphans.length) log(`- ORPHAN: ${orphans.join(', ')}`);
  return { ok, bad, missing, orphans: orphans.length };
}

log('# U1 资源包预置完整性审计');
log(`- 生成时间: ${new Date().toISOString()}`);
log(`- Node: ${process.version}`);
log(`- 校验方式: 读 SHA256SUMS.txt 逐行复核（离线，无联网下载）`);

const npm = auditDir(path.join(ROOT, 'offline/npm'), 'SHA256SUMS.txt');
const cat = auditDir(path.join(ROOT, 'offline/catalog'), 'SHA256SUMS.txt');

// 016 §2：dsh 0.1.7-rc.2 期望哈希逐字核验
const ENGINE = path.join(ROOT, 'offline-3.0/engines/deepseek-ai-dsh-0.1.7-rc.2.tgz');
// 期望哈希从 016 §2 原文正则提取（禁止手抄，防 63/64 位误差）
const DOC016 = fs.readFileSync(path.join(ROOT, '016-插件化交付增补-v3.0.md'), 'utf8');
const ENGINE_EXPECT = (DOC016.match(/SHA256\s+`?([0-9a-f]{64})`?/) || [])[1] || '';
log('\n## offline-3.0/engines（016 §2 重锁版本，期望值自 016 原文提取）');
let engineOk = false;
if (!fs.existsSync(ENGINE)) log(`- MISSING\t${ENGINE}`);
else {
  const a = sha256(ENGINE);
  engineOk = a === ENGINE_EXPECT;
  log(`- deepseek-ai-dsh-0.1.7-rc.2.tgz  actual=${a}`);
  log(`- expect =${ENGINE_EXPECT}`);
  log(`- 结果: ${engineOk ? 'HASH_OK' : 'HASH_MISMATCH'}`);
}

const totalBad = npm.bad + cat.bad + (engineOk ? 0 : 1);
log(`\n## 结论\n- total_bad=${totalBad} → U1 ${totalBad === 0 ? 'PASS' : 'FAIL'}`);
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/u1-bundle-audit.md'), out.join('\n') + '\n', 'utf8');
process.exit(totalBad === 0 ? 0 : 1);
