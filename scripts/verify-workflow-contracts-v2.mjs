#!/usr/bin/env node
// R12 workflow contract and recovery matrix: 78 workflows x 7 paths plus approval integrity.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createWorkbenchPlatform, ensureWorkspace } from '../workbench-ui-plugin/lib/platform.mjs';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const matrixSpec = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflow-tests/index.json'), 'utf8'));
const workspaceRoot = path.resolve(process.env.PIDSH_CONTRACT_WORKSPACE || path.join(ROOT, '.work', `r12-contract-${Date.now()}`));
process.env.UNIVERSAL_WORKBENCH_QA_WORKSPACE = workspaceRoot;
process.env.WORKBENCH_ALLOW_MODEL_STUB = '1';
process.env.WORKBENCH_TEST_FORMATS = 'md';
ensureWorkspace({ bundleRoot: ROOT, workspaceRoot });

const delivery = require('../workbench-ui-plugin/lib/delivery-service.cjs').createDeliveryService({
  root: ROOT,
  workspaceRoot,
  audit: () => {},
});
const platform = createWorkbenchPlatform({
  root: ROOT,
  workspaceRoot,
  audit: () => {},
  deliverDomain: (options) => delivery.deliverDomain(options),
});

const definitions = platform.definitions();
const allRoles = [...new Set(definitions.flatMap((definition) =>
  definition.stages.flatMap((stage) => stage.requiredRoles || []),
))];
for (const [id, displayName] of [
  ['QA-OP-1', 'QA 审批人甲'],
  ['QA-OP-2', 'QA 审批人乙'],
  ['QA-OP-3', 'QA 审批人丙'],
]) {
  platform.upsertOperator({ id, displayName, roles: allRoles });
}

const records = [];
const record = (workflowId, caseId, pass, note = '') => {
  records.push({ workflow_id: workflowId, case_id: caseId, pass: !!pass, note: String(note) });
};

function payloadFor(definition, mutate = false) {
  const payload = {};
  const fields = definition.deliverable?.fields || [];
  for (const [index, field] of fields.entries()) {
    if (mutate && index === 0) continue;
    if (/amount|budget|cost|revenue|net|total|qty|count|hours|days|score|rate|pct|progress|salary|price/i.test(field)) payload[field] = 1;
    else if (/date|period|month|quarter|week|year/i.test(field)) payload[field] = '2026-Q4';
    else if (/approvals?/i.test(field)) payload[field] = 'pending';
    else if (/flag/i.test(field)) payload[field] = 'true';
    else payload[field] = 'QA';
  }
  payload.notes = 'R12 workflow contract fixture';
  payload.source_refs = ['fixture:r12-contract'];
  return payload;
}

function approvalRoles(definition, operatorIndex) {
  const stage = definition.stages.find((item) => item.type === 'approval');
  const roles = stage?.requiredRoles || [];
  return roles[operatorIndex] || roles[0] || '业务负责人';
}

async function advanceApprovals(instance, definition) {
  let current = instance;
  let index = 0;
  while (current.status === 'awaiting_approval' && index < 2) {
    current = await platform.act({
      id: current.id,
      action: 'approve',
      role: approvalRoles(definition, index),
      operatorId: index === 0 ? 'QA-OP-1' : 'QA-OP-2',
      comment: 'R12 matrix approve',
    });
    index += 1;
  }
  return current;
}

async function runNormal(definition) {
  let instance = platform.start({ workflowId: definition.workflow_id, payload: payloadFor(definition) });
  instance = await platform.act({ id: instance.id, action: 'submit_input', payload: payloadFor(definition) });
  instance = await advanceApprovals(instance, definition);
  return {
    pass: instance.status === 'completed' && (instance.artifacts || []).length >= 2,
    note: `status=${instance.status} artifacts=${(instance.artifacts || []).length}`,
    instance,
  };
}

async function runValidationReject(definition) {
  let instance = platform.start({ workflowId: definition.workflow_id, payload: {} });
  try {
    instance = await platform.act({ id: instance.id, action: 'submit_input', payload: payloadFor(definition, true) });
    return { pass: false, note: `unexpected status=${instance.status}` };
  } catch (error) {
    return { pass: /必填字段|未知输入字段/.test(String(error.message || error)), note: String(error.message || error) };
  }
}

async function runApprovalReject(definition) {
  const hasApproval = definition.stages.some((stage) => stage.type === 'approval');
  if (!hasApproval) return { pass: true, note: 'not_applicable' };
  let instance = platform.start({ workflowId: definition.workflow_id, payload: payloadFor(definition) });
  instance = await platform.act({ id: instance.id, action: 'submit_input', payload: payloadFor(definition) });
  instance = await platform.act({
    id: instance.id,
    action: 'reject',
    role: approvalRoles(definition, 0),
    operatorId: 'QA-OP-1',
    comment: 'R12 matrix reject',
  });
  return { pass: instance.status === 'rejected', note: `status=${instance.status}` };
}

