#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadModelConfig, runModel, writeJsonAtomic } from '../tools/model-adapter/index.mjs';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const root = path.resolve(arg('--root', process.cwd()));
const configPath = arg('--config', '');
const skill = arg('--skill', 'workflow-smoke');
const prompt = arg('--prompt', '执行一条最小工作流并返回结构化结果。');
const out = path.resolve(arg('--out', path.join(root, 'reports', '4.0', 'workflow-live.json')));
const requireL2 = process.argv.includes('--require-l2');
const startedAt = new Date().toISOString();

try {
  const config = loadModelConfig({ configPath: configPath || undefined, root, requireCredential: true });
  const result = await runModel(config, prompt, {
    system: `Execute workbench skill ${skill}. Return a concise machine-readable result.`
  });
  if (!result.output || !String(result.output).trim()) throw new Error('EMPTY_MODEL_OUTPUT');
  if (!result.usage?.totalTokens || result.usage.totalTokens <= 0) throw new Error('ZERO_MODEL_USAGE');
  if (requireL2 && !result.capabilities?.l2) throw new Error('L2_REQUIRED');

  const auditDir = path.join(root, 'templates', 'workspace', 'audit');
  fs.mkdirSync(auditDir, { recursive: true });
  const auditFile = path.join(auditDir, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`);
  fs.appendFileSync(auditFile, `${JSON.stringify({
    ts: new Date().toISOString(),
    action: 'engine.run',
    engine: 'adapter',
    provider: result.provider,
    skill,
    ok: true,
    model: result.model,
    tokens: result.usage.totalTokens
  })}\n`);

  const report = {
    schemaVersion: '1.0',
    gate: 'live-workflow',
    startedAt,
    finishedAt: new Date().toISOString(),
    skill,
    provider: result.provider,
    model: result.model,
    tokens: result.usage.totalTokens,
    capabilities: result.capabilities,
    outputPreview: String(result.output).slice(0, 1200),
    auditFile: path.relative(root, auditFile).replace(/\\/g, '/'),
    ok: true
  };
  writeJsonAtomic(out, report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const report = {
    schemaVersion: '1.0',
    gate: 'live-workflow',
    startedAt,
    finishedAt: new Date().toISOString(),
    skill,
    ok: false,
    error: String(error.message || error).slice(0, 500)
  };
  writeJsonAtomic(out, report);
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 2;
}
