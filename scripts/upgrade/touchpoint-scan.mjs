#!/usr/bin/env node
// touchpoint-scan.mjs — 按 dsh-plugin-upgrade-skill 的七类触点模式表扫描插件源码/构建产物。
// 用法：
//   node scripts/upgrade/touchpoint-scan.mjs                    # 扫 workbench-ui-plugin（src+lib+清单）
//   node scripts/upgrade/touchpoint-scan.mjs --fleet            # 追加扫描产品集全部离线 tarball
//   node scripts/upgrade/touchpoint-scan.mjs --fleet --extract-dir .work/scan-extract
import fs from 'node:fs'
import path from 'node:path'
import { extractTgz } from './tar-tgz.mjs'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const has = (n) => argv.includes(n)
const opt = (name, def) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const PLUGIN_DIR = path.resolve(ROOT, opt('--root', 'workbench-ui-plugin'))
const PATTERNS = path.resolve(ROOT, opt('--patterns', 'tools/dsh-upgrade-skill/skills/plugin-upgrade/references/pre-flight-patterns.json'))
const OUT = path.resolve(ROOT, opt('--out', 'reports/upgrade-0.2.0-rc.2/touchpoint-scan.json'))
const FLEET = has('--fleet')
const EXTRACT = path.resolve(ROOT, opt('--extract-dir', '.work/scan-extract'))
const MAX_BYTES = 1.5 * 1024 * 1024
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.yml', '.yaml'])

const spec = JSON.parse(fs.readFileSync(PATTERNS, 'utf8'))
const classes = spec.classes.map((c) => ({ ...c, regexes: c.patterns.map((p) => new RegExp(p)) }))

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (CODE_EXT.has(path.extname(entry.name))) out.push(full)
  }
  return out
}

function scanFiles(files, targetLabel, hits) {
  let scanned = 0
  for (const file of files) {
    let stat
    try { stat = fs.statSync(file) } catch { continue }
    if (stat.size > MAX_BYTES) { hits.skippedLarge.push({ target: targetLabel, file: path.relative(ROOT, file), bytes: stat.size }); continue }
    let text
    try { text = fs.readFileSync(file, 'utf8') } catch { continue }
    scanned += 1
    const lines = text.split(/\r?\n/)
    lines.forEach((line, idx) => {
      for (const cls of classes) {
        for (let pi = 0; pi < cls.regexes.length; pi += 1) {
          if (cls.regexes[pi].test(line)) {
            hits.entries.push({ target: targetLabel, file: path.relative(ROOT, file), line: idx + 1, classId: cls.id, classSlug: cls.slug, patternIndex: pi })
          }
        }
      }
    })
  }
  return scanned
}

const hits = { entries: [], skippedLarge: [] }
let scannedFiles = scanFiles(walk(PLUGIN_DIR), 'workbench-ui-plugin', hits)

if (FLEET) {
  fs.mkdirSync(EXTRACT, { recursive: true })
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/runtime-web.package.json'), 'utf8'))
  for (const [name, src] of Object.entries(manifest.dependencies)) {
    if (name === '@deepseek-ai/dsh' || !src.startsWith('file:')) continue
    const abs = path.resolve(ROOT, '.work/runtime-web', src.slice(5))
    if (!abs.endsWith('.tgz') || !fs.existsSync(abs)) continue
    const slug = path.basename(abs, '.tgz')
    const dest = path.join(EXTRACT, slug)
    if (!fs.existsSync(path.join(dest, 'package'))) {
      fs.mkdirSync(dest, { recursive: true })
      try { extractTgz(abs, dest) } catch { continue }
    }
    const pkgRoot = path.join(dest, 'package')
    scannedFiles += scanFiles(walk(pkgRoot), name, hits)
  }
}

const byClass = Object.fromEntries(classes.map((c) => [c.id, hits.entries.filter((h) => h.classId === c.id).length]))
const report = {
  schema: 'pids-nexus/upgrade-touchpoint-scan/v1',
  generatedAt: new Date().toISOString(),
  pluginDir: path.relative(ROOT, PLUGIN_DIR),
  fleet: FLEET,
  scannedFiles,
  byClass,
  totalHits: hits.entries.length,
  skippedLargeCount: hits.skippedLarge.length,
  entries: hits.entries,
  skippedLarge: hits.skippedLarge,
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(`TOUCHPOINT_SCAN files=${scannedFiles} hits=${hits.entries.length} byClass=${JSON.stringify(byClass)} skippedLarge=${hits.skippedLarge.length} -> ${path.relative(ROOT, OUT)}`)
process.exit(0)
