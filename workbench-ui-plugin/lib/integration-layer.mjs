// integration-layer.mjs — 集成层：域索引 / 升级与兼容 / 集成中心（三项目痕迹）
// 只读为主：所有数据来自 bundle 清单、证据目录与 vendor 技能，不写产品资产。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runtimeDomainModel, runtimeDomains } from './runtime-workbenches.mjs';

// 内置域配色（与壳内面板 DOMAIN_ORDER 同源；自定义域缺省用场景色或哈希色）
export const BUILTIN_COLORS = {
  strat: '#1458d4',
  'mkt-on': '#7c3aed',
  'mkt-off': '#b54708',
  sales: '#067647',
  fin: '#0e7490',
  rec: '#c11574',
  trn: '#175cd3',
  prf: '#6941c6',
  comp: '#c4320a',
  ben: '#027a48',
  admin: '#475467',
  cmp: '#344054',
  'er-eap': '#9e165f',
};

const PALETTE = ['#0f766e', '#7e22ce', '#b45309', '#1d4ed8', '#be123c', '#15803d', '#9a3412', '#4338ca'];

function colorFor(id) {
  if (BUILTIN_COLORS[id]) return BUILTIN_COLORS[id];
  const hash = crypto.createHash('sha1').update(String(id)).digest();
  return PALETTE[hash[0] % PALETTE.length];
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function sceneField(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return null;
  return match[1].split('#')[0].trim().replace(/^["']|["']$/g, '') || null;
}

function docDomainOf(prefix) {
  return prefix === 'er' || prefix === 'eap' ? 'er-eap' : prefix;
}

function listScenes(bundleRoot) {
  const dir = path.join(bundleRoot, 'manifests', 'scenes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.yaml')).map((name) => {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    return {
      file: name,
      prefix: name.split('.')[0],
      domain: sceneField(text, 'domain') || name.split('.')[0].toUpperCase(),
      label: sceneField(text, 'label'),
      color: sceneField(text, 'color'),
      origin: sceneField(text, 'origin') || 'builtin',
    };
  });
}

// —— 域索引：内置 13 域 + 自定义域（scenes 派生），供面板/独立应用动态渲染 ——
export function buildDomainsIndex({ bundleRoot, workspaceRoot = null }) {
  const modelsDir = path.join(bundleRoot, 'manifests', 'domain-model');
  const models = fs.existsSync(modelsDir)
    ? fs.readdirSync(modelsDir).filter((name) => name.endsWith('.json')).map((name) => readJson(path.join(modelsDir, name))).filter(Boolean)
    : [];
  const byId = new Map(models.map((model) => [model.domain, model]));
  const scenes = listScenes(bundleRoot);
  const sceneDomains = new Map();
  for (const scene of scenes) {
    const id = docDomainOf(scene.prefix);
    if (!sceneDomains.has(id)) sceneDomains.set(id, { label: scene.label, color: scene.color, origin: scene.origin, scenes: [] });
    sceneDomains.get(id).scenes.push(scene.file);
    if (scene.label) sceneDomains.get(id).label = scene.label;
    if (scene.color) sceneDomains.get(id).color = scene.color;
    if (scene.origin) sceneDomains.get(id).origin = scene.origin;
  }
  const ids = [...new Set([...byId.keys(), ...sceneDomains.keys()])];
  const domains = ids.sort().map((id) => {
    const model = byId.get(id) || null;
    const scene = sceneDomains.get(id) || {};
    const origin = (scene.origin && scene.origin !== 'builtin') ? scene.origin : (model?.origin || (BUILTIN_COLORS[id] ? 'builtin' : 'custom'));
    return {
      id,
      label: model?.label || scene.label || id.toUpperCase(),
      color: scene.color || model?.color || colorFor(id),
      origin,
      custom: origin === 'custom',
      in_baseline: !!BUILTIN_COLORS[id],
      scene_ids: model?.scene_ids || scene.scenes || [],
      level: model?.level || null,
      tables: model ? model.tables.length : 0,
      workflows: model ? model.workflows.length : 0,
      model_available: !!model,
      local: false,
    };
  });
  // 运行时装订：新增域追加、内置域修订标注 local（先叠加层、后内置）
  if (workspaceRoot) {
    for (const runtime of runtimeDomains(workspaceRoot)) {
      const runtimeModel = runtimeDomainModel(workspaceRoot, runtime.id);
      const existing = domains.find((item) => item.id === runtime.id);
      if (existing) {
        existing.local = true;
        existing.local_title = runtime.title;
        if (runtimeModel?.label) existing.label = runtimeModel.label;
        if (runtimeModel) {
          existing.tables = runtimeModel.tables.length;
          existing.workflows = runtimeModel.workflows.length;
        }
        continue;
      }
      domains.push({
        id: runtime.id,
        label: runtimeModel?.label || runtime.label,
        color: runtime.color,
        origin: 'installed',
        custom: true,
        in_baseline: false,
        local: true,
        local_title: runtime.title,
        scene_ids: runtimeModel?.scene_ids || [],
        level: runtimeModel?.level || null,
        tables: runtimeModel ? runtimeModel.tables.length : 0,
        workflows: runtimeModel ? runtimeModel.workflows.length : 0,
        model_available: !!runtimeModel,
      });
    }
  }
  return {
    schema: 'pids-nexus/domains-index/v1',
    generated_at: new Date().toISOString(),
    counts: {
      builtin: domains.filter((item) => !item.custom).length,
      custom: domains.filter((item) => item.custom).length,
      local: domains.filter((item) => item.local).length,
      total: domains.length,
    },
    domains,
  };
}

// —— 升级与兼容（只读）——
export function buildUpgradeStatus({ bundleRoot }) {
  const runtimeManifest = readJson(path.join(bundleRoot, 'manifests', 'runtime-web.package.json'), {});
  const compatibility = readJson(path.join(bundleRoot, 'templates', 'runtime', 'compatibility.json'), {});
  const enginesDir = path.join(bundleRoot, 'offline', 'engines');
  const engines = fs.existsSync(enginesDir)
    ? fs.readdirSync(enginesDir).filter((name) => /\.(tgz|tar\.gz)$/i.test(name)).map((name) => ({
      file: name,
      bytes: fs.statSync(path.join(enginesDir, name)).size,
    }))
    : [];
  const shaFile = path.join(enginesDir, 'SHA256SUMS.txt');
  const engineHashes = fs.existsSync(shaFile) ? fs.readFileSync(shaFile, 'utf8').split(/\r?\n/).filter(Boolean).slice(0, 12) : [];

  const evidenceDir = path.join(bundleRoot, 'reports', 'upgrade-0.2.0-rc.2');
  const evidence = fs.existsSync(evidenceDir)
    ? fs.readdirSync(evidenceDir).map((name) => ({ file: name, bytes: fs.statSync(path.join(evidenceDir, name)).size })).sort((a, b) => b.bytes - a.bytes).slice(0, 24)
    : [];
  const adrs = [
    'docs/adr/ADR-0017-dsh-0.2.0-rc.2-engine-upgrade.md',
    'docs/retro/adr/ADR-0015-dsh-0.2.0-rc.2-引擎升级.md',
  ].filter((rel) => fs.existsSync(path.join(bundleRoot, rel)));

  const vendorRoot = path.join(bundleRoot, 'tools', 'dsh-upgrade-skill');
  const referencesDir = path.join(vendorRoot, 'skills', 'plugin-upgrade', 'references');
  const corridor = [];
  if (fs.existsSync(referencesDir)) {
    for (const name of fs.readdirSync(referencesDir).filter((item) => item.endsWith('.md')).sort()) {
      const text = fs.readFileSync(path.join(referencesDir, name), 'utf8');
      if (!/^kind:\s*dsh-version-card-set/m.test(text)) continue;
      corridor.push({
        file: name,
        from: sceneField(text, 'from'),
        to: sceneField(text, 'to'),
        status: sceneField(text, 'status'),
        coverage: sceneField(text, 'coverage'),
        cardCount: Number(sceneField(text, 'cardCount') || 0),
        verifiedAt: sceneField(text, 'verifiedAt'),
      });
    }
  }
  const skillsDir = path.join(vendorRoot, 'skills');
  const skills = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    : [];
  const provenance = fs.existsSync(path.join(vendorRoot, 'PROVENANCE.md'))
    ? fs.readFileSync(path.join(vendorRoot, 'PROVENANCE.md'), 'utf8').split(/\r?\n/).slice(0, 12).join('\n')
    : '';

  const toolsVersions = path.join(bundleRoot, 'tools-versions.txt');
  return {
    schema: 'pids-nexus/upgrade-status/v1',
    generated_at: new Date().toISOString(),
    engine: {
      dsh: runtimeManifest.dependencies?.['@deepseek-ai/dsh'] || null,
      dependency_count: Object.keys(runtimeManifest.dependencies || {}).length,
      overrides: runtimeManifest.overrides || runtimeManifest.pnpm?.overrides || null,
      tarballs: engines,
      hashes: engineHashes,
    },
    compatibility: {
      exempt_packages: Object.keys(compatibility || {}).length,
      sample: Object.keys(compatibility || {}).slice(0, 8),
    },
    evidence: { files: evidence, adrs },
    corridor: { skills, references: corridor },
    tools_versions: fs.existsSync(toolsVersions) ? fs.readFileSync(toolsVersions, 'utf8') : '(missing)',
    provenance,
    actions: {
      rollback_dryrun: 'POST /workbench/api/rollback-dryrun',
      tools_versions: 'GET /workbench/api/tools-versions',
    },
    note: '只读中心：不提供在线升级执行；升级必须按 vendor 技能的宿主升级纪律在外部终端按精确版本进行。',
  };
}

// —— 集成中心（三项目采纳痕迹）——
export function buildIntegrationStatus({ bundleRoot }) {
  const file = path.join(bundleRoot, 'manifests', 'integration-status.json');
  const doc = readJson(file, null);
  const live = {
    upgrade_skill_vendored: fs.existsSync(path.join(bundleRoot, 'tools', 'dsh-upgrade-skill', 'skills')),
    upgrade_center_route: true,
    custom_workbench_route: true,
    custom_workbench_standard: fs.existsSync(path.join(bundleRoot, 'docs', 'custom-workbench-standard.zh.md')),
    integration_manifest: !!doc,
  };
  return {
    schema: 'pids-nexus/integration-status/v1',
    generated_at: new Date().toISOString(),
    ...(doc || { projects: [], note: 'manifests/integration-status.json 缺失' }),
    live,
  };
}

export function readDevelopmentGuide({ bundleRoot }) {
  const file = path.join(bundleRoot, 'docs', 'custom-workbench-standard.zh.md');
  if (!fs.existsSync(file)) return '(missing docs/custom-workbench-standard.zh.md)';
  return fs.readFileSync(file, 'utf8');
}
