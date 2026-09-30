import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DOMAIN_IDS = [
  'strat',
  'mkt-on',
  'mkt-off',
  'sales',
  'fin',
  'rec',
  'trn',
  'prf',
  'comp',
  'ben',
  'admin',
  'cmp',
  'er-eap',
];

const DELIVERY_FORMATS = ['md', 'csv', 'html', 'xlsx', 'docx', 'pptx', 'pdf'];
const BACKUP_LIMIT = 30;
const APPROVAL_KEY_FILE = ['config', 'identity', 'approval.key'];
const OPERATORS_FILE = ['config', 'identity', 'operators.json'];
const PII_PATTERNS = [
  { id: 'phone_cn', re: /(?<!\d)1[3-9]\d{9}(?!\d)/g },
  { id: 'idcard_cn', re: /(?<!\d)\d{17}[\dXx](?!\d)/g },
  { id: 'email', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
];

function now() {
  return new Date().toISOString();
}

function stamp() {
  return now().replace(/[-:.]/g, '').replace('T', '-').replace('Z', '');
}

function safeId(value, label = 'id') {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9._:@-]{1,160}$/.test(text)) throw new Error(`${label} 非法`);
  return text;
}

function safeSegment(value, label = 'segment') {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(text)) throw new Error(`${label} 非法`);
  return text;
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
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

