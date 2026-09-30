#!/usr/bin/env node
// Build the R12 runtime capability, skill contract, and memory provider registries.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const RUNTIME = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/runtime-bundles.json'), 'utf8'));
const WORKFLOWS = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflows/index.json'), 'utf8')).workflows;
const PROFILE_ROOT = process.env.PIDSH_RUNTIME_PROFILE
  || path.join(ROOT, '.dsh-home', 'profiles', 'web');

const EXTERNAL = {
  'dsh-github-workbench': ['github_token'],
  'dsh-github-intelligence': ['github_token'],
  'dsh-lark-bot': ['lark_app_credentials'],
  'dsh-im': ['im_credentials'],
  'dsh-notifier': ['notification_channel'],
  'dsh-sentry': ['sentry_auth_token'],
  'dsh-sonarqube': ['sonarqube_url'],
  'dsh-mcp-lens': ['mcp_server'],
  '@vectorize-io/hindsight-coding-agents': ['hindsight_service'],
  '@wxg-prc-cpg/dsh-weknora': ['weknora_service'],
  '@openviking/dsh-memory-plugin': ['openviking_service'],
  'dsh-browser': ['browser_runtime'],
  'dsh-builtin-browser': ['browser_runtime'],
  'dsh-pocket': ['network_optional'],
};

const CAPABILITIES = {
  '@deepseek-ai/dsh-base': 'agent_runtime',
  '@deepseek-ai/dsh-web-app': 'web_shell',
  '@workbench/client-ui': 'strategy_domain_workbench',
  'dsh-mnemon': 'three_tier_memory_control_plane',
  '@openviking/dsh-memory-plugin': 'openviking_memory',
  '@a9i5k4/dsh-auto-memory': 'automatic_memory',
  'dsh-artifacts': 'artifact_registry',
  'dsh-background-agents': 'background_jobs',
  'dsh-bridge': 'external_bridge',
  'dsh-browser': 'browser_tools',
  'dsh-builtin-browser': 'browser_tools',
  'dsh-context': 'context_insight',
  'dsh-cost-meter': 'usage_and_cost',
  '@ychris12138/dsh-usage-stats': 'provider_balance_usage',
  'dsh-excel-panel': 'spreadsheet_panel',
  'dsh-docs-panel': 'document_panel',
  'dsh-ppt': 'presentation_delivery',
  'dsh-pr-board': 'pull_request_board',
  'dsh-skill-picker': 'skill_center',
  'dsh-plugin': 'plugin_center',
  'dsh-notifier': 'notification_channels',
  'dsh-mcp-lens': 'mcp_diagnostics',
  'dsh-network-settings': 'network_diagnostics',
  'dsh-file-drop': 'file_intake',
  'dsh-undo-savepoint': 'snapshot_restore',
  'dsh-plugin-vetting': 'plugin_security_review',
  'dsh-doublecheck': 'dual_check',
  'dsh-sentry': 'error_monitoring',
  'dsh-sonarqube': 'code_quality',
};

const SKILL_WORKFLOW_ALIASES = {
  'interview-summary': ['rec.interview-schedule@1.0.0'],
};

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function packageMetadata(entry) {
  const builtin = path.join(PROFILE_ROOT, 'node_modules', ...entry.name.split('/'), 'package.json');
  if (entry.source === 'builtin' && fs.existsSync(builtin)) return readJson(builtin, {});
  if (entry.source && entry.source !== 'builtin') {
    const tar = path.join(ROOT, entry.source);
    if (fs.existsSync(tar)) {
      try {
        return JSON.parse(execFileSync('tar', ['-xOzf', tar, 'package/package.json'], {
          encoding: 'utf8',
          maxBuffer: 4 * 1024 * 1024,
        }));
      } catch {
        return {};
      }
    }
  }
  return {};
}

function kindFor(entry, pkg) {
  const name = entry.name.toLowerCase();
  if (name === '@deepseek-ai/dsh-base') return 'engine';
  if (name === '@deepseek-ai/dsh-web-app') return 'shell';
  if (name.includes('workbench/client-ui')) return 'workbench';
  if (name.includes('mnemon-provider-')) return 'memory-provider';
  if (/memory|mnemon|weknora|hindsight/.test(name)) return 'memory';
  if (/panel|sidebar|board|explorer|picker|snapshot|savepoint|skill|plugin/.test(name)) return 'ui';
  if (/browser|github|lark|notifier|network|im$|mcp|bridge|file-drop/.test(name)) return 'connector';
  if (/excel|docs|ppt|univer|artifacts|paperclip|inspiration/.test(name)) return 'delivery';
  if (/sentry|sonar|doublecheck|vetting|scan/.test(name)) return 'security';
  if (pkg.dsh?.client) return 'ui';
  return 'tool';
}

