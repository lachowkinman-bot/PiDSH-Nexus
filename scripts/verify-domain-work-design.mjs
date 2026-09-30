#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const workflowIndex = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflows/index.json'), 'utf8'));
const designIndex = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/domain-work-design/index.json'), 'utf8'));
const benchmarks = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/benchmark-sources.json'), 'utf8')).sources.map((source) => source.id));
const DOMAIN_IDS = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/strategy-model.json'), 'utf8')).domains || {});
const records = [];
const rec = (id, pass, note = '') => {
  records.push({ id, pass: !!pass, note: String(note) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${note}`);
};

const domains = fs.readdirSync(path.join(ROOT, 'manifests/domain-work-design'))
  .filter((file) => file.endsWith('.json') && file !== 'index.json')
  .map((file) => JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/domain-work-design', file), 'utf8')));
const workflows = workflowIndex.workflows;
const workflowIds = new Set(workflows.map((workflow) => workflow.workflow_id));
const mapped = [];
const moduleIds = new Set();
const itemIds = new Set();
const fieldProblems = [];
const stageProblems = [];
const contractProblems = [];
const benchmarkProblems = [];
const ruleProblems = [];
const lineageProblems = [];
const eventProblems = [];

rec('index.counts', designIndex.domains === 13 && designIndex.workflows === 78 && designIndex.contracts === 78, JSON.stringify(designIndex));
rec('domains.count', domains.length === 13, `domains=${domains.length}`);
rec('modules.count', domains.reduce((sum, domain) => sum + domain.modules.length, 0) === 39, `modules=${domains.reduce((sum, domain) => sum + domain.modules.length, 0)}`);

for (const design of domains) {
  if (!design.benchmark_refs.every((id) => benchmarks.has(id))) benchmarkProblems.push(`${design.domain}: benchmark refs`);
  for (const module of design.modules) {
    if (moduleIds.has(module.id)) moduleIds.add(`${design.domain}:${module.id}`); else moduleIds.add(module.id);
    if (!module.benchmark_refs.every((id) => benchmarks.has(id))) benchmarkProblems.push(`${design.domain}/${module.id}: benchmark refs`);
    for (const item of module.items) {
      if (itemIds.has(item.id)) itemIds.add(`${design.domain}:${item.id}`); else itemIds.add(item.id);
      mapped.push(item.workflow.id);
      if (!workflowIds.has(item.workflow.id)) contractProblems.push(`${item.id}: unknown workflow`);
      if (item.stages.length < 7) stageProblems.push(`${item.id}: stages=${item.stages.length}`);
      if (item.stages.length < 8) stageProblems.push(`${item.id}: v2 stages=${item.stages.length}`);
      if (!Array.isArray(item.business_rules) || item.business_rules.length < 15) ruleProblems.push(`${item.id}: business_rules=${item.business_rules?.length || 0}`);
      const ruleIds = new Set((item.business_rules || []).map((rule) => rule.id));
      for (const stage of item.stages) {
        if (!stage.inputs?.length || !stage.outputs?.length || !stage.standard || !stage.gate || !stage.on_fail
          || !stage.owner_role || !stage.entry_criteria || !stage.input_contract_ref || !stage.output_contract_ref
          || !stage.evidence?.length || !stage.timeout_seconds || !stage.retry_policy || !stage.idempotency_key
          || !stage.ui_help || !stage.failure_severity || !stage.rule_refs?.length) {
          stageProblems.push(`${item.id}/${stage.id}: incomplete stage`);
        }
        for (const ruleId of stage.rule_refs || []) {
          if (!ruleIds.has(ruleId)) ruleProblems.push(`${item.id}/${stage.id}: missing rule ${ruleId}`);
        }
      }
      if (!item.benchmark_refs.every((id) => benchmarks.has(id))) benchmarkProblems.push(`${item.id}: benchmark refs`);
      const contract = JSON.parse(fs.readFileSync(path.join(ROOT, `manifests/workflow-contracts/${design.domain}.json`), 'utf8')).contracts[item.workflow.id];
      if (!contract) {
        contractProblems.push(`${item.workflow.id}: missing contract`);
        continue;
      }
      const fields = item.workflow.deliverable.fields;
      if (JSON.stringify(contract.input.required) !== JSON.stringify(fields)) contractProblems.push(`${item.workflow.id}: input required mismatch`);
      if (JSON.stringify(contract.output.properties.deliverable.required) !== JSON.stringify(fields)) contractProblems.push(`${item.workflow.id}: output required mismatch`);
      for (const field of fields) {
        if (!contract.input.properties[field] || !contract.output.properties.deliverable.properties[field]) {
          contractProblems.push(`${item.workflow.id}/${field}: schema property missing`);
        }
      }
      for (const stage of item.stages) {
        const stageContract = contract.stage_contracts?.[stage.id];
        if (!stageContract?.input || !stageContract?.output) contractProblems.push(`${item.workflow.id}/${stage.id}: missing stage contract`);
        if (!stage.input_contract_ref.endsWith(`/stage_contracts/${stage.id}/input`)) stageProblems.push(`${item.id}/${stage.id}: input ref mismatch`);
        if (!stage.output_contract_ref.endsWith(`/stage_contracts/${stage.id}/output`)) stageProblems.push(`${item.id}/${stage.id}: output ref mismatch`);
      }
      for (const effect of item.cross_domain_effects || []) {
        if (!DOMAIN_IDS.includes(effect.target_domain)) eventProblems.push(`${item.id}: unknown target ${effect.target_domain}`);
        if (!['person_key', 'position_key', 'customer_key', 'contract_key', 'initiative_key', 'trace_id'].includes(effect.anonymous_key)) {
          eventProblems.push(`${item.id}: illegal anonymous key ${effect.anonymous_key}`);
        }
      }
    }
  }
  const typedict = JSON.parse(fs.readFileSync(path.join(ROOT, `manifests/typedict/${design.domain}.json`), 'utf8'));
  const ids = new Set();
  for (const field of typedict.fields) {
    if (ids.has(field.id)) fieldProblems.push(`${design.domain}/${field.id}: duplicate`);
    ids.add(field.id);
    if (!field.logical_type || !field.physical_type || !field.source || !field.level) fieldProblems.push(`${design.domain}/${field.id}: incomplete`);
  }
  for (const module of design.modules) {
    for (const item of module.items) {
      for (const field of item.workflow.deliverable.fields) {
        const present = typedict.fields.some((entry) => entry.field === field);
        if (!present) fieldProblems.push(`${design.domain}/${item.workflow.id}/${field}: missing typedict field`);
      }
    }
  }
  const doc = path.join(ROOT, 'docs/domain-work-design', `${design.domain}.md`);
  if (!fs.existsSync(doc) || fs.statSync(doc).size < 500) fieldProblems.push(`${design.domain}: docs missing`);
}

const mappedSet = new Set(mapped);
const missing = [...workflowIds].filter((id) => !mappedSet.has(id));
const duplicates = mapped.filter((id, index) => mapped.indexOf(id) !== index);
rec('workflow.coverage', missing.length === 0 && duplicates.length === 0, `mapped=${mappedSet.size} missing=${missing.join(',')} duplicates=${[...new Set(duplicates)].join(',')}`);
rec('workflow.count', mapped.length === 78 && mappedSet.size === 78, `mapped=${mapped.length} unique=${mappedSet.size}`);
rec('work_item.unique', itemIds.size === 78, `item_ids=${itemIds.size}`);
rec('module.unique', moduleIds.size === 39, `module_ids=${moduleIds.size}`);
rec('stages.standards', stageProblems.length === 0, `issues=${stageProblems.length}`);
rec('rules.closed_loop', ruleProblems.length === 0, `issues=${ruleProblems.length}`);
rec('contracts.integrity', contractProblems.length === 0, `issues=${contractProblems.length}`);
rec('typedict.integrity', fieldProblems.length === 0, `issues=${fieldProblems.length}`);
rec('benchmark.refs', benchmarkProblems.length === 0, `issues=${benchmarkProblems.length}`);
rec('schema.files', [
  'manifests/schema/domain-work-design.schema.json',
  'manifests/schema/workflow-contracts.schema.json',
  'manifests/schema/typedict.schema.json',
  'manifests/schema/workflow-definition-v2.schema.json',
  'manifests/schema/workflow-instance.schema.json',
  'manifests/schema/stage-run.schema.json',
  'manifests/schema/approval-record.schema.json',
  'manifests/schema/metric-snapshot.schema.json',
  'manifests/schema/strategy-objective.schema.json',
  'manifests/schema/artifact-manifest.schema.json',
].every((file) => fs.existsSync(path.join(ROOT, file))), 'schema refs present');
rec('global.artifacts', [
  'manifests/business-rules.json',
  'manifests/benchmark-mapping.json',
  'manifests/dictionaries/term-dictionary.json',
  'manifests/lineage.json',
  'manifests/cross-domain-events.json',
  'manifests/workflow-tests/index.json',
].every((file) => fs.existsSync(path.join(ROOT, file))), 'global v2 artifacts present');
const termDictionary = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/dictionaries/term-dictionary.json'), 'utf8'));
const allTypedictFields = domains.flatMap((design) => {
  const typedict = JSON.parse(fs.readFileSync(path.join(ROOT, `manifests/typedict/${design.domain}.json`), 'utf8'));
  return typedict.fields;
});
rec('term.mapping', termDictionary.terms.length === allTypedictFields.length, `terms=${termDictionary.terms.length} fields=${allTypedictFields.length}`);
const lineage = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/lineage.json'), 'utf8'));
rec('lineage.integrity', lineage.edges.length >= designIndex.workflows * 12 && lineage.edges.every((edge) => edge.from && edge.to && edge.relation), `edges=${lineage.edges.length}`);
const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/cross-domain-events.json'), 'utf8'));
rec('cross-domain.events', eventProblems.length === 0 && events.events.length >= 7, `events=${events.events.length} issues=${eventProblems.length}`);
const workflowTests = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflow-tests/index.json'), 'utf8'));
rec('workflow.test.matrix', workflowTests.case_count === designIndex.workflows * 7, `cases=${workflowTests.case_count}`);
const businessRules = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/business-rules.json'), 'utf8'));
rec('policy.thresholds.explicit', businessRules.rules.every((rule) => rule.status !== undefined), `rules=${businessRules.rules.length}`);
const benchmarkMapping = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/benchmark-mapping.json'), 'utf8'));
rec(
  'benchmark.mapping',
  benchmarkMapping.mappings.length === benchmarks.size
    && benchmarkMapping.mappings.every((item) => item.scope !== 'workflow' || item.workflow_count > 0),
  `sources=${benchmarkMapping.mappings.length}`,
);

const csvRows = fs.readFileSync(path.join(ROOT, 'templates/Type-Dict/field-type-dict.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
rec('typedict.csv.count', csvRows.length - 1 === designIndex.typedict_fields, `rows=${csvRows.length - 1} expected=${designIndex.typedict_fields}`);

const passed = records.filter((record) => record.pass).length;
const report = {
  schema: 'pids-nexus/domain-work-design-validation/v1',
  generated_at: new Date().toISOString(),
  pass: passed === records.length,
  passed,
  total: records.length,
  records,
  issues: {
    missing_workflows: missing,
    duplicate_workflows: [...new Set(duplicates)],
    stage_problems: stageProblems,
    rule_problems: ruleProblems,
    contract_problems: contractProblems,
    typedict_problems: fieldProblems,
    benchmark_problems: benchmarkProblems,
    event_problems: eventProblems,
  },
};
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/domain-work-design-validation.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(ROOT, 'reports/domain-work-design-validation.md'), [
  '# Domain work design validation',
  '',
  `- Result: ${report.pass ? 'PASS' : 'FAIL'}`,
  `- Checks: ${passed}/${records.length}`,
  `- Domains: ${domains.length}`,
  `- Modules: ${moduleIds.size}`,
  `- Work items: ${itemIds.size}`,
  `- Workflows mapped: ${mappedSet.size}`,
  `- TypeDict fields: ${designIndex.typedict_fields}`,
  `- Contracts: ${designIndex.contracts}`,
  '',
].join('\n'), 'utf8');
console.log(`DOMAIN_WORK_DESIGN ${report.pass ? 'PASS' : 'FAIL'} ${passed}/${records.length} -> reports/domain-work-design-validation.json`);
if (!report.pass) process.exit(1);
