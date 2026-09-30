#!/usr/bin/env node
// gen-sample-xlsx.mjs — 生成最小真实 xlsx（含公式单元格，供 dsh-excel-panel L3 功能验证）
// 用法：node scripts/gen-sample-xlsx.mjs [out.xlsx]
// 结构：[Content_Types].xml + _rels/.rels + xl/workbook.xml + xl/_rels/workbook.xml.rels + xl/worksheets/sheet1.xml
// sheet1：A1=Item B1=Qty C1=Total(公式 =SUM(B2:B3)) A2/B2/A3/B3 数据行
import fs from 'node:fs';
import zlib from 'node:zlib';

const out = process.argv[2] || 'reports/u16-sample.xlsx';
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function makeZip(entries) {
  const chunks = []; const central = []; let offset = 0;
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));
    offset += local.length + nameBuf.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cdBuf, eocd]);
}

const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Salary" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
// 化名脱敏：name_masked；C2 = =B2*8000（公式结果可见判据）
const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>name_masked</t></is></c><c r="B1" t="inlineStr"><is><t>band</t></is></c><c r="C1" t="inlineStr"><is><t>total</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>EMP-****01</t></is></c><c r="B2"><v>3</v></c><c r="C2"><f>B2*8000</f><v>24000</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>EMP-****02</t></is></c><c r="B3"><v>2</v></c><c r="C3"><f>B3*8000</f><v>16000</v></c></row><row r="4"><c r="A4" t="inlineStr"><is><t>SUM</t></is></c><c r="C4"><f>SUM(C2:C3)</f><v>40000</v></c></row></sheetData></worksheet>`;

const zip = makeZip([
  ['[Content_Types].xml', Buffer.from(ct)], ['_rels/.rels', Buffer.from(rels)],
  ['xl/workbook.xml', Buffer.from(wb)], ['xl/_rels/workbook.xml.rels', Buffer.from(wbRels)],
  ['xl/worksheets/sheet1.xml', Buffer.from(sheet)],
]);
fs.writeFileSync(out, zip);
console.log(`XLSX_WRITTEN ${out} bytes=${zip.length}`);
