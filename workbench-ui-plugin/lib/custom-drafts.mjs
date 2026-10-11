// custom-drafts.mjs — 自定义工作台草稿管线（草稿 → 校验 → 预览 → 合入包导出）
//
// 设计纪律（ADR-0018）：
//   ① 草稿只落用户数据根 workspace/custom/**，绝不直接改写产品资产（{app} 或源树）；
//   ② 校验在 staging 副本上跑既有生成/门禁脚本，证据机器可读；
//   ③ 预览是 staging 里重建的 app.html，不代表已生效；
//   ④ 正式生效 = 导出合入包 → 开发源树 apply-draft → 全套门禁 → 重打包。
//
// 两级校验模型（如实分级，不静默放行）：
//   - 域级校验（domain_checks，必须全绿）：gen-domain-model 硬校验 + build-app 预览构建；
//   - 基线门禁（baseline_gates）：design:verify / workflow-contracts / workflow-delivery。
//     其中 design:verify 为 13 域 / 39 模块 / 78 工作流闭集断言：
//       · 修订（revise）：基线门禁必须全绿，否则草稿不通过；
//       · 新增域（new-domain）：闭集门禁必然失败，失败摘要登记为「基线扩展缺口清单」，
//         合入包必须携带该缺口清单，正式固化前先扩展基线门禁（见 consolidation/README.md）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';

export const DRAFT_SCHEMA = 'pids-nexus/custom-draft/v1';
export const VERIFY_SCHEMA = 'pids-nexus/custom-draft-verify/v1';
export const CONSOLIDATION_SCHEMA = 'pids-nexus/custom-draft-consolidation/v1';
export const DRAFT_STATUS = ['draft', 'verified', 'preview-ready', 'exported', 'consolidated'];

// 资产契约白名单（相对产品根的路径前缀，与既有管线同源，不新增第二套真相）
export const OVERLAY_PREFIXES = [
  'manifests/scenes/',
  'manifests/workflows/',
  'templates/workspace/data/',
  'templates/Type-Dict/',
  'templates/skills-domain/',
  'docs/preset-design/',
  'docs/domain-work-design/',
];

// 工作流条目注入文件约定：manifests/workflows/<域>.workflows.json（index.json 同形数组）
const WORKFLOW_FRAGMENT_RE = /^manifests\/workflows\/([A-Za-z0-9-]+)\.workflows\.json$/;

// 顺序：gen-workflows → 注入 <域>.workflows.json → gen-domain-model → build-app
const DOMAIN_STEPS = [
  ['gen-workflows', 'scripts/gen-workflows.mjs'],
];
const POST_INJECT_STEPS = [
  ['gen-domain-model', 'scripts/gen-domain-model.mjs'],
];
const PREVIEW_STEP = ['build-app', 'scripts/build-app.mjs'];
// 快检基线（秒级，同步跑）与重检基线（分钟级，后台跑）
const FAST_BASELINE_STEPS = [
  ['build-domain-work-design', 'scripts/build-domain-work-design.mjs', []],
  ['design-verify', 'scripts/verify-domain-work-design.mjs', []],
];
const HEAVY_BASELINE_STEPS = [
  ['workflow-contracts', 'scripts/verify-workflow-contracts-v2.mjs', []],
  ['workflow-delivery', 'scripts/verify-workflow-delivery-matrix.mjs', ['adm-zip', 'exceljs']],
];

const STAGING_SOURCES = ['manifests', 'templates', 'docs', 'src', 'scripts', 'workbench-ui-plugin', 'assets'];
const STAGING_SKIP = new Set(['node_modules', '.git', '.work', '.mimosa']);
const STEP_TIMEOUT_MS = 300000;
const HEAVY_STEP_TIMEOUT_MS = 1800000;

export function customRoot(workspaceRoot) {
  return path.join(workspaceRoot, 'custom');
}
export function draftsRoot(workspaceRoot) {
  return path.join(customRoot(workspaceRoot), 'drafts');
}
export function stagingPath(workspaceRoot, draftId) {
  return path.join(customRoot(workspaceRoot), '.staging', draftId);
}
export function draftPath(workspaceRoot, draftId) {
  return path.join(draftsRoot(workspaceRoot), draftId);
}
export function evidencePath(bundleRoot, draftId) {
  return path.join(bundleRoot, 'reports', 'custom', draftId, 'verify.json');
}

export function safeDraftId(value) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(text)) throw new Error('draft id 需 3-64 位字母数字.-_');
  return text;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function nowIso() {
  return new Date().toISOString();
}
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
function copyTree(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (STAGING_SKIP.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}
function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else if (entry.isFile()) out.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return out;
}
function normalizeRel(rel) {
  const text = String(rel || '').replace(/\\/g, '/');
  if (!text || text.startsWith('/') || text.includes('..') || /^[A-Za-z]:/.test(text)) {
    throw new Error(`草稿资产路径非法：${rel}`);
  }
  if (!OVERLAY_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    throw new Error(`草稿资产不在契约白名单内：${rel}`);
  }
  return text;
}
function tail(text, limit) {
  const value = String(text || '');
  return value.length > limit ? value.slice(-limit) : value;
}

