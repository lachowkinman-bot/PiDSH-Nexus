// runtime-workbenches.mjs — 运行时工作台层（装上即用）
//
// 设计纪律（ADR-0019）：
//   ① 安装物只落用户数据根 workspace/custom/installed/<id>/，bundle 资产保持只读；
//   ② 安装前必须过域级校验（gen-domain-model 硬校验 + 运行时设计校验），未过不得安装；
//   ③ 新增域在安装时生成"最小可用设计"（模块/事项/阶段由工作流节点派生），
//      从而工作流向导/实例/审批/交付/审计全链路可用；
//   ④ 修订内置域只允许 overlay 场景/技能/台账/§9 规则（不改 78 条工作流闭集），工作流/设计沿用内置；
//   ⑤ 运行时装订统一标注"本地工作台（未固化）"；固化进产品基线仍走 dev8 的合入包流程。
import fs from 'node:fs';
import path from 'node:path';
import { stageOverlay, injectWorkflowFragments, runStagedScript } from './custom-drafts.mjs';
import { forgetInstall, recordInstall } from './plugin-packages.mjs';
import { PACKAGE_SCHEMA, validatePackageV2 } from './workbench-package.mjs';

export const INSTALL_SCHEMA = 'pids-nexus/runtime-workbench/v2';
const LEGACY_INSTALL_SCHEMA = 'pids-nexus/runtime-workbench/v1';
export const CATALOG_SCHEMA = 'pids-nexus/workbench-catalog/v1';
export const BUILTIN_DOMAIN_IDS = ['strat', 'mkt-on', 'mkt-off', 'sales', 'fin', 'rec', 'trn', 'prf', 'comp', 'ben', 'admin', 'cmp', 'er-eap'];

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
function copyTree(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}
function assertSafeId(value, label) {
  const text = String(value || '').trim();
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(text)) throw new Error(`${label} 非法（2-24 位小写字母/数字/连字符）：${value}`);
  return text;
}

export function installedRoot(workspaceRoot) {
  return path.join(workspaceRoot, 'custom', 'installed');
}
export function installedDir(workspaceRoot, id) {
  return path.join(installedRoot(workspaceRoot), assertSafeId(id, '工作台 id'));
}

export function listInstalled(workspaceRoot, { includeDisabled = true } = {}) {
  const root = installedRoot(workspaceRoot);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(root, entry.name);
      const raw = readJson(path.join(dir, 'install.json'));
      if (!raw) return null;
      const { install, migrated } = normalizeInstall(raw);
      if (migrated) {
        // v1 → v2 自动迁移：补齐身份/版本/分类/描述，保留资产与生成物不动
        try { writeJsonAtomic(path.join(dir, 'install.json'), install); } catch { /* 迁移写回失败不影响读取 */ }
      }
      return { id: install.id, dir, install };
    })
    .filter(Boolean)
    .filter((item) => includeDisabled || item.install.status === 'installed')
    .sort((a, b) => String(a.install.installed_at || '').localeCompare(String(b.install.installed_at || '')));
}

export function normalizeInstall(raw) {
  if (!raw || raw.schema === INSTALL_SCHEMA) return { install: raw, migrated: false };
  if (raw.schema !== LEGACY_INSTALL_SCHEMA) return { install: raw, migrated: false };
  const migrated = {
    ...raw,
    schema: INSTALL_SCHEMA,
    catalog_id: raw.catalog_id || `pids:${raw.id}`,
    version: raw.version || '1.0.0',
    license: raw.license || 'Apache-2.0',
    category: raw.category || 'local',
    description: raw.description || {
      zh: `${raw.title || raw.id}（由 v1 安装记录自动迁移）`,
      en: `${raw.id} workbench (auto-migrated from v1 install record)`,
    },
    audience: raw.audience || null,
    requirements: raw.requirements || null,
    screenshots: raw.screenshots || [],
    legacy_schema: LEGACY_INSTALL_SCHEMA,
    migrated_at: nowIso(),
  };
  return { install: migrated, migrated: true };
}

