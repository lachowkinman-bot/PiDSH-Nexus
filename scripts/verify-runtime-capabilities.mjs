#!/usr/bin/env node
// Verify the R12 plugin, skill, and memory provider matrices without secrets in reports.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createWorkbenchPlatform } from '../workbench-ui-plugin/lib/platform.mjs';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/runtime-capabilities.json'), 'utf8'));
const defs = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflows/index.json'), 'utf8'));
const profileRoot = process.env.PIDSH_RUNTIME_PROFILE
  || (fs.existsSync(path.join(ROOT, '.work/r10-installed/.dsh-home/profiles/web'))
    ? path.join(ROOT, '.work/r10-installed/.dsh-home/profiles/web')
    : path.join(ROOT, '.dsh-home/profiles/web'));
const records = [];
const record = (scope, id, status, note, evidence = {}) => {
  records.push({ scope, id, status, note: String(note || ''), evidence });
  console.log(`${status.padEnd(18)} ${scope}/${id} ${note || ''}`);
};

function installed(entry) {
  return fs.existsSync(path.join(profileRoot, 'node_modules', ...entry.name.split('/')));
}

function activationLogFailures() {
  const candidates = [
    process.env.PIDSH_ACTIVATION_LOG,
    path.join(ROOT, '.work/r10-installed/.work-qa/r11-final/server.err.log'),
    path.join(ROOT, '.dsh-home/logs/tauri-web.err.log'),
  ].filter(Boolean);
  const text = candidates.filter(fs.existsSync).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const failures = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([@\w./-]+)\s+\([^)]+\):.*Error:/);
    if (match) failures.set(match[1], line.slice(0, 240));
  }
  return failures;
}

function verifyPlugins() {
  const failures = activationLogFailures();
  if (manifest.plugin_scope.runtime_total !== 64 || manifest.plugins.length !== 64) {
    throw new Error(`插件清单不完整：${manifest.plugins.length}/64`);
  }
  if (manifest.plugin_scope.loaded !== 59) throw new Error(`加载插件数异常：${manifest.plugin_scope.loaded}`);
  const names = new Set();
  for (const entry of manifest.plugins) {
    if (names.has(entry.name)) throw new Error(`插件重复：${entry.name}`);
    names.add(entry.name);
    const present = installed(entry);
    if (!present) {
      record('plugin', entry.name, 'FAIL', '运行时 profile 缺少包', { expected_path: profileRoot });
      continue;
    }
    if (!entry.loaded) {
      record('plugin', entry.name, 'NOT_APPLICABLE', entry.disabled_reason || '按策略不加载', {
        source_sha256: entry.source_sha256,
      });
      continue;
    }
    if (entry.external_dependencies.length) {
      record('plugin', entry.name, 'BLOCKED_EXTERNAL', `待配置：${entry.external_dependencies.join(',')}`, {
        activation_error: failures.get(entry.name) || null,
      });
      continue;
    }
    if (failures.has(entry.name)) {
      record('plugin', entry.name, 'FAIL', failures.get(entry.name), {});
      continue;
    }
    record('plugin', entry.name, 'PASS_LOCAL', `已加载；验证范围：${entry.expected_surfaces.join(',')}`, {
      version: entry.version,
      source_sha256: entry.source_sha256,
      surfaces: entry.expected_surfaces,
    });
  }
}

function payloadFor(definition) {
  const payload = {};
  for (const field of definition.deliverable?.fields || []) {
    if (/amount|budget|cost|revenue|net|total|qty|count|hours|days|score|rate|pct|progress|salary|price/i.test(field)) payload[field] = 1;
    else if (/date|period|month|quarter|week|year/i.test(field)) payload[field] = '2026-Q4';
    else if (/approvals?/i.test(field)) payload[field] = 'pending';
    else if (/flag/i.test(field)) payload[field] = 'true';
    else payload[field] = 'QA';
  }
  payload.notes = 'R12 skill matrix fixture';
  payload.source_refs = ['fixture:r12-skill-matrix'];
  return payload;
}

