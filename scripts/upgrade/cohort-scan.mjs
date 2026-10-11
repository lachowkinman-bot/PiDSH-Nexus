#!/usr/bin/env node
// cohort-scan.mjs — 检查运行时 profile 中 @deepseek-ai/dsh* 是否零残留 0.1.x（0.2 升级门禁）。
// 用法：node scripts/upgrade/cohort-scan.mjs [--profile <dir>] [--line 0.2] [--out <json>]
//   profile 默认取 $PIDSH_RUNTIME_PROFILE，其次 .dsh-home/profiles/web
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const opt = (name, def) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const PROFILE = path.resolve(ROOT, opt('--profile', process.env.PIDSH_RUNTIME_PROFILE || '.dsh-home/profiles/web'))
const LINE = opt('--line', '0.2')
const OUT = path.resolve(ROOT, opt('--out', 'reports/upgrade-0.2.0-rc.2/cohort-scan.json'))
const ALLOWLIST_FILE = path.resolve(ROOT, opt('--allowlist', 'manifests/upgrade/cohort-allowlist.json'))

function isStale(version) { return typeof version === 'string' && version.length > 0 && !version.startsWith(`${LINE}.`) }
const allowlist = []
if (fs.existsSync(ALLOWLIST_FILE)) {
  try {
    for (const entry of JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8')).entries || []) allowlist.push(entry)
  } catch { /* 白名单损坏按空处理，会体现为 gate 失败 */ }
}
const allowed = (name, version) => allowlist.find((e) => e.name === name && e.version === version)

const packages = []
const stale = []
const scopeDir = path.join(PROFILE, 'node_modules', '@deepseek-ai')
if (fs.existsSync(scopeDir)) {
  for (const dir of fs.readdirSync(scopeDir)) {
    if (!dir.startsWith('dsh')) continue
    const pkgFile = path.join(scopeDir, dir, 'package.json')
    if (!fs.existsSync(pkgFile)) continue
    let version = ''
    try { version = JSON.parse(fs.readFileSync(pkgFile, 'utf8')).version ?? '' } catch { version = '' }
    const entry = { name: `@deepseek-ai/${dir}`, version }
    packages.push(entry)
    if (isStale(version)) stale.push(entry)
  }
}

const lockStale = []
const nestedStale = []
const lockFile = path.join(PROFILE, 'package-lock.json')
if (fs.existsSync(lockFile)) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'))
    for (const [key, value] of Object.entries(lock.packages || {})) {
      const m = /node_modules\/@deepseek-ai\/(dsh[\w-]*)$/.exec(key)
      if (!m) continue
      const version = value?.version ?? ''
      if (!isStale(version)) continue
      const topLevel = key === `node_modules/@deepseek-ai/${m[1]}`
      const record = { name: `@deepseek-ai/${m[1]}`, version, key }
      if (topLevel) lockStale.push(record)
      else nestedStale.push(record)
    }
  } catch { /* lock 损坏时由构建门禁另行处理 */ }
}

const blocked = stale.filter((entry) => !allowed(entry.name, entry.version))
const blockedLock = lockStale.filter((entry) => !allowed(entry.name, entry.version))
const allowlisted = [...stale, ...lockStale]
  .filter((entry) => allowed(entry.name, entry.version))
  .map((entry) => ({ ...entry, reason: allowed(entry.name, entry.version).reason }))

const report = {
  schema: 'pids-nexus/upgrade-cohort-scan/v1',
  generatedAt: new Date().toISOString(),
  profile: PROFILE,
  expectedLine: `${LINE}.x`,
  scanned: packages.length,
  stale,
  lockStale,
  nestedStale,
  allowlisted,
  allowlist: path.relative(ROOT, ALLOWLIST_FILE),
  ok: blocked.length === 0 && blockedLock.length === 0,
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(`COHORT_SCAN profile=${PROFILE} scanned=${packages.length} stale=${stale.length} lockStale=${lockStale.length} nestedStale=${nestedStale.length} allowlisted=${allowlisted.length} -> ${path.relative(ROOT, OUT)}`)
for (const s of stale.slice(0, 20)) console.log(`  ${blocked.includes(s) ? 'STALE' : 'ALLOWED'} ${s.name}@${s.version}`)
for (const s of lockStale.slice(0, 20)) console.log(`  ${blockedLock.includes(s) ? 'STALE(lock)' : 'ALLOWED(lock)'} ${s.name}@${s.version}`)
for (const s of nestedStale.slice(0, 20)) console.log(`  NESTED(plugin-private) ${s.name}@${s.version} ${s.key}`)
process.exit(report.ok ? 0 : 1)