export function enabledInstalls(workspaceRoot) {
  return listInstalled(workspaceRoot).filter((item) => item.install.status === 'installed');
}

export function runtimeDomainIds(workspaceRoot) {
  return enabledInstalls(workspaceRoot).map((item) => item.install.id);
}

export function runtimeDomains(workspaceRoot) {
  return enabledInstalls(workspaceRoot).map((item) => ({
    id: item.install.id,
    label: item.install.label || item.install.id,
    color: item.install.color || '#0f766e',
    origin: 'installed',
    custom: item.install.kind !== 'revision',
    local: true,
    title: item.install.title || item.install.label || item.install.id,
    kind: item.install.kind,
    installed_at: item.install.installed_at,
    source: item.install.source || null,
  }));
}

export function runtimeDomainModel(workspaceRoot, domain) {
  const item = enabledInstalls(workspaceRoot).find((entry) => entry.install.id === domain);
  if (!item) return null;
  return readJson(path.join(item.dir, 'generated', 'domain-model.json'));
}

export function runtimeWorkflowEntries(workspaceRoot) {
  const out = [];
  for (const item of enabledInstalls(workspaceRoot)) {
    if (item.install.kind !== 'new-domain') continue;
    const entries = readJson(path.join(item.dir, 'generated', 'workflow-entries.json'), []);
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (entry && entry.domain === item.install.id) out.push(entry);
    }
  }
  return out;
}

export function runtimeDesign(workspaceRoot, domain) {
  const item = enabledInstalls(workspaceRoot).find((entry) => entry.install.id === domain);
  if (!item || item.install.kind !== 'new-domain') return null;
  return readJson(path.join(item.dir, 'generated', 'design.json'));
}

function defaultRuntimeDesign() {
  return null;
}
void defaultRuntimeDesign;

// —— 安装 ——
function persistInstall({ workspaceRoot, id, draft, origin, source, kind, label, color, title, staging, injected, designOk, evidence, builtinRevision,
  version = '1.0.0', catalogId = null, category = 'local', description = null, license = 'Apache-2.0', audience = null, requirements = null, screenshots = [], packageMeta = null }) {
  const dir = installedDir(workspaceRoot, id);
  fs.mkdirSync(path.join(dir, 'generated'), { recursive: true });
  copyTree(draft.overlayDir, path.join(dir, 'assets'));
  // 数据播种：把工作台包里的示例台账复制到数据根（已存在的文件不覆盖，真实数据导入后优先）
  const seedDir = path.join(draft.overlayDir, 'templates', 'workspace', 'data', id);
  if (fs.existsSync(seedDir)) {
    const dataDir = path.join(workspaceRoot, 'data', id);
    fs.mkdirSync(dataDir, { recursive: true });
    for (const file of fs.readdirSync(seedDir)) {
      const target = path.join(dataDir, file);
      if (!fs.existsSync(target)) fs.copyFileSync(path.join(seedDir, file), target);
    }
  }
  const modelFile = path.join(staging, 'manifests', 'domain-model', `${id}.json`);
  if (!fs.existsSync(modelFile)) throw new Error(`安装失败：staging 缺少域模型 ${id}.json`);
  fs.copyFileSync(modelFile, path.join(dir, 'generated', 'domain-model.json'));
  const entriesFile = path.join(staging, 'custom-out', 'workflow-entries.json');
  if (fs.existsSync(entriesFile)) fs.copyFileSync(entriesFile, path.join(dir, 'generated', 'workflow-entries.json'));
  else writeJsonAtomic(path.join(dir, 'generated', 'workflow-entries.json'), []);
  const designFile = path.join(staging, 'custom-out', 'design.json');
  if (fs.existsSync(designFile)) fs.copyFileSync(designFile, path.join(dir, 'generated', 'design.json'));
  writeJsonAtomic(path.join(dir, 'generated', 'verify.json'), evidence);
  const install = {
    schema: INSTALL_SCHEMA,
    id,
    catalog_id: catalogId || `pids:${id}`,
    version,
    license,
    category,
    description: description || { zh: `${title || label || id} 工作台`, en: `${id} workbench` },
    audience: audience || null,
    requirements: requirements || null,
    screenshots: Array.isArray(screenshots) ? screenshots : [],
    package_schema: packageMeta && packageMeta.schema ? packageMeta.schema : null,
    kind,
    builtin_revision: !!builtinRevision,
    label: label || draft.label || id,
    color: color || '#0f766e',
    title: title || label || id,
    origin: origin || 'session',
    source: source || null,
    status: 'installed',
    installed_at: nowIso(),
    updated_at: nowIso(),
    injected_workflows: injected || 0,
    design_ok: !!designOk,
    verify: { ok: !!evidence.ok, generated_at: evidence.generated_at, checks: evidence.checks || [] },
  };
  writeJsonAtomic(path.join(dir, 'install.json'), install);
  try {
    recordInstall(workspaceRoot, install.catalog_id, {
      type: 'pids-runtime',
      runtime_id: id,
      version,
      distribution: { type: 'pids-runtime', path: (source && (source.dir || source.draft_id)) || null },
      catalog_id: install.catalog_id,
    });
  } catch { /* 安装记录失败不影响安装结果 */ }
  return { dir, install };
}

