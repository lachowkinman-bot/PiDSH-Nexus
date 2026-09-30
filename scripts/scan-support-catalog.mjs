#!/usr/bin/env node
// scan-support-catalog.mjs — Pi_DSH_support 目录批量体检与选型（只读，产出报告，不改动任何包）
// 用法：node scripts/scan-support-catalog.mjs
// 产出：reports/support-catalog-scan.json / .csv / .md
//
// 判据来源：AGENTS.md「新增插件或包必须经过依赖兼容、许可、离线打包、启动验证和功能验证后才能进入 runtime」。
// 本脚本只做第一道机械筛（可用性/许可/风险），通过者仍需启动验证与功能验证才可进 runtime。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIRS = ['Pi_DSH_support/dsh-plugins', 'Pi_DSH_support/pi-packages'];
const REPORT_DIR = path.join(ROOT, 'reports');

// 已知需要原生二进制 / 联网下载 / 重安装的依赖或脚本特征（进 runtime 前必须单独验证）
const NATIVE_HINTS = [
  'node-pty', 'onnxruntime-node', 'onnxruntime-web', 'sherpa-onnx', 'sharp', 'canvas',
  '@img/', 'playwright', 'puppeteer', 'better-sqlite3', 'sqlite3', 'node-gyp', 'electron',
];
const RISKY_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare', 'prepack'];
// 与「Windows 单机交付型应用」交付质量强相关的关键词（用于排序，不改变是否可用）
const VALUE_HINTS = [
  ['office', 6], ['docx', 6], ['xlsx', 6], ['excel', 6], ['pptx', 6], ['ppt', 6], ['pdf', 6],
  ['anydoc', 6], ['univer', 5], ['document', 5], ['report', 5], ['deliver', 5], ['export', 4],
  ['verify', 5], ['check', 4], ['audit', 5], ['quality', 4], ['compliance', 4], ['security', 4],
  ['memory', 4], ['context', 4], ['continu', 4], ['session', 3], ['workflow', 3], ['task', 3],
  ['notify', 3], ['notifier', 3], ['backup', 4], ['restore', 4], ['offline', 5], ['schema', 3],
];

function dirSizeAndCount(dir, limit = 20000) {
  let bytes = 0, files = 0, stack = [dir];
  while (stack.length && files < limit) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        stack.push(path.join(cur, e.name));
      } else if (e.isFile()) {
        files += 1;
        try { bytes += fs.statSync(path.join(cur, e.name)).size; } catch { /* 忽略不可读项 */ }
      }
    }
  }
  return { bytes, files };
}

function scoreValue(name, description) {
  const hay = `${name} ${description || ''}`.toLowerCase();
  let score = 0;
  for (const [key, weight] of VALUE_HINTS) if (hay.includes(key)) score += weight;
  return score;
}

function classify(entry) {
  const { name, kind, hasDist, riskyScripts, nativeDeps, deps, privatePkg } = entry;
  if (!name) return 'INVALID';
  if (riskyScripts) return 'NEEDS_SCRIPT_AUDIT';
  if (nativeDeps) return 'NEEDS_NATIVE_AUDIT';
  if (privatePkg && !hasDist) return 'SOURCE_ONLY';
  if (deps > 0 && !hasDist) return 'BUILD_REQUIRED';
  if (kind === 'dsh' && hasDist) return 'READY_DIST';
  if (kind === 'dsh') return 'READY_SOURCE';
  return 'PI_PACKAGE';
}

const rows = [];
for (const rel of DIRS) {
  const base = path.join(ROOT, rel);
  if (!fs.existsSync(base)) continue;
  for (const name of fs.readdirSync(base)) {
    const dir = path.join(base, name);
    const pkgFile = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgFile)) continue;
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8')); } catch { pkg = {}; }
    const deps = Object.keys(pkg.dependencies || {});
    const peerDeps = Object.keys(pkg.peerDependencies || {});
    const scripts = pkg.scripts || {};
    const riskyScripts = RISKY_SCRIPTS.filter((s) => scripts[s]);
    const allDeps = [...deps, ...peerDeps].map((d) => d.toLowerCase());
    const nativeDeps = allDeps.filter((d) => NATIVE_HINTS.some((h) => d.includes(h)));
    const hasDist = fs.existsSync(path.join(dir, 'dist')) || fs.existsSync(path.join(dir, 'lib'));
    const kind = pkg.dsh ? 'dsh' : (fs.existsSync(path.join(dir, 'cordis.patch.yml')) ? 'dsh' : 'pi');
    const size = dirSizeAndCount(dir);
    const entry = {
      dir: `${rel}/${name}`,
      name: pkg.name || '',
      version: pkg.version || '',
      kind,
      license: pkg.license || pkg.licenses || '',
      description: String(pkg.description || '').slice(0, 200),
      engine: pkg.dsh?.engines?.dsh || pkg.engines?.node || '',
      deps: deps.length,
      peerDeps: peerDeps.length,
      depList: deps.slice(0, 12).join('|'),
      riskyScripts: riskyScripts.join('|'),
      nativeDeps: nativeDeps.join('|'),
      hasDist,
      sizeMB: Number((size.bytes / 1048576).toFixed(2)),
      files: size.files,
      valueScore: scoreValue(pkg.name || name, pkg.description),
      privatePkg: pkg.private === true,
    };
    entry.classification = classify(entry);
    rows.push(entry);
  }
}

