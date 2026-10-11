#!/usr/bin/env node
// 4.0 engine runner: adapter-first, legacy pi/dsh only as explicit fallback.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadModelConfig, runModel } from '../tools/model-adapter/index.mjs';

const ROOT = process.cwd();
const AUDIT_DIR = process.env.UNIVERSAL_WORKBENCH_AUDIT_DIR
  ? path.resolve(process.env.UNIVERSAL_WORKBENCH_AUDIT_DIR)
  : path.join(ROOT, 'templates/workspace/audit');
const TMP_DIR = path.join(ROOT, 'reports/.tmp');
const profile = fs.existsSync(path.join(ROOT, 'runner-profile.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'runner-profile.json'), 'utf8'))
  : { runner: 'adapter' };

function audit(event, detail) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  fs.appendFileSync(
    path.join(AUDIT_DIR, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`),
    `${JSON.stringify({ ts: new Date().toISOString(), action: event, ...detail })}\n`
  );
}

function skillFileFor(skill) {
  const base = path.join(ROOT, 'templates/skills-domain');
  if (!fs.existsSync(base)) return null;
  for (const domain of fs.readdirSync(base)) {
    const candidate = path.join(base, domain, `SKILL-${skill}.md`);
    if (fs.existsSync(candidate)) return path.relative(ROOT, candidate).replace(/\\/g, '/');
  }
  return null;
}

function promptFor(skill, prompt, skillFile) {
  const skillText = skillFile ? `\nSkill file: ${skillFile}\n` : '';
  return `执行技能 ${skill}。${skillText}\n业务任务：\n${prompt}`;
}

async function viaAdapter(skill, prompt) {
  const config = loadModelConfig({ root: ROOT });
  if (config.provider === 'offline') throw new Error('MODEL_CONFIG_OFFLINE');
  const result = await runModel(config, promptFor(skill, prompt, skillFileFor(skill)));
  if (!result.output || !String(result.output).trim()) throw new Error('MODEL_EMPTY_OUTPUT');
  return {
    engine: 'adapter',
    provider: result.provider,
    output: result.output.slice(0, 4000),
    model: result.model,
    tokens: result.usage?.totalTokens || 0,
    capability: result.capabilities
  };
}

function runViaBash(cmd, { prompt, extraEnv = {}, timeoutMs = 180000 }) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const promptFile = path.join(TMP_DIR, `engine-prompt-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(promptFile, prompt, 'utf8');
  const relative = path.relative(ROOT, promptFile).replace(/\\/g, '/');
  try {
    return execFileSync('bash', ['-lc', cmd(relative)], {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      cwd: ROOT,
      env: { ...process.env, ...extraEnv }
    });
  } finally {
    try { fs.unlinkSync(promptFile); } catch {}
  }
}

function parsePiStream(stream) {
  let final = null;
  for (const line of String(stream).trim().split(/\r?\n/)) {
    let value;
    try { value = JSON.parse(line); } catch { continue; }
    if (value.type === 'message_end' && value.message?.role === 'assistant' && value.message.stopReason !== 'pending') {
      final = value.message;
    }
  }
  if (!final) throw new Error('PI_NO_ASSISTANT_MESSAGE');
  if (final.errorMessage) throw new Error(String(final.errorMessage).slice(0, 140));
  if (final.stopReason !== 'stop') throw new Error(`PI_STOP_REASON:${final.stopReason}`);
  if (!(final.usage?.totalTokens > 0)) throw new Error('PI_ZERO_TOKENS');
  const text = (final.content || []).filter((item) => item.type === 'text').map((item) => item.text).join(' ');
  if (!text.trim()) throw new Error('PI_EMPTY_TEXT');
  return { output: text, tokens: final.usage.totalTokens, model: final.model };
}

function viaLegacyPi(skill, prompt) {
  const key = process.env.DEEPSEEK_API_KEY || '';
  if (!key) throw new Error('LEGACY_DEEPSEEK_API_KEY_MISSING');
  const model = process.env.WORKBENCH_ENGINE_MODEL || 'deepseek-v4-flash';
  const skillFile = skillFileFor(skill);
  const skillArg = skillFile ? ` --skill "${skillFile}"` : '';
  const output = runViaBash(
    (relative) => `pi --provider deepseek --model ${model} --api-key "$GT_KEY" --tools read,write${skillArg} -p --mode json "$(cat "${relative}")"`,
    { prompt: promptFor(skill, prompt, skillFile), extraEnv: { GT_KEY: key } }
  );
  const result = parsePiStream(output);
  return { engine: 'pi-legacy', output: result.output.slice(0, 4000), model: result.model, tokens: result.tokens };
}

function viaLegacyDsh(skill, prompt) {
  const output = runViaBash(
    (relative) => `dsh exec "$(cat "${relative}")"`,
    { prompt: promptFor(skill, prompt, skillFileFor(skill)), timeoutMs: 420000 }
  ).trim();
  if (!output) throw new Error('DSH_EMPTY_OUTPUT');
  if (/Authentication Fails|invalid|401|403/i.test(output)) throw new Error('DSH_AUTH_OR_REQUEST_FAILURE');
  return { engine: 'dsh-legacy', output: output.slice(0, 4000), model: 'dsh-headless', tokens: 0 };
}

export async function runSkill(skill, prompt, { allowFallback = true, engines: only } = {}) {
  const chain = [
    ['adapter', viaAdapter]
  ];
  if (process.env.WORKBENCH_ALLOW_LEGACY_ENGINE_FALLBACK === '1') {
    chain.push(['pi-legacy', viaLegacyPi], ['dsh-legacy', viaLegacyDsh]);
  }
  const selected = only
    ? chain.filter(([name]) => name === only || (only === 'pi' && name === 'pi-legacy') || (only === 'dsh' && name === 'dsh-legacy'))
    : chain;
  const tried = [];
  for (const [name, run] of selected) {
    try {
      const result = await run(skill, prompt);
      audit('engine.run', {
        engine: result.engine,
        provider: result.provider || name,
        skill,
        ok: true,
        model: result.model,
        tokens: result.tokens
      });
      return { ...result, fallback: false, tried };
    } catch (error) {
      const message = String(error.message || error).slice(0, 180);
      tried.push(`${name}:${message}`);
      audit('engine.run', { engine: name, skill, ok: false, err: message });
    }
  }
  if (!allowFallback) throw new Error(`ENGINE_UNAVAILABLE :: ${tried.join(' | ')}`);
  audit('engine.run', { engine: 'local', skill, fallback: 'offline', tried });
  return {
    engine: 'local',
    fallback: true,
    tried,
    output: '[offline fallback] deterministic local execution'
  };
}

function selfTest() {
  audit('engine.run', { engine: 'dry-run', skill: 'self-test', ok: true });
  const file = path.join(AUDIT_DIR, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`);
  const line = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).pop();
  if (!line.includes('engine.run')) throw new Error('AUDIT_CHANNEL_FAILED');
  console.log('SELF_TEST_OK engine=adapter-first audit=engine.run');
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  try {
    selfTest();
  } catch (error) {
    console.error(`SELF_TEST_FAIL:${error.message}`);
    process.exit(1);
  }
} else if (args.includes('--run')) {
  const skill = args[args.indexOf('--run') + 1];
  const prompt = args[args.indexOf('--run') + 2] || '';
  runSkill(skill, prompt)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(`RUN_FAIL:${error.message}`);
      process.exit(1);
    });
} else if (args.includes('--both')) {
  console.log('--both is deprecated in 4.0; use the adapter probe and workflow-live gate instead.');
} else {
  console.log('Usage: --run <skill> "<prompt>" | --self-test');
}