async function runDualApprovalMissing(definition) {
  const stage = definition.stages.find((item) => item.type === 'approval');
  if (!stage || stage.approvalCount < 2) return { pass: true, note: 'not_applicable' };
  let instance = platform.start({ workflowId: definition.workflow_id, payload: payloadFor(definition) });
  instance = await platform.act({ id: instance.id, action: 'submit_input', payload: payloadFor(definition) });
  instance = await platform.act({
    id: instance.id,
    action: 'approve',
    role: approvalRoles(definition, 0),
    operatorId: 'QA-OP-1',
    comment: 'first approval',
  });
  try {
    await platform.act({
      id: instance.id,
      action: 'approve',
      role: approvalRoles(definition, 1),
      operatorId: 'QA-OP-1',
      comment: 'same operator duplicate',
    });
    return { pass: false, note: 'same operator was accepted' };
  } catch (error) {
    const current = platform.getInstance(instance.id);
    return {
      pass: current.status === 'awaiting_approval' && /同一操作者|双审批/.test(String(error.message || error)),
      note: String(error.message || error),
    };
  }
}

async function runModelFailureResume(definition) {
  process.env.WORKBENCH_ALLOW_MODEL_STUB = '0';
  let instance = platform.start({ workflowId: definition.workflow_id, payload: payloadFor(definition) });
  instance = await platform.act({ id: instance.id, action: 'submit_input', payload: payloadFor(definition) });
  const blocked = instance.status === 'blocked_model';
  process.env.WORKBENCH_ALLOW_MODEL_STUB = '1';
  instance = await platform.act({ id: instance.id, action: 'retry' });
  instance = await advanceApprovals(instance, definition);
  return { pass: blocked && instance.status === 'completed', note: `blocked=${blocked} final=${instance.status}` };
}

async function runSensitiveBlock(definition) {
  process.env.WORKBENCH_ALLOW_MODEL_STUB = '0';
  const sensitive = createWorkbenchPlatform({
    root: ROOT,
    workspaceRoot,
    audit: () => {},
    runEngine: async () => ({
      fallback: false,
      output: JSON.stringify({
        summary: 'sensitive',
        findings: [{ id: 'f1', title: 'phone', detail: '13812345678', severity: 'critical' }],
        recommendations: [{ id: 'r1', title: 'remove', detail: 'remove PII' }],
        confidence: 0.9,
        evidence_refs: ['input:notes'],
        redactions: [],
      }),
    }),
    deliverDomain: (options) => delivery.deliverDomain(options),
  });
  let instance = sensitive.start({ workflowId: definition.workflow_id, payload: payloadFor(definition) });
  instance = await sensitive.act({ id: instance.id, action: 'submit_input', payload: payloadFor(definition) });
  process.env.WORKBENCH_ALLOW_MODEL_STUB = '1';
  return { pass: instance.status === 'blocked_model' && /敏感字段/.test(instance.last_error || ''), note: instance.last_error || '' };
}

async function runRestartResume(definition) {
  process.env.WORKBENCH_ALLOW_MODEL_STUB = '0';
  let instance = platform.start({ workflowId: definition.workflow_id, payload: payloadFor(definition) });
  instance = await platform.act({ id: instance.id, action: 'submit_input', payload: payloadFor(definition) });
  if (instance.status !== 'blocked_model') return { pass: false, note: `pre-restart status=${instance.status}` };
  process.env.WORKBENCH_ALLOW_MODEL_STUB = '1';
  const restarted = createWorkbenchPlatform({
    root: ROOT,
    workspaceRoot,
    audit: () => {},
    deliverDomain: (options) => delivery.deliverDomain(options),
  });
  instance = await restarted.act({ id: instance.id, action: 'retry' });
  instance = await advanceApprovals(instance, definition);
  return { pass: instance.status === 'completed', note: `final=${instance.status}` };
}

