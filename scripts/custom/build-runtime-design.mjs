#!/usr/bin/env node
// build-runtime-design.mjs — 通用设计生成器：为运行时新增域产出最小可用设计
// 用法（在 staging 根运行）：node scripts/custom/build-runtime-design.mjs --domain cust-learning --label "学习运营" --out-dir custom-out
// 产出：<out-dir>/design.json（与既有 domain-work-design 同形）+ <out-dir>/workflow-entries.json（本域工作流条目）
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../scene-loader.mjs';

const argv = process.argv.slice(2);
const argOf = (name, fallback = null) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
};

const ROOT = process.cwd();
const domain = String(argOf('--domain', '')).trim();
if (!/^[a-z][a-z0-9-]{1,23}$/.test(domain)) {
  console.error('RUNTIME_DESIGN_FAIL domain 非法');
  process.exit(2);
}
const label = argOf('--label', domain);
const outDir = path.resolve(ROOT, argOf('--out-dir', 'custom-out'));

const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflows/index.json'), 'utf8'));
const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/domain-model', `${domain}.json`), 'utf8'));
const workflows = (index.workflows || []).filter((item) => item.domain === domain);
if (!workflows.length) {
  console.error(`RUNTIME_DESIGN_FAIL 域 ${domain} 没有工作流条目（需提供 manifests/workflows/${domain}.workflows.json）`);
  process.exit(1);
}

function sceneFor(id) {
  const dir = path.join(ROOT, 'manifests/scenes');
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.yaml'))) {
    const prefix = file.split('.')[0];
    const doc = parseYaml(fs.readFileSync(path.join(dir, file), 'utf8'));
    const docId = prefix === 'er' || prefix === 'eap' ? 'er-eap' : prefix;
    if (docId === id) return { file, scene: doc };
  }
  return null;
}
const sceneInfo = sceneFor(domain);
const level = model.level || sceneInfo?.scene?.policies?.permission?.min_level || 'L2';
const northStar = `${label}成效（运行时工作台）`;

const STAGE_BASE = {
  entry_criteria: '上游阶段通过且实例 revision、策略版本和数据版本可读取',
  evidence: ['source_refs', 'file_hashes', 'data_version'],
  timeout_seconds: 300,
  retry_policy: { max_attempts: 1, backoff: 'none' },
  idempotency_key: '${instance_id}:${stage_id}:${revision}',
  ui_help: '按字段说明填写；来源必须引用具体表、文件或上游实例。',
  failure_severity: 'blocking',
};

function stageForNode(node, indexNo, workflow, itemId) {
  const base = { ...STAGE_BASE, owner_role: '业务负责人', input_contract_ref: `runtime://${domain}/${workflow.workflow_id}/intake`, output_contract_ref: `runtime://${domain}/${workflow.workflow_id}/outcome` };
  if (node.type === 'skill') {
    return { ...base, id: `n${indexNo}-llm`, type: 'llm_task', name: `技能执行 · ${node.ref || workflow.skill}`, outputs: ['llm_result'], standard: '按技能说明执行，保留输入证据与结果快照。', gate: 'model_quality_gate', on_fail: 'blocked_model_or_quality_retry' };
  }
  if (node.type === 'condition') {
    return { ...base, id: `n${indexNo}-rule`, type: 'rule_gate', name: '业务条件判断', outputs: ['rule_decision'], standard: '按域规则与 TypeDict 校验，不得跳过。', gate: 'typedict_and_domain_rules', on_fail: 'field_level_error_without_write' };
  }
  if (node.type === 'approval') {
    const dual = !!(node.dual || workflow.dual);
    const roles = node.required_roles && node.required_roles.length
      ? node.required_roles
      : dual ? ['业务负责人', '风险负责人'] : ['业务负责人'];
    return { ...base, id: `n${indexNo}-approval`, type: 'human_approval', name: `人工审批（${node.level || level}${dual ? ' · 双审批' : ''}）`, outputs: ['approval_record'], standard: '审批人签名绑定实例、数据版本与草稿哈希；驳回原因必填。', gate: dual ? 'dual_approval' : 'single_approval', on_fail: 'reject_and_preserve_draft', required_roles: roles, dual, node: node.id, rule_refs: [`${itemId}-APPROVAL`] };
  }
  if (node.type === 'tool') {
    return { ...base, id: `n${indexNo}-publish`, type: 'writeback_and_delivery', name: '产出与交付', outputs: ['artifact_manifest'], standard: '产出物入交付中心并登记哈希；失败回滚到写前快照。', gate: 'artifact_manifest', on_fail: 'rollback_to_pre_write_snapshot' };
  }
  return null;
}

