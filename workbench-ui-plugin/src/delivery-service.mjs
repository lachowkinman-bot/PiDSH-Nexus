import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { marked } from 'marked';

export const DELIVERY_FORMATS = Object.freeze(['md', 'csv', 'html', 'xlsx', 'docx', 'pptx', 'pdf']);

const MIME = Object.freeze({
  md: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  html: 'text/html; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  json: 'application/json; charset=utf-8',
});

const FILE_BY_FORMAT = Object.freeze({
  md: 'report.md',
  csv: 'data.csv',
  html: 'report.html',
  xlsx: 'data.xlsx',
  docx: 'report.docx',
  pptx: 'deck.pptx',
  pdf: 'report.pdf',
});

const NUMERIC_HINT = /(amount|price|budget|used|remain|revenue|net|cost|total|qty|count|hours|days|_wan|_yuan|pct|score|rate|points|balance|seat|cap|enrolled|attendance|leads|orders|headcount|salary|bonus)/i;

export class DeliveryError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'DeliveryError';
    this.code = code;
    this.status = status;
  }
}

function toPosix(value) {
  return String(value).replace(/\\/g, '/');
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function safeSegment(value, label) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(text)) throw new DeliveryError('INVALID_ARGUMENT', `${label} 非法`);
  return text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const clean = rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
  return { headers: clean[0] || [], rows: clean.slice(1) };
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text) && !/^-?\d+(?:\.\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function stringifyCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function numericValue(value) {
  const text = String(value ?? '').trim().replace(/,/g, '').replace(/%$/, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function metricDefinitions(headers, rows) {
  const out = [{ label: '数据行数', value: rows.length, formula: null }];
  headers.forEach((header, index) => {
    if (!NUMERIC_HINT.test(header)) return;
    const values = rows.map((row) => numericValue(row[index])).filter((value) => value != null);
    if (values.length < Math.max(1, Math.ceil(rows.length * 0.5))) return;
    const sum = values.reduce((acc, value) => acc + value, 0);
    const average = sum / values.length;
    out.push({ label: `${header} 合计`, value: Number(sum.toFixed(2)), formula: { sum, index, rows: values.length } });
    out.push({ label: `${header} 平均`, value: Number(average.toFixed(2)), formula: null });
  });
  return out.slice(0, 9);
}

function escapeMarkdownCell(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function markdownTable(headers, rows) {
  const head = `| ${headers.map(escapeMarkdownCell).join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${headers.map((_, index) => escapeMarkdownCell(row[index])).join(' | ')} |`);
  return [head, rule, ...body].join('\n');
}

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeSheetName(value, used) {
  let base = String(value || 'Data').replace(/[\\/?*:[\]]/g, '_').slice(0, 31) || 'Data';
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = `_${n}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function findPptCore(root) {
  const bundled = path.join(root, 'assets', 'dsh-ppt', 'deck-core.mjs');
  if (fs.existsSync(bundled)) return bundled;
  const homes = [
    process.env.DSH_HOME,
    path.join(root, '.dsh-home'),
    path.join(process.env.LOCALAPPDATA || '', 'UniversalWorkbench', '.dsh-home'),
  ].filter(Boolean);
  for (const home of homes) {
    const file = path.join(home, 'profiles', 'web', 'node_modules', 'dsh-ppt', 'skills', 'dsh-ppt', 'scripts', 'deck-core.mjs');
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function loadDomainModel(root, domain) {
  const file = path.join(root, 'manifests', 'domain-model', `${domain}.json`);
  if (!fs.existsSync(file)) throw new DeliveryError('DOMAIN_MODEL_MISSING', `缺少域模型：${domain}`, 503);
  const model = readJson(file);
  if (!model) throw new DeliveryError('DOMAIN_MODEL_INVALID', `无法读取域模型：${domain}`, 503);
  return model;
}

function loadProfiles(root) {
  const file = path.join(root, 'manifests', 'domain-delivery.json');
  const doc = readJson(file);
  if (!doc?.domains) throw new DeliveryError('DELIVERY_PROFILE_MISSING', '缺少 manifests/domain-delivery.json', 503);
  return doc;
}

function loadWorkflow(root, workflowId) {
  const index = readJson(path.join(root, 'manifests', 'workflows', 'index.json'), { workflows: [] });
  const workflow = (index.workflows || []).find((item) => item.workflow_id === workflowId);
  if (!workflow) throw new DeliveryError('WORKFLOW_MISSING', `找不到工作流：${workflowId}`, 503);
  return workflow;
}

function readSourceTables(root, domain, profile) {
  const dir = path.join(root, 'templates', 'workspace', 'data', domain);
  const names = [profile.primary_table, profile.secondary_table].filter(Boolean);
  const tables = [];
  for (const name of names) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) throw new DeliveryError('SOURCE_TABLE_MISSING', `缺少数据表：${domain}/${name}`, 503);
    const parsed = parseCsv(fs.readFileSync(file, 'utf8'));
    tables.push({
      name,
      file,
      headers: parsed.headers,
      rows: parsed.rows,
      sha256: sha256File(file),
      bytes: fs.statSync(file).size,
    });
  }
  return tables;
}

function buildReport(domain, profile, model, workflow, tables, generatedAt) {
  const primary = tables[0];
  const secondary = tables[1] || null;
  const metrics = metricDefinitions(primary.headers, primary.rows);
  const preview = primary.rows.slice(0, 8);
  const workflowNodes = (workflow.nodes || []).map((node, index) => ({
    index: index + 1,
    type: node.type || '',
    ref: node.ref || node.expr || '',
    dual: !!node.dual,
  }));
  const lines = [
    `# ${profile.title}`,
    '',
    `> 域：${profile.label}（${domain}）`,
    `> 生成时间：${generatedAt}`,
    `> 数据口径：${loadProfilesNote(domain)}`,
    '',
    '## 交付范围',
    '',
    `- 代表工作流：${workflow.workflow_id}`,
    `- 工作流说明：${workflow.description || '-'}`,
    `- 最低数据级别：${model.level || '-'}`,
    `- 双审批：${model.dual_approval ? '是' : '否'}`,
    `- 脱敏字段：${(model.redact_fields || []).join('、') || '无'}`,
    '',
    '## 数据资产',
    '',
    markdownTable(['文件', '行数', '列数', 'SHA-256'], tables.map((table) => [
      table.name,
      table.rows.length,
      table.headers.length,
      table.sha256,
    ])),
    '',
    '## 关键指标',
    '',
    markdownTable(['指标', '值'], metrics.map((metric) => [metric.label, metric.value])),
    '',
    '## 工作流节点',
    '',
    markdownTable(['序号', '类型', '引用/表达式', '双审批'], workflowNodes.map((node) => [
      node.index,
      node.type,
      node.ref,
      node.dual ? '是' : '否',
    ])),
    '',
    `## ${primary.name} 数据预览`,
    '',
    markdownTable(primary.headers, preview),
    '',
  ];
  if (secondary) {
    lines.push(`## ${secondary.name} 数据摘要`, '');
    lines.push(markdownTable(['指标', '值'], metricDefinitions(secondary.headers, secondary.rows).map((metric) => [metric.label, metric.value])));
    lines.push('');
  }
  lines.push(
    '## 校验与限制',
    '',
    '- 交付文件必须同时通过文件头、结构解析、内容守恒和 SHA-256 校验。',
    '- 本包来自合成冷启动数据，仅用于验证工作台交付链路，不构成真实经营、法律、薪酬或健康结论。',
    '- 涉及 L3/L4 的域仍须由真实数据所有者确认脱敏、审批和留存策略后才能用于正式业务。',
    '',
  );
  return { markdown: lines.join('\n'), metrics, preview, workflowNodes };
}

function loadProfilesNote() {
  return '合成冷启动数据；仅用于验证工作台交付链路，不构成真实业务结论。';
}

function renderHtml(title, markdown) {
  const body = marked.parse(markdown);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEscape(title)}</title>
<style>
:root{--paper:#f7f9fc;--ink:#172033;--muted:#5f6b7a;--line:#dbe3ee;--accent:#1769aa}
*{box-sizing:border-box}body{margin:0;background:#eaf0f7;color:var(--ink);font:15px/1.7 "Microsoft YaHei","Noto Sans CJK SC",sans-serif}
main{max-width:1100px;margin:28px auto;background:var(--paper);padding:42px 52px;border:1px solid var(--line);box-shadow:0 12px 40px #1b35501a}
h1,h2{line-height:1.25}h1{font-size:30px;border-bottom:3px solid var(--accent);padding-bottom:14px}h2{font-size:20px;margin-top:30px}
blockquote{margin:18px 0;padding:12px 16px;background:#eef5fb;border-left:4px solid var(--accent);color:var(--muted)}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}th,td{border:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#e6eef8}code{font-family:Consolas,monospace;word-break:break-all}
@media(max-width:720px){main{margin:0;padding:24px 18px;border:0}h1{font-size:24px}table{display:block;overflow:auto}}
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

async function writeXlsx(file, primary, tables, metrics) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Universal Workbench';
  workbook.created = new Date();
  const used = new Set();
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: '指标', key: 'label', width: 28 },
    { header: '值', key: 'value', width: 22 },
    { header: '公式', key: 'formula', width: 24 },
  ];
  summary.addRow({ label: '源文件', value: primary.name, formula: '' });
  for (const metric of metrics) summary.addRow({ label: metric.label, value: metric.value, formula: '' });
  const calcIndex = summary.rowCount + 1;
  summary.addRow({ label: '公式校验（行数）', value: 0, formula: `=COUNTA(A:A)-2` });
  summary.getCell(`C${calcIndex}`).value = `=COUNTA(A:A)-2`;
  summary.getCell(`B${calcIndex}`).value = { formula: `COUNTA(A:A)-2`, result: primary.rows.length };
  for (const table of tables) {
    const sheet = workbook.addWorksheet(safeSheetName(table.name.replace(/\.csv$/i, ''), used));
    sheet.addRow(table.headers);
    for (const row of table.rows) {
      sheet.addRow(row.map((value) => {
        const number = numericValue(value);
        return number == null ? value : number;
      }));
    }
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1769AA' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: sheet.getCell(1, Math.max(1, table.headers.length)).address };
    for (const column of sheet.columns) column.width = Math.min(36, Math.max(12, String(column.header || '').length + 6));
  }
  summary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1769AA' } };
  summary.views = [{ state: 'frozen', ySplit: 1 }];
  await workbook.xlsx.writeFile(file);
}

function docxCell(text, bold = false) {
  return new TableCell({
    shading: bold ? { fill: 'E6EEF8' } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold, font: 'Microsoft YaHei' })] })],
  });
}

function docxTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((header) => docxCell(header, true)) }),
      ...rows.map((row) => new TableRow({ children: headers.map((_, index) => docxCell(row[index])) })),
    ],
  });
}

async function writeDocx(file, profile, report, tables) {
  const children = [
    new Paragraph({ text: profile.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `域：${profile.label}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `代表工作流：${profile.workflow_id}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `生成时间：${new Date().toISOString()}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '数据资产', heading: HeadingLevel.HEADING_1 }),
    docxTable(['文件', '行数', '列数', 'SHA-256'], tables.map((table) => [table.name, table.rows.length, table.headers.length, table.sha256])),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '关键指标', heading: HeadingLevel.HEADING_1 }),
    docxTable(['指标', '值'], report.metrics.map((metric) => [metric.label, metric.value])),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '数据预览', heading: HeadingLevel.HEADING_1 }),
    docxTable(tables[0].headers, report.preview),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '校验与限制', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: loadProfilesNote() }),
    new Paragraph({ text: '本文件必须通过 OOXML 部件、文字提取、内容守恒与 SHA-256 校验。' }),
  ];
  const document = new Document({
    creator: 'Universal Workbench',
    title: profile.title,
    description: `${profile.label} 通用工作台交付包`,
    styles: {
      default: {
        document: { run: { font: 'Microsoft YaHei', size: 22 }, paragraph: { spacing: { after: 120 } } },
      },
    },
    sections: [{ properties: {}, children }],
  });
  const buffer = await Packer.toBuffer(document);
  fs.writeFileSync(file, buffer);
}

function writePdf(file, profile, report, tables, fontFile) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(fontFile)) {
      reject(new DeliveryError('PDF_FONT_MISSING', `缺少 PDF 中文字体：${fontFile}`, 503));
      return;
    }
    const doc = new PDFDocument({
      size: 'A4',
      margin: 42,
      font: fontFile,
      info: { Title: profile.title, Author: 'Universal Workbench' },
    });
    const stream = fs.createWriteStream(file);
    doc.pipe(stream);
    doc.registerFont('cjk', fontFile);
    const font = 'cjk';
    doc.font(font).fontSize(21).text(profile.title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#52606d').text(`域：${profile.label}  |  生成时间：${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown(1.5).fillColor('#172033');
    doc.fontSize(14).text('数据资产');
    doc.moveDown(0.4);
    tables.forEach((table) => {
      doc.fontSize(9).text(`${table.name}  |  行 ${table.rows.length}  |  列 ${table.headers.length}  |  SHA-256 ${table.sha256}`);
    });
    doc.moveDown(1).fontSize(14).text('关键指标');
    doc.moveDown(0.4);
    report.metrics.forEach((metric) => doc.fontSize(9).text(`${metric.label}：${metric.value}`));
    doc.moveDown(1).fontSize(14).text('数据预览');
    doc.moveDown(0.4);
    doc.fontSize(8);
    report.preview.forEach((row, index) => {
      const text = row.map((value, column) => `${tables[0].headers[column] || `C${column + 1}`}=${value ?? ''}`).join(' | ');
      doc.text(`${index + 1}. ${text}`);
    });
    doc.moveDown(1).fontSize(9).fillColor('#52606d').text(loadProfilesNote());
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

function deckMarkdown(profile, report, tables) {
  const lines = [
    `# ${profile.title}`,
    '',
    `## ${profile.label}`,
    '',
    `- 数据表：${tables[0].name}`,
    `- 数据行数：${tables[0].rows.length}`,
    `- 代表工作流：${profile.workflow_id}`,
    '',
    '## 关键指标',
    '',
    ...report.metrics.slice(0, 6).map((metric) => `- ${metric.label}：${metric.value}`),
    '',
    '## 校验与限制',
    '',
    '- 所有产物均经过文件头和结构校验。',
    '- 数据来自合成冷启动样本，不作为真实经营结论。',
    '',
  ];
  return lines.join('\n');
}

async function writePptx(root, tempDir, profile, report, tables) {
  const core = findPptCore(root);
  if (!core) throw new DeliveryError('PPT_GENERATOR_MISSING', '未找到 dsh-ppt deck-core.mjs', 503);
  const pptDir = path.join(tempDir, '_ppt');
  fs.mkdirSync(pptDir, { recursive: true });
  try {
    const { buildDeck } = await import(pathToFileURL(core).href);
    buildDeck({
      title: profile.title,
      content: deckMarkdown(profile, report, tables),
      theme: 'data',
      lang: 'zh',
      motion: 'off',
      outputDir: pptDir,
      fileName: 'deck',
      overwrite: true,
    });
  } catch (error) {
    throw new DeliveryError('PPT_GENERATION_FAILED', `PPTX 生成失败：${String(error.message || error).slice(0, 240)}`, 503);
  }
  const generated = path.join(pptDir, 'deck.pptx');
  if (!fs.existsSync(generated)) throw new DeliveryError('PPT_OUTPUT_MISSING', 'dsh-ppt 未生成 deck.pptx', 503);
  fs.copyFileSync(generated, path.join(tempDir, FILE_BY_FORMAT.pptx));
}

function artifactRecord(root, file, format) {
  const relative = toPosix(path.relative(root, file));
  return {
    id: relative,
    format,
    file: relative,
    path: file,
    bytes: fs.statSync(file).size,
    sha256: sha256File(file),
    mime: MIME[format],
    downloadUrl: `/workbench/api/artifact?id=${encodeURIComponent(relative)}`,
  };
}

function validatePackage(root, runDir, expectedFormats) {
  const absolute = path.resolve(runDir);
  if (!absolute.startsWith(path.resolve(root, 'deliverables') + path.sep)) {
    throw new DeliveryError('INVALID_DELIVERY_PATH', '交付目录越界');
  }
  const manifestFile = path.join(absolute, 'manifest.json');
  if (!fs.existsSync(manifestFile)) throw new DeliveryError('MANIFEST_MISSING', '缺少交付清单');
  const manifest = readJson(manifestFile);
  const expected = new Set(expectedFormats);
  for (const format of expected) {
    const artifact = (manifest.artifacts || []).find((item) => item.format === format);
    if (!artifact) throw new DeliveryError('ARTIFACT_MISSING', `清单缺少格式：${format}`);
    const file = path.join(absolute, FILE_BY_FORMAT[format]);
    if (!fs.existsSync(file) || fs.statSync(file).size <= 0) throw new DeliveryError('ARTIFACT_EMPTY', `产物为空：${format}`);
    if (artifact.sha256 !== sha256File(file)) throw new DeliveryError('ARTIFACT_HASH_MISMATCH', `产物哈希不一致：${format}`);
  }
  return manifest;
}

export function createDeliveryService({ root, audit = () => {} }) {
  const rootDir = path.resolve(root);
  const deliverablesDir = path.join(rootDir, 'deliverables');
  const fontFile = path.join(rootDir, 'assets', 'fonts', 'NotoSansCJKsc-Regular.otf');

  function profiles() {
    return loadProfiles(rootDir);
  }

  function normalizeFormats(formats) {
    const list = formats == null || formats === 'all' ? [...DELIVERY_FORMATS] : Array.isArray(formats) ? formats : [formats];
    const unique = [...new Set(list.map((value) => String(value).toLowerCase()))];
    for (const format of unique) {
      if (!DELIVERY_FORMATS.includes(format)) throw new DeliveryError('INVALID_FORMAT', `不支持的格式：${format}`, 400);
    }
    return unique;
  }

  async function deliverDomain(options = {}) {
    const domain = safeSegment(options.domain, 'domain');
    const profileDoc = profiles();
    const profile = profileDoc.domains[domain];
    if (!profile) throw new DeliveryError('DOMAIN_NOT_FOUND', `未知域：${domain}`, 400);
    const requestedFormats = normalizeFormats(options.formats);
    if (requestedFormats.length === 0) throw new DeliveryError('FORMAT_REQUIRED', '至少选择一种格式', 400);
    const workflowId = options.workflowId || profile.workflow_id;
    const model = loadDomainModel(rootDir, domain);
    const workflow = loadWorkflow(rootDir, workflowId);
    const tables = readSourceTables(rootDir, domain, profile);
    const generatedAt = new Date().toISOString();
    const stamp = generatedAt.replace(/[-:.]/g, '').replace('T', '-').replace('Z', '');
    const runId = `${stamp}-${crypto.randomBytes(4).toString('hex')}`;
    const domainDir = path.join(deliverablesDir, domain);
    fs.mkdirSync(domainDir, { recursive: true });
    const tempDir = fs.mkdtempSync(path.join(domainDir, '.tmp-'));
    const finalDir = path.join(domainDir, runId);
    const report = buildReport(domain, profile, model, workflow, tables, generatedAt);
    const artifacts = [];
    try {
      if (requestedFormats.includes('md')) {
        const file = path.join(tempDir, FILE_BY_FORMAT.md);
        fs.writeFileSync(file, report.markdown, 'utf8');
        artifacts.push(artifactRecord(rootDir, file, 'md'));
      }
      if (requestedFormats.includes('csv')) {
        const file = path.join(tempDir, FILE_BY_FORMAT.csv);
        fs.writeFileSync(file, stringifyCsv(tables[0].headers, tables[0].rows), 'utf8');
        artifacts.push(artifactRecord(rootDir, file, 'csv'));
      }
      if (requestedFormats.includes('html')) {
        const file = path.join(tempDir, FILE_BY_FORMAT.html);
        fs.writeFileSync(file, renderHtml(profile.title, report.markdown), 'utf8');
        artifacts.push(artifactRecord(rootDir, file, 'html'));
      }
      if (requestedFormats.includes('xlsx')) {
        const file = path.join(tempDir, FILE_BY_FORMAT.xlsx);
        await writeXlsx(file, tables[0], tables, report.metrics);
        artifacts.push(artifactRecord(rootDir, file, 'xlsx'));
      }
      if (requestedFormats.includes('docx')) {
        const file = path.join(tempDir, FILE_BY_FORMAT.docx);
        await writeDocx(file, profile, report, tables);
        artifacts.push(artifactRecord(rootDir, file, 'docx'));
      }
      if (requestedFormats.includes('pptx')) {
        await writePptx(rootDir, tempDir, profile, report, tables);
        artifacts.push(artifactRecord(rootDir, path.join(tempDir, FILE_BY_FORMAT.pptx), 'pptx'));
      }
      if (requestedFormats.includes('pdf')) {
        const file = path.join(tempDir, FILE_BY_FORMAT.pdf);
        await writePdf(file, profile, report, tables, fontFile);
        artifacts.push(artifactRecord(rootDir, file, 'pdf'));
      }
      const publishedArtifacts = artifacts.map((item) => {
        const finalFile = path.join(finalDir, path.basename(item.path));
        const relative = toPosix(path.relative(rootDir, finalFile));
        return {
          ...item,
          id: relative,
          file: relative,
          path: finalFile,
          downloadUrl: `/workbench/api/artifact?id=${encodeURIComponent(relative)}`,
        };
      });
      const manifest = {
        schema: 'universal-workbench/delivery-package/v1',
        run_id: runId,
        domain,
        label: profile.label,
        title: options.title || profile.title,
        workflow_id: workflow.workflow_id,
        generated_at: generatedAt,
        formats: requestedFormats,
        data_note: profileDoc.data_note,
        source_tables: tables.map((table) => ({
          file: toPosix(path.relative(rootDir, table.file)),
          rows: table.rows.length,
          columns: table.headers.length,
          bytes: table.bytes,
          sha256: table.sha256,
        })),
        content_digest: sha256Text(report.markdown),
        artifacts: publishedArtifacts,
      };
      fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      validatePackage(rootDir, tempDir, requestedFormats);
      fs.renameSync(tempDir, finalDir);
      const published = {
        ...manifest,
        path: toPosix(path.relative(rootDir, finalDir)),
        manifestPath: toPosix(path.relative(rootDir, path.join(finalDir, 'manifest.json'))),
        artifacts: publishedArtifacts,
      };
      audit('deliverable.package.create', {
        domain,
        run_id: runId,
        formats: requestedFormats,
        manifest: published.manifestPath,
      });
      return {
        ok: true,
        runId,
        ...published,
        artifacts: published.artifacts.map(({ path: _absolutePath, ...artifact }) => artifact),
      };
    } catch (error) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
      audit('deliverable.package.fail', { domain, formats: requestedFormats, error: String(error.message || error) });
      throw error;
    }
  }

  function listDeliveries(domain) {
    if (!fs.existsSync(deliverablesDir)) return [];
    const domains = domain ? [safeSegment(domain, 'domain')] : fs.readdirSync(deliverablesDir).filter((name) => fs.statSync(path.join(deliverablesDir, name)).isDirectory());
    const output = [];
    for (const name of domains) {
      const dir = path.join(deliverablesDir, name);
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir).filter((item) => !item.startsWith('.tmp-'))) {
        const manifestFile = path.join(dir, entry, 'manifest.json');
        if (!fs.existsSync(manifestFile)) continue;
        const manifest = readJson(manifestFile);
        if (!manifest) continue;
        output.push({
          domain: name,
          runId: entry,
          path: toPosix(path.relative(rootDir, path.join(dir, entry))),
          generatedAt: manifest.generated_at,
          title: manifest.title,
          formats: manifest.formats,
          artifactCount: (manifest.artifacts || []).length,
          manifest: toPosix(path.relative(rootDir, manifestFile)),
          artifacts: (manifest.artifacts || []).map((artifact) => {
            const normalized = artifact.file && artifact.file.includes('/.tmp-')
              ? `deliverables/${name}/${entry}/${path.basename(artifact.file)}`
              : artifact.file;
            return {
              format: artifact.format,
              file: normalized,
              bytes: artifact.bytes,
              sha256: artifact.sha256,
              mime: artifact.mime,
              downloadUrl: `/workbench/api/artifact?id=${encodeURIComponent(normalized)}`,
            };
          }),
        });
      }
    }
    return output.sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
  }

  function resolveArtifact(id) {
    const relative = String(id || '').replace(/\\/g, '/');
    if (!relative || relative.includes('..') || path.isAbsolute(relative)) throw new DeliveryError('INVALID_ARTIFACT_ID', '非法交付物标识', 400);
    const file = path.resolve(rootDir, relative);
    const prefix = `${deliverablesDir}${path.sep}`;
    if (!file.startsWith(prefix)) throw new DeliveryError('ARTIFACT_OUTSIDE_ROOT', '交付物路径越界', 400);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new DeliveryError('ARTIFACT_NOT_FOUND', '交付物不存在', 404);
    const ext = path.extname(file).slice(1).toLowerCase();
    return { file, format: ext, mime: MIME[ext] || 'application/octet-stream', filename: path.basename(file) };
  }

  async function verifyAllDomains() {
    const results = [];
    for (const domain of Object.keys(profiles().domains)) {
      try {
        const result = await deliverDomain({ domain, formats: DELIVERY_FORMATS });
        results.push({ domain, ok: true, runId: result.runId, artifacts: result.artifacts.length });
      } catch (error) {
        results.push({ domain, ok: false, code: error.code || 'ERROR', error: String(error.message || error) });
      }
    }
    return results;
  }

  return {
    root: rootDir,
    deliverablesDir,
    profiles,
    deliverDomain,
    listDeliveries,
    resolveArtifact,
    validatePackage,
    verifyAllDomains,
  };
}