async function verifyApprovalIntegrity() {
  const definition = definitions.find((item) => item.stages.some((stage) => stage.type === 'approval'));
  const first = (await runNormal(definition)).instance;
  const second = (await runNormal(definition)).instance;
  const file = path.join(workspaceRoot, 'instances', first.id, 'instance.json');
  const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
  persisted.approvals[0].comment = 'tampered';
  fs.writeFileSync(file, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  let tamperBlocked = false;
  try {
    platform.getInstance(first.id);
  } catch (error) {
    tamperBlocked = /签名校验失败/.test(String(error.message || error));
  }
  record('APPROVAL-INTEGRITY', 'tamper', tamperBlocked, tamperBlocked ? 'signature rejected' : 'tamper accepted');

  const secondFile = path.join(workspaceRoot, 'instances', second.id, 'instance.json');
  const secondData = JSON.parse(fs.readFileSync(secondFile, 'utf8'));
  secondData.approvals[0] = JSON.parse(fs.readFileSync(file, 'utf8')).approvals[0];
  fs.writeFileSync(secondFile, `${JSON.stringify(secondData, null, 2)}\n`, 'utf8');
  let replayBlocked = false;
  try {
    platform.getInstance(second.id);
  } catch (error) {
    replayBlocked = /签名校验失败/.test(String(error.message || error));
  }
  record('APPROVAL-INTEGRITY', 'cross-instance-replay', replayBlocked, replayBlocked ? 'signature rejected' : 'replay accepted');
}

function verifyLegacyApprovalMigration() {
  const legacyRoot = path.join(ROOT, '.work', `r12-legacy-migration-${Date.now()}`);
  ensureWorkspace({ bundleRoot: ROOT, workspaceRoot: legacyRoot });
  const id = 'WI-LEGACY-TEST';
  const file = path.join(legacyRoot, 'instances', id, 'instance.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({
    schema: 'pids-nexus/workflow-instance/v2',
    id,
    workflow_id: 'rec.offer-approve@1.0.0',
    domain: 'rec',
    status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revision: 1,
    data_version: 'legacy-data-version',
    input: {},
    approvals: [{ role: 'HRD', operator: 'legacy-user', decision: 'approved', comment: 'old', at: new Date().toISOString() }],
    artifacts: [],
    stages: [],
  }, null, 2)}\n`, 'utf8');
  ensureWorkspace({ bundleRoot: ROOT, workspaceRoot: legacyRoot });
  const migrated = JSON.parse(fs.readFileSync(file, 'utf8'));
  const backups = fs.existsSync(path.join(legacyRoot, 'backups'))
    ? fs.readdirSync(path.join(legacyRoot, 'backups')).filter((name) => /r12-approval-migration/.test(name))
    : [];
  record(
    'APPROVAL-INTEGRITY',
    'legacy-migration',
    migrated.approvals.length === 0
      && migrated.legacy_approvals.length === 1
      && migrated.approval_integrity === 'legacy_unverified'
      && backups.length === 1,
    `legacy=${migrated.legacy_approvals?.length || 0} backups=${backups.length}`,
  );
}

const runners = {
  normal: runNormal,
  validation_reject: runValidationReject,
  approval_reject: runApprovalReject,
  dual_approval_missing: runDualApprovalMissing,
  model_failure_resume: runModelFailureResume,
  sensitive_egress_block: runSensitiveBlock,
  restart_resume: runRestartResume,
};

if (!process.argv.includes('--quick-integrity')) {
  for (const definition of definitions) {
    for (const caseId of Object.keys(runners)) {
      try {
        const result = await runners[caseId](definition);
        record(definition.workflow_id, caseId, result.pass, result.note);
      } catch (error) {
        record(definition.workflow_id, caseId, false, String(error.stack || error.message || error));
      }
    }
  }
}

await verifyApprovalIntegrity();
verifyLegacyApprovalMigration();

const failures = records.filter((item) => !item.pass);
const report = {
  schema: 'pids-nexus/workflow-contract-verification/v2',
  generated_at: new Date().toISOString(),
  workspace_root: workspaceRoot,
  expected_cases: matrixSpec.case_count,
  executed_cases: records.filter((item) => item.workflow_id !== 'APPROVAL-INTEGRITY').length,
  passed: records.length - failures.length,
  failed: failures.length,
  pass: failures.length === 0,
  records,
};
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/r12-workflow-contracts.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(ROOT, 'reports/r12-workflow-contracts.md'), [
  '# R12 Workflow Contract Matrix',
  '',
  `- Result: ${report.pass ? 'PASS' : 'FAIL'}`,
  `- Expected workflow cases: ${report.expected_cases}`,
  `- Executed workflow cases: ${report.executed_cases}`,
  `- Approval integrity cases: ${records.length - report.executed_cases}`,
  `- Passed: ${report.passed}/${records.length}`,
  `- Failed: ${report.failed}`,
  '',
].join('\n'), 'utf8');
console.log(`WORKFLOW_CONTRACTS_V2 ${report.pass ? 'PASS' : 'FAIL'} ${report.passed}/${records.length} -> reports/r12-workflow-contracts.json`);
if (!report.pass) process.exit(1);
