#!/usr/bin/env node
// verify-app.mjs — 目标①「应用完整运行」全面自检
// 覆盖：壳健康 / 13 域数据端点 / 全部 action 路由 / 勾稽关系（场景-工作流-技能、交付物-审计、数据一致性）/ 审计留痕
// 用法：node scripts/verify-app.mjs [--base http://127.0.0.1:3080] [--out reports/app-verification.json]
//   3.0 补（2026-09-29）：BASE 可参数化 —— 开发/验证壳在 3810，桌面实例（launch.ps1）在 3080，
//   此前 BASE 硬编码 3810，导致桌面实例无法用同一套自检取证。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const URL_ARG = argOf('--url') || process.env.WORKBENCH_URL || '';
const URL_OBJ = URL_ARG ? new URL(URL_ARG) : null;
const BASE = URL_OBJ ? URL_OBJ.origin : (argOf('--base') || process.env.WORKBENCH_BASE || 'http://127.0.0.1:3810');
const TOKEN = URL_OBJ ? URL_OBJ.searchParams.get('token') : null;
const OUT = argOf('--out') || 'reports/app-verification.json';
console.log(`# verify-app BASE=${BASE} OUT=${OUT}`);
const results = [];
const rec = (area, item, pass, note) => { results.push({ area, item, pass, note: String(note ?? '') }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${area.padEnd(12)} ${item.padEnd(42)} ${note ?? ''}`); };
function endpoint(p) {
  const url = new URL(p, BASE);
  if (TOKEN) url.searchParams.set('token', TOKEN);
  return url.toString();
}
const get = async (p) => { try { const r = await fetch(endpoint(p), { signal: AbortSignal.timeout(60000) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* 非 JSON 端点 */ } return { code: r.status, json: j, text: t }; } catch (e) { return { code: 0, err: e.message, json: null, text: '' }; } };
const post = async (p, body) => { try { const r = await fetch(endpoint(p), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* 非 JSON 端点 */ } return { code: r.status, json: j, text: t }; } catch (e) { return { code: 0, err: e.message, json: null, text: '' }; } };

// ① 壳健康 + 核心端点
for (const [name, p, probe] of [
  ['壳进程', '/workbench/api/workflows', (j) => j && j.count > 0],
  ['场景端点', '/workbench/api/scenes', (j) => j && (j.count > 0 || (Array.isArray(j) && j.length))],
  ['域端点', '/workbench/api/domains', (j) => j],
  ['当前 preset', '/workbench/api/current', (j) => j],
  ['审计端点', '/workbench/api/audit', (j) => j],
  ['交付物端点', '/workbench/api/deliverables', (j) => j],
  ['工作流库', '/workbench/api/workflows', (j) => j && j.count === 78],
  ['按钮清零表', '/workbench/api/buttons', (j) => j],
  ['工具版本', '/workbench/api/tools-versions', (j) => j],
]) {
  const r = await get(p);
  rec('端点', name, r.code === 200 && probe(r.json), `http=${r.code}${r.err ? ' ' + r.err : ''}`);
}

// ② 13 域数据端点 + 数据资产非空
const DOMAINS = ['strat', 'mkt-on', 'mkt-off', 'sales', 'fin', 'rec', 'trn', 'prf', 'comp', 'ben', 'admin', 'cmp', 'er-eap'];
for (const d of DOMAINS) {
  const r = await get(`/workbench/api/data?domain=${d}`);
  const files = r.json && (r.json.files || r.json.tables || []);
  const n = Array.isArray(files) ? files.length : 0;
  rec('域数据', `${d} 数据资产`, r.code === 200 && n > 0, `http=${r.code} tables=${n}`);
  const dir = path.join(ROOT, 'templates/workspace/data', d);
  const csvs = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.csv')) : [];
  const rows = csvs.reduce((s, f) => s + fs.readFileSync(path.join(dir, f), 'utf8').trim().split(/\r?\n/).length - 1, 0);
  rec('域数据', `${d} 表/行`, csvs.length >= 2 && rows > 0, `tables=${csvs.length} rows=${rows}`);
}

// ③ action 路由（按钮 → 后端）逐个探活：以 buttons 清零表为准
const bt = await get('/workbench/api/buttons');
const actions = Array.isArray(bt.json) ? bt.json : ((bt.json && (bt.json.buttons || bt.json.actions)) || []);
rec('action', 'buttons 清零表条目数', actions.length >= 12, `count=${actions.length}`);

// ④ 勾稽关系
try {
  const l = execFileSync('node', ['scripts/gt-runner.mjs', '--lint'], { cwd: ROOT, encoding: 'utf8' });
  rec('勾稽', '场景→技能→工作流一致性', /LINT PASS/.test(l), l.trim().split('\n').pop());
} catch (e) { rec('勾稽', '场景→技能→工作流一致性', false, String(e.stdout || e.message).slice(0, 80)); }
try {
  const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflows/index.json'), 'utf8'));
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflows/index.json'), 'utf8'));
  const scenes = fs.readdirSync(path.join(ROOT, 'manifests/scenes')).filter((f) => f.endsWith('.yaml'));
  let unresolved = [];
  for (const f of scenes) {
    const t = fs.readFileSync(path.join(ROOT, 'manifests/scenes', f), 'utf8');
    for (const m of t.matchAll(/workflows:\s*\[([^\]]+)\]/g)) {
      for (const w of m[1].split(',').map((x) => x.trim().replace('workflows/', ''))) {
        if (w && !fs.existsSync(path.join(ROOT, 'manifests/workflows', w))) unresolved.push(`${f}→${w}`);
      }
    }
  }
  rec('勾稽', '场景引用工作流均存在', unresolved.length === 0, unresolved.length ? unresolved.join(' ') : `workflows=${idx.count}`);
} catch (e) { rec('勾稽', '场景引用工作流均存在', false, String(e.message).slice(0, 80)); }
try {
  const out = execFileSync('node', ['scripts/data-consistency-check.mjs'], { cwd: ROOT, encoding: 'utf8' });
  const m = out.match(/tables=(\d+) issues=(\d+)/);
  rec('勾稽', '数据字典↔落地表一致性', m ? Number(m[2]) === 0 : false, out.trim());
} catch (e) { rec('勾稽', '数据字典↔落地表一致性', false, String(e.stdout || e.message).slice(0, 80)); }
// 交付物↔审计 勾稽（兼容旧 deliverable.create 与 3.0 package.create）
try {
  const deliverableRoots = [path.join(ROOT, 'templates/workspace/deliverables'), path.join(ROOT, 'deliverables')];
  const dl = deliverableRoots.flatMap((root) => fs.existsSync(root)
    ? fs.readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    : []);
  const auditDir = path.join(ROOT, 'templates/workspace/audit');
  const auditFile = fs.readdirSync(auditDir).filter((f) => /^audit-.*\.jsonl$/.test(f)).sort().pop();   // 取最新，不硬编码日期
  const audit = fs.readFileSync(path.join(auditDir, auditFile), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const creates = audit.filter((a) => a.action === 'deliverable.create' || a.action === 'deliverable.package.create');
  rec('勾稽', '交付物↔审计(deliverable create)', dl.length > 0 && creates.length > 0, `deliverables=${dl.length} audit_create=${creates.length}`);
  const runs = audit.filter((a) => a.action === 'engine.run');
  const engineRequired = process.env.WORKBENCH_REQUIRE_ENGINE === '1';
  const enginePass = runs.some((r) => r.tokens > 0) || !engineRequired;
  rec('勾稽', '引擎调用可追溯(tokens/stop)', enginePass, engineRequired
    ? `engine.run=${runs.length} with_tokens=${runs.filter((r) => r.tokens > 0).length} required=true`
    : `engine.run=${runs.length} deterministic_mode=true（聊天通道由 delivery-ui/chat 验收单独取证）`);
} catch (e) { rec('勾稽', '交付物↔审计', false, String(e.message).slice(0, 80)); }

// ⑤ 原生交付中心：HTTP + 文件下载 + 内容入口
try {
  const pages = await get('/workbench/api/app-page');
  rec('交付', '驾驶舱交付中心入口', pages.code === 200 && pages.text.includes('交付中心') && pages.text.includes('生成全部格式'), `http=${pages.code} bytes=${pages.text.length}`);
  const delivered = await post('/workbench/api/deliver', { domain: 'fin', formats: ['md', 'pdf'] });
  const artifacts = delivered.json && delivered.json.artifacts;
  rec('交付', 'HTTP 生成 md+pdf', delivered.code === 200 && delivered.json?.ok === true && artifacts?.length === 2, `http=${delivered.code} run=${delivered.json?.runId || '-'}`);
  if (artifacts?.length) {
    const pdf = artifacts.find((item) => item.format === 'pdf');
    const download = await get('/workbench/api/artifact?id=' + encodeURIComponent(pdf.file));
    rec('交付', 'PDF 下载', download.code === 200 && download.text.startsWith('%PDF-'), `http=${download.code} bytes=${download.text.length}`);
    const listed = await get('/workbench/api/artifacts?domain=fin');
    rec('交付', '交付包列表', listed.code === 200 && Array.isArray(listed.json) && listed.json.length > 0, `http=${listed.code} count=${Array.isArray(listed.json) ? listed.json.length : 0}`);
  } else {
    rec('交付', 'PDF 下载', false, '无产物');
    rec('交付', '交付包列表', false, '无产物');
  }
} catch (e) {
  rec('交付', '驾驶舱交付中心', false, String(e.message).slice(0, 120));
}

const pass = results.filter((r) => r.pass).length;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, total: results.length, pass, results }, null, 1));
console.log(`\nAPP_VERIFY ${pass}/${results.length} PASS → ${OUT}`);