function preflightOverlay(overlayDir) {
  const files = [];
  const walk = (dir, base = dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, base);
      else files.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  };
  walk(overlayDir);
  return files;
}

export function installWorkbench({ bundleRoot, workspaceRoot, overlayDir, id, label, color, title, origin = 'session', source = null, draftMeta = null,
  version = '1.0.0', catalogId = null, category = 'local', description = null, license = 'Apache-2.0', audience = null, requirements = null,
  screenshots = [], screenshotsDir = null, packageMeta = null }) {
  const domain = assertSafeId(id, '工作台域 id');
  const builtin = BUILTIN_DOMAIN_IDS.includes(domain);
  const files = preflightOverlay(overlayDir);
  if (!files.length) throw new Error('安装失败：资产为空（overlay 至少需要一个文件）');
  const fragmentFile = `manifests/workflows/${domain}.workflows.json`;
  const hasFragments = files.includes(fragmentFile);
  if (builtin && hasFragments) {
    throw new Error('运行时装订暂不支持给内置域新增/改写工作流（请改用自定义域，或走固化流程）');
  }
  if (builtin && !files.some((rel) => rel.startsWith('templates/') || rel.startsWith('docs/preset-design/') || rel.startsWith('manifests/scenes/'))) {
    throw new Error('修订内置域至少需要修改场景/台账/技能/§9 规则之一');
  }
  const kind = builtin ? 'revision' : 'new-domain';
  const stagingId = `install-${domain}`;
  const { staging, applied } = stageOverlay({ bundleRoot, workspaceRoot, overlayDir, id: stagingId });
  const checks = [];
  const record = (name, step) => {
    checks.push({ name, exit: step.exit, ms: step.ms });
    if (step.exit !== 0) {
      const tail = `${step.stdout_tail}\n${step.stderr_tail}`.trim().split(/\r?\n/).slice(-6).join(' | ');
      throw new Error(`安装校验未通过（${name}）：${tail.slice(0, 400)}`);
    }
    return step;
  };
  record('gen-workflows', runStagedScript(staging, 'scripts/gen-workflows.mjs'));
  const injected = injectWorkflowFragments(staging);
  if (injected.errors.length) throw new Error(`工作流条目非法：${injected.errors.join('；')}`);
  if (injected.injected) checks.push({ name: 'workflow-fragments', exit: 0, injected: injected.injected });
  record('gen-domain-model', runStagedScript(staging, 'scripts/gen-domain-model.mjs'));
  let designOk = false;
  if (kind === 'new-domain') {
    record('build-runtime-design', runStagedScript(staging, 'scripts/custom/build-runtime-design.mjs', ['--domain', domain, '--label', label || domain, '--out-dir', 'custom-out']));
    record('verify-runtime-design', runStagedScript(staging, 'scripts/custom/verify-runtime-design.mjs', ['--domain', domain, '--out-dir', 'custom-out', '--staging', '.']));
    designOk = true;
  }
  const evidence = {
    schema: 'pids-nexus/runtime-workbench-install/v1',
    id: domain,
    kind,
    generated_at: nowIso(),
    overlay_files: files.length,
    applied,
    injected_workflows: injected.injected || 0,
    ok: true,
    checks,
  };
  const destDir = installedDir(workspaceRoot, domain);
  const { dir, install } = persistInstall({
    workspaceRoot,
    id: domain,
    draft: { overlayDir, label },
    origin,
    source,
    kind,
    label,
    color,
    title,
    staging,
    injected: injected.injected,
    designOk,
    evidence,
    builtinRevision: builtin,
    version,
    catalogId,
    category,
    description,
    license,
    audience,
    requirements,
    packageMeta,
    screenshots: (() => {
      if (!screenshotsDir || !fs.existsSync(screenshotsDir)) return screenshots || [];
      const out = [];
      for (const shot of screenshots || []) {
        const file = String(shot.file || '');
        const target = path.join(screenshotsDir, file);
        if (!fs.existsSync(target)) continue;
        const dest = path.join(destDir, file);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(target, dest);
        out.push({ ...shot, file });
      }
      return out;
    })(),
  });
  void draftMeta;
  return { ok: true, id: domain, kind, dir: dir.replace(/\\/g, '/'), install, evidence };
}