function sourceHash(entry) {
  if (!entry.source || entry.source === 'builtin') return null;
  const file = path.join(ROOT, entry.source);
  return fs.existsSync(file)
    ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    : null;
}

function runtimeEntries() {
  return RUNTIME.entries.map((entry) => {
    const pkg = packageMetadata(entry);
    const kind = kindFor(entry, pkg);
    const externalDependencies = EXTERNAL[entry.name] || [];
    const loaded = !!entry.load;
    return {
      name: entry.name,
      version: entry.version,
      source: entry.source,
      source_sha256: sourceHash(entry),
      license: pkg.license || null,
      kind,
      capability: CAPABILITIES[entry.name] || kind,
      loaded,
      disabled_reason: loaded ? null : entry.droppedBecause || null,
      external_dependencies: externalDependencies,
      data_level: /memory|github|lark|im|notifier|sentry|sonar/.test(entry.name) ? 'L3' : 'L2',
      expected_surfaces: loaded
        ? kind === 'ui' || kind === 'workbench' || kind === 'delivery'
          ? ['installed', 'loaded', 'surface', 'invoke', 'restart']
          : ['installed', 'loaded', 'invoke']
        : ['installed', 'disabled_reason', 'replacement_or_isolation'],
      status_policy: externalDependencies.length ? 'PASS_LIVE_OR_BLOCKED_EXTERNAL' : 'PASS_LOCAL_REQUIRED',
      test_case: kind === 'memory-provider' ? 'memory-provider-matrix'
        : kind === 'memory' ? 'memory-integration'
        : kind === 'ui' || kind === 'workbench' || kind === 'delivery' ? 'ui-surface'
        : kind === 'connector' ? 'connector-or-blocked'
        : 'load-and-probe',
    };
  });
}

