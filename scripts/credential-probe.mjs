#!/usr/bin/env node
// credential-probe.mjs — S0/R 凭据健康探针（015 v2.1 §14.5，修复 1.0 未达项 8）
// 用法：node scripts/credential-probe.mjs [timeout_ms=30000]
// 读 .env（DEEPSEEK_API_KEY / OPENAI_API_KEY / OPENAI_BASE_URL 等），向配置端点发 1 次最小真实请求。
// 退出码：0=凭据健康；1=401/403；2=超时/网络；3=无凭据配置。非 0 → 按 §10.3 停线。
import fs from 'node:fs';

function loadEnv(p = '.env') {
  if (!fs.existsSync(p)) return {};
  const env = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = { ...loadEnv(), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /API_KEY|BASE_URL/i.test(k))) };
const key = env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY || '';
const base = (env.OPENAI_BASE_URL || env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const model = env.WORKBENCH_PROBE_MODEL || 'deepseek-chat';
if (!key) { console.error('PROBE_FAIL no-credential (exit 3)'); process.exit(3); }

const t0 = Date.now();
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), Number(process.argv[2] || 30000));
try {
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 4, stream: false }),
    signal: ctrl.signal,
  });
  clearTimeout(timer);
  if (res.status === 401 || res.status === 403) {
    console.error(`PROBE_FAIL credential-rejected status=${res.status} (exit 1) — 停线，禁止带病连跑`);
    process.exit(1);
  }
  if (!res.ok) { console.error(`PROBE_FAIL http-${res.status} (exit 2)`); process.exit(2); }
  const j = await res.json();
  const ok = j.choices && j.choices[0] && j.choices[0].message;
  console.log(`PROBE_OK model=${model} latency=${Date.now() - t0}ms reply=${ok ? 'yes' : 'no'}`);
  process.exit(ok ? 0 : 2);
} catch (e) {
  clearTimeout(timer);
  console.error(`PROBE_FAIL ${e.name === 'AbortError' ? 'timeout' : e.message} (exit 2)`);
  process.exit(2);
}