export function installWorkbenchFromDraft({ bundleRoot, workspaceRoot, draftId, origin = 'session' }) {
  const draftDir = path.join(workspaceRoot, 'custom', 'drafts', draftId);
  const draft = readJson(path.join(draftDir, 'draft.json'));
  if (!draft) throw new Error(`草稿不存在：${draftId}`);
  const verify = readJson(path.join(draftDir, 'verify.json'));
  if (!verify || !verify.ok) throw new Error('草稿尚未通过校验：先运行 verify-draft');
  const id = draft.kind === 'new-domain' ? draft.newDomain : draft.targetDomain;
  const overlayDir = path.join(draftDir, 'overlay');
  return installWorkbench({
    bundleRoot,
    workspaceRoot,
    overlayDir,
    id,
    label: draft.title || id,
    color: '#0f766e',
    title: draft.title || id,
    origin,
    source: { type: 'draft', draft_id: draftId },
    draftMeta: { requirements: draft.requirements || '' },
  });
}

export function importWorkbenchPackage({ bundleRoot, workspaceRoot, packageDir, origin = 'package' }) {
  const manifest = readJson(path.join(packageDir, 'workbench.json')) || readJson(path.join(packageDir, 'manifest.json'));
  if (!manifest || !manifest.id) throw new Error('工作台包缺少 workbench.json（需含 id/label/title/assets）');
  if (manifest.schema === PACKAGE_SCHEMA) {
    const validation = validatePackageV2({ manifest, dir: packageDir });
    if (!validation.ok) throw new Error(`工作台包校验未通过：\n- ${validation.problems.join('\n- ')}`);
  }
  const assetsDir = path.join(packageDir, manifest.assets || 'assets');
  if (!fs.existsSync(assetsDir)) throw new Error(`工作台包缺少资产目录：${manifest.assets || 'assets'}`);
  const domain = manifest.id.startsWith('pids:') ? manifest.id.slice('pids:'.length) : manifest.id;
  return installWorkbench({
    bundleRoot,
    workspaceRoot,
    overlayDir: assetsDir,
    id: domain,
    label: manifest.name || manifest.label,
    color: manifest.color,
    title: manifest.title || manifest.name,
    origin,
    source: { type: 'package', dir: packageDir.replace(/\\/g, '/'), version: manifest.version || null },
    version: manifest.version || '1.0.0',
    catalogId: manifest.id,
    category: manifest.category || 'local',
    description: manifest.description || null,
    license: manifest.license || 'Apache-2.0',
    audience: manifest.audience || null,
    requirements: manifest.requirements || null,
    screenshots: manifest.screenshots || [],
    screenshotsDir: packageDir,
    packageMeta: { schema: manifest.schema || null },
  });
}