// —— 草稿记录 ——
export function loadDraft(workspaceRoot, draftId) {
  const dir = draftPath(workspaceRoot, safeDraftId(draftId));
  const file = path.join(dir, 'draft.json');
  const draft = readJson(file);
  if (!draft) throw new Error(`草稿不存在：${draftId}`);
  return { dir, file, draft };
}

export function listDrafts(workspaceRoot) {
  const root = draftsRoot(workspaceRoot);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((name) => fs.existsSync(path.join(root, name, 'draft.json')))
    .map((name) => readJson(path.join(root, name, 'draft.json')))
    .filter(Boolean)
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

export function isConsolidated(bundleRoot, draft) {
  const manifest = draft.assetManifest || [];
  if (!manifest.length) return false;
  for (const asset of manifest) {
    const target = path.join(bundleRoot, asset.path);
    if (!fs.existsSync(target)) return false;
    if (sha256File(target) !== asset.sha256) return false;
  }
  return true;
}

export function summarizeDraft(workspaceRoot, bundleRoot, draft) {
  const dir = draftPath(workspaceRoot, draft.id);
  const verify = readJson(path.join(dir, 'verify.json'));
  let verifyRunning = fs.existsSync(path.join(dir, 'verify.running.json'));
  if (verifyRunning && !isRunningMarkerAlive(readJson(path.join(dir, 'verify.running.json')))) {
    try { fs.rmSync(path.join(dir, 'verify.running.json'), { force: true }); } catch { /* 忽略清理失败 */ }
    verifyRunning = false;
  }
  const summary = {
    ...draft,
    dir: dir.replace(/\\/g, '/'),
    overlay_count: (draft.assetManifest || []).length,
    preview_available: fs.existsSync(path.join(dir, 'preview', 'app.html')),
    consolidation_available: fs.existsSync(path.join(dir, 'consolidation', 'manifest.json')),
    verify_running: verifyRunning,
    verify: verify ? {
      ok: verify.ok,
      generated_at: verify.generated_at,
      gaps: verify.gaps || [],
      baseline_status: verify.baseline_gates?.status || 'not-run',
      heavy_status: verify.heavy_gates?.status || 'not-run',
      baseline_pending: !!verify.baseline_pending,
    } : null,
  };
  if (draft.status === 'exported' || draft.status === 'consolidated') {
    summary.consolidated = isConsolidated(bundleRoot, draft);
    if (summary.consolidated && draft.status !== 'consolidated') summary.status = 'consolidated';
  }
  return summary;
}

// —— 指令（本地化自 dataelement“制作我的工作台”，术语替换为 PiDSH 工作域资产契约）——
export function buildInstruction(draft, dir, guidePath) {
  const draftDir = String(dir).replace(/\\/g, '/');
  const guide = String(guidePath).replace(/\\/g, '/');
  const kindText = draft.kind === 'new-domain' ? '新建一个自定义工作域' : `修订现有工作域 ${draft.targetDomain}`;
  return [
    `我想在 PiDSH Nexus 里${kindText}，草稿编号 ${draft.id}。这条通用指令不含业务需求本身，不能据此直接决定做什么。`,
    '',
    `先读离线规范：${guide}（也可用 GET /workbench/api/custom/development-guide 获取）。`,
    '然后检查我在当前对话里明确说过的业务场景、目标用户和一次任务的核心流程；可以只读检查项目目录与既有资产，但不能把目录名、示例或现有代码当成我已确认的意图。',
    '任一项不明确时，只问我一个合并问题：“这个工作域要服务谁、解决什么业务场景？用户从进入到完成任务的核心步骤是什么？”等我回答；答复前不要创建或修改任何资产。',
    '',
    `需求明确后，只在本草稿的 overlay 目录内新增/修改资产：${draftDir}/overlay`,
    '资产契约（相对 bundle 根镜像，白名单）：',
    '  1. manifests/scenes/<域前缀>.<主场景>.yaml —— 域/技能/策略/GT；新增域需带 label/color/origin: custom',
    '  2. manifests/workflows/<域>.workflows.json —— 工作流条目（index.json 同形数组；内置域的逐条 yaml 由生成器管理，禁止直接改）',
    '  3. templates/workspace/data/<域>/*.csv —— 台账表，表头必须与场景声明逐字一致',
    '  4. templates/Type-Dict/field-type-dict.csv —— 新字段必须补行（design:verify 会核对行数）',
    '  5. templates/skills-domain/<域>/SKILL-*.md —— 技能文件，每个技能至少被一条工作流引用',
    '  6. docs/preset-design/<域>.md —— §4 状态机 / §5 审批链 / §9 校验规则（gen-domain-model 的输入）',
    '  docs/domain-work-design/<域>.md 是生成物，禁止直接改',
    '',
    '完成后自测（必须真实运行，失败就修 overlay 再跑，不得跳过）：',
    `  node scripts/custom/verify-draft.mjs --draft "${draftDir}"`,
    '校验通过（verify.json ok=true）才可汇报完成；不得声称已生效——正式生效要过全套门禁并重打包。',
    '最后如实报告：改了哪些文件、校验结果、预览状态、未完成项。',
  ].join('\n');
}

export function draftInstruction({ bundleRoot, workspaceRoot, draftId }) {
  const { dir, draft } = loadDraft(workspaceRoot, draftId);
  const guide = path.join(bundleRoot, 'docs', 'custom-workbench-standard.zh.md');
  return { draft_id: draft.id, instruction: buildInstruction(draft, dir, guide) };
}

// —— 创建草稿 ——
export function createDraft({ workspaceRoot, bundleRoot, kind, targetDomain, newDomain, title, requirements }) {
  const id = deriveDraftId(kind, targetDomain || newDomain);
  const dir = draftPath(workspaceRoot, id);
  if (fs.existsSync(path.join(dir, 'draft.json'))) throw new Error(`草稿已存在：${id}`);
  if (kind === 'revise' && !String(targetDomain || '').trim()) throw new Error('revise 草稿必须给 targetDomain');
  if (kind === 'new-domain' && !/^[a-z][a-z0-9-]{1,23}$/.test(String(newDomain || ''))) {
    throw new Error('new-domain 的域 id 需 2-24 位小写字母/数字/连字符');
  }
  fs.mkdirSync(path.join(dir, 'overlay'), { recursive: true });
  const draft = {
    schema: DRAFT_SCHEMA,
    id,
    kind,
    targetDomain: kind === 'revise' ? String(targetDomain).trim() : null,
    newDomain: kind === 'new-domain' ? String(newDomain).trim() : null,
    title: String(title || '').trim() || (kind === 'revise' ? `修订 ${targetDomain}` : `新建 ${newDomain}`),
    requirements: String(requirements || '').trim(),
    created_at: nowIso(),
    updated_at: nowIso(),
    status: 'draft',
    assetManifest: [],
    evidence: { verify: null, preview: null, consolidation: null },
    history: [{ ts: nowIso(), action: 'draft.create', note: `kind=${kind}` }],
  };
  writeJsonAtomic(path.join(dir, 'draft.json'), draft);
  return summarizeDraft(workspaceRoot, bundleRoot, draft);
}

function deriveDraftId(kind, subject) {
  const slug = String(subject || 'draft').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'draft';
  const stamp = nowIso().replace(/[-:TZ.]/g, '').slice(2, 14);
  return `${kind === 'new-domain' ? 'new' : 'rev'}-${slug}-${stamp}`.slice(0, 64);
}

function updateDraft(dir, mutate) {
  const file = path.join(dir, 'draft.json');
  const draft = readJson(file);
  if (!draft) throw new Error(`草稿记录缺失：${file}`);
  mutate(draft);
  draft.updated_at = nowIso();
  writeJsonAtomic(file, draft);
  return draft;
}

function recordHistory(draft, action, note) {
  draft.history = Array.isArray(draft.history) ? draft.history : [];
  draft.history.push({ ts: nowIso(), action, note: String(note || '') });
  if (draft.history.length > 60) draft.history = draft.history.slice(-60);
}

export function refreshAssetManifest(dir) {
  const overlay = path.join(dir, 'overlay');
  return walk(overlay).map((rel) => {
    const file = path.join(overlay, rel);
    return { path: normalizeRel(rel), sha256: sha256File(file), bytes: fs.statSync(file).size };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

// —— 预检：白名单 + 生成器所有权守卫 ——
export function draftPreflight(dir) {
  const gaps = [];
  const files = walk(path.join(dir, 'overlay'));
  const assets = [];
  for (const rel of files) {
    let normalized;
    try {
      normalized = normalizeRel(rel);
    } catch (error) {
      gaps.push(String(error.message || error));
      continue;
    }
    assets.push(normalized);
    if (/^manifests\/workflows\/.*\.ya?ml$/i.test(normalized)) {
      gaps.push(`manifests/workflows/ 下的逐条 yaml 由生成器管理，禁止直接改写：${normalized}（请改用 <域>.workflows.json 条目或修订场景/技能/台账）`);
    }
    if (normalized.startsWith('docs/domain-work-design/')) {
      gaps.push(`docs/domain-work-design/ 由 build-domain-work-design 生成，禁止直接改写：${normalized}（工作设计请通过场景/技能/台账/§9 校验规则间接修订）`);
    }
  }
  return { assets, gaps };
}

// —— 工作流条目注入（custom 与授权新增）——
export function injectWorkflowFragments(staging) {
  const dir = path.join(staging, 'manifests', 'workflows');
  const indexFile = path.join(dir, 'index.json');
  const index = readJson(indexFile);
  if (!index) return { injected: 0, errors: ['manifests/workflows/index.json 缺失'] };
  const errors = [];
  let injected = 0;
  for (const name of fs.readdirSync(dir)) {
    const match = name.match(/^([A-Za-z0-9-]+)\.workflows\.json$/);
    if (!match) continue;
    const domain = match[1];
    const entries = readJson(path.join(dir, name));
    if (!Array.isArray(entries)) {
      errors.push(`${name}: 必须是 JSON 数组`);
      continue;
    }
    for (const entry of entries) {
      const problem = validateWorkflowEntry(domain, entry);
      if (problem) {
        errors.push(`${name}: ${problem}`);
        continue;
      }
      index.workflows = index.workflows.filter((item) => item.workflow_id !== entry.workflow_id);
      index.workflows.push(entry);
      injected += 1;
    }
  }
  if (injected) {
    index.by_domain = {};
    for (const item of index.workflows) {
      index.by_domain[item.domain] = index.by_domain[item.domain] || [];
      index.by_domain[item.domain].push(item.workflow_id);
    }
    index.count = index.workflows.length;
    writeJsonAtomic(indexFile, index);
  }
  return { injected, errors };
}

function validateWorkflowEntry(domain, entry) {
  if (!entry || typeof entry !== 'object') return '条目必须是对象';
  if (typeof entry.workflow_id !== 'string' || !entry.workflow_id.includes('@')) return 'workflow_id 缺失或格式非法（需 name@x.y.z）';
  if (entry.domain !== domain) return `domain 必须为 ${domain}`;
  for (const key of ['kind', 'description', 'skill']) {
    if (typeof entry[key] !== 'string' || !entry[key].trim()) return `${key} 缺失`;
  }
  if (!Array.isArray(entry.nodes) || !entry.nodes.length) return 'nodes 缺失';
  if (!entry.deliverable || typeof entry.deliverable.file !== 'string' || !Array.isArray(entry.deliverable.fields)) return 'deliverable 缺失（需 file/format/fields/acceptance）';
  return null;
}

// —— staging 物化（供草稿与运行时装订共用）——
export function stageOverlay({ bundleRoot, workspaceRoot, overlayDir, id }) {
  const staging = stagingPath(workspaceRoot, id);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  fs.mkdirSync(path.join(staging, 'preview'), { recursive: true });
  for (const name of STAGING_SOURCES) copyTree(path.join(bundleRoot, name), path.join(staging, name));
  // 依赖解析：staging 在安装态位于数据根之外，需要显式链接开发树 node_modules（仅校验用）
  let nodeModules = 'missing';
  const bundleNodeModules = path.join(bundleRoot, 'node_modules');
  if (fs.existsSync(bundleNodeModules)) {
    try {
      fs.symlinkSync(bundleNodeModules, path.join(staging, 'node_modules'), 'junction');
      nodeModules = 'junction';
    } catch {
      nodeModules = 'missing';
    }
  }
  const overlay = overlayDir || path.join(draftPath(workspaceRoot, id), 'overlay');
  let applied = 0;
  for (const rel of walk(overlay)) {
    const target = path.join(staging, normalizeRel(rel));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(overlay, rel), target);
    applied += 1;
  }
  return { staging, applied, nodeModules };
}

export function runStagedScript(staging, script, args = [], timeoutMs = STEP_TIMEOUT_MS) {
  return runStep(staging, script, args, timeoutMs);
}

function materializeStaging({ bundleRoot, workspaceRoot, draft }) {
  return stageOverlay({ bundleRoot, workspaceRoot, overlayDir: path.join(draftPath(workspaceRoot, draft.id), 'overlay'), id: draft.id });
}

function missingDependencies(bundleRoot, requires) {
  return (requires || []).filter((name) => !fs.existsSync(path.join(bundleRoot, 'node_modules', name)));
}

function runStep(cwd, script, extraArgs = [], timeoutMs = STEP_TIMEOUT_MS) {
  const started = Date.now();
  try {
    const stdout = execFileSync(process.execPath, [script, ...extraArgs], {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { script, exit: 0, ms: Date.now() - started, stdout_tail: tail(stdout, 1600), stderr_tail: '' };
  } catch (error) {
    return {
      script,
      exit: typeof error.status === 'number' ? error.status : 1,
      ms: Date.now() - started,
      stdout_tail: tail(error.stdout || '', 1600),
      stderr_tail: tail(error.stderr || String(error.message || error), 1600),
    };
  }
}

function extractGaps(steps) {
  const gaps = [];
  for (const step of steps) {
    if (step.exit === 0) continue;
    const text = `${step.stdout_tail}\n${step.stderr_tail}`;
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/✗|BUILD_ABORT|BUILD_GATE_FAIL|Error:|错误|失败|FAIL\b|未映射|缺少/i.test(trimmed) && !/violations=0/.test(trimmed)) {
        gaps.push(`${step.script}: ${trimmed.slice(0, 240)}`);
      }
    }
    if (!gaps.length) gaps.push(`${step.script}: exit=${step.exit}（详见 verify.json 步骤输出）`);
  }
  return gaps.slice(0, 40);
}

// —— 校验：域级（必须）+ 基线（修订必须 / 新增域登记缺口）——
export function verifyDraft({ bundleRoot, workspaceRoot, draftId, full = false }) {
  const { dir, draft } = loadDraft(workspaceRoot, draftId);
  const runningMarker = path.join(dir, 'verify.running.json');
  if (full) writeJsonAtomic(runningMarker, { pid: process.pid, started_at: nowIso(), stage: 'running' });
  try {
    return runVerifyPipeline({ bundleRoot, workspaceRoot, draftId, full, dir, draft });
  } finally {
    if (full) { try { fs.rmSync(runningMarker, { force: true }); } catch { /* 标记清理失败不影响结果 */ } }
  }
}

function runVerifyPipeline({ bundleRoot, workspaceRoot, draftId, full, dir, draft }) {
  const preflight = draftPreflight(dir);
  const { staging, applied } = materializeStaging({ bundleRoot, workspaceRoot, draft });

  const domainSteps = [];
  for (const [id, script] of DOMAIN_STEPS) domainSteps.push({ id, ...runStep(staging, script) });
  const inject = injectWorkflowFragments(staging);
  if (inject.injected) domainSteps.push({ id: 'workflow-fragments', exit: 0, ms: 0, stdout_tail: `injected=${inject.injected}`, stderr_tail: '' });
  // 注入后再生成域模型，使其看到注入的工作流条目
  for (const [id, script] of POST_INJECT_STEPS) {
    if (!domainSteps.every((step) => step.exit === 0)) {
      domainSteps.push({ id, script, exit: null, ms: 0, skipped: true, stdout_tail: '', stderr_tail: '' });
      continue;
    }
    domainSteps.push({ id, ...runStep(staging, script) });
  }
  const previewBuild = { id: PREVIEW_STEP[0], ...runStep(staging, PREVIEW_STEP[1], ['--out', 'preview/app.html', '--preview', draft.id]) };
  domainSteps.push(previewBuild);

  const domainRan = domainSteps.filter((step) => step.exit !== null);
  const domainOk = domainRan.length === domainSteps.length
    && domainRan.every((step) => step.exit === 0)
    && preflight.gaps.length === 0
    && inject.errors.length === 0;

  const runGroup = (group, timeoutMs) => {
    const steps = [];
    for (const [index, [id, script, requires]] of group.entries()) {
      const missing = missingDependencies(bundleRoot, requires);
      if (missing.length) {
        steps.push({ id, script, exit: null, ms: 0, env_skipped: true, note: `依赖不可用：${missing.join('、')}（安装态无开发依赖）`, stdout_tail: '', stderr_tail: '' });
        for (const [restId, restScript] of group.slice(index + 1)) {
          steps.push({ id: restId, script: restScript, exit: null, ms: 0, skipped: true, stdout_tail: '', stderr_tail: '' });
        }
        break;
      }
      const step = { id, ...runStep(staging, script, [], timeoutMs) };
      steps.push(step);
      if (step.exit !== 0) {
        for (const [restId, restScript] of group.slice(index + 1)) {
          steps.push({ id: restId, script: restScript, exit: null, ms: 0, skipped: true, stdout_tail: '', stderr_tail: '' });
        }
        break;
      }
    }
    return steps;
  };

  const fastSteps = [];
  const envSkips = [];
  if (domainOk) {
    fastSteps.push(...runGroup(FAST_BASELINE_STEPS, STEP_TIMEOUT_MS));
  }
  for (const step of fastSteps) if (step.env_skipped) envSkips.push(`${step.id}: ${step.note}`);

  const heavySteps = [];
  if (full && domainOk && fastSteps.every((step) => step.exit === 0 || step.exit === null)) {
    heavySteps.push(...runGroup(HEAVY_BASELINE_STEPS, HEAVY_STEP_TIMEOUT_MS));
    for (const step of heavySteps) if (step.env_skipped) envSkips.push(`${step.id}: ${step.note}`);
  }
  const heavyAttempted = heavySteps.length > 0;
  const heavyRan = heavySteps.filter((step) => step.exit !== null);
  const heavyFail = heavyRan.some((step) => step.exit !== 0);
  const heavyStatus = !heavyAttempted ? 'not-run' : heavyFail ? 'fail' : envSkips.length && heavySteps.some((step) => step.env_skipped) ? 'partial' : 'pass';

  const baselineAttempted = fastSteps.length > 0;
  const baselineRan = fastSteps.filter((step) => step.exit !== null);
  const baselineFail = baselineRan.some((step) => step.exit !== 0);
  const baselinePending = draft.kind === 'new-domain' && baselineAttempted && baselineFail;
  const ok = domainOk && (draft.kind === 'new-domain' ? true : !baselineFail);

  const gaps = [
    ...preflight.gaps,
    ...inject.errors.map((item) => `工作流条目注入：${item}`),
    ...envSkips,
    ...extractGaps([...domainSteps, ...fastSteps, ...heavySteps].filter((step) => step.exit !== 0 && step.exit !== null)),
  ];

  const report = {
    schema: VERIFY_SCHEMA,
    draft_id: draft.id,
    kind: draft.kind,
    target: draft.kind === 'new-domain' ? draft.newDomain : draft.targetDomain,
    generated_at: nowIso(),
    ok,
    overlay_files: applied,
    staging: staging.replace(/\\/g, '/'),
    domain_checks: {
      ok: domainOk,
      steps: domainSteps.map((step) => ({ id: step.id, script: step.script, exit: step.exit, ms: step.ms, stdout_tail: step.stdout_tail, stderr_tail: step.stderr_tail })),
    },
    baseline_gates: {
      attempted: baselineAttempted,
      status: !baselineAttempted ? 'skipped' : baselineFail ? 'fail' : envSkips.length ? 'partial' : 'pass',
      steps: fastSteps.map((step) => ({ id: step.id, script: step.script, exit: step.exit, ms: step.ms, skipped: !!step.skipped, env_skipped: !!step.env_skipped, note: step.note || '', stdout_tail: step.stdout_tail, stderr_tail: step.stderr_tail })),
    },
    heavy_gates: {
      attempted: heavyAttempted,
      status: heavyStatus,
      steps: heavySteps.map((step) => ({ id: step.id, script: step.script, exit: step.exit, ms: step.ms, skipped: !!step.skipped, env_skipped: !!step.env_skipped, note: step.note || '', stdout_tail: step.stdout_tail, stderr_tail: step.stderr_tail })),
    },
    baseline_pending: baselinePending,
    full,
    gaps,
  };
  const assetManifest = refreshAssetManifest(dir);
  const evidenceFile = evidencePath(bundleRoot, draft.id);
  writeJsonAtomic(evidenceFile, report);
  writeJsonAtomic(path.join(dir, 'verify.json'), report);
  const updated = updateDraft(dir, (doc) => {
    doc.assetManifest = assetManifest;
    doc.status = ok ? (fs.existsSync(path.join(dir, 'preview', 'app.html')) ? 'preview-ready' : 'verified') : 'draft';
    doc.evidence = { ...(doc.evidence || {}), verify: path.relative(bundleRoot, evidenceFile).replace(/\\/g, '/') };
    recordHistory(doc, 'draft.verify', `ok=${ok} domain=${domainOk} baseline=${report.baseline_gates.status} gaps=${gaps.length}`);
  });
  return { ...report, status: updated.status, assetManifest };
}

// —— 预览：staging 重建 app.html（带“草稿预览”横幅）——
export function buildPreview({ bundleRoot, workspaceRoot, draftId }) {
  const { dir, draft } = loadDraft(workspaceRoot, draftId);
  const preflight = draftPreflight(dir);
  if (preflight.gaps.length) {
    return { ok: false, stage: 'preflight', gaps: preflight.gaps, status: draft.status };
  }
  const { staging, applied } = materializeStaging({ bundleRoot, workspaceRoot, draft });
  const steps = [];
  for (const [id, script] of DOMAIN_STEPS) steps.push({ id, ...runStep(staging, script) });
  const inject = injectWorkflowFragments(staging);
  if (inject.errors.length) {
    return { ok: false, stage: 'inject', gaps: inject.errors, status: draft.status };
  }
  if (inject.injected) steps.push({ id: 'workflow-fragments', exit: 0, ms: 0, stdout_tail: `injected=${inject.injected}`, stderr_tail: '' });
  if (!steps.every((step) => step.exit === 0)) {
    return { ok: false, stage: 'materialize', steps: steps.map(slimStep), gaps: extractGaps(steps), status: draft.status };
  }
  for (const [id, script] of POST_INJECT_STEPS) steps.push({ id, ...runStep(staging, script) });
  if (!steps.every((step) => step.exit === 0)) {
    return { ok: false, stage: 'materialize', steps: steps.map(slimStep), gaps: extractGaps(steps), status: draft.status };
  }
  const build = { id: PREVIEW_STEP[0], ...runStep(staging, PREVIEW_STEP[1], ['--out', 'preview/app.html', '--preview', draft.id]) };
  steps.push(build);
  if (build.exit !== 0) {
    return { ok: false, stage: 'build', steps: steps.map(slimStep), gaps: extractGaps([build]), status: draft.status };
  }
  const target = path.join(dir, 'preview', 'app.html');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(staging, 'preview', 'app.html'), target);
  const updated = updateDraft(dir, (doc) => {
    if (doc.status === 'draft' || doc.status === 'verified') doc.status = 'preview-ready';
    doc.evidence = { ...(doc.evidence || {}), preview: 'preview/app.html' };
    recordHistory(doc, 'draft.preview', `bytes=${fs.statSync(target).size} injected=${inject.injected}`);
  });
  return {
    ok: true,
    stage: 'built',
    bytes: fs.statSync(target).size,
    overlay_files: applied,
    injected_workflows: inject.injected,
    status: updated.status,
    url: `/workbench/api/app-page?draft=${encodeURIComponent(draft.id)}`,
    steps: steps.map(slimStep),
  };
}

function slimStep(step) {
  return { id: step.id, exit: step.exit, ms: step.ms };
}

// —— 合入包导出 ——
export function consolidateDraft({ bundleRoot, workspaceRoot, draftId }) {
  const { dir, draft } = loadDraft(workspaceRoot, draftId);
  const verify = readJson(path.join(dir, 'verify.json'));
  if (!verify || !verify.ok) return { ok: false, error: '草稿尚未通过校验：请先运行 verify-draft' };
  const heavy = verify.heavy_gates?.status || 'not-run';
  if (draft.kind !== 'new-domain' && heavy !== 'pass') {
    return { ok: false, error: `修订草稿的完整基线门禁未通过（heavy=${heavy}）：先运行「完整门禁（后台）」再导出合入包` };
  }
  const assets = refreshAssetManifest(dir);
  if (!assets.length) return { ok: false, error: '草稿 overlay 为空：没有可合入的资产' };
  const verifyHashes = new Map((verify.assetManifest || []).map((item) => [item.path, item.sha256]));
  const stale = assets.filter((item) => verifyHashes.get(item.path) !== item.sha256);
  if (verifyHashes.size && stale.length) {
    return { ok: false, error: `草稿在校验后又发生变化（${stale.length} 个文件）：请重新运行 verify-draft` };
  }
  const consolidation = path.join(dir, 'consolidation');
  fs.rmSync(consolidation, { recursive: true, force: true });
  fs.mkdirSync(consolidation, { recursive: true });
  const changes = assets.map((asset) => {
    const bundleFile = path.join(bundleRoot, asset.path);
    const exists = fs.existsSync(bundleFile);
    const same = exists && sha256File(bundleFile) === asset.sha256;
    return { path: asset.path, sha256: asset.sha256, bytes: asset.bytes, change: !exists ? 'new' : same ? 'unchanged' : 'modified' };
  });
  copyTree(path.join(dir, 'overlay'), path.join(consolidation, 'overlay'));
  fs.copyFileSync(path.join(dir, 'verify.json'), path.join(consolidation, 'verify.json'));
  const baseline = verify.baseline_gates || { status: 'not-run' };
  const manifest = {
    schema: CONSOLIDATION_SCHEMA,
    draft_id: draft.id,
    kind: draft.kind,
    target: draft.kind === 'new-domain' ? draft.newDomain : draft.targetDomain,
    title: draft.title,
    requirements: draft.requirements,
    generated_at: nowIso(),
    overlay_files: changes.length,
    changes,
    verify: 'verify.json',
    baseline_gates: { status: baseline.status, baseline_pending: !!verify.baseline_pending, gaps: verify.gaps || [] },
    heavy_gates: { status: heavy },
    apply: `node scripts/custom/apply-draft.mjs --draft "<此目录>" --root "<PiDSH 源树>" --yes`,
    next_gates: ['npm run design:verify', 'npm run verify:workflow-contracts', 'npm run verify:workflow-delivery', 'npm run build:app', 'npm run 4.0:verify'],
  };
  writeJsonAtomic(path.join(consolidation, 'manifest.json'), manifest);
  const readme = [
    `# 合入包 · ${draft.title}`,
    '',
    `- 草稿：${draft.id}（${draft.kind}${draft.kind === 'new-domain' ? ` / ${draft.newDomain}` : ` / ${draft.targetDomain}`}）`,
    `- 生成时间：${manifest.generated_at}`,
    `- 资产：${changes.filter((item) => item.change !== 'unchanged').length} 个变更（new=${changes.filter((i) => i.change === 'new').length}，modified=${changes.filter((i) => i.change === 'modified').length}）`,
    `- 基线门禁：${baseline.status}${verify.baseline_pending ? '（13 域闭集门禁（design:verify）未覆盖新增域，缺口清单见 verify.json 的 gaps）' : ''}`,
    `- 完整门禁（契约矩阵/交付矩阵）：${heavy}`,
    '',
    '## 合入步骤',
    '1. 在 PiDSH 源树执行：`node scripts/custom/apply-draft.mjs --draft "<本目录>" --root "<源树>" --dry-run` 预览变更；',
    '2. 确认后去掉 `--dry-run` 加 `--yes` 应用（被覆盖文件自动备份到 `reports/custom/rollback/<draft>/`）；',
    '3. 依次跑：design:verify → verify:workflow-contracts → verify:workflow-delivery → build:app；',
    '4. 按发布流程重打包安装器并做安装态验收；应用内该草稿会自动标记“已固化”（按资产哈希比对）。',
    '',
    '## 前置条件（新增域）',
    'design:verify 当前为 13 域 / 39 模块 / 78 工作流闭集断言；新增自定义域在合入前必须把基线门禁扩展为「13+N」口径（含 typedict、workflow-tests 矩阵、strategy-model 等派生清单），缺口清单见 verify.json。',
    '',
    '## 回滚',
    '把 `reports/custom/rollback/<draft>/` 中的备份文件按原路径还原，或 `git checkout -- <paths>`（源树为 git 仓库时）。',
    '',
    '## 限制',
    '- 应用内不直接写产品资产；预览只读 staging；未过门禁不得宣告生效。',
  ].join('\n');
  fs.writeFileSync(path.join(consolidation, 'README.md'), readme, 'utf8');
  const updated = updateDraft(dir, (doc) => {
    doc.assetManifest = assets;
    doc.status = 'exported';
    doc.evidence = { ...(doc.evidence || {}), consolidation: 'consolidation/manifest.json' };
    recordHistory(doc, 'draft.consolidate', `files=${changes.length} baseline=${baseline.status}`);
  });
  return { ok: true, status: updated.status, consolidation: consolidation.replace(/\\/g, '/'), changes, baseline_status: baseline.status, baseline_pending: !!verify.baseline_pending };
}

// —— 应用（开发源树侧；幂等、可回滚）——
export function applyDraft({ draftDir, root, dryRun = true }) {
  const manifestFile = path.join(draftDir, 'manifest.json');
  const manifest = readJson(manifestFile);
  if (!manifest || manifest.schema !== CONSOLIDATION_SCHEMA) throw new Error(`合入包 manifest 非法：${manifestFile}`);
  const overlay = path.join(draftDir, 'overlay');
  const plan = [];
  for (const rel of walk(overlay)) {
    const normalized = normalizeRel(rel);
    const from = path.join(overlay, rel);
    const to = path.join(root, normalized);
    const exists = fs.existsSync(to);
    const same = exists && sha256File(to) === sha256File(from);
    plan.push({ path: normalized, action: same ? 'skip-same' : exists ? 'overwrite' : 'create' });
  }
  if (dryRun) return { dry_run: true, root: path.resolve(root), plan };
  const rollbackDir = path.join(root, 'reports', 'custom', 'rollback', String(manifest.draft_id || path.basename(draftDir)));
  for (const item of plan) {
    if (item.action === 'skip-same') continue;
    const from = path.join(overlay, item.path);
    const to = path.join(root, item.path);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (item.action === 'overwrite') {
      const backup = path.join(rollbackDir, item.path);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.copyFileSync(to, backup);
    }
    fs.copyFileSync(from, to);
  }
  writeJsonAtomic(path.join(root, 'reports', 'custom', String(manifest.draft_id || 'draft'), 'applied.json'), {
    schema: 'pids-nexus/custom-draft-apply/v1',
    draft_id: manifest.draft_id,
    applied_at: nowIso(),
    root: path.resolve(root),
    plan,
    rollback_dir: path.relative(root, rollbackDir).replace(/\\/g, '/'),
  });
  return { dry_run: false, applied: plan.filter((item) => item.action !== 'skip-same').length, plan };
}

// 后台重检：契约矩阵与交付矩阵耗时数分钟，必须脱离宿主事件循环运行
function isRunningMarkerAlive(marker) {
  if (!marker || typeof marker.pid !== 'number' || marker.pid <= 0) return false;
  try {
    process.kill(marker.pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function startHeavyVerify({ bundleRoot, workspaceRoot, draftId, scriptPath }) {
  const dir = draftPath(workspaceRoot, safeDraftId(draftId));
  if (!fs.existsSync(path.join(dir, 'draft.json'))) throw new Error(`草稿不存在：${draftId}`);
  const markerFile = path.join(dir, 'verify.running.json');
  if (fs.existsSync(markerFile)) {
    const marker = readJson(markerFile);
    if (isRunningMarkerAlive(marker)) return { ok: false, running: true, note: '已有重检在运行' };
    // 陈旧标记（进程已退出/被杀）：清理后允许重新启动，避免按钮被永久禁用
    try { fs.rmSync(markerFile, { force: true }); } catch { /* 忽略 */ }
  }
  const cli = scriptPath || path.join(bundleRoot, 'scripts', 'custom', 'verify-draft.mjs');
  if (!fs.existsSync(cli)) throw new Error(`缺少校验脚本：${cli}`);
  writeJsonAtomic(path.join(dir, 'verify.running.json'), { pid: 0, started_at: nowIso(), stage: 'spawn' });
  const child = spawn(process.execPath, [cli, '--draft', draftId, '--workspace', workspaceRoot, '--full'], {
    cwd: bundleRoot,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  writeJsonAtomic(path.join(dir, 'verify.running.json'), { pid: child.pid, started_at: nowIso(), stage: 'running' });
  child.unref();
  return { ok: true, running: true, pid: child.pid };
}

export function developmentGuide({ bundleRoot }) {
  const file = path.join(bundleRoot, 'docs', 'custom-workbench-standard.zh.md');
  if (!fs.existsSync(file)) return '(missing docs/custom-workbench-standard.zh.md)';
  return fs.readFileSync(file, 'utf8');
}
