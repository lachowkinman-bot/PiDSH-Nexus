#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createWorkbenchPlatform, ensureWorkspace, resolveWorkspaceRoot } from '../workbench-ui-plugin/lib/platform.mjs';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(
  process.env.WORKBENCH_PLATFORM_TEST_ROOT
  || path.join(ROOT, '.work', `qa-platform-${Date.now()}`),
);
process.env.UNIVERSAL_WORKBENCH_QA_WORKSPACE = workspaceRoot;
process.env.WORKBENCH_ALLOW_MODEL_STUB = '1';
process.env.WORKBENCH_TEST_FORMATS = 'md';

ensureWorkspace({ bundleRoot: ROOT, workspaceRoot });
const delivery = require('../workbench-ui-plugin/lib/delivery-service.cjs').createDeliveryService({
  root: ROOT,
  workspaceRoot,
  audit: () => {},
});

const records = [];
const record = (id, pass, note = '') => {
  records.push({ id, pass: !!pass, note: String(note) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${note}`);
};

const platform = createWorkbenchPlatform({
  root: ROOT,
  workspaceRoot,
  audit: () => {},
  deliverDomain: (options) => delivery.deliverDomain(options),
});

platform.upsertOperator({
  id: 'QA-BIZ-01',
  displayName: 'QA 业务审批人',
  roles: ['业务负责人', '部门负责人', '招聘负责人', '财务负责人'],
});
platform.upsertOperator({
  id: 'QA-RISK-01',
  displayName: 'QA 风险审批人',
  roles: ['风险负责人', '合规负责人', 'HRD', 'CFO'],
});

const definitions = platform.definitions();
const allRequiredRoles = [...new Set(definitions.flatMap((item) =>
  item.stages.flatMap((stage) => stage.requiredRoles || []),
))];
platform.upsertOperator({ id: 'QA-BIZ-01', displayName: 'QA 业务审批人', roles: allRequiredRoles });
platform.upsertOperator({ id: 'QA-RISK-01', displayName: 'QA 风险审批人', roles: allRequiredRoles });
record('definitions.count', definitions.length === 78, `count=${definitions.length}`);
record(
  'definitions.stages',
  definitions.every((item) => item.stages.length >= 7 && item.stages.some((stage) => stage.type === 'llm')),
  `minStages=${Math.min(...definitions.map((item) => item.stages.length))}`,
);

const strategy = platform.strategy();
record('strategy.domains', strategy.domains.length === 13, `domains=${strategy.domains.length}`);
record('strategy.keyResults', strategy.key_results.length === 5, `krs=${strategy.key_results.length}`);
record('strategy.lineage', strategy.data_version && strategy.domains.every((item) => item.source), `version=${strategy.data_version}`);

function payloadFor(definition) {
  const payload = {};
  for (const field of definition.deliverable?.fields || []) {
    if (/amount|budget|cost|revenue|net|total|qty|count|hours|days|score|rate|pct|progress/i.test(field)) payload[field] = 1;
    else if (/date|period|month|quarter|week|year/i.test(field)) payload[field] = '2026-Q4';
    else if (/approvals?/i.test(field)) payload[field] = 'pending';
    else if (/flag/i.test(field)) payload[field] = 'true';
    else payload[field] = 'QA';
  }
  payload.notes = 'platform verification fixture';
  payload.source_refs = ['fixture:platform'];
  return payload;
}

const noApproval = definitions.find((item) => !item.hitl_nodes?.length && item.kind !== 'approve');
if (!noApproval) throw new Error('找不到无审批工作流');
let instance = platform.start({ workflowId: noApproval.workflow_id, payload: payloadFor(noApproval) });
instance = await platform.act({ id: instance.id, action: 'submit_input', payload: payloadFor(noApproval) });
record('workflow.normal.complete', instance.status === 'completed', `${noApproval.workflow_id} status=${instance.status}`);
record('workflow.normal.artifacts', instance.artifacts.length >= 2, `artifacts=${instance.artifacts.length}`);
record('workflow.normal.strategy', platform.metrics({ domain: noApproval.domain }).length > 0, `metrics=${platform.metrics({ domain: noApproval.domain }).length}`);

const approval = definitions.find((item) => item.dual && item.hitl_nodes?.length);
if (!approval) throw new Error('找不到双审批工作流');
const approvalStage = approval.stages.find((stage) => stage.type === 'approval');
let approvalInstance = platform.start({ workflowId: approval.workflow_id, payload: payloadFor(approval) });
approvalInstance = await platform.act({
  id: approvalInstance.id,
  action: 'submit_input',
  payload: payloadFor(approval),
});
record('workflow.approval.awaiting', approvalInstance.status === 'awaiting_approval', `status=${approvalInstance.status}`);
let sameApproverBlocked = false;
try {
  await platform.act({
    id: approvalInstance.id,
    action: 'approve',
    role: approvalStage.requiredRoles?.[0] || '业务负责人',
    operatorId: 'QA-RISK-01',
    comment: 'QA approve',
  });
  await platform.act({
    id: approvalInstance.id,
    action: 'approve',
    role: approvalStage.requiredRoles?.[0] || '业务负责人',
    operatorId: 'QA-RISK-01',
    comment: 'QA duplicate approve',
  });
} catch (error) {
  sameApproverBlocked = /双审批|同一操作者/.test(String(error.message || error));
}
record('workflow.approval.duplicate-blocked', sameApproverBlocked, `workflow=${approval.workflow_id}`);

approvalInstance = platform.start({ workflowId: approval.workflow_id, payload: payloadFor(approval) });
approvalInstance = await platform.act({
  id: approvalInstance.id,
  action: 'submit_input',
  payload: payloadFor(approval),
});
await platform.act({
  id: approvalInstance.id,
  action: 'approve',
  role: approvalStage.requiredRoles?.[0] || '业务负责人',
  operatorId: 'QA-BIZ-01',
  comment: '业务通过',
});
approvalInstance = await platform.act({
  id: approvalInstance.id,
  action: 'approve',
  role: approvalStage.requiredRoles?.[1] || '风险负责人',
  operatorId: 'QA-RISK-01',
  comment: '风险通过',
});
record('workflow.approval.complete', approvalInstance.status === 'completed', `status=${approvalInstance.status}`);

process.env.WORKBENCH_ALLOW_MODEL_STUB = '0';
const blocked = platform.start({ workflowId: noApproval.workflow_id, payload: payloadFor(noApproval) });
const blockedResult = await platform.act({
  id: blocked.id,
  action: 'submit_input',
  payload: payloadFor(noApproval),
});
record('workflow.model.blocked', blockedResult.status === 'blocked_model', `status=${blockedResult.status} error=${blockedResult.last_error || ''}`);
process.env.WORKBENCH_ALLOW_MODEL_STUB = '1';
const resumed = await platform.act({ id: blocked.id, action: 'retry' });
record('workflow.model.resume', resumed.status === 'completed', `status=${resumed.status}`);

process.env.WORKBENCH_ALLOW_MODEL_STUB = '0';
const sensitivePlatform = createWorkbenchPlatform({
  root: ROOT,
  workspaceRoot,
  audit: () => {},
  runEngine: async () => ({
    fallback: false,
    output: JSON.stringify({
      summary: 'sensitive output',
      findings: [{ id: 'f1', title: 'PII', detail: '联系 13812345678', severity: 'critical' }],
      recommendations: [{ id: 'a1', title: 'remove', detail: 'remove raw PII' }],
      confidence: 0.9,
      evidence_refs: ['input:notes'],
      redactions: [],
      narrative: 'sensitive',
    }),
  }),
  deliverDomain: (options) => delivery.deliverDomain(options),
});
const sensitive = sensitivePlatform.start({ workflowId: noApproval.workflow_id, payload: payloadFor(noApproval) });
const sensitiveResult = await sensitivePlatform.act({
  id: sensitive.id,
  action: 'submit_input',
  payload: payloadFor(noApproval),
});
record(
  'workflow.sensitive-output.blocked',
  sensitiveResult.status === 'blocked_model' && /敏感字段/.test(sensitiveResult.last_error || ''),
  `status=${sensitiveResult.status} error=${sensitiveResult.last_error || ''}`,
);

record('backups.created', platform.backups().length > 0, `count=${platform.backups().length}`);
record('workspace.override', resolveWorkspaceRoot(ROOT) === workspaceRoot, workspaceRoot);
const beforeImportVersion = platform.strategy().data_version;
const imported = platform.importTable({
  domain: 'rec',
  table: 'qa_import',
  csv: 'id,value\n1,QA\n',
});
record('data.import.backup', imported.rows === 1 && imported.backup, `backup=${imported.backup}`);
record('data.import.version', platform.strategy().data_version !== beforeImportVersion, `before=${beforeImportVersion.slice(0, 12)} after=${platform.strategy().data_version.slice(0, 12)}`);

process.env.WORKBENCH_ALLOW_MODEL_STUB = '1';
const matrix = [];
for (const definition of definitions) {
  try {
    let item = platform.start({ workflowId: definition.workflow_id, payload: payloadFor(definition) });
    item = await platform.act({
      id: item.id,
      action: 'submit_input',
      payload: payloadFor(definition),
    });
    let approvalIndex = 0;
    while (item.status === 'awaiting_approval' && approvalIndex < 2) {
      const approvalStage = definition.stages.find((stage) => stage.type === 'approval');
      const roles = approvalStage?.requiredRoles || (approvalIndex === 0 ? ['业务负责人'] : ['风险负责人']);
      item = await platform.act({
        id: item.id,
        action: 'approve',
        role: roles[approvalIndex] || roles[0],
        operatorId: approvalIndex === 0 ? 'QA-BIZ-01' : 'QA-RISK-01',
        comment: '矩阵验收审批通过',
      });
      approvalIndex += 1;
    }
    const stagesPassed = item.stages.every((stage) => stage.status === 'passed');
    matrix.push({
      workflow_id: definition.workflow_id,
      pass: item.status === 'completed' && stagesPassed && item.artifacts.length >= 2,
      status: item.status,
      instance_id: item.id,
      stages_passed: stagesPassed,
      artifacts: item.artifacts.length,
    });
  } catch (error) {
    matrix.push({
      workflow_id: definition.workflow_id,
      pass: false,
      status: 'exception',
      error: String(error.message || error),
    });
  }
}
const matrixPassed = matrix.filter((item) => item.pass).length;
record('workflow.matrix.78', matrixPassed === definitions.length, `pass=${matrixPassed} fail=${definitions.length - matrixPassed}`);

const passed = records.filter((item) => item.pass).length;
const out = path.join(ROOT, 'reports', 'platform-verification.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify({
  generated_at: new Date().toISOString(),
  workspace_root: workspaceRoot,
  total: records.length,
  passed,
  failed: records.length - passed,
  records,
  workflow_matrix: matrix,
}, null, 2)}\n`);
console.log(`PLATFORM_VERIFY ${passed}/${records.length} PASS -> ${path.relative(ROOT, out)}`);
if (passed !== records.length) process.exit(1);
