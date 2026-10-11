#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const root = path.resolve(arg('--root', process.cwd()));
const out = path.resolve(arg('--out', path.join(root, 'reports', '4.0', 'security-scan.json')));
const scanRoots = [
  'config',
  'agent-pack',
  'manifests',
  'scripts',
  'tools',
  'AGENTS.md',
  'README.md',
  'GOAL-PACK-4.0.md',
  'RESOURCE_CHECKLIST.md',
  'agent-task-pack.md'
];
const secretRules = [
  { id: 'openai-like', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'github-token', regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { id: 'slack-token', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { id: 'aws-key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'assigned-secret', regex: /\b(?:api[_-]?key|token|secret|password)\b\s*[:=]\s*["'][^"'\n]{12,}["']/gi },
  { id: 'bearer-token', regex: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi }
];
const piiRules = [
  { id: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { id: 'cn-mobile', regex: /\b1[3-9]\d{9}\b/g },
  { id: 'cn-id', regex: /\b\d{17}[\dXx]\b/g }
];
const ignoredDirs = new Set(['node_modules', '.git', '.work', '.dsh-home', 'offline', 'offline-3.0', 'installer-output', 'reports']);
const ignoredExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.zip', '.tar', '.7z', '.exe', '.dll', '.bin']);
// 第三方固定副本（MIT）自带假夹具：示例邮箱与 "sk-verify-local-…" 死端点占位符是上游自测数据，
// 不代表本仓库凭据；来源、提交与用途见 tools/dsh-upgrade-skill/PROVENANCE.md。
// 另：自定义工作台夹具（scripts/custom/fixtures）含**故意的**假 PII 反例数据，用于证明域级校验能拦下未脱敏台账；
// 这些值不是真实凭据或真实个人信息，且不会被产品打包（见 docs/custom-workbench-standard.zh.md）。
const excludedRelPrefixes = ['tools/dsh-upgrade-skill/skills', 'scripts/custom/fixtures'];
function isExcluded(full) {
  const rel = path.relative(root, full).replaceAll('\\', '/');
  return excludedRelPrefixes.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`));
}

function walk(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  if (!stat.isDirectory()) return [];
  const entries = fs.readdirSync(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(target, entry.name);
    if (isExcluded(full)) continue;
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const findings = [];
const files = scanRoots.flatMap((relative) => {
  const target = path.join(root, relative);
  return fs.existsSync(target) ? walk(target) : [];
});
for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (ignoredExtensions.has(ext)) continue;
  const stat = fs.statSync(file);
  if (stat.size > 2 * 1024 * 1024) continue;
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const rule of secretRules) {
    for (const match of text.matchAll(rule.regex)) {
      findings.push({
        id: rule.id,
        file: path.relative(root, file).replace(/\\/g, '/'),
        line: lineOf(text, match.index || 0),
        match: rule.id,
        severity: 'secret'
      });
    }
  }
  if (path.basename(file) === '4.0-scan-secrets.mjs') continue;
  for (const rule of piiRules) {
    for (const match of text.matchAll(rule.regex)) {
      const value = match[0];
      if (rule.id === 'email' && value.endsWith('example.com')) continue;
      if (
        rule.id === 'cn-mobile' &&
        value === '13812345678' &&
        /(^|[\\/])scripts[\\/]verify-/.test(file)
      ) continue;
      findings.push({
        id: rule.id,
        file: path.relative(root, file).replace(/\\/g, '/'),
        line: lineOf(text, match.index || 0),
        match: rule.id,
        severity: 'pii'
      });
    }
  }
}

const report = {
  schemaVersion: '1.0',
  gate: 'security-scan',
  root,
  scannedFiles: files.length,
  findings,
  secretFindings: findings.filter((item) => item.severity === 'secret').length,
  piiFindings: findings.filter((item) => item.severity === 'pii').length,
  ok: findings.length === 0,
  finishedAt: new Date().toISOString()
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 2;