// —— 生命周期 ——
function updateInstall(workspaceRoot, id, mutate) {
  const dir = installedDir(workspaceRoot, id);
  const file = path.join(dir, 'install.json');
  const install = readJson(file);
  if (!install) throw new Error(`未安装的工作台：${id}`);
  mutate(install);
  install.updated_at = nowIso();
  writeJsonAtomic(file, install);
  return install;
}
export function disableWorkbench({ workspaceRoot, id }) {
  return updateInstall(workspaceRoot, id, (doc) => { doc.status = 'disabled'; });
}
export function enableWorkbench({ workspaceRoot, id }) {
  return updateInstall(workspaceRoot, id, (doc) => { doc.status = 'installed'; });
}
export function uninstallWorkbench({ workspaceRoot, id }) {
  const dir = installedDir(workspaceRoot, id);
  const install = readJson(path.join(dir, 'install.json'));
  if (!install) throw new Error(`未安装的工作台：${id}`);
  // 数据与审计保留：只移除入口与生成物
  fs.rmSync(dir, { recursive: true, force: true });
  try { forgetInstall(workspaceRoot, install.catalog_id || `pids:${id}`); } catch { /* 记录清理失败不阻塞卸载 */ }
  return { ok: true, id, removed: true, data_kept: true };
}

// —— 目录与样例（v2：workbenches[] + distribution.path 指向本地样例包）——
export function bundledCatalog({ bundleRoot }) {
  const catalogFile = path.join(bundleRoot, 'manifests', 'workbench-catalog.json');
  return readJson(catalogFile, { schemaVersion: 2, kind: 'catalog', categories: [], workbenches: [] });
}

export function workbenchCatalog({ bundleRoot, workspaceRoot }) {
  const catalog = bundledCatalog({ bundleRoot });
  return {
    schema: CATALOG_SCHEMA,
    generated_at: nowIso(),
    installed: listInstalled(workspaceRoot).map((item) => ({ ...item.install, dir: item.dir.replace(/\\/g, '/') })),
    samples: (catalog.workbenches || [])
      .filter((entry) => entry.distribution && entry.distribution.type === 'pids-runtime' && entry.distribution.path)
      .map((entry) => ({
        id: entry.id,
        dir: path.join(bundleRoot, entry.distribution.path).replace(/\\/g, '/'),
        label: entry.name,
        title: entry.name,
        description: entry.description && entry.description.zh,
        available: fs.existsSync(path.join(bundleRoot, entry.distribution.path)),
      })),
    remote: { enabled: false, note: '远程目录源见 workspace/config/market-sources.json（默认关闭）。' },
  };
}

export function installSample({ bundleRoot, workspaceRoot, sampleId }) {
  const samples = workbenchCatalog({ bundleRoot, workspaceRoot }).samples;
  const sample = samples.find((item) => item.id === sampleId || item.id === `pids:${sampleId}`);
  if (!sample) throw new Error(`目录中不存在样例：${sampleId}`);
  if (!sample.available) throw new Error(`样例资源缺失：${sample.dir}`);
  return importWorkbenchPackage({ bundleRoot, workspaceRoot, packageDir: sample.dir, origin: 'bundled-sample' });
}