function skillEntries() {
  const root = path.join(ROOT, 'templates/skills-domain');
  const contracts = Object.fromEntries(
    fs.readdirSync(path.join(ROOT, 'manifests/workflow-contracts'))
      .filter((file) => file.endsWith('.json'))
      .map((file) => [file.replace(/\.json$/, ''), readJson(path.join(ROOT, 'manifests/workflow-contracts', file), {})]),
  );
  const skills = [];
  for (const domain of fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    for (const file of fs.readdirSync(path.join(root, domain.name)).filter((name) => name.endsWith('.md'))) {
      const text = fs.readFileSync(path.join(root, domain.name, file), 'utf8');
      const name = (text.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || file.replace(/^SKILL-|\.md$/g, '');
      const intent = /-intent$/.test(name);
      const aliasIds = SKILL_WORKFLOW_ALIASES[name] || [];
      const relatedWorkflows = WORKFLOWS.filter((workflow) => workflow.domain === domain.name
        && (intent || workflow.skill === name || aliasIds.includes(workflow.workflow_id)));
      const primary = relatedWorkflows[0] || null;
      const contract = primary ? contracts[domain.name]?.contracts?.[primary.workflow_id] : null;
      const inputFields = primary?.deliverable?.fields || [];
      skills.push({
        name,
        domain: domain.name,
        file: path.posix.join('templates/skills-domain', domain.name, file),
        kind: intent ? 'intent_router' : 'business_skill',
        workflow_ids: relatedWorkflows.map((workflow) => workflow.workflow_id),
        input_schema: intent
          ? {
            type: 'object',
            additionalProperties: false,
            required: ['intent_text'],
            properties: { intent_text: { type: 'string', minLength: 1 } },
          }
          : {
            type: 'object',
            additionalProperties: false,
            required: [...inputFields, 'source_refs'],
            properties: Object.fromEntries([
              ...inputFields.map((field) => [field, { type: 'string' }]),
              ['source_refs', { type: 'array', minItems: 1, items: { type: 'string' } }],
            ]),
          },
        output_schema_ref: contract ? `manifests/workflow-contracts/${domain.name}.json#${primary.workflow_id}/output` : null,
        security: {
          pii_allowed_in_prompt: false,
          source_refs_required: true,
          evidence_required: true,
        },
        fixture: intent
          ? { intent_text: relatedWorkflows[0]?.trigger?.expr || domain.name }
          : Object.fromEntries([
            ...inputFields.map((field) => [field, /amount|cost|count|score|rate|pct|qty/i.test(field) ? 1 : 'QA']),
            ['source_refs', [`fixture:${domain.name}`]],
          ]),
        status: 'NOT_RUN',
      });
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function memoryProviders() {
  const root = path.join(PROFILE_ROOT, 'node_modules');
  const specs = [
    ['mnemon-native', 'dsh-mnemon-provider-mnemon-native', ['create', 'read', 'search', 'delete', 'relationships'], ['mnemon_cli']],
    ['openviking', 'dsh-mnemon-provider-openviking', ['create', 'read', 'search', 'list', 'delete'], ['endpoint', 'credentials', 'user_or_account']],
    ['honcho', 'dsh-mnemon-provider-honcho', ['create', 'read', 'search', 'delete'], ['endpoint', 'credentials', 'workspace', 'peer']],
    ['mem0', 'dsh-mnemon-provider-mem0', ['create', 'read', 'search', 'delete'], ['endpoint', 'credentials', 'user_scope']],
    ['hindsight', 'dsh-mnemon-provider-hindsight', ['create', 'read', 'search', 'graph'], ['endpoint', 'bank_scope', 'credentials_optional']],
    ['holographic', 'dsh-mnemon-provider-holographic', ['create', 'read', 'search', 'graph', 'delete'], []],
    ['retaindb', 'dsh-mnemon-provider-retaindb', ['create', 'read', 'search', 'delete'], ['endpoint', 'credentials', 'project', 'user']],
    ['byterover', 'dsh-mnemon-provider-byterover', ['status', 'query', 'curate'], ['brv_cli', 'knowledge_directory']],
    ['supermemory', 'dsh-mnemon-provider-supermemory', ['create', 'read', 'search', 'delete'], ['endpoint', 'credentials', 'container']],
  ];
  return specs.map(([id, packageName, capabilities, requirements]) => ({
    id,
    package: packageName,
    installed: fs.existsSync(path.join(root, ...packageName.split('/'))),
    version: readJson(path.join(root, ...packageName.split('/'), 'package.json'), {}).version || null,
    capabilities,
    requirements,
    external: requirements.length > 0,
    expected_status: requirements.length ? 'BLOCKED_EXTERNAL_WHEN_UNCONFIGURED' : 'PASS_LOCAL_REQUIRED',
    test_case: 'create-read-update-delete-recall-restart-backup-and-pii-boundary',
    status: 'NOT_RUN',
  }));
}

const runtime = runtimeEntries();
const skills = skillEntries();
const providers = memoryProviders();
const output = {
  schema: 'pids-nexus/runtime-capabilities/v1',
  generated_at: new Date().toISOString(),
  plugin_scope: {
    runtime_total: RUNTIME.total,
    loaded: RUNTIME.loaded,
    shipped_not_loaded: RUNTIME.total - RUNTIME.loaded,
  },
  plugins: runtime,
  skills: {
    total: skills.length,
    business: skills.filter((skill) => skill.kind === 'business_skill').length,
    intent_routers: skills.filter((skill) => skill.kind === 'intent_router').length,
    entries: skills,
  },
  memory: {
    control_plane: {
      package: 'dsh-mnemon',
      installed: fs.existsSync(path.join(PROFILE_ROOT, 'node_modules', 'dsh-mnemon')),
      tiers: ['runtime', 'documents', 'memory_spaces'],
    },
    providers,
  },
};

if (runtime.length !== RUNTIME.total) throw new Error(`插件矩阵不完整：${runtime.length}/${RUNTIME.total}`);
if (providers.length !== 9) throw new Error(`记忆 provider 矩阵不完整：${providers.length}/9`);
fs.writeFileSync(
  path.join(ROOT, 'manifests/runtime-capabilities.json'),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
);
console.log(`RUNTIME_CAPABILITIES_OK plugins=${runtime.length} loaded=${RUNTIME.loaded} skills=${skills.length} providers=${providers.length}`);