function appendJsonl(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function approvalKey(workspaceRoot) {
  const file = path.join(workspaceRoot, ...APPROVAL_KEY_FILE);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${crypto.randomBytes(32).toString('base64')}\n`, { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(file, 0o600);
    } catch {
      // Windows ACLs are inherited from the user workspace; POSIX mode is best effort.
    }
  }
  const encoded = fs.readFileSync(file, 'utf8').trim();
  const key = Buffer.from(encoded, 'base64');
  if (key.length < 32) throw new Error('审批签名密钥损坏');
  return key;
}

function operatorsPath(workspaceRoot) {
  return path.join(workspaceRoot, ...OPERATORS_FILE);
}

function defaultOperators() {
  return {
    schema: 'pids-nexus/operator-registry/v1',
    updated_at: now(),
    operators: [
      {
        id: 'LOCAL-OWNER',
        display_name: '本机管理员',
        roles: ['系统管理员'],
        status: 'active',
        created_at: now(),
      },
    ],
  };
}

function loadOperators(workspaceRoot) {
  const file = operatorsPath(workspaceRoot);
  const registry = readJson(file, null);
  if (registry && Array.isArray(registry.operators)) return registry;
  const created = defaultOperators();
  writeJsonAtomic(file, created);
  return created;
}

function saveOperators(workspaceRoot, registry) {
  registry.updated_at = now();
  writeJsonAtomic(operatorsPath(workspaceRoot), registry);
  return registry;
}

function migrateLegacyApprovals(workspaceRoot) {
  const instancesRoot = path.join(workspaceRoot, 'instances');
  if (!fs.existsSync(instancesRoot)) return { migrated: 0 };
  const candidates = [];
  for (const entry of fs.readdirSync(instancesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(instancesRoot, entry.name, 'instance.json');
    const instance = readJson(file);
    if (!instance || !Array.isArray(instance.approvals) || !instance.approvals.length) continue;
    if (instance.approvals.some((record) => !record.signature || !record.operator_id)) candidates.push({ file, instance });
  }
  if (!candidates.length) return { migrated: 0 };
  const backup = path.join(workspaceRoot, 'backups', `${stamp()}-r12-approval-migration`);
  fs.mkdirSync(backup, { recursive: true });
  fs.cpSync(instancesRoot, path.join(backup, 'instances'), { recursive: true });
  for (const { file, instance } of candidates) {
    instance.legacy_approvals = [
      ...(instance.legacy_approvals || []),
      ...instance.approvals.map((record) => ({ ...record, migration: 'r12_unsigned_legacy_record' })),
    ];
    instance.approvals = [];
    instance.approval_integrity = 'legacy_unverified';
    instance.requires_reapproval = ['approved', 'completed'].includes(instance.status);
    writeJsonAtomic(file, instance);
  }
  appendAudit(workspaceRoot, 'approval.migration.r12', {
    migrated_instances: candidates.length,
    backup: path.relative(workspaceRoot, backup),
  });
  return { migrated: candidates.length, backup: path.relative(workspaceRoot, backup) };
}

function signingMaterial(workspaceRoot) {
  const key = approvalKey(workspaceRoot);
  return {
    key,
    key_id: crypto.createHash('sha256').update(key).digest('hex').slice(0, 16),
  };
}

function approvalDraftHash(instance) {
  return sha256Text(canonicalJson({
    workflow_id: instance.workflow_id,
    instance_id: instance.id,
    input: instance.input || {},
    analysis: instance.analysis || null,
    quality: instance.quality || null,
  }));
}

function approvalSignature(instance, record, key) {
  const signed = {
    workflow_id: instance.workflow_id,
    instance_id: instance.id,
    revision: record.revision,
    data_version: record.data_version,
    artifact_hash: record.artifact_hash,
    operator_id: record.operator_id,
    operator_name: record.operator_name,
    role: record.role,
    decision: record.decision,
    comment: record.comment,
    at: record.at,
    key_id: record.key_id,
  };
  return crypto.createHmac('sha256', key).update(canonicalJson(signed)).digest('hex');
}

function assertApprovalIntegrity(workspaceRoot, instance) {
  if (!Array.isArray(instance.approvals) || !instance.approvals.length) return true;
  const { key } = signingMaterial(workspaceRoot);
  for (const record of instance.approvals) {
    if (!record.signature || !record.operator_id) throw new Error('审批记录缺少可信签名');
    const expected = approvalSignature(instance, record, key);
    const actual = String(record.signature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
      throw new Error(`审批记录签名校验失败：${record.operator_id || 'unknown'}`);
    }
  }
  return true;
}

function toPosix(value) {
  return String(value).replace(/\\/g, '/');
}

function copyMissing(sourceDir, targetDir, counter) {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyMissing(source, target, counter);
    } else if (entry.isFile() && !fs.existsSync(target)) {
      fs.copyFileSync(source, target);
      counter.files += 1;
    }
  }
}

export function resolveWorkspaceRoot(bundleRoot) {
  const explicit = process.env.UNIVERSAL_WORKBENCH_WORKSPACE || process.env.UNIVERSAL_WORKBENCH_QA_WORKSPACE;
  if (explicit) return path.resolve(explicit);
  const localAppData = process.env.LOCALAPPDATA || process.env.XDG_DATA_HOME;
  const resolvedBundle = path.resolve(bundleRoot);
  const installedUnderLocal = localAppData
    && resolvedBundle.toLowerCase().startsWith(path.resolve(localAppData).toLowerCase());
  if (installedUnderLocal) return path.join(localAppData, 'PiDSH Nexus', 'workspace');
  return path.join(resolvedBundle, '.work', 'workbench-workspace');
}

export function ensureWorkspace({ bundleRoot, workspaceRoot }) {
  const bundleDir = path.resolve(bundleRoot);
  const workspaceDir = path.resolve(workspaceRoot || resolveWorkspaceRoot(bundleDir));
  const dirs = [
    workspaceDir,
    path.join(workspaceDir, 'config'),
    path.join(workspaceDir, 'config', 'identity'),
    path.join(workspaceDir, 'data'),
    path.join(workspaceDir, 'imports'),
    path.join(workspaceDir, 'instances'),
    path.join(workspaceDir, 'deliverables'),
    path.join(workspaceDir, 'audit'),
    path.join(workspaceDir, 'metrics'),
    path.join(workspaceDir, 'backups'),
  ];
  for (const dir of dirs) fs.mkdirSync(dir, { recursive: true });
  approvalKey(workspaceDir);
  loadOperators(workspaceDir);
  migrateLegacyApprovals(workspaceDir);

  const marker = path.join(workspaceDir, '.workspace.json');
  if (!fs.existsSync(marker)) {
    const counter = { files: 0 };
    copyMissing(path.join(bundleDir, 'templates', 'workspace', 'data'), path.join(workspaceDir, 'data'), counter);
    copyMissing(path.join(bundleDir, 'templates', 'workspace', 'system'), path.join(workspaceDir, 'config', 'system'), counter);
    copyMissing(path.join(bundleDir, 'templates', 'workspace', 'knowledge'), path.join(workspaceDir, 'knowledge'), counter);
    const strategySource = path.join(bundleDir, 'manifests', 'strategy-model.json');
    const strategyTarget = path.join(workspaceDir, 'config', 'strategy.json');
    if (fs.existsSync(strategySource) && !fs.existsSync(strategyTarget)) {
      fs.copyFileSync(strategySource, strategyTarget);
      counter.files += 1;
    }
    writeJsonAtomic(marker, {
      schema: 'pids-nexus/workspace/v1',
      created_at: now(),
      source: path.relative(bundleDir, path.join(bundleDir, 'templates', 'workspace')).replace(/\\/g, '/'),
      copied_files: counter.files,
    });
  }
  return workspaceDir;
}

function appendAudit(root, action, detail = {}) {
  const day = now().slice(0, 10);
  appendJsonl(path.join(root, 'audit', `audit-${day}.jsonl`), {
    ts: now(),
    action,
    ...detail,
  });
}

function parseCsvText(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value !== '')) rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows[0].map((value) => value.trim());
  return rows.slice(1).map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
}

function loadCsv(file) {
  if (!fs.existsSync(file)) return [];
  return parseCsvText(fs.readFileSync(file, 'utf8'));
}

function numberValue(value) {
  const text = String(value ?? '').trim().replace(/,/g, '').replace(/%$/, '');
  if (text === '' || text === '-' || text === '—') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function matchesWhere(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, values]) => {
    const list = Array.isArray(values) ? values.map(String) : [String(values)];
    return list.includes(String(row[key] ?? ''));
  });
}

function applyAggregate(rows, definition) {
  const kind = definition?.kind || 'count';
  const filtered = rows.filter((row) => matchesWhere(row, definition?.where));
  const excluded = (definition?.exclude
    ? filtered.filter((row) => !matchesWhere(row, definition.exclude))
    : filtered);
  if (kind === 'count') return excluded.length;
  if (kind === 'sum') {
    return excluded.reduce((sum, row) => sum + (numberValue(row[definition.column]) ?? 0), 0);
  }
  if (kind === 'avg') {
    const values = excluded.map((row) => numberValue(row[definition.column])).filter((value) => value != null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }
  throw new Error(`不支持的聚合类型：${kind}`);
}

function readDomainTables(workspaceRoot, domain) {
  const dir = path.join(workspaceRoot, 'data', safeSegment(domain, 'domain'));
  const tables = {};
  if (!fs.existsSync(dir)) return tables;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.csv'))) {
    tables[file] = loadCsv(path.join(dir, file));
  }
  return tables;
}

function computeMetric(workspaceRoot, definition) {
  if (!definition) return null;
  const tables = readDomainTables(workspaceRoot, definition.domain || '');
  const rows = tables[definition.table] || [];
  if (definition.kind === 'ratio') {
    const numerator = applyAggregate(rows, definition.numerator);
    const denominator = applyAggregate(rows, definition.denominator);
    if (!denominator) return 0;
    return (numerator / denominator) * (definition.multiply || 1);
  }
  return applyAggregate(rows, definition);
}

function computeDomainMetric(workspaceRoot, domain, definition) {
  if (!definition) return null;
  const tables = readDomainTables(workspaceRoot, domain);
  const rows = tables[definition.table] || [];
  if (definition.kind === 'ratio') {
    const numerator = applyAggregate(rows, definition.numerator);
    const denominator = applyAggregate(rows, definition.denominator);
    if (!denominator) return 0;
    return (numerator / denominator) * (definition.multiply || 1);
  }
  return applyAggregate(rows, definition);
}

function dataVersion(workspaceRoot) {
  const root = path.join(workspaceRoot, 'data');
  const entries = [];
  if (!fs.existsSync(root)) return sha256Text('empty');
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) entries.push(`${toPosix(path.relative(root, full))}:${sha256File(full)}`);
    }
  };
  visit(root);
  return sha256Text(entries.join('\n'));
}

function pruneBackups(workspaceRoot) {
  const root = path.join(workspaceRoot, 'backups');
  if (!fs.existsSync(root)) return;
  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort();
  while (dirs.length > BACKUP_LIMIT) {
    const target = dirs.shift();
    const resolved = path.resolve(target);
    if (!resolved.toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep)) continue;
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

function createBackup(workspaceRoot, reason, traceId) {
  const backupDir = path.join(workspaceRoot, 'backups', `${stamp()}-${safeId(traceId || 'trace', 'trace')}`);
  const manifest = {
    schema: 'pids-nexus/backup/v1',
    created_at: now(),
    reason: String(reason || 'write'),
    trace_id: traceId || null,
    files: [],
  };
  for (const folder of ['data', 'config']) {
    const source = path.join(workspaceRoot, folder);
    if (!fs.existsSync(source)) continue;
    const visit = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(full);
        else if (entry.isFile()) {
          const relative = toPosix(path.relative(workspaceRoot, full));
          if (relative === 'config/identity/approval.key') continue;
          const target = path.join(backupDir, relative);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(full, target);
          manifest.files.push({ file: relative, bytes: fs.statSync(full).size, sha256: sha256File(full) });
        }
      }
    };
    visit(source);
  }
  writeJsonAtomic(path.join(backupDir, 'manifest.json'), manifest);
  pruneBackups(workspaceRoot);
  return { dir: backupDir, fileCount: manifest.files.length, bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0) };
}

function workflowIndex(bundleRoot) {
  const file = path.join(bundleRoot, 'manifests', 'workflows', 'index.json');
  const index = readJson(file, { count: 0, workflows: [] });
  if (!index || !Array.isArray(index.workflows)) throw new Error('工作流索引不可用');
  return index;
}

function domainModel(bundleRoot, domain) {
  const file = path.join(bundleRoot, 'manifests', 'domain-model', `${safeSegment(domain)}.json`);
  const model = readJson(file);
  if (!model) throw new Error(`域模型缺失：${domain}`);
  return model;
}

function findWorkflow(bundleRoot, workflowId) {
  const id = safeId(workflowId, 'workflowId');
  const workflow = workflowIndex(bundleRoot).workflows.find((item) => item.workflow_id === id);
  if (!workflow) throw new Error(`工作流不存在：${id}`);
  return workflow;
}

const DOMAIN_STAGE_COPY = {
  rec: {
    intake: '岗位、候选人与面试输入',
    llm_analysis: '简历解析、匹配评价、邀约与题库生成',
    quality_gate: '招聘规则、脱敏与证据复核',
    outcome_eval: '录用、入职、30/60/90 天质量与渠道留存复盘',
  },
  fin: {
    intake: '费用、发票、预算与收入输入',
    llm_analysis: '凭证解析、预算勾稽与异常说明',
    quality_gate: '金额、税号、连号与预算规则复核',
    outcome_eval: '收入、成本、预算和现金流成效复盘',
  },
  sales: {
    intake: '商机、报价、合同与客户上下文',
    llm_analysis: '赢率、报价、条款与推进策略分析',
    quality_gate: '折扣、条款、审批路线与金额勾稽',
    outcome_eval: '收入、赢单、周期和输单复盘',
  },
};

function defaultStageCopy(domain) {
  return {
    intake: `${domain} 业务输入与来源数据`,
    llm_analysis: 'LLM 结构化分析、生成与风险提示',
    quality_gate: '业务规则、证据引用与安全门禁复核',
    outcome_eval: '交付质量与经营成效复盘',
  };
}

function buildStages(workflow, bundleRoot) {
  const designFile = path.join(bundleRoot, 'manifests', 'domain-work-design', `${workflow.domain}.json`);
  const design = readJson(designFile);
  const designedItem = design?.modules
    ?.flatMap((module) => module.items)
    ?.find((item) => item.workflow?.id === workflow.workflow_id);
  if (!designedItem) throw new Error(`工作流缺少模块/事项设计：${workflow.workflow_id}`);
  const typeMap = {
    data_intake: 'intake',
    rule_gate: 'rule',
    llm_task: 'llm',
    quality_gate: 'quality',
    human_approval: 'approval',
    no_human_approval: 'rule',
    writeback_and_delivery: 'publish',
    outcome_evaluation: 'outcome',
    strategy_writeback: 'strategy',
  };
  const designedStages = designedItem.stages.map((stage) => ({
    id: stage.id,
    type: typeMap[stage.type] || stage.type,
    title: stage.name,
    required: true,
    standard: stage.standard,
    gate: stage.gate,
    on_fail: stage.on_fail,
    skill: stage.type === 'llm_task' ? workflow.skill : undefined,
    approvalCount: stage.type === 'human_approval' ? (workflow.dual || workflow.approval?.dual ? 2 : 1) : undefined,
    node: stage.type === 'human_approval' ? (workflow.approval?.node || (workflow.hitl_nodes || [])[0] || 'n3') : undefined,
    requiredRoles: stage.type === 'human_approval'
      ? (workflow.approval?.required_roles || (workflow.dual || workflow.approval?.dual ? ['业务负责人', '风险负责人'] : ['业务负责人']))
      : undefined,
    status: stage.id === 'intake' ? 'ready' : 'pending',
    started_at: null,
    finished_at: null,
    error: null,
  }));
  if (!designedStages.some((stage) => stage.id === 'strategy_rollup')) {
    designedStages.push({
      id: 'strategy_rollup',
      type: 'strategy',
      title: '回写战略指标与决策证据',
      required: true,
      standard: `回写 ${workflow.domain} 北极星指标、贡献 KR、数据版本和证据引用。`,
      gate: 'metric_lineage_and_data_freshness',
      on_fail: 'mark_outcome_pending',
      status: 'pending',
      started_at: null,
      finished_at: null,
      error: null,
    });
  }
  return designedStages;
}

function buildLegacyStages(workflow) {
  const copy = DOMAIN_STAGE_COPY[workflow.domain] || defaultStageCopy(workflow.domain);
  const approvalRequired = (workflow.hitl_nodes || []).length > 0 || Boolean(workflow.approval);
  const approvalCount = workflow.dual || workflow.approval?.dual ? 2 : 1;
  const stages = [
    { id: 'intake', type: 'intake', title: copy.intake, required: true },
    { id: 'schema_validate', type: 'rule', title: '输入结构与引用完整性校验', required: true },
    { id: 'llm_analysis', type: 'llm', title: copy.llm_analysis, required: true, skill: workflow.skill },
    { id: 'quality_gate', type: 'quality', title: copy.quality_gate, required: true },
  ];
  if (approvalRequired) {
    stages.push({
      id: 'approval',
      type: 'approval',
      title: '人工审批',
      required: true,
      approvalCount,
      node: workflow.approval?.node || (workflow.hitl_nodes || [])[0] || 'n3',
    });
  }
  stages.push(
    { id: 'publish', type: 'publish', title: '写入业务数据并生成交付包', required: true },
    { id: 'outcome_eval', type: 'outcome', title: copy.outcome_eval, required: true },
    { id: 'strategy_rollup', type: 'strategy', title: '回写战略指标与决策证据', required: true },
  );
  return stages.map((stage) => ({
    ...stage,
    status: stage.id === 'intake' ? 'ready' : 'pending',
    started_at: null,
    finished_at: null,
    error: null,
  }));
}

function instanceFile(workspaceRoot, id) {
  return path.join(workspaceRoot, 'instances', safeId(id, 'instanceId'), 'instance.json');
}

function loadInstance(workspaceRoot, id) {
  const file = instanceFile(workspaceRoot, id);
  const instance = readJson(file);
  if (!instance) throw new Error(`工作流实例不存在：${id}`);
  return instance;
}

function saveInstance(workspaceRoot, instance) {
  instance.updated_at = now();
  instance.revision = Number(instance.revision || 0) + 1;
  writeJsonAtomic(instanceFile(workspaceRoot, instance.id), instance);
  appendJsonl(
    path.join(workspaceRoot, 'instances', instance.id, 'events.jsonl'),
    { ts: instance.updated_at, revision: instance.revision, status: instance.status },
  );
  return instance;
}

function requireApproval(instance) {
  return instance.stages.find((stage) => stage.id === 'approval');
}

function currentStage(instance) {
  return instance.stages.find((stage) => stage.status !== 'passed' && stage.status !== 'skipped') || null;
}

function assertNoSensitiveOutput(value, domain) {
  const text = JSON.stringify(value);
  const hits = [];
  for (const pattern of PII_PATTERNS) {
    pattern.re.lastIndex = 0;
    if (pattern.re.test(text)) hits.push(pattern.id);
  }
  if (hits.length) throw new Error(`LLM 输出命中敏感字段：${hits.join(', ')}`);
  if (domain === 'er-eap' && /\bE\d{3,}\b|[\u4e00-\u9fa5]{2,4}(?=心理咨询|法律援助|危机干预)/.test(text)) {
    throw new Error('EAP 输出包含可识别身份线索');
  }
}

function parseEngineJson(output) {
  const text = String(output || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(candidate.slice(first, last + 1));
    throw new Error('LLM 输出不是合法 JSON');
  }
}

function mockModelResult(workflow, input) {
  return {
    summary: `已完成 ${workflow.description} 的结构化分析`,
    findings: [
      {
        id: 'finding-1',
        title: '输入数据可进入业务审批',
        detail: '字段、来源和证据引用已通过确定性门禁。',
        severity: 'info',
      },
    ],
    recommendations: [
      {
        id: 'action-1',
        title: '按当前建议推进',
        detail: '由人工审批人复核后进入正式交付。',
      },
    ],
    confidence: 0.88,
    evidence_refs: Object.keys(input || {}).map((key) => `input:${key}`),
    redactions: [],
    narrative: `这是 ${workflow.workflow_id} 的 QA 模型桩输出，仅用于离线门禁。`,
  };
}

function normalizeModelResult(workflow, input, result) {
  if (!result || typeof result !== 'object') throw new Error('LLM 输出不是对象');
  const normalized = {
    summary: String(result.summary || '').trim(),
    findings: Array.isArray(result.findings) ? result.findings : [],
    recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
    confidence: Number(result.confidence),
    evidence_refs: Array.isArray(result.evidence_refs) ? result.evidence_refs.map(String) : [],
    redactions: Array.isArray(result.redactions) ? result.redactions.map(String) : [],
    narrative: String(result.narrative || '').trim(),
    model: String(result.model || 'unknown'),
    prompt_version: String(result.prompt_version || 'workflow-v2'),
    workflow_id: workflow.workflow_id,
    generated_at: now(),
  };
  if (!normalized.summary) throw new Error('LLM 输出缺少 summary');
  if (!normalized.findings.length) throw new Error('LLM 输出缺少 findings');
  if (!normalized.recommendations.length) throw new Error('LLM 输出缺少 recommendations');
  if (!Number.isFinite(normalized.confidence) || normalized.confidence < 0 || normalized.confidence > 1) {
    throw new Error('LLM confidence 必须在 0 到 1 之间');
  }
  if (!normalized.evidence_refs.length) throw new Error('LLM 输出缺少 evidence_refs');
  if (!normalized.narrative) normalized.narrative = normalized.summary;
  assertNoSensitiveOutput(normalized, workflow.domain);
  return { ...normalized, input_keys: Object.keys(input || {}) };
}

function validateInput(workflow, model, input) {
  const errors = [];
  const required = workflow.deliverable?.fields || [];
  for (const field of required) {
    if (input[field] == null || String(input[field]).trim() === '') errors.push(`缺少必填字段：${field}`);
  }
  const allowed = new Set([...required, 'source_refs', 'notes', 'uploaded_files', 'form_data']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) errors.push(`未知输入字段：${key}`);
  }
  if (model.redact_fields?.length) {
    for (const field of model.redact_fields) {
      const value = String(input[field] ?? '');
      if (value && !/[•*×]/.test(value)) errors.push(`字段 ${field} 必须使用脱敏值`);
    }
  }
  return errors;
}

function buildPrompt(workflow, model, input) {
  return [
    `你是 PiDSH Nexus 的 ${workflow.domain} 业务执行器。`,
    `工作流：${workflow.workflow_id}；技能：${workflow.skill}；目标：${workflow.description}`,
    `交付要求：${workflow.deliverable?.acceptance || '输出可追溯、可审批、可交付'}`,
    `数据级别：${model.level || 'L3'}；脱敏字段：${(model.redact_fields || []).join(',') || '无'}。`,
    '禁止输出姓名、完整手机号、身份证号、完整银行卡号或未授权的个人薪酬。',
    '只返回 JSON，结构必须是：',
    '{"summary":"","findings":[{"id":"","title":"","detail":"","severity":"info|warning|critical"}],"recommendations":[{"id":"","title":"","detail":""}],"confidence":0.0,"evidence_refs":["input:field"],"redactions":[],"narrative":""}',
    `输入：${JSON.stringify(input)}`,
  ].join('\n');
}

async function runModelStage(context, workflow, model, instance) {
  if (process.env.WORKBENCH_ALLOW_MODEL_STUB === '1') {
    return normalizeModelResult(workflow, instance.input, mockModelResult(workflow, instance.input));
  }
  if (typeof context.runEngine !== 'function') throw new Error('MODEL_UNAVAILABLE: 未配置模型执行器');
  const result = await context.runEngine(workflow.skill, buildPrompt(workflow, model, instance.input));
  if (!result || result.fallback) throw new Error('MODEL_UNAVAILABLE: 模型调用失败或进入本地降级');
  return normalizeModelResult(workflow, instance.input, parseEngineJson(result.output));
}

async function publishStage(context, workflow, instance) {
  const artifactDir = path.join(context.workspaceRoot, 'instances', instance.id, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const resultFile = path.join(artifactDir, 'result.json');
  const reportFile = path.join(artifactDir, 'report.md');
  writeJsonAtomic(resultFile, {
    schema: 'pids-nexus/workflow-result/v1',
    workflow_id: workflow.workflow_id,
    instance_id: instance.id,
    domain: workflow.domain,
    input: instance.input,
    analysis: instance.analysis,
    approvals: instance.approvals,
    quality: instance.quality,
  });
  fs.writeFileSync(reportFile, [
    `# ${workflow.description}`,
    '',
    `- 工作流：${workflow.workflow_id}`,
    `- 实例：${instance.id}`,
    `- 生成时间：${now()}`,
    `- 数据版本：${instance.data_version}`,
    '',
    '## 结论',
    '',
    instance.analysis?.summary || '无',
    '',
    '## 发现',
    '',
    ...(instance.analysis?.findings || []).map((item) => `- ${item.title || item.id || '发现'}：${item.detail || ''}`),
    '',
    '## 建议',
    '',
    ...(instance.analysis?.recommendations || []).map((item) => `- ${item.title || item.id || '建议'}：${item.detail || ''}`),
    '',
    '## 审批',
    '',
    ...(instance.approvals || []).map((item) => `- ${item.role} / ${item.operator_name || item.operator_id}：${item.decision}（${item.at}，签名 ${String(item.signature || '').slice(0, 12)}…）`),
    '',
  ].join('\n'), 'utf8');
  const artifacts = [resultFile, reportFile].map((file) => ({
    format: path.extname(file).slice(1),
    file: toPosix(path.relative(context.workspaceRoot, file)),
    bytes: fs.statSync(file).size,
    sha256: sha256File(file),
  }));
  if (typeof context.deliverDomain === 'function') {
    const formats = String(process.env.WORKBENCH_TEST_FORMATS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    try {
      const delivery = await context.deliverDomain({
        domain: workflow.domain,
        workflowId: workflow.workflow_id,
        formats: formats.length ? formats : DELIVERY_FORMATS,
      });
      instance.delivery = {
        run_id: delivery.runId,
        manifest: delivery.manifestPath,
        artifacts: delivery.artifacts,
      };
      for (const artifact of delivery.artifacts || []) {
        artifacts.push({
          format: artifact.format,
          file: artifact.file,
          bytes: artifact.bytes,
          sha256: artifact.sha256,
        });
      }
    } catch (error) {
      instance.delivery_error = String(error.message || error);
    }
  }
  instance.artifacts = artifacts;
  const manifestFile = path.join(artifactDir, 'artifact-manifest.json');
  writeJsonAtomic(manifestFile, {
    schema: 'pids-nexus/artifact-manifest/v1',
    instance_id: instance.id,
    workflow_id: workflow.workflow_id,
    created_at: now(),
    artifacts,
  });
  return { artifacts, manifest: toPosix(path.relative(context.workspaceRoot, manifestFile)) };
}

