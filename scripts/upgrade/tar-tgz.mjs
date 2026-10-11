// tar-tgz.mjs — 纯 JS 的最小 TGZ 读取/解包器（避免依赖 spawn tar，沙箱内 tar 子进程会被 EPERM）。
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

function parseEntries(buf, onEntry) {
  let off = 0
  let pendingLongName = null
  let pendingPaxPath = null
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512)
    if (header.every((b) => b === 0)) break
    const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '')
    const name0 = prefix ? `${prefix}/${rawName}` : rawName
    const size = parseInt(header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim(), 8) || 0
    const type = String.fromCharCode(header[156] || 0x30)
    off += 512
    const dataStart = off
    off += Math.ceil(size / 512) * 512
    const data = buf.subarray(dataStart, dataStart + size)
    if (type === 'L') { pendingLongName = data.toString('utf8').replace(/\0.*$/, ''); continue }
    if (type === 'x' || type === 'g') {
      const text = data.toString('utf8')
      const m = /(?:^|\n)\d+ path=([^\n]+)\n/.exec(text)
      if (m) pendingPaxPath = m[1]
      continue
    }
    const name = (pendingPaxPath || pendingLongName || name0).replace(/^\.\//, '')
    pendingPaxPath = null
    pendingLongName = null
    if (!name) continue
    onEntry({ name, type, size, data })
  }
}

export function readTgzEntry(tgzPath, entryPath) {
  const buf = zlib.gunzipSync(fs.readFileSync(tgzPath))
  let hit = null
  parseEntries(buf, (entry) => {
    if (!hit && entry.name === entryPath) hit = Buffer.from(entry.data)
  })
  return hit
}

export function extractTgz(tgzPath, destDir) {
  const buf = zlib.gunzipSync(fs.readFileSync(tgzPath))
  let count = 0
  parseEntries(buf, (entry) => {
    const name = entry.name
    if (name.startsWith('/') || name.split('/').includes('..')) return
    const target = path.join(destDir, name)
    if (entry.type === '5') { fs.mkdirSync(target, { recursive: true }); return }
    if (entry.type !== '0' && entry.type !== '') return
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, entry.data)
    count += 1
  })
  return count
}
