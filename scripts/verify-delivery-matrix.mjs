#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const argOf = (name, fallback = null) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};
const BASE = argOf('--base');
const OUT = argOf('--out', 'reports/delivery-matrix.json');
const SOFFICE = argOf('--soffice', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe');
const TARGET_ROOT = path.resolve(argOf('--target-root', ROOT));
const skipOffice = argv.includes('--skip-office');
const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/domain-delivery.json'), 'utf8'));
const formats = profiles.formats;

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function textOf(file) {
  return fs.readFileSync(file, 'utf8');
}

function record(records, area, item, pass, note = '') {
  records.push({ area, item, pass: !!pass, note: String(note) });
}

function zipText(file, required) {
  const zip = new AdmZip(file);
  const names = zip.getEntries().map((entry) => entry.entryName);
  const missing = required.filter((name) => !names.includes(name));
  if (missing.length) throw new Error(`缺少 ZIP 部件：${missing.join(',')}`);
  return zip.getEntries()
    .filter((entry) => /\.(xml|rels)$/i.test(entry.entryName))
    .map((entry) => entry.getData().toString('utf8'))
    .join('\n');
}

async function validatePdf(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(file));
  const task = pdfjs.getDocument({ data, disableWorker: true, useSystemFonts: true });
  const doc = await task.promise;
  const pages = [];
  for (let page = 1; page <= Math.min(doc.numPages, 10); page += 1) {
    const p = await doc.getPage(page);
    const content = await p.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return { pages: doc.numPages, text: pages.join('\n') };
}

async function deliver(domain) {
  if (!BASE) {
    const mod = await import('../workbench-ui-plugin/lib/delivery-service.cjs');
    const service = mod.createDeliveryService({ root: ROOT, audit: () => {} });
    return service.deliverDomain({ domain, formats });
  }
  const response = await fetch(`${BASE}/workbench/api/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domain, formats }),
    signal: AbortSignal.timeout(180000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

function officeRoundTrip(files, outDir) {
  if (skipOffice || files.length === 0) return { ok: true, skipped: true };
  if (!fs.existsSync(SOFFICE)) return { ok: false, error: `LibreOffice 不存在：${SOFFICE}` };
  fs.mkdirSync(outDir, { recursive: true });
  const profileUrl = 'file:///' + path.join(outDir, 'lo-profile').replace(/\\/g, '/').replace(/^\//, '');
  try {
    execFileSync(SOFFICE, [
      `-env:UserInstallation=${profileUrl}`,
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', outDir,
      ...files,
    ], { encoding: 'utf8', timeout: 180000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    return { ok: true, outputs: fs.readdirSync(outDir).filter((name) => name.endsWith('.pdf')) };
  } catch (error) {
    return { ok: false, error: String(error.stdout || error.stderr || error.message).slice(0, 500) };
  }
}

const records = [];
const matrix = [];
for (const [domain, profile] of Object.entries(profiles.domains)) {
  const row = { domain, formatResults: {}, package: null, error: null };
  try {
    const result = await deliver(domain);
    row.package = result;
    record(records, '矩阵', `${domain} 交付包`, result.ok === true && result.artifacts.length === formats.length, `run=${result.runId} artifacts=${result.artifacts.length}`);
    if (result.artifacts.length !== formats.length) throw new Error(`产物数量 ${result.artifacts.length} != ${formats.length}`);
    const officeFiles = [];
    for (const artifact of result.artifacts) {
      const file = path.join(TARGET_ROOT, artifact.file);
      let pass = fs.existsSync(file) && fs.statSync(file).size > 0;
      let note = `${artifact.bytes} bytes`;
      try {
        if (sha256(file) !== artifact.sha256) throw new Error('SHA-256 不一致');
        const prefix = fs.readFileSync(file).subarray(0, 8).toString('latin1');
        if (artifact.format === 'md') {
          const text = textOf(file);
          if (!text.startsWith('# ')) throw new Error('Markdown 标题缺失');
          if (!text.includes(profile.workflow_id)) throw new Error('Markdown 缺工作流标识');
        } else if (artifact.format === 'csv') {
          const text = textOf(file);
          const lines = text.trim().split(/\r?\n/);
          if (lines.length < 2 || !lines[0].includes(',')) throw new Error('CSV 结构不完整');
        } else if (artifact.format === 'html') {
          const text = textOf(file);
          if (!/^<!DOCTYPE html>/i.test(text) || !text.includes(profile.title)) throw new Error('HTML 标题/结构缺失');
        } else if (artifact.format === 'xlsx') {
          if (!prefix.startsWith('PK')) throw new Error('XLSX 文件头不是 ZIP');
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(file);
          const summary = workbook.getWorksheet('Summary');
          const formulas = [];
          summary?.eachRow((r) => r.eachCell((c) => { if (c.value && typeof c.value === 'object' && c.value.formula) formulas.push(c.value.formula); }));
          if (!summary || formulas.length === 0) throw new Error('Summary 缺少公式');
        } else if (artifact.format === 'docx') {
          if (!prefix.startsWith('PK')) throw new Error('DOCX 文件头不是 ZIP');
          const xml = zipText(file, ['word/document.xml']);
          if (!xml.includes(profile.title) || !xml.includes(profile.workflow_id)) throw new Error('DOCX 文字/工作流缺失');
          officeFiles.push(file);
        } else if (artifact.format === 'pptx') {
          if (!prefix.startsWith('PK')) throw new Error('PPTX 文件头不是 ZIP');
          const xml = zipText(file, ['ppt/presentation.xml', 'ppt/slides/slide1.xml']);
          if (!xml.includes(profile.title) || !xml.includes(profile.workflow_id)) throw new Error('PPTX 文字/工作流缺失');
          officeFiles.push(file);
        } else if (artifact.format === 'pdf') {
          if (!prefix.startsWith('%PDF-')) throw new Error('PDF 文件头错误');
          const pdf = await validatePdf(file);
          if (pdf.pages < 1 || !pdf.text.includes(profile.title)) throw new Error('PDF 文本不可提取或标题缺失');
          note += ` pages=${pdf.pages}`;
        }
      } catch (error) {
        pass = false;
        note += ` :: ${error.message}`;
      }
      row.formatResults[artifact.format] = { pass, note, file: artifact.file, sha256: artifact.sha256 };
      record(records, domain, artifact.format, pass, note);
    }
    const office = officeRoundTrip(officeFiles, path.join(ROOT, 'reports/.tmp/delivery-office', domain));
    row.officeRoundTrip = office;
    record(records, 'Office', `${domain} 重读/转换`, office.ok, office.error || `outputs=${office.outputs?.length ?? 0}`);
    matrix.push(row);
  } catch (error) {
    row.error = String(error.message || error);
    record(records, domain, '交付包', false, row.error);
    matrix.push(row);
  }
}

const pass = records.filter((item) => item.pass).length;
const failed = records.filter((item) => !item.pass);
const report = {
  generated_at: new Date().toISOString(),
  mode: BASE ? 'http' : 'direct',
  base: BASE,
  domains: Object.keys(profiles.domains).length,
  formats,
  expectedArtifacts: Object.keys(profiles.domains).length * formats.length,
  checks: records.length,
  pass,
  fail: failed.length,
  failed,
  matrix,
};
fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(report, null, 2));
const md = [
  '# 交付矩阵验收',
  '',
  `- 模式：${report.mode}`,
  `- 域：${report.domains}`,
  `- 公开产物：${report.expectedArtifacts}`,
  `- 检查：${pass}/${records.length} PASS`,
  `- 失败：${failed.length}`,
  '',
  ...failed.map((item) => `- FAIL [${item.area}] ${item.item}: ${item.note}`),
  '',
].join('\n');
fs.writeFileSync(path.join(ROOT, OUT.replace(/\.json$/i, '.md')), md);
console.log(`DELIVERY_MATRIX ${pass}/${records.length} PASS artifacts=${report.expectedArtifacts} fail=${failed.length} -> ${OUT}`);
if (failed.length) process.exit(1);