async function runUntilBlocked(context, workflow, model, instance) {
  let stage = currentStage(instance);
  let safety = 0;
  while (stage && safety < 20) {
    safety += 1;
    stage.status = 'running';
    stage.started_at = stage.started_at || now();
    try {
      if (stage.type === 'intake') {
        const errors = validateInput(workflow, model, instance.input);
        if (errors.length) throw new Error(errors.join('；'));
        stage.status = 'passed';
      } else if (stage.type === 'rule') {
        const errors = validateInput(workflow, model, instance.input);
        if (errors.length) throw new Error(errors.join('；'));
        stage.status = 'passed';
      } else if (stage.type === 'llm') {
        instance.analysis = await runModelStage(context, workflow, model, instance);
        stage.status = 'passed';
      } else if (stage.type === 'quality') {
        const analysis = normalizeModelResult(workflow, instance.input, instance.analysis);
        instance.analysis = analysis;
        instance.quality = {
          passed: true,
          confidence: analysis.confidence,
          evidence_refs: analysis.evidence_refs,
          checked_at: now(),
          rubric: workflow.deliverable?.acceptance || '结构完整、证据可追溯',
        };
        stage.status = 'passed';
      } else if (stage.type === 'approval') {
        instance.status = 'awaiting_approval';
        stage.status = 'awaiting_approval';
        break;
      } else if (stage.type === 'publish') {
        const published = await publishStage(context, workflow, instance);
        instance.artifact_manifest = published.manifest;
        stage.status = 'passed';
      } else if (stage.type === 'outcome') {
        const strategy = readJson(path.join(context.workspaceRoot, 'config', 'strategy.json'), readJson(path.join(context.bundleRoot, 'manifests', 'strategy-model.json'), {}));
        const definition = strategy.domains?.[workflow.domain]?.metric;
        instance.outcome = {
          metric: strategy.domains?.[workflow.domain]?.north_star || '业务成效',
          actual: computeDomainMetric(context.workspaceRoot, workflow.domain, definition),
          unit: strategy.domains?.[workflow.domain]?.unit || '',
          evaluated_at: now(),
          data_version: dataVersion(context.workspaceRoot),
        };
        stage.status = 'passed';
      } else if (stage.type === 'strategy') {
        const strategy = readJson(path.join(context.workspaceRoot, 'config', 'strategy.json'), readJson(path.join(context.bundleRoot, 'manifests', 'strategy-model.json'), {}));
        const domainSpec = strategy.domains?.[workflow.domain] || {};
        appendJsonl(path.join(context.workspaceRoot, 'metrics', `snapshots-${now().slice(0, 7)}.jsonl`), {
          ts: now(),
          instance_id: instance.id,
          workflow_id: workflow.workflow_id,
          domain: workflow.domain,
          metric: domainSpec.north_star || 'business_outcome',
          actual: instance.outcome?.actual ?? computeDomainMetric(context.workspaceRoot, workflow.domain, domainSpec.metric),
          unit: domainSpec.unit || '',
          contributes_to: domainSpec.contributes_to || [],
          data_version: instance.data_version,
        });
        stage.status = 'passed';
        instance.status = 'completed';
      } else {
        throw new Error(`未知阶段类型：${stage.type}`);
      }
      stage.finished_at = now();
      stage.error = null;
      if (instance.status === 'completed') break;
      stage = currentStage(instance);
    } catch (error) {
      stage.status = 'blocked';
      stage.error = String(error.message || error);
      stage.finished_at = now();
      instance.status = stage.type === 'llm' ? 'blocked_model' : 'blocked';
      instance.last_error = stage.error;
      break;
    }
  }
  if (currentStage(instance)?.type === 'approval' && instance.status !== 'awaiting_approval') {
    instance.status = 'awaiting_approval';
  }
  return saveInstance(context.workspaceRoot, instance);
}

