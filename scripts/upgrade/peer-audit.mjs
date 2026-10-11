#!/usr/bin/env node
// peer-audit.mjs — 离线审计产品集插件对目标 DSH 版本的 peer/engines 声明（0.2 升级门禁）。
// 用法：node scripts/upgrade/peer-audit.mjs [--root .] [--target 0.2.0-rc.2]
//        [--out reports/upgrade-0.2.0-rc.2/peer-audit.json]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { readTgzEntry } from './tar-tgz.mjs'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const opt = (name, def) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const TARGET = opt('--target', '0.2.0-rc.2')
const OUT = path.resolve(ROOT, opt('--out', 'reports/upgrade-0.2.0-rc.2/peer-audit.json'))
const MANIFEST = path.resolve(ROOT, opt('--manifest', 'manifests/runtime-web.package.json'))
const RUNTIME_DIR = path.join(ROOT, '.work/runtime-web')

function loadSemver() {
  const require = createRequire(import.meta.url)
  for (const base of [path.join(ROOT, 'node_modules'), path.join(RUNTIME_DIR, 'node_modules')]) {
    try { return require(path.join(base, 'semver')) } catch { /* try next */ }
  }
  throw new Error('semver 不可用：先 npm ci 或先构建 .work/runtime-web')
}
const semver = loadSemver()

function readTgzPackageJson(tgz) {
  const data = readTgzEntry(tgz, 'package/package.json')
  if (!data) throw new Error(`tgz 内缺少 package/package.json: ${path.basename(tgz)}`)
  return JSON.parse(data.toString('utf8'))
}

function resolveSource(src) {
  if (!src.startsWith('file:')) return null
  // file: 相对 .work/runtime-web 解析（与 npm install 的语义一致）
  const abs = path.resolve(RUNTIME_DIR, src.slice('file:'.length))
  return abs
}

function readPluginPackage(src) {
  const abs = resolveSource(src)
  if (!abs) return null
  if (fs.existsSync(path.join(abs, 'package.json'))) return JSON.parse(fs.readFileSync(path.join(abs, 'package.json'), 'utf8'))
  if (abs.endsWith('.tgz') && fs.existsSync(abs)) return readTgzPackageJson(abs)
  return null
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const entries = []
const needsExemption = []
const unsatisfied = []
const unreadable = []

for (const [name, src] of Object.entries(manifest.dependencies)) {
  if (name === '@deepseek-ai/dsh') continue
  let pkg
  try { pkg = readPluginPackage(src) } catch (e) { unreadable.push({ name, src, error: String(e.message).slice(0, 160) }); continue }
  if (!pkg) { unreadable.push({ name, src, error: 'package.json 不可读' }); continue }
  const peers = Object.entries(pkg.peerDependencies || {}).filter(([k]) => k.startsWith('@deepseek-ai/dsh'))
  const enginesDsh = pkg.engines?.dsh ?? null
  const peerResults = peers.map(([range, value]) => ({
    name: range,
    range: value,
    satisfied: semver.satisfies(TARGET, value, { includePrerelease: true }),
  }))
  const enginesSatisfied = enginesDsh === null ? null : semver.satisfies(TARGET, enginesDsh, { includePrerelease: true })
  const bad = peerResults.filter((p) => !p.satisfied)
  const entry = {
    name,
    version: pkg.version ?? '0.0.0',
    dshPeers: peerResults,
    enginesDsh,
    enginesSatisfied,
    verdict: bad.length || enginesSatisfied === false ? 'needs-exemption' : 'ok',
  }
  entries.push(entry)
  if (entry.verdict !== 'ok') needsExemption.push(entry)
  for (const b of bad) unsatisfied.push({ plugin: name, version: entry.version, peer: b.name, range: b.range })
  if (enginesSatisfied === false) unsatisfied.push({ plugin: name, version: entry.version, peer: 'engines.dsh', range: enginesDsh })
}

const report = {
  schema: 'pids-nexus/upgrade-peer-audit/v1',
  generatedAt: new Date().toISOString(),
  target: TARGET,
  manifest: path.relative(ROOT, MANIFEST),
  totalPlugins: entries.length,
  ok: needsExemption.length === 0 && unreadable.length === 0,
  unsatisfied,
  needsExemption,
  unreadable,
  entries,
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(`PEER_AUDIT target=${TARGET} plugins=${entries.length} needsExemption=${needsExemption.length} unreadable=${unreadable.length} -> ${path.relative(ROOT, OUT)}`)
for (const e of needsExemption) console.log(`  NEEDS-EXEMPTION ${e.name}@${e.version} peers=${e.dshPeers.map((p) => `${p.range}:${p.satisfied ? 'ok' : 'X'}`).join(',')} engines=${e.enginesDsh ?? '-'}`)
for (const u of unreadable) console.log(`  UNREADABLE ${u.name} (${u.error})`)
process.exit(report.ok ? 0 : 1)