rows.sort((a, b) => b.valueScore - a.valueScore || a.dir.localeCompare(b.dir));

const byClass = {};
for (const r of rows) byClass[r.classification] = (byClass[r.classification] || 0) + 1;
const licenseMissing = rows.filter((r) => !r.license).length;
const safePool = rows.filter((r) => ['READY_DIST', 'READY_SOURCE'].includes(r.classification) && !r.nativeDeps.length && !r.riskyScripts.length);
const top = safePool.slice(0, 40);

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(path.join(REPORT_DIR, 'support-catalog-scan.json'), JSON.stringify({ scannedAt: new Date().toISOString(), total: rows.length, byClass, licenseMissing, rows }, null, 2));
const csvHead = 'dir,name,version,kind,classification,license,engine,deps,peerDeps,riskyScripts,nativeDeps,hasDist,sizeMB,files,valueScore';
const csvBody = rows.map((r) => [r.dir, r.name, r.version, r.kind, r.classification, r.license, r.engine, r.deps, r.peerDeps, r.riskyScripts, r.nativeDeps, r.hasDist, r.sizeMB, r.files, r.valueScore]
  .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
fs.writeFileSync(path.join(REPORT_DIR, 'support-catalog-scan.csv'), [csvHead, ...csvBody].join('\n') + '\n');

const md = [
  '# Pi_DSH_support 目录体检与选型报告',
  '',
  `扫描时间：${new Date().toISOString()}　包总数：**${rows.length}**（dsh-plugins + pi-packages）`,
  '',
  '> 机械筛只回答「是否具备离线装载的最低条件」；进入 runtime 仍需启动验证 + 功能验证（AGENTS.md 硬规则）。',
  '',
  '## 分类统计',
  '',
  '| 分类 | 含义 | 数量 |',
  '|---|---|---|',
  `| READY_DIST | 自带 dist/lib 且无风险脚本/原生依赖，可离线装载 | ${byClass.READY_DIST || 0} |`,
  `| READY_SOURCE | 源码直载（无构建产物但无依赖），可离线装载 | ${byClass.READY_SOURCE || 0} |`,
  `| BUILD_REQUIRED | 有依赖但无构建产物，需先构建 | ${byClass.BUILD_REQUIRED || 0} |`,
  `| NEEDS_SCRIPT_AUDIT | 含 pre/install/postinstall/prepare 脚本，须逐条审计 | ${byClass.NEEDS_SCRIPT_AUDIT || 0} |`,
  `| NEEDS_NATIVE_AUDIT | 依赖原生二进制（node-pty/onnxruntime/sharp 等） | ${byClass.NEEDS_NATIVE_AUDIT || 0} |`,
  `| SOURCE_ONLY | 私有源码包且无构建产物 | ${byClass.SOURCE_ONLY || 0} |`,
  `| PI_PACKAGE | pi 侧包（非 dsh 插件形态） | ${byClass.PI_PACKAGE || 0} |`,
  `| INVALID | package.json 缺 name | ${byClass.INVALID || 0} |`,
  '',
  `许可字段缺失：${licenseMissing} 个（进 runtime 前必须补齐许可结论）。`,
  '',
  '## 候选 Top 40（可离线装载池，按交付价值打分）',
  '',
  '| # | 包 | 版本 | 分类 | 许可 | 依赖 | 体积MB | 价值分 |',
  '|---|---|---|---|---|---|---|---|',
  ...top.map((r, i) => `| ${i + 1} | \`${r.name}\` | ${r.version} | ${r.classification} | ${r.license || '—'} | ${r.deps} | ${r.sizeMB} | ${r.valueScore} |`),
  '',
  '## 已进入 runtime 的 Pi_DSH_support 包（本轮之前已集成，需回归验证）',
  '',
  '| 包 | 用途 | 当前状态 |',
  '|---|---|---|',
  '| `@a9i5k4/dsh-auto-memory` | 会话自动记忆 | 已写入 `manifests/runtime-web.package.json` |',
  '| `@weibaohui/skills-management` | 技能中心管理 | 同上 |',
  '| `@omdsh-dev/dsh-plugin-check` | 插件体检 | 同上 |',
  '| `@weibaohui/dsh-kb` | 知识库 | 同上 |',
  '',
  '完整明细见 `reports/support-catalog-scan.csv` 与 `.json`。',
  '',
].join('\n');
fs.writeFileSync(path.join(REPORT_DIR, 'support-catalog-scan.md'), md);

console.log(`SCAN_OK total=${rows.length} ready=${(byClass.READY_DIST || 0) + (byClass.READY_SOURCE || 0)} top=${top.length} licenseMissing=${licenseMissing}`);