function listInstanceIds(workspaceRoot) {
  const root = path.join(workspaceRoot, 'instances');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function listInstances(workspaceRoot, filters = {}) {
  const items = [];
  for (const id of listInstanceIds(workspaceRoot)) {
    const instance = readJson(instanceFile(workspaceRoot, id));
    if (!instance) continue;
    assertApprovalIntegrity(workspaceRoot, instance);
    if (filters.workflowId && instance.workflow_id !== filters.workflowId) continue;
    if (filters.domain && instance.domain !== filters.domain) continue;
    if (filters.status && instance.status !== filters.status) continue;
    items.push(instance);
  }
  return items.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

function findDomainDefinition(strategy, domain) {
  return strategy?.domains?.[domain] || null;
}

export function getStrategyOverview(context, options = {}) {
  const strategy = readJson(
    path.join(context.workspaceRoot, 'config', 'strategy.json'),
    readJson(path.join(context.bundleRoot, 'manifests', 'strategy-model.json'), {}),
  );
  const version = dataVersion(context.workspaceRoot);
  const domains = Object.entries(strategy.domains || {}).map(([domain, definition]) => {
    const actual = computeDomainMetric(context.workspaceRoot, domain, definition.metric);
    return {
      domain,
      label: definition.label,
      north_star: definition.north_star,
      actual,
      unit: definition.unit,
      contributes_to: definition.contributes_to || [],
      weight: definition.weight || 0,
      source: definition.metric ? `${domain}/${definition.metric.table}` : null,
      data_version: version,
    };
  });
  const byDomain = Object.fromEntries(domains.map((item) => [item.domain, item]));
  const keyResults = (strategy.key_results || []).map((kr) => {
    const source = byDomain[kr.domain];
    const actual = kr.metric_definition
      ? computeDomainMetric(context.workspaceRoot, kr.domain, kr.metric_definition)
      : source?.actual;
    const progress = Number.isFinite(Number(actual)) && Number(kr.target)
      ? Math.max(0, Math.min(100, (Number(actual) / Number(kr.target)) * 100))
      : null;
    return {
      ...kr,
      actual: actual ?? null,
      progress_pct: progress == null ? null : Number(progress.toFixed(1)),
      risk: progress == null ? 'unknown' : progress < 60 ? 'critical' : progress < 85 ? 'warning' : 'on_track',
      data_version: version,
    };
  });
  const weighted = keyResults.filter((item) => item.progress_pct != null);
  const objectiveProgress = weighted.length
    ? weighted.reduce((sum, item) => sum + item.progress_pct, 0) / weighted.length
    : null;
  const instances = listInstances(context.workspaceRoot);
  return {
    schema: 'pids-nexus/strategy-overview/v1',
    generated_at: now(),
    period: strategy.period,
    objective: {
      ...strategy.objective,
      actual: objectiveProgress == null ? null : Number(objectiveProgress.toFixed(1)),
      data_version: version,
    },
    key_results: keyResults,
    domains,
    active_instances: instances.filter((item) => !['completed', 'rejected', 'archived'].includes(item.status)).length,
    completed_instances: instances.filter((item) => item.status === 'completed').length,
    blockers: instances
      .filter((item) => ['blocked', 'blocked_model', 'failed'].includes(item.status))
      .slice(0, 10)
      .map((item) => ({ instance_id: item.id, workflow_id: item.workflow_id, status: item.status, error: item.last_error })),
    source: 'manifests/strategy-model.json + config/strategy.json',
    data_version: version,
    include_deliveries: options.includeDeliveries !== false,
  };
}

export function listMetrics(context, options = {}) {
  const root = path.join(context.workspaceRoot, 'metrics');
  const rows = [];
  if (fs.existsSync(root)) {
    for (const file of fs.readdirSync(root).filter((name) => name.endsWith('.jsonl'))) {
      for (const line of fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line);
          if (options.domain && item.domain !== options.domain) continue;
          rows.push(item);
        } catch {
          // Ignore a partial final line; the next append repairs the stream.
        }
      }
    }
  }
  return rows.sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, Number(options.limit || 500));
}