function itemFor(workflow) {
  const stem = workflow.workflow_id.split('@')[0].split('.')[1];
  const itemId = `${domain}-${stem}`;
  const fields = (workflow.deliverable && workflow.deliverable.fields) || [];
  const stages = [
    {
      ...STAGE_BASE,
      owner_role: '业务负责人',
      id: 'intake',
      type: 'data_intake',
      name: '业务输入与资料接收',
      inputs: fields,
      outputs: ['validated_input_payload', 'source_refs', 'file_hashes'],
      standard: fields.length ? `必填字段 ${fields.join('、')} 完整；来源、数据版本与文件哈希可追溯。` : '输入需说明来源与数据版本，文件哈希可追溯。',
      gate: 'required_fields_and_upload_safety',
      on_fail: 'retain_draft_and_request_user_input',
      rule_refs: [`${itemId}-INPUT-REQUIRED`, `${itemId}-SOURCE-TRACEABLE`],
    },
  ];
  (workflow.nodes || []).forEach((node, i) => {
    const stage = stageForNode(node, i + 1, workflow, itemId);
    if (stage) stages.push(stage);
  });
  stages.push({
    ...STAGE_BASE,
    owner_role: '业务负责人',
    id: 'strategy_rollup',
    type: 'strategy_writeback',
    name: '回写成效与决策证据',
    outputs: ['outcome_record'],
    standard: '回写域北极星成效并链接决策证据；指标溯源可用。',
    gate: 'outcome_evidence',
    on_fail: 'mark_outcome_pending',
    rule_refs: [`${itemId}-OUTCOME`],
  });
  const approval = (workflow.nodes || []).find((node) => node.type === 'approval') || null;
  return {
    id: itemId,
    name: workflow.description,
    outcome: (workflow.deliverable && workflow.deliverable.acceptance) || '按交付规范产出并留痕',
    owner_role: '业务负责人',
    frequency: '按需',
    workflow: {
      id: workflow.workflow_id,
      description: workflow.description,
      kind: workflow.kind,
      skill: workflow.skill,
      trigger: workflow.trigger || null,
      nodes: workflow.nodes || [],
      deliverable: workflow.deliverable,
      approval: approval ? { node: approval.id, level: approval.level || level, dual: !!(approval.dual || workflow.dual) } : null,
    },
    stages,
    business_rules: [{ id: `${itemId}-DOMAIN-RULE`, kind: 'domain_rule', status: 'active', statement: '运行时工作台：按域规则与交付规范执行。' }],
    cross_domain_effects: [],
    data_contract: {
      input: { fields: fields.map((field) => ({ field, required: true })) },
      output: { fields: ((workflow.deliverable && workflow.deliverable.fields) || []).map((field) => ({ field })) },
    },
    controls: { gate: 'runtime_design', note: '运行时生成的最小设计（未固化）' },
    metrics: {},
    benchmark_refs: [],
  };
}

const design = {
  schema: 'pids-nexus/domain-work-design/v1',
  domain,
  label: model.label || label,
  level,
  north_star: northStar,
  contributes_to: [],
  modules: [
    {
      id: `${domain}-ops`,
      name: `${model.label || label} · 工作台`,
      outcome: `把${model.label || label}的业务流程、数据与审批纳入统一工作台`,
      benchmark_refs: [],
      items: workflows.map(itemFor),
    },
  ],
  benchmark_refs: [],
  runtime: { generated: true, note: '由 build-runtime-design.mjs 生成的最小可用设计（运行时装订）' },
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'design.json'), `${JSON.stringify(design, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(outDir, 'workflow-entries.json'), `${JSON.stringify(workflows, null, 2)}\n`, 'utf8');
const stageCount = design.modules[0].items.reduce((sum, item) => sum + item.stages.length, 0);
console.log(`RUNTIME_DESIGN_OK domain=${domain} items=${design.modules[0].items.length} stages=${stageCount}`);
