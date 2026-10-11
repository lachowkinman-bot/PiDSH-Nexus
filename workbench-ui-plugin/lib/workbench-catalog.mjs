// workbench-catalog.mjs — 工作台目录协议 v2（对齐 dataelement catalog.mjs 的校验/缓存语义）
//
// 纪律：
//   ① 目录来源可配置（本地文件默认 + 可选 HTTPS 远程源），默认不联网；
//   ② 校验：schemaVersion=2、kind=catalog、身份唯一、分发型合法、截图含 sha256/宽/高/字节；
//   ③ 读取：2MB 上限、10s 超时、15 分钟缓存、force=1 刷新、失败回退缓存并标记 stale；
//   ④ 检查更新只提示；禁止降级（本机版本高于目录版本时拒绝）。
import fs from 'node:fs';
import path from 'node:path';

export const CATALOG_SCHEMA = 'pids-nexus/workbench-catalog/v2';
export const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
const CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const SOURCES_FILE = 'market-sources.json';
const CACHE_FILE = 'market-cache.json';

export class CatalogError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'CatalogError';
    this.status = status;
  }
}
const fail = (message) => { throw new CatalogError(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim() !== '';
const semver = (value) => typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
const httpsUrl = (value) => {
  if (!text(value)) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
};
export const runtimeWorkbenchId = (domain) => `pids:${domain}`;
const validIdentity = (value) => typeof value === 'string'
  && (/^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*$/.test(value) || /^pids:[a-z][a-z0-9-]{1,63}$/.test(value));

export function validateCatalogV2(value) {
  if (!object(value) || value.schemaVersion !== 2 || value.kind !== 'catalog') fail('不支持的工作台目录（需要 schemaVersion=2 / kind=catalog）。');
  if (!Array.isArray(value.categories) || !Array.isArray(value.workbenches)) fail('工作台目录结构非法。');
  const categories = new Map();
  for (const category of value.categories) {
    if (!object(category) || !text(category.id) || typeof category.name !== 'string' || categories.has(category.id)) fail('工作台目录分类非法。');
    categories.set(category.id, category.name);
  }
  const ids = new Set();
  const legacyIds = new Map();
  for (const entry of value.workbenches) {
    if (!object(entry) || !validIdentity(entry.id) || ids.has(entry.id) || !text(entry.name)
      || !text(entry.category) || !categories.has(entry.category)
      || !object(entry.description) || !text(entry.description.zh) || !text(entry.description.en)
      || !semver(entry.version) || !text(entry.license) || !object(entry.distribution)
      || !['pids-runtime', 'npm', 'github-release', 'github-source'].includes(entry.distribution.type)
      || !semver(entry.distribution.version) || entry.distribution.version !== entry.version
      || !Array.isArray(entry.screenshots) || entry.screenshots.length < 1) {
      fail('工作台目录条目字段非法。');
    }
    if (entry.id.startsWith('pids:')) {
      if (entry.distribution.type !== 'pids-runtime') fail('pids:* 身份必须使用 pids-runtime 分发型。');
    } else {
      if (!httpsUrl(entry.url) || entry.url.toLowerCase() !== `https://github.com/${entry.id}`) fail('工作台目录身份/URL 不一致（需 owner/repo）。');
      if (entry.distribution.type === 'pids-runtime') fail('owner/repo 身份不能使用 pids-runtime 分发型。');
      if (entry.distribution.type === 'npm' && !text(entry.distribution.name)) fail('npm 分发缺少包名。');
      if (entry.distribution.type === 'github-release' && (!httpsUrl(entry.distribution.url) || !/^[a-f0-9]{64}$/.test(entry.distribution.sha256))) fail('Release 分发缺少 HTTPS 地址或 sha256。');
      if (entry.distribution.type === 'github-source' && (!httpsUrl(entry.distribution.url) || !/^[a-f0-9]{7,64}$/.test(entry.distribution.commit))) fail('源码分发缺少仓库地址或 commit。');
    }
    for (const screenshot of entry.screenshots) {
      if (!object(screenshot) || !text(screenshot.alt) || !/^[a-f0-9]{64}$/.test(screenshot.sha256)
        || !Number.isSafeInteger(screenshot.width) || screenshot.width <= 0
        || !Number.isSafeInteger(screenshot.height) || screenshot.height <= 0
        || !Number.isSafeInteger(screenshot.bytes) || screenshot.bytes <= 0
        || (!httpsUrl(screenshot.url) && !text(screenshot.file))) {
        fail('工作台目录截图字段非法（需 url 或 file + sha256/width/height/bytes/alt）。');
      }
    }
    for (const legacy of entry.legacyIds || []) {
      if (typeof legacy !== 'string' || !legacy) fail('legacyIds 非法。');
      if (legacyIds.has(legacy) && legacyIds.get(legacy) !== entry.id) fail('legacy id 冲突。');
      legacyIds.set(legacy, entry.id);
    }
    ids.add(entry.id);
  }
  return JSON.parse(JSON.stringify(value));
}

export function compareSemver(candidate, current) {
  const parse = (value) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(value || ''));
    if (!match) return null;
    return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] || '' };
  };
  const a = parse(candidate);
  const b = parse(current);
  if (!a || !b) return null;
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  if (a.pre === b.pre) return 0;
  if (a.pre === '') return 1;
  if (b.pre === '') return -1;
  return a.pre > b.pre ? 1 : -1;
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