export function listBackups(context) {
  const root = path.join(context.workspaceRoot, 'backups');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(root, entry.name);
      const manifest = readJson(path.join(dir, 'manifest.json'), {});
      return {
        id: entry.name,
        path: toPosix(path.relative(context.workspaceRoot, dir)),
        created_at: manifest.created_at || null,
        reason: manifest.reason || null,
        file_count: Array.isArray(manifest.files) ? manifest.files.length : 0,
      };
    })
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

export function listWorkflowDefinitions(context) {
  const index = workflowIndex(context.bundleRoot);
  return index.workflows.map((workflow) => ({
    ...workflow,
    stages: buildStages(workflow, context.bundleRoot),
  }));
}

export function getDomainWorkDesign(context, domain = null) {
  const root = path.join(context.bundleRoot, 'manifests', 'domain-work-design');
  const index = readJson(path.join(root, 'index.json'), null);
  if (!index) throw new Error('领域工作设计索引缺失，请先运行 design:build');
  if (!domain) return index;
  const item = readJson(path.join(root, `${safeSegment(domain, 'domain')}.json`), null);
  if (!item) throw new Error(`领域工作设计缺失：${domain}`);
  return item;
}

export function listOperators(context) {
  const registry = loadOperators(context.workspaceRoot);
  return {
    schema: registry.schema,
    updated_at: registry.updated_at,
    operators: registry.operators.map((operator) => ({
      id: operator.id,
      display_name: operator.display_name,
      roles: [...(operator.roles || [])],
      status: operator.status,
      created_at: operator.created_at,
    })),
  };
}

