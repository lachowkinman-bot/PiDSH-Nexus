#!/usr/bin/env node
// pluginload-report.mjs — 冷启动日志门禁：零禁用行、零 failed-to-import、零 pending、零激活错误。
// 用法：node scripts/upgrade/pluginload-report.mjs --log <.dsh-home/logs/xxx.err.log>
//        [--out reports/upgrade-0.2.0-rc.2/pluginload-report.json]
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const opt = (name, def) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const LOG = opt('--log', '')
const OUT = path.resolve(ROOT, opt('--out', 'reports/upgrade-0.2.0-rc.2/pluginload-report.json'))
if (!LOG || !fs.existsSync(LOG)) {
  console.error(`PLUGINLOAD_REPORT 找不到日志：${LOG || '(缺少 --log)'}`)
  process.exit(2)
}

const text = fs.readFileSync(LOG, 'utf8')
const lines = text.split(/\r?\n/)
const disablingRows = []
const failedImports = []
const pendingServices = []
const activationErrors = []

for (const line of lines) {
  let m
  if ((m = /disabling profile plugin row "?([^"\s]+)"?[：: ]*(.*)$/i.exec(line))) disablingRows.push({ plugin: m[1], detail: m[2].slice(0, 200) })
  else if ((m = /failed to import|ERR_MODULE_NOT_FOUND|Cannot find module/i.exec(line))) failedImports.push(line.slice(0, 240))
  else if ((m = /waiting for services?:?\s*([^)\n]{1,200})/i.exec(line))) pendingServices.push(m[1].trim())
  else if ((m = /^([@\w./-]+)\s+\([^)]+\):.*(Error|TypeError|ReferenceError):/.exec(line))) activationErrors.push({ plugin: m[1], detail: line.slice(0, 240) })
}

const report = {
  schema: 'pids-nexus/upgrade-pluginload-report/v1',
  generatedAt: new Date().toISOString(),
  log: path.relative(ROOT, LOG),
  counts: {
    disablingRows: disablingRows.length,
    failedImports: failedImports.length,
    pendingServices: pendingServices.length,
    activationErrors: activationErrors.length,
  },
  disablingRows,
  failedImports,
  pendingServices,
  activationErrors,
  ok: disablingRows.length === 0 && failedImports.length === 0 && pendingServices.length === 0 && activationErrors.length === 0,
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(`PLUGINLOAD_REPORT disabling=${disablingRows.length} failedImports=${failedImports.length} pending=${pendingServices.length} activationErrors=${activationErrors.length} ok=${report.ok} -> ${path.relative(ROOT, OUT)}`)
process.exit(report.ok ? 0 : 1)