export function marketSources({ bundleRoot, workspaceRoot }) {
  const file = path.join(workspaceRoot, 'config', SOURCES_FILE);
  const doc = readJson(file, null);
  const sources = [];
  for (const source of doc?.sources || []) {
    if (!object(source) || !text(source.id) || !['file', 'https'].includes(source.type) || source.enabled === false) continue;
    sources.push(source);
  }
  if (!sources.some((source) => source.type === 'file' && String(source.path || '').includes('workbench-catalog.json'))) {
    sources.unshift({ id: 'bundled', type: 'file', path: path.join(bundleRoot, 'manifests', 'workbench-catalog.json'), enabled: true });
  }
  return { file, remoteAllowed: doc?.allowRemote === true, sources };
}

async function readRemote(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('目录请求超时')), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new CatalogError(`目录返回 HTTP ${response.status}。`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_CATALOG_BYTES) throw new CatalogError('目录超过 2MB 上限。');
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { clearTimeout(timer); }
}

export function createCatalogReader({ bundleRoot, workspaceRoot, fetchImpl = fetch, now = Date.now }) {
  const cacheFile = path.join(workspaceRoot, 'custom', CACHE_FILE);
  const loadSource = async (source, { force }) => {
    if (source.type === 'file') {
      const doc = readJson(source.path, null);
      if (!doc) throw new CatalogError(`本地目录不可读：${source.path}`);
      return { doc, source: `local:${source.id}` };
    }
    if (!httpsUrl(source.url)) throw new CatalogError(`远程目录必须是 HTTPS：${source.id}`);
    return { doc: await readRemote(source.url), source: `remote:${source.id}` };
  };
  return async function readCatalog({ force = false } = {}) {
    const { remoteAllowed, sources } = marketSources({ bundleRoot, workspaceRoot });
    const cached = readJson(cacheFile, null);
    const cacheFresh = cached && Number.isFinite(cached.fetchedAt) && (now() - cached.fetchedAt) < CACHE_MAX_AGE_MS && !force;
    if (cacheFresh) {
      try {
        return { catalog: validateCatalogV2(cached.catalog), source: 'cache', stale: false, fetchedAt: cached.fetchedAt, errors: [] };
      } catch { /* 缓存损坏则继续现场读取 */ }
    }
    const merged = { schemaVersion: 2, kind: 'catalog', categories: [], workbenches: [] };
    const errors = [];
    const sourcesUsed = [];
    let sawRemote = false;
    for (const source of sources) {
      if (source.type === 'https' && !remoteAllowed) { errors.push(`远程源已跳过（未开启 allowRemote）：${source.id}`); continue; }
      if (source.type === 'https') sawRemote = true;
      try {
        const { doc, source: marker } = await loadSource(source, { force });
        const valid = validateCatalogV2(doc);
        const categories = new Map(merged.categories.map((item) => [item.id, item]));
        for (const category of valid.categories) if (!categories.has(category.id)) merged.categories.push(category);
        const byId = new Map(merged.workbenches.map((item) => [item.id, item]));
        for (const entry of valid.workbenches) byId.set(entry.id, entry);
        merged.workbenches = [...byId.values()];
        sourcesUsed.push(marker);
      } catch (error) {
        errors.push(`${source.id}: ${String(error && error.message || error).slice(0, 160)}`);
      }
    }
    if (!merged.workbenches.length) {
      if (cached) {
        try {
          return { catalog: validateCatalogV2(cached.catalog), source: 'cache', stale: true, fetchedAt: cached.fetchedAt, errors };
        } catch { /* 继续抛错 */ }
      }
      throw new CatalogError(errors.length ? `所有目录源都不可用：${errors.join('；')}` : '没有任何可用目录源。');
    }
    merged.generatedAt = new Date(now()).toISOString();
    if (sawRemote) writeJsonAtomic(cacheFile, { fetchedAt: now(), catalog: merged });
    return { catalog: merged, source: sourcesUsed.join('+'), stale: false, fetchedAt: now(), errors };
  };
}

export function checkUpdates({ catalog, installed }) {
  const byId = new Map((catalog.workbenches || []).map((entry) => [entry.id, entry]));
  const records = [];
  for (const item of installed) {
    const identity = item.catalog_id || runtimeWorkbenchId(item.id);
    const entry = byId.get(identity) || byId.get(item.id);
    if (!entry) { records.push({ id: item.id, identity, status: 'not-in-catalog', current: item.version || null }); continue; }
    const comparison = compareSemver(entry.version, item.version || '0.0.0');
    if (comparison === null) { records.push({ id: item.id, identity, status: 'unknown-version', current: item.version || null, latest: entry.version }); continue; }
    if (comparison > 0) records.push({ id: item.id, identity, status: 'update-available', current: item.version, latest: entry.version });
    else if (comparison < 0) records.push({ id: item.id, identity, status: 'downgrade-blocked', current: item.version, latest: entry.version });
    else records.push({ id: item.id, identity, status: 'up-to-date', current: item.version, latest: entry.version });
  }
  return { schema: 'pids-nexus/workbench-updates/v1', generated_at: new Date().toISOString(), records };
}