export function upsertOperator(context, body = {}) {
  const id = safeId(body.id || body.operatorId, 'operatorId').toUpperCase();
  const displayName = String(body.displayName || body.display_name || id).trim().slice(0, 80);
  const roles = [...new Set((Array.isArray(body.roles) ? body.roles : String(body.roles || '').split(','))
    .map((role) => String(role).trim())
    .filter(Boolean))].slice(0, 24);
  const status = ['active', 'disabled'].includes(body.status) ? body.status : 'active';
  if (!displayName) throw new Error('操作者名称必填');
  if (!roles.length) throw new Error('操作者至少需要一个角色');
  if (roles.includes('*') && id !== 'LOCAL-OWNER') throw new Error('仅 LOCAL-OWNER 可拥有通配角色');
  const registry = loadOperators(context.workspaceRoot);
  const existing = registry.operators.find((operator) => operator.id === id);
  if (existing) {
    existing.display_name = displayName;
    existing.roles = roles;
    existing.status = status;
    existing.updated_at = now();
  } else {
    registry.operators.push({
      id,
      display_name: displayName,
      roles,
      status,
      created_at: now(),
    });
  }
  if (!registry.operators.some((operator) => operator.status === 'active' && operator.id === 'LOCAL-OWNER')) {
    registry.operators.unshift(defaultOperators().operators[0]);
  }
  saveOperators(context.workspaceRoot, registry);
  appendAudit(context.workspaceRoot, 'identity.operator.upsert', { operator_id: id, roles, status });
  context.audit?.('identity.operator.upsert', { operator_id: id, roles, status });
  return listOperators(context);
}