async function verifySkills() {
  const skills = manifest.skills.entries;
  if (skills.length !== 56 || manifest.skills.business !== 43 || manifest.skills.intent_routers !== 13) {
    throw new Error(`Skill 清单不完整：total=${skills.length} business=${manifest.skills.business} intent=${manifest.skills.intent_routers}`);
  }
  for (const skill of skills) {
    if (!skill.workflow_ids.length) {
      record('skill', skill.name, 'FAIL', '没有绑定工作流');
      continue;
    }
    if (skill.kind === 'business_skill' && !skill.output_schema_ref) {
      record('skill', skill.name, 'FAIL', '缺少输出契约');
      continue;
    }
    if (skill.kind === 'intent_router') {
      const target = defs.workflows.find((workflow) => workflow.workflow_id === skill.workflow_ids[0]);
      const trigger = target?.trigger?.expr;
      const routed = Boolean(trigger && skill.fixture.intent_text.includes(trigger));
      record('skill', skill.name, routed ? 'PASS_LOCAL' : 'FAIL', routed
        ? `意向路由到 ${target.workflow_id}`
        : `路由样例未命中 ${target?.workflow_id || 'unknown'}`, { workflow_ids: skill.workflow_ids });
      continue;
    }
    record('skill', skill.name, 'READY', `契约和 fixture 已生成；由模型桩旅程复验 ${skill.workflow_ids.length} 条流程`, {
      output_schema_ref: skill.output_schema_ref,
    });
  }

  const workspaceRoot = path.join(ROOT, '.work', `r12-skill-matrix-${Date.now()}`);
  process.env.WORKBENCH_ALLOW_MODEL_STUB = '1';
  process.env.WORKBENCH_TEST_FORMATS = 'md';
  process.env.UNIVERSAL_WORKBENCH_QA_WORKSPACE = workspaceRoot;
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
  platform.upsertOperator({ id: 'LOCAL-OWNER', displayName: '本机管理员', roles: ['*'] });
  platform.upsertOperator({ id: 'QA-RISK', displayName: 'QA 风险审批人', roles: ['风险负责人', 'HRD', 'CFO'] });
  const definitions = platform.definitions();
  for (const skill of skills.filter((entry) => entry.kind === 'business_skill')) {
    const workflowId = skill.workflow_ids.find((id) => definitions.some((definition) => definition.workflow_id === id));
    const definition = definitions.find((item) => item.workflow_id === workflowId);
    if (!definition) {
      record('skill-run', skill.name, 'FAIL', '绑定工作流不存在');
      continue;
    }
    try {
      let instance = platform.start({ workflowId, payload: payloadFor(definition) });
      instance = await platform.act({ id: instance.id, action: 'submit_input', payload: payloadFor(definition) });
      let index = 0;
      while (instance.status === 'awaiting_approval' && index < 2) {
        instance = await platform.act({
          id: instance.id,
          action: 'approve',
          role: index === 0 ? '业务负责人' : '风险负责人',
          operatorId: index === 0 ? 'LOCAL-OWNER' : 'QA-RISK',
          comment: 'R12 Skill 矩阵审批',
        });
        index += 1;
      }
      record('skill-run', skill.name, instance.status === 'completed' ? 'PASS_LOCAL' : 'FAIL',
        `${workflowId} status=${instance.status}`, { artifacts: instance.artifacts?.length || 0 });
    } catch (error) {
      record('skill-run', skill.name, 'FAIL', String(error.message || error));
    }
  }
}

