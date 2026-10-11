#!/usr/bin/env node
// build-compatibility-exemptions.mjs — 由 peer-audit 报告生成 profile 版本豁免表。
// 纪律：只写精确 `name@version` → [dsh 版本] 映射，禁止宽范围豁免。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const AUDIT = path.resolve(ROOT, 'reports/upgrade-0.2.0-rc.2/peer-audit.json')
const OUT = path.resolve(ROOT, 'templates/runtime/compatibility.json')

const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'))
const map = {}
if (fs.existsSync(OUT)) {
  try {
    const old = JSON.parse(fs.readFileSync(OUT, 'utf8'))
    for (const [key, value] of Object.entries(old)) map[key] = Array.isArray(value) ? [...value] : value
  } catch { /* 旧表损坏时以审计结果重建 */ }
}
for (const entry of audit.needsExemption || []) {
  const key = `${entry.name}@${entry.version}`
  const set = new Set(map[key] || [])
  set.add(audit.target)
  map[key] = [...set]
}
const sorted = Object.fromEntries(Object.keys(map).sort().map((key) => [key, map[key]]))
fs.writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`)
console.log(`COMPAT_EXEMPTIONS entries=${Object.keys(sorted).length} target=${audit.target} -> ${path.relative(ROOT, OUT)}`)