export function getInstance(context, id) {
  const instance = loadInstance(context.workspaceRoot, id);
  assertApprovalIntegrity(context.workspaceRoot, instance);
  return instance;
}

export function resolveInstanceArtifact(context, id, relativeFile) {
  const instanceId = safeId(id, 'instanceId');
  const relative = String(relativeFile || '').replace(/\\/g, '/');
  if (!relative || relative.includes('..') || path.isAbsolute(relative)) throw new Error('实例产物标识非法');
  const root = path.join(context.workspaceRoot, 'instances', instanceId);
  const file = path.resolve(root, relative);
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!file.startsWith(prefix)) throw new Error('实例产物越界');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('实例产物不存在');
  const format = path.extname(file).slice(1).toLowerCase();
  const mime = {
    json: 'application/json; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }[format] || 'application/octet-stream';
  return { file, format, mime, filename: path.basename(file) };
}

export function startInstance(context, body = {}) {
  const workflow = findWorkflow(context.bundleRoot, body.workflowId || body.id);
  const domain = workflow.domain || body.domain;
  if (!DOMAIN_IDS.includes(domain)) throw new Error(`未知域：${domain}`);
  const id = `WI-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const backup = createBackup(context.workspaceRoot, `start:${workflow.workflow_id}`, id);
  const instance = {
    schema: 'pids-nexus/workflow-instance/v2',
    id,
    workflow_id: workflow.workflow_id,
    workflow_description: workflow.description,
    domain,
    status: 'intake',
    created_at: now(),
    updated_at: now(),
    revision: 0,
    data_version: dataVersion(context.workspaceRoot),
    input: body.payload && typeof body.payload === 'object' ? body.payload : {},
    analysis: null,
    quality: null,
    approvals: [],
    artifacts: [],
    stages: buildStages(workflow, context.bundleRoot),
    backup: { id: path.basename(backup.dir), files: backup.fileCount, bytes: backup.bytes },
    last_error: null,
  };
  saveInstance(context.workspaceRoot, instance);
  appendAudit(context.workspaceRoot, 'workflow.instance.start', { instance_id: id, workflow_id: workflow.workflow_id, domain, backup: instance.backup.id });
  context.audit?.('workflow.instance.start', { instance_id: id, workflow_id: workflow.workflow_id, domain });
  return instance;
}

function submitInput(context, workflow, model, instance, body) {
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
  instance.input = { ...instance.input, ...payload };
  const errors = validateInput(workflow, model, instance.input);
  if (errors.length) throw new Error(errors.join('；'));
  const intake = instance.stages.find((stage) => stage.id === 'intake');
  intake.status = 'passed';
  intake.started_at = intake.started_at || now();
  intake.finished_at = now();
  instance.status = 'ready';
  instance.last_error = null;
  return instance;
}

function approve(context, workflow, instance, body) {
  const approvalStage = requireApproval(instance);
  if (!approvalStage) throw new Error('该工作流不需要人工审批');
  const decision = String(body.decision || 'approved').toLowerCase();
  const role = String(body.role || '').trim();
  const operatorId = String(body.operatorId || body.operator_id || '').trim();
  const legacyOperator = String(body.operator || '').trim();
  const comment = String(body.comment || '').trim();
  if (!role) throw new Error('审批角色必填');
  if (!operatorId && !legacyOperator) throw new Error('操作者身份必填');
  if (decision === 'rejected' && !comment) throw new Error('驳回必须填写原因');
  if (!['approved', 'rejected'].includes(decision)) throw new Error('审批决定必须是 approved 或 rejected');
  const registry = loadOperators(context.workspaceRoot);
  const normalizedLegacy = legacyOperator ? legacyOperator.toUpperCase() : '';
  const operator = registry.operators.find((item) =>
    item.id === (operatorId || normalizedLegacy).toUpperCase()
    || item.display_name === legacyOperator);
  if (!operator) throw new Error('审批操作者未在本地身份注册表中登记');
  if (operator.status !== 'active') throw new Error('审批操作者已停用');
  if (!(operator.roles || []).includes('*') && !(operator.roles || []).includes(role)) {
    throw new Error(`操作者 ${operator.id} 不具备角色：${role}`);
  }
  if (Array.isArray(approvalStage.requiredRoles) && approvalStage.requiredRoles.length
    && !approvalStage.requiredRoles.includes(role)) {
    throw new Error(`审批角色不在流程授权范围：${role}`);
  }
  if (instance.approvals.some((item) => item.operator_id === operator.id)) {
    throw new Error('同一操作者不能在同一实例中重复完成多级审批');
  }
  const { key, key_id } = signingMaterial(context.workspaceRoot);
  const record = {
    workflow_id: instance.workflow_id,
    instance_id: instance.id,
    revision: Number(instance.revision || 0) + 1,
    data_version: instance.data_version,
    artifact_hash: approvalDraftHash(instance),
    operator_id: operator.id,
    operator_name: operator.display_name,
    role,
    decision,
    comment,
    at: now(),
    key_id,
  };
  record.signature = approvalSignature(instance, record, key);
  instance.approvals.push(record);
  if (decision === 'rejected') {
    approvalStage.status = 'rejected';
    approvalStage.finished_at = now();
    instance.status = 'rejected';
    instance.last_error = comment;
    return instance;
  }
  const required = approvalStage.approvalCount || 1;
  const approved = instance.approvals.filter((item) => item.decision === 'approved');
  const uniqueRoles = new Set(approved.map((item) => item.role));
  const uniqueOperators = new Set(approved.map((item) => item.operator_id));
  if (approved.length < required) {
    instance.status = 'awaiting_approval';
    return instance;
  }
  if (required > 1 && (uniqueRoles.size < required || uniqueOperators.size < required)) {
    throw new Error('双审批必须使用两个不同角色和两个不同操作者');
  }
  approvalStage.status = 'passed';
  approvalStage.finished_at = now();
  instance.status = 'approved';
  return instance;
}

export async function actInstance(context, body = {}) {
  const id = safeId(body.id || body.instanceId, 'instanceId');
  const instance = loadInstance(context.workspaceRoot, id);
  assertApprovalIntegrity(context.workspaceRoot, instance);
  const workflow = findWorkflow(context.bundleRoot, instance.workflow_id);
  const model = domainModel(context.bundleRoot, instance.domain);
  const action = String(body.action || '').trim();
  if (!action) throw new Error('action 必填');
  const backup = createBackup(context.workspaceRoot, `${action}:${instance.workflow_id}`, instance.id);
  instance.last_backup = { id: path.basename(backup.dir), files: backup.fileCount, bytes: backup.bytes, at: now() };
  let next;
  if (action === 'submit_input') {
    next = await runUntilBlocked(context, workflow, model, submitInput(context, workflow, model, instance, body));
  } else if (action === 'run' || action === 'retry' || action === 'resume') {
    for (const stage of instance.stages) {
      if (stage.status === 'blocked' || stage.status === 'failed') {
        stage.status = stage.id === 'intake' ? 'ready' : 'pending';
        stage.error = null;
      }
    }
    instance.status = 'running';
    instance.last_error = null;
    next = await runUntilBlocked(context, workflow, model, instance);
  } else if (action === 'approve' || action === 'reject') {
    const approved = approve(context, workflow, instance, {
      ...body,
      decision: action === 'reject' ? 'rejected' : (body.decision || 'approved'),
    });
    next = approved.status === 'rejected'
      ? saveInstance(context.workspaceRoot, approved)
      : await runUntilBlocked(context, workflow, model, approved);
  } else if (action === 'archive') {
    instance.status = 'archived';
    next = saveInstance(context.workspaceRoot, instance);
  } else {
    throw new Error(`不支持的 action：${action}`);
  }
  appendAudit(context.workspaceRoot, `workflow.instance.${action}`, {
    instance_id: instance.id,
    workflow_id: workflow.workflow_id,
    status: next.status,
    backup: instance.last_backup.id,
  });
  context.audit?.(`workflow.instance.${action}`, { instance_id: instance.id, workflow_id: workflow.workflow_id, status: next.status });
  return next;
}

export function importDomainTable(context, body = {}) {
  const domain = safeSegment(body.domain, 'domain');
  if (!DOMAIN_IDS.includes(domain)) throw new Error(`未知域：${domain}`);
  const table = safeSegment(String(body.table || '').replace(/\.csv$/i, ''), 'table');
  const csv = String(body.csv || '');
  if (!csv.trim()) throw new Error('CSV 内容不能为空');
  const parsed = parseCsvText(csv);
  if (!parsed.length) throw new Error('CSV 至少需要一行数据');
  const backup = createBackup(context.workspaceRoot, `import:${domain}/${table}`, `import-${Date.now()}`);
  const target = path.join(context.workspaceRoot, 'data', domain, `${table}.csv`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, csv.endsWith('\n') ? csv : `${csv}\n`, 'utf8');
  const result = {
    ok: true,
    domain,
    table: `${table}.csv`,
    rows: parsed.length,
    bytes: fs.statSync(target).size,
    sha256: sha256File(target),
    backup: path.basename(backup.dir),
    data_version: dataVersion(context.workspaceRoot),
  };
  appendAudit(context.workspaceRoot, 'data.import', result);
  context.audit?.('data.import', result);
  return result;
}

export function createWorkbenchPlatform(options) {
  const bundleRoot = path.resolve(options.root);
  const workspaceRoot = ensureWorkspace({ bundleRoot, workspaceRoot: options.workspaceRoot });
  const context = {
    bundleRoot,
    workspaceRoot,
    audit: options.audit,
    runEngine: options.runEngine,
    deliverDomain: options.deliverDomain,
  };
  return {
    context,
    workspaceRoot,
    ensureWorkspace: () => ensureWorkspace({ bundleRoot, workspaceRoot }),
    strategy: (query = {}) => getStrategyOverview(context, query),
    metrics: (query = {}) => listMetrics(context, query),
    backups: () => listBackups(context),
    definitions: () => listWorkflowDefinitions(context),
    workDesign: (domain) => getDomainWorkDesign(context, domain),
    operators: () => listOperators(context),
    upsertOperator: (body) => upsertOperator(context, body),
    listInstances: (query = {}) => listInstances(workspaceRoot, query),
    getInstance: (id) => getInstance(context, id),
    resolveInstanceArtifact: (id, file) => resolveInstanceArtifact(context, id, file),
    start: (body) => startInstance(context, body),
    act: (body) => actInstance(context, body),
    importTable: (body) => importDomainTable(context, body),
    backup: (reason, traceId) => createBackup(workspaceRoot, reason, traceId),
  };
}
