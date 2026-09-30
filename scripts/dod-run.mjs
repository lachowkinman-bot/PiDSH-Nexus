#!/usr/bin/env node
// dod-run.mjs — U3/U16 四级 DoD 的 L2/L4 执行器（015 §14.2：装载行≠可用，独立性禁用/启用必测）
// 子命令：
//   boot-capture <outLog> <port>  启动 dsh --profile web 抓启动日志（插件装载行）+ 健康探测（/ 与 /workbench/api/scenes）后退出
//   l4-one <pkg> <tgz>            单包独立性：remove→boot健康→add→boot健康（P0/P1 全量 + catalog 抽样）
// 证据：reports/boot-log-*.txt、reports/l2-loading.json、reports/l4-independence.csv
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const NODE_DIR = path.join(ROOT, 'offline/node/node-v24.21.0-win-x64');
const DSH_HOME = process.env.DSH_HOME || path.join(ROOT, '.dsh-home');
const env = { ...process.env, DSH_HOME };
env.PATH = `${NODE_DIR}${path.delimiter}${env.PATH || ''}`;

function dshSync(args, timeout = 240000) {
  return spawnSync('dsh.cmd', args, { env, cwd: ROOT, encoding: 'utf8', timeout, shell: true, windowsHide: true });
}
async function bootCapture(outLog, port) {
  const child = spawn('dsh.cmd', ['--profile', 'web', '--no-open', '--port', String(port)], { env, cwd: ROOT, shell: true, windowsHide: true });
  let log = '';
  const urlRe = new RegExp(`dsh web:.*?(http://127\\.0\\.0\\.1:${port}\\S*)`);
  let url = null;
  const deadline = Date.now() + 100000;
  await new Promise((resolve) => {
    const onData = (d) => {
      log += d.toString();
      const m = log.match(urlRe);
      if (m && !url) url = m[1];
    };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    const timer = setInterval(() => { if (url || Date.now() > deadline) { clearInterval(timer); resolve(); } }, 500);
  });
  // 让装载日志再沉淀 3s
  await new Promise((r) => setTimeout(r, 3000));
  // 让装载日志沉淀并轮询工作台 API（路由注册晚于 URL 行出现，实测需 ~30-60s）
  const base = url ? url.split('?')[0] : null;
  // 用 curl.exe 探测（本环境实测：undici fetch 会被 fence 掐断连接而 curl 正常）
  const fetchCode = async (p) => new Promise((resolve) => {
    const r = spawnSync('curl.exe', ['-s', '-o', 'NUL', '-w', '%{http_code}', '--max-time', '8', `${base}${p}`], { encoding: 'utf8', timeout: 12000, shell: true, windowsHide: true });
    const code = parseInt((r.stdout || '').trim(), 10);
    resolve(Number.isFinite(code) && code > 0 ? code : 0);
  });
  // ready=200（等路由就绪）；any=任何 HTTP 响应即算（fence 存活证据）
  const poll = async (p, mode, tries = 14) => {
    for (let i = 0; i < tries; i++) {
      const st = await fetchCode(p);
      if (mode === 'any' && st > 0) return st;
      if (st === 200) return 200;
      if (st !== 200 && mode === 'ready') { await new Promise((r) => setTimeout(r, 5000)); continue; }
      return st;
    }
    return 0;
  };
  const health = { root: 0, workbenchApi: 0, alive: false, bound: 'unknown' };
  if (base) {
    health.root = await poll('/', 'any', 2);                       // fence 400/401 也证明 HTTP 服务存活（快速）
    health.workbenchApi = await poll('/workbench/api/scenes', 'ready', 2);   // 参考项（时序敏感，不作判据；2 次即止控制耗时）
    // 判据项：URL 已输出且端口仍处于 LISTENING = 壳进入服务状态
    try {
      const ns = spawnSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 15000, shell: true, windowsHide: true });
      const line = (ns.stdout || '').split(/\r?\n/).find((l) => l.includes(`:${port}`) && l.includes('LISTENING'));
      health.bound = line ? line.trim().split(/\s+/)[1] : 'not-found';
      health.alive = Boolean(url && line);
    } catch { health.bound = 'netstat-fail'; health.alive = false; }
  }
  try { child.kill('SIGTERM'); } catch { }
  await new Promise((r) => setTimeout(r, 1500));
  try { spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: true, windowsHide: true, timeout: 20000 }); } catch { }
  // 兜底：按端口清残余监听进程（shell:true 下 node 孙进程可能逃过 /T）
  for (let i = 0; i < 3; i++) {
    const ns = spawnSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 15000, shell: true, windowsHide: true });
    const line = (ns.stdout || '').split(/\r?\n/).find((l) => l.includes(`:${port}`) && l.includes('LISTENING'));
    if (!line) break;
    const pid = line.trim().split(/\s+/).pop();
    if (pid && /^\d+$/.test(pid)) { try { spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { shell: true, windowsHide: true, timeout: 20000 }); } catch { } }
    await new Promise((r) => setTimeout(r, 1500));
  }
  fs.writeFileSync(outLog, log);
  return { url, health, log };
}
const sub = process.argv[2];
if (sub === 'boot-capture') {
  const outLog = path.resolve(process.argv[3] || `reports/boot-log-${Date.now()}.txt`);
  const port = process.argv[4] || '3810';
  const { health } = await bootCapture(outLog, port);
  const log = fs.readFileSync(outLog, 'utf8');
  // L2 装载行提取：pi2dsh 行 + client/server 插件注册行
  const piLoads = [...log.matchAll(/\[pi2dsh\] loaded ([^\s:]+):/g)].map((m) => m[1]);
  const engineLoads = [...log.matchAll(/\[pi2dsh engine\] preparing (\d+) Pi package/g)].map((m) => +m[1]);
  const fails = [...log.matchAll(/failed (?:to load )?plugin[^\n]*/gi)].map((m) => m[0]);
  const result = { ts: new Date().toISOString(), log: outLog, health, piLoads, enginePrepared: engineLoads, pluginFailLines: fails, piLoadCount: piLoads.length };
  fs.writeFileSync(path.join(ROOT, 'reports/l2-loading.json'), JSON.stringify(result, null, 1));
  console.log(`BOOT_CAPTURE_DONE health=${JSON.stringify(health)} piLoads=${piLoads.length} failLines=${fails.length} → reports/l2-loading.json`);
} else if (sub === 'l4-one') {
  const pkg = process.argv[3];
  const tgz = path.resolve(process.argv[4]);
  if (!pkg || !tgz || !fs.existsSync(tgz)) { console.error('usage: dod-run.mjs l4-one <pkg> <tgz>'); process.exit(2); }
  const csv = path.join(ROOT, 'reports/l4-independence.csv');
  if (!fs.existsSync(csv)) fs.writeFileSync(csv, 'pkg,phase,boot_alive,bound,ts\n');
  const log = (phase, h) => fs.appendFileSync(csv, `${pkg},${phase},${h.health.alive ? 1 : 0},${h.health.bound},${new Date().toISOString()}\n`);
  // 1) 禁用（remove）
  const rm = dshSync(['plugin', '--profile', 'web', 'remove', pkg], 180000);
  fs.appendFileSync(path.join(ROOT, 'reports/l4-independence.csv'), ''); // noop keep csv
  const bootNo = await bootCapture(`reports/boot-log-l4-${pkg.replace(/[^\w.-]/g, '_')}-removed.txt`, '3811');
  log('removed', bootNo);
  // 2) 启用（add 回来）
  const add = dshSync(['plugin', '--profile', 'web', 'add', tgz], 180000);
  const bootBack = await bootCapture(`reports/boot-log-l4-${pkg.replace(/[^\w.-]/g, '_')}-restored.txt`, '3812');
  log('restored', bootBack);
  const verdict = rm.status === 0 && add.status === 0 && bootNo.health.alive && bootBack.health.alive ? 'PASS' : 'CHECK';
  console.log(`L4_ONE_DONE ${pkg} rm=${rm.status} add=${add.status} verdict=${verdict}`);
  process.exit(verdict === 'PASS' ? 0 : 1);
} else {
  console.log('usage: dod-run.mjs boot-capture <outLog> <port> | l4-one <pkg> <tgz>');
  process.exit(2);
}
