// data-plane.mjs — 真实数据面：导入（严格/列映射）、XLSX、外部只读数据源骨架
//
// 纪律：
//   ① 导入必须按域模型校验表头（严格=逐字一致；映射=显式列映射并给出问题清单）；
//   ② 每次写入前备份、写入后审计（data.import），数据版本随之更新；
//   ③ 外部源只读、只引用环境变量凭据、默认关闭；SQL 适配器本轮只留接口（not-implemented）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { runtimeDomainModel } from './runtime-workbenches.mjs';

const IMPORT_SCHEMA = 'pids-nexus/data-import/v1';
const DATASOURCES_SCHEMA = 'pids-nexus/datasources/v1';

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
function nowIso() {
  return new Date().toISOString();
}
function safeSegment(value, label) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(text)) throw new Error(`${label} 非法：${value}`);
  return text;
}

export function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const value = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (quoted) {
      if (ch === '"') {
        if (value[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((item) => item.some((cell) => String(cell).trim() !== ''));
}

export function stringifyCsv(headers, rows) {
  const quote = (cell) => {
    const text = String(cell == null ? '' : cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(quote).join(',')).join('\n') + '\n';
}

export function resolveDomainModelFile({ bundleRoot, workspaceRoot, domain }) {
  if (workspaceRoot) {
    const runtime = runtimeDomainModel(workspaceRoot, domain);
    if (runtime) return runtime;
  }
  return readJson(path.join(bundleRoot, 'manifests', 'domain-model', `${domain}.json`));
}

export function resolveTableColumns({ bundleRoot, workspaceRoot, domain, table }) {
  const model = resolveDomainModelFile({ bundleRoot, workspaceRoot, domain });
  if (!model) throw new Error(`域模型缺失：${domain}`);
  const file = table.endsWith('.csv') ? table : `${table}.csv`;
  const entry = (model.tables || []).find((item) => item.file === file);
  if (!entry) throw new Error(`域 ${domain} 没有台账表：${file}`);
  return { model, file, columns: entry.columns || [] };
}

function optionalRequireModule(candidateDirs, name) {
  for (const dir of candidateDirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    try {
      const require = createRequire(path.join(dir, 'resolve.cjs'));
      return require.resolve(name);
    } catch { /* 继续下一个候选目录 */ }
  }
  return null;
}

async function loadExcelJs({ bundleRoot }) {
  const dshHome = process.env.DSH_HOME || path.join(bundleRoot, '.dsh-home');
  const resolved = optionalRequireModule([
    path.join(bundleRoot, 'node_modules'),
    path.join(dshHome, 'profiles', 'web', 'node_modules'),
  ], 'exceljs');
  if (!resolved) return null;
  const mod = await import(`file://${resolved.replace(/\\/g, '/')}`);
  return mod.default || mod;
}

export async function payloadToMatrix({ bundleRoot, body }) {
  if (body.csv) return guessDelimiterMatrix(parseCsvText(body.csv));
  if (body.xlsxBase64) {
    const ExcelJS = await loadExcelJs({ bundleRoot });
    if (!ExcelJS) throw new Error('XLSX 解析不可用：未找到 exceljs（开发树 node_modules 或 profile 依赖）');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(String(body.xlsxBase64), 'base64'));
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('XLSX 没有工作表');
    const matrix = [];
    sheet.eachRow((row) => {
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell) => values.push(cell.text == null ? '' : String(cell.text)));
      matrix.push(values);
    });
    return matrix.filter((item) => item.some((cell) => String(cell).trim() !== ''));
  }
  if (body.filePath) {
    const file = path.resolve(String(body.filePath));
    if (!fs.existsSync(file)) throw new Error(`导入文件不存在：${file}`);
    const text = fs.readFileSync(file, 'utf8');
    return parseCsvText(text);
  }
  throw new Error('缺少导入内容：csv / xlsxBase64 / filePath 三选一');
}

function guessDelimiterMatrix(rows) {
  return rows;
}

export function validateHeaders(modelColumns, inputHeaders) {
  const missing = modelColumns.filter((column) => !inputHeaders.includes(column));
  const extra = inputHeaders.filter((column) => !modelColumns.includes(column));
  const order = inputHeaders.filter((column) => modelColumns.includes(column));
  const orderMismatch = order.join('|') !== modelColumns.filter((column) => inputHeaders.includes(column)).join('|');
  return { ok: !missing.length && !extra.length && !orderMismatch, missing, extra, order_mismatch: orderMismatch, expected: modelColumns, actual: inputHeaders };
}

export function applyColumnMapping(modelColumns, inputHeaders, mapping) {
  const problems = [];
  const mapped = new Array(inputHeaders.length).fill(null);
  const map = mapping && typeof mapping === 'object' ? mapping : {};
  for (let i = 0; i < inputHeaders.length; i += 1) {
    const target = map[inputHeaders[i]];
    if (target == null || target === '') continue;
    if (!modelColumns.includes(target)) { problems.push(`目标列不在域模型中：${inputHeaders[i]} → ${target}`); continue; }
    if (mapped.includes(target)) { problems.push(`目标列重复映射：${target}`); continue; }
    mapped[i] = target;
  }
  const missing = modelColumns.filter((column) => !mapped.includes(column));
  const ok = problems.length === 0 && missing.length === 0;
  return { ok, problems, missing, mapped };
}

function createDataBackup(workspaceRoot, domain, table, file) {
  if (!fs.existsSync(file)) return null;
  const stamp = nowIso().replace(/[-:.]/g, '').slice(0, 15);
  const dir = path.join(workspaceRoot, 'backups', `${stamp}-import-${domain}-${table}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(file, path.join(dir, path.basename(file)));
  writeJsonAtomic(path.join(dir, 'manifest.json'), {
    schema: 'pids-nexus/backup/v1',
    reason: `import:${domain}/${table}`,
    files: [{ path: path.basename(file), bytes: fs.statSync(file).size }],
    created_at: nowIso(),
  });
  return dir;
}

function appendAuditLine(workspaceRoot, action, detail) {
  const dir = path.join(workspaceRoot, 'audit');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `audit-${nowIso().slice(0, 10)}.jsonl`);
  fs.appendFileSync(file, JSON.stringify({ ts: nowIso(), action, ...detail }) + '\n', 'utf8');
}

export function dataVersionOf(workspaceRoot) {
  const dir = path.join(workspaceRoot, 'data');
  const sha = crypto.createHash('sha256');
  const walk = (target) => {
    if (!fs.existsSync(target)) return;
    for (const entry of fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(target, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) { sha.update(path.relative(dir, full)); sha.update(fs.readFileSync(full)); }
    }
  };
  walk(dir);
  return sha.digest('hex').slice(0, 16);
}

export async function importDomainData({ bundleRoot, workspaceRoot, body = {} }) {
  const domain = safeSegment(body.domain, 'domain');
  const { file, columns } = resolveTableColumns({ bundleRoot, workspaceRoot, domain, table: safeSegment(body.table, 'table') });
  const matrix = await payloadToMatrix({ bundleRoot, body });
  if (matrix.length < 2) throw new Error('导入内容至少需要表头 + 一行数据');
  const inputHeaders = matrix[0].map((cell) => String(cell).trim());
  const mode = body.mode === 'mapping' ? 'mapping' : 'strict';
  const preview = body.preview === true;
  let headers = inputHeaders;
  let rows = matrix.slice(1);
  let validation;
  if (mode === 'strict') {
    validation = validateHeaders(columns, inputHeaders);
    if (!validation.ok && !preview) {
      return {
        schema: IMPORT_SCHEMA, ok: false, mode, preview: false, domain, table: file,
        validation, message: '表头与域模型不一致（strict 模式）：请修正表头或改用列映射导入。',
      };
    }
  } else {
    const mapping = applyColumnMapping(columns, inputHeaders, body.mapping || {});
    validation = { ...mapping, expected: columns, actual: inputHeaders };
    if (mapping.ok) {
      const indexOf = new Map(mapping.mapped.map((target, i) => [target, i]).filter(([target]) => target));
      headers = columns;
      rows = matrix.slice(1).map((row) => columns.map((column) => row[indexOf.get(column)] ?? ''));
    } else if (!preview) {
      return {
        schema: IMPORT_SCHEMA, ok: false, mode, preview: false, domain, table: file,
        validation, message: '列映射不完整：请补齐缺失列映射后重试。',
      };
    }
  }
  if (preview) {
    return {
      schema: IMPORT_SCHEMA,
      ok: validation.ok,
      mode,
      preview: true,
      domain,
      table: file,
      validation,
      headers_in: inputHeaders,
      headers_out: headers,
      sample_rows: rows.slice(0, 20),
      total_rows: rows.length,
    };
  }
  if (!validation.ok) {
    return { schema: IMPORT_SCHEMA, ok: false, mode, preview: false, domain, table: file, validation, message: '校验未通过，未写入任何数据。' };
  }
  const target = path.join(workspaceRoot, 'data', domain, file);
  const backup = createDataBackup(workspaceRoot, domain, file.replace(/\.csv$/, ''), target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, stringifyCsv(headers, rows), 'utf8');
  const result = {
    schema: IMPORT_SCHEMA,
    ok: true,
    mode,
    preview: false,
    domain,
    table: file,
    rows: rows.length,
    bytes: fs.statSync(target).size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),
    backup: backup ? path.basename(backup) : null,
    data_version: dataVersionOf(workspaceRoot),
    generated_at: nowIso(),
  };
  appendAuditLine(workspaceRoot, 'data.import', { domain, table: file, rows: rows.length, mode, backup: result.backup });
  return result;
}

// —— 外部只读数据源骨架 ——
function datasourcesFile(workspaceRoot) {
  return path.join(workspaceRoot, 'config', 'datasources.json');
}
export function listDatasources({ workspaceRoot }) {
  const doc = readJson(datasourcesFile(workspaceRoot), { schema: DATASOURCES_SCHEMA, sources: [] });
  return {
    schema: DATASOURCES_SCHEMA,
    note: '只读外部源：默认关闭；凭据只引用环境变量名，不落明文；SQL 适配器本轮未实现（not-implemented）。',
    config_path: path.join(workspaceRoot, 'config', 'datasources.json').replace(/\\/g, '/'),
    sources: (doc.sources || []).map((source) => ({
      id: source.id,
      type: source.type,
      enabled: !!source.enabled,
      domain: source.domain || null,
      table: source.table || null,
      target: source.endpoint || source.path || null,
      credential_env: source.credential_env || null,
      mode: 'read-only',
      supported: source.type === 'file' || source.type === 'http',
    })),
  };
}

export async function probeDatasource({ workspaceRoot, id }) {
  const doc = readJson(datasourcesFile(workspaceRoot), { sources: [] });
  const source = (doc.sources || []).find((item) => item.id === id);
  if (!source) throw new Error(`数据源不存在：${id}`);
  if (source.type === 'sql') return { ok: false, id, status: 'not-implemented', note: 'SQL 适配器接口已预留，本轮未实现驱动。' };
  if (source.type === 'file') {
    const file = path.resolve(String(source.path || ''));
    const exists = fs.existsSync(file);
    appendAuditLine(workspaceRoot, 'datasource.probe', { id, type: 'file', ok: exists });
    return { ok: exists, id, status: exists ? 'ready' : 'missing', file: file.replace(/\\/g, '/') };
  }
  if (source.type === 'http') {
    const url = String(source.endpoint || '');
    const secure = /^https:\/\//i.test(url) || /^http:\/\/(127\.0\.0\.1|localhost)/i.test(url);
    if (!secure) return { ok: false, id, status: 'blocked', note: '仅允许 HTTPS（或本机回环）来源，且不得携带凭据。' };
    try {
      const response = await fetch(url, { method: 'GET', headers: source.header_env ? {} : {}, signal: AbortSignal.timeout(8000) });
      appendAuditLine(workspaceRoot, 'datasource.probe', { id, type: 'http', ok: response.ok, status: response.status });
      return { ok: response.ok, id, status: response.ok ? 'ready' : 'http-error', http: response.status };
    } catch (error) {
      appendAuditLine(workspaceRoot, 'datasource.probe', { id, type: 'http', ok: false, error: String(error.message || error).slice(0, 120) });
      return { ok: false, id, status: 'unreachable', note: String(error.message || error).slice(0, 200) };
    }
  }
  return { ok: false, id, status: 'unsupported' };
}

export async function refreshDatasource({ bundleRoot, workspaceRoot, id }) {
  const doc = readJson(datasourcesFile(workspaceRoot), { sources: [] });
  const source = (doc.sources || []).find((item) => item.id === id);
  if (!source) throw new Error(`数据源不存在：${id}`);
  if (!source.enabled) return { ok: false, id, status: 'disabled', note: '数据源未启用（enabled=false）。' };
  if (source.type === 'sql') return { ok: false, id, status: 'not-implemented', note: 'SQL 刷新未实现。' };
  if (!source.domain || !source.table) throw new Error('数据源需要声明 domain 与 table');
  let body = null;
  if (source.type === 'file') {
    const file = path.resolve(String(source.path || ''));
    if (!fs.existsSync(file)) return { ok: false, id, status: 'missing', note: `文件不存在：${file}` };
    body = /\.xlsx$/i.test(file)
      ? { domain: source.domain, table: source.table, xlsxBase64: fs.readFileSync(file).toString('base64'), mode: source.strict === false ? 'mapping' : 'strict', mapping: source.mapping || {} }
      : { domain: source.domain, table: source.table, csv: fs.readFileSync(file, 'utf8'), mode: source.strict === false ? 'mapping' : 'strict', mapping: source.mapping || {} };
  } else {
    const url = String(source.endpoint || '');
    const secure = /^https:\/\//i.test(url) || /^http:\/\/(127\.0\.0\.1|localhost)/i.test(url);
    if (!secure) return { ok: false, id, status: 'blocked', note: '仅允许 HTTPS（或本机回环）来源。' };
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { ok: false, id, status: 'http-error', http: response.status };
    const text = await response.text();
    body = { domain: source.domain, table: source.table, csv: text, mode: source.strict === false ? 'mapping' : 'strict', mapping: source.mapping || {} };
  }
  const result = await importDomainData({ bundleRoot, workspaceRoot, body });
  appendAuditLine(workspaceRoot, 'datasource.refresh', { id, ok: result.ok, domain: source.domain, table: source.table, rows: result.rows || 0 });
  return { ok: result.ok, id, status: result.ok ? 'imported' : 'rejected', import: result };
}