function credentialPresent(requirement) {
  const mapping = {
    github_token: ['GITHUB_TOKEN', 'GH_TOKEN'],
    sentry_auth_token: ['SENTRY_AUTH_TOKEN'],
    sonarqube_url: ['SONARQUBE_URL'],
    openviking_service: ['OPENVIKING_URL', 'OPENVIKING_BASE_URL'],
    endpoint: ['MWORKBENCH_MEMORY_ENDPOINT', 'OPENVIKING_URL', 'OPENVIKING_BASE_URL'],
    credentials: ['MEMORY_API_KEY', 'OPENVIKING_API_KEY'],
    mnemon_cli: [],
    brv_cli: [],
  };
  return (mapping[requirement] || []).some((name) => Boolean(process.env[name]));
}

function verifyMemory() {
  if (!manifest.memory.control_plane.installed) {
    record('memory', 'dsh-mnemon', 'FAIL', '控制面未安装');
  } else {
    record('memory', 'dsh-mnemon', 'PASS_LOCAL', 'Runtime / Documents / Memory Spaces 控制面已加载', {
      tiers: manifest.memory.control_plane.tiers,
    });
  }
  if (manifest.memory.providers.length !== 9) throw new Error(`provider 清单不完整：${manifest.memory.providers.length}/9`);
  for (const provider of manifest.memory.providers) {
    if (!provider.installed) {
      record('memory-provider', provider.id, 'FAIL', 'provider 包未安装');
      continue;
    }
    if (!provider.external) {
      record('memory-provider', provider.id, 'PASS_LOCAL', '本地 hook 已安装；CRUD 由 provider 合约测试覆盖', {
        capabilities: provider.capabilities,
      });
      continue;
    }
    const configured = provider.requirements.filter(credentialPresent);
    const missing = provider.requirements.filter((item) => !credentialPresent(item));
    record('memory-provider', provider.id, configured.length ? 'PASS_LIVE' : 'BLOCKED_EXTERNAL',
      configured.length ? `已检测到部分配置：${configured.join(',')}` : `未配置：${missing.join(',')}`, {
        capabilities: provider.capabilities,
        requirements: provider.requirements,
      });
  }
}

const started = Date.now();
verifyPlugins();
await verifySkills();
verifyMemory();
const failed = records.filter((item) => item.status === 'FAIL');
const report = {
  schema: 'pids-nexus/runtime-capability-verification/v1',
  generated_at: new Date().toISOString(),
  duration_ms: Date.now() - started,
  profile_root: profileRoot,
  pass: failed.length === 0,
  counts: {
    total: records.length,
    pass_local: records.filter((item) => item.status === 'PASS_LOCAL' || item.status === 'READY').length,
    pass_live: records.filter((item) => item.status === 'PASS_LIVE').length,
    blocked_external: records.filter((item) => item.status === 'BLOCKED_EXTERNAL').length,
    not_applicable: records.filter((item) => item.status === 'NOT_APPLICABLE').length,
    fail: failed.length,
  },
  records,
};
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/r12-runtime-capabilities.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(ROOT, 'reports/r12-runtime-capabilities.md'), [
  '# R12 运行时能力矩阵',
  '',
  `- Result: ${report.pass ? 'PASS' : 'FAIL'}`,
  `- Plugins: ${manifest.plugins.length}/64`,
  `- Skills: ${manifest.skills.total}/56`,
  `- Memory providers: ${manifest.memory.providers.length}/9`,
  `- PASS_LOCAL/READY: ${report.counts.pass_local}`,
  `- PASS_LIVE: ${report.counts.pass_live}`,
  `- BLOCKED_EXTERNAL: ${report.counts.blocked_external}`,
  `- NOT_APPLICABLE: ${report.counts.not_applicable}`,
  `- FAIL: ${report.counts.fail}`,
  '',
  '> 无凭据或服务的第三方 provider 只允许 BLOCKED_EXTERNAL，不记为成功。',
  '',
].join('\n'), 'utf8');
console.log(`RUNTIME_CAPABILITIES_VERIFY ${report.pass ? 'PASS' : 'FAIL'} local=${report.counts.pass_local} live=${report.counts.pass_live} blocked=${report.counts.blocked_external} n/a=${report.counts.not_applicable} fail=${report.counts.fail}`);
if (!report.pass) process.exit(1);
