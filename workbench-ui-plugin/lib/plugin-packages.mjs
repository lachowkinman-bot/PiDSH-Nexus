// plugin-packages.mjs — DSH 插件式工作台包（本地 .tgz → profile，重启生效）
//
// 纪律：先探测 CLI 能力；安装/卸载失败原样回报，不静默回退；记录独立于状态账本。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readPackedManifest, PACKAGE_SCHEMA } from './workbench-package.mjs';

export const INSTALLS_SCHEMA = 'pids-nexus/market-installs/v1';
const INSTALLS_FILE = 'market-installs.json';

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

export function installsFile(workspaceRoot) {
  return path.join(workspaceRoot, 'custom', INSTALLS_FILE);
}
export function readInstalls(workspaceRoot) {
  const doc = readJson(installsFile(workspaceRoot), null);
  return doc && doc.schema === INSTALLS_SCHEMA && doc.installs ? doc.installs : {};
}
export function recordInstall(workspaceRoot, id, value) {
  const installs = readInstalls(workspaceRoot);
  installs[id] = { ...(installs[id] || {}), ...value, updated_at: new Date().toISOString() };
  writeJsonAtomic(installsFile(workspaceRoot), { schema: INSTALLS_SCHEMA, installs });
  return installs[id];
}
export function forgetInstall(workspaceRoot, id) {
  const installs = readInstalls(workspaceRoot);
  if (!Object.hasOwn(installs, id)) return false;
  delete installs[id];
  writeJsonAtomic(installsFile(workspaceRoot), { schema: INSTALLS_SCHEMA, installs });
  return true;
}

export function dshHome({ bundleRoot }) {
  return process.env.DSH_HOME || path.join(bundleRoot, '.dsh-home');
}

export function dshCli({ bundleRoot }) {
  const nodeRoot = path.join(bundleRoot, 'offline', 'node');
  if (!fs.existsSync(nodeRoot)) return null;
  for (const dir of fs.readdirSync(nodeRoot)) {
    const candidate = path.join(nodeRoot, dir, process.platform === 'win32' ? 'dsh.cmd' : 'dsh');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function run(cli, args, { bundleRoot, timeoutMs = 300000 } = {}) {
  const command = process.platform === 'win32' ? 'cmd.exe' : cli;
  const argv = process.platform === 'win32' ? ['/d', '/s', '/c', `"${cli}" ${args.join(' ')}`] : args;
  try {
    const stdout = execFileSync(command, argv, {
      cwd: bundleRoot,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, DSH_HOME: dshHome({ bundleRoot }) },
    });
    return { ok: true, exit: 0, output: String(stdout || '').trim().slice(-8000) };
  } catch (error) {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`.trim() || String(error.message || error);
    return { ok: false, exit: typeof error.status === 'number' ? error.status : 1, output: output.slice(-8000) };
  }
}

export function probePluginCli({ bundleRoot }) {
  const cli = dshCli({ bundleRoot });
  if (!cli) return { ok: false, status: 'cli-missing', note: '未找到便携 dsh CLI（offline/node/*/dsh）。' };
  const help = run(cli, ['plugin', '--profile', 'web', 'add', '--help'], { bundleRoot, timeoutMs: 60000 });
  const acceptsTgz = /tgz|tarball|file:/i.test(help.output);
  return {
    ok: help.ok,
    status: help.ok ? (acceptsTgz ? 'ready' : 'unknown-input') : 'help-failed',
    cli: cli.replace(/\\/g, '/'),
    help: help.output.split(/\r?\n/).slice(0, 12).join('\n'),
    acceptsTgz,
  };
}

export function inspectPluginPackage(tgzPath) {
  if (!fs.existsSync(tgzPath)) throw new Error(`插件包不存在：${tgzPath}`);
  const buffer = fs.readFileSync(tgzPath);
  const manifest = readPackedManifest(buffer);
  if (!manifest || typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
    throw new Error('插件包缺少 package/package.json（name/version）。');
  }
  const dsh = manifest.dsh || {};
  const problems = [];
  if (!dsh.bundle || typeof dsh.bundle.patch !== 'string') problems.push('缺少 dsh.bundle.patch（插件层激活声明）。');
  if (!dsh.client || dsh.client.platform !== 'web') problems.push('缺少 dsh.client.platform="web"。');
  if (!manifest.exports || !(manifest.exports['./client'] || manifest.exports['./client.js'])) problems.push('缺少 exports["./client"] 客户端入口。');
  if (!manifest.license) problems.push('缺少 license。');
  return { manifest, problems, ok: problems.length === 0 };
}

export function installPluginPackage({ bundleRoot, workspaceRoot, tgzPath, catalogId = null, allowRemote = false }) {
  const info = inspectPluginPackage(tgzPath);
  if (!info.ok) return { ok: false, status: 'invalid-package', problems: info.problems };
  const probe = probePluginCli({ bundleRoot });
  if (!probe.ok || probe.status !== 'ready') {
    return { ok: false, status: 'cli-unavailable', probe };
  }
  const cli = dshCli({ bundleRoot });
  const result = run(cli, ['plugin', '--profile', 'web', 'add', `"${tgzPath}"`], { bundleRoot });
  if (!result.ok) return { ok: false, status: 'install-failed', exit: result.exit, output: result.output };
  const pluginName = info.manifest.name;
  const profilePackage = path.join(dshHome({ bundleRoot }), 'profiles', 'web', 'package.json');
  const registered = (() => {
    try { return fs.readFileSync(profilePackage, 'utf8').includes(pluginName); } catch { return false; }
  })();
  recordInstall(workspaceRoot, catalogId || `npm:${pluginName}`, {
    type: 'dsh-plugin',
    pluginName,
    version: info.manifest.version,
    distribution: { type: catalogId ? 'catalog' : 'local-tgz', path: tgzPath.replace(/\\/g, '/') },
    catalog_id: catalogId,
    allow_remote: !!allowRemote,
  });
  return {
    ok: true,
    status: 'installed',
    pluginName,
    version: info.manifest.version,
    registered,
    needs_restart: true,
    note: '插件式工作台已装入 profile：重启 Harness（桌面应用）后才会出现侧边栏入口与业务面板。',
  };
}

export function uninstallPluginPackage({ bundleRoot, workspaceRoot, id }) {
  const installs = readInstalls(workspaceRoot);
  const record = installs[id];
  if (!record || record.type !== 'dsh-plugin') return { ok: false, status: 'not-a-plugin-install' };
  const cli = dshCli({ bundleRoot });
  if (!cli) return { ok: false, status: 'cli-missing' };
  const result = run(cli, ['plugin', '--profile', 'web', 'remove', record.pluginName], { bundleRoot });
  if (!result.ok) return { ok: false, status: 'uninstall-failed', exit: result.exit, output: result.output };
  forgetInstall(workspaceRoot, id);
  return { ok: true, status: 'removed', pluginName: record.pluginName, needs_restart: true, data_kept: true };
}
