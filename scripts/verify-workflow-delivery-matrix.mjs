#!/usr/bin/env node
// Validate 78 workflow deliveries across the seven formal formats.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import { ensureWorkspace } from '../workbench-ui-plugin/lib/platform.mjs';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflows/index.json'), 'utf8'));
const workspaceRoot = path.resolve(process.env.PIDSH_DELIVERY_WORKSPACE || path.join(ROOT, '.work', `r12-delivery-${Date.now()}`));
ensureWorkspace({ bundleRoot: ROOT, workspaceRoot });
const service = require('../workbench-ui-plugin/lib/delivery-service.cjs').createDeliveryService({
  root: ROOT,
  workspaceRoot,
  audit: () => {},
});
const formats = ['md', 'csv', 'html', 'xlsx', 'docx', 'pptx', 'pdf'];
const records = [];
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const zipText = (file, required) => {
  const zip = new AdmZip(file);
  const names = zip.getEntries().map((entry) => entry.entryName);
  for (const name of required) if (!names.includes(name)) throw new Error(`missing ${name}`);
  return zip.getEntries().filter((entry) => /\.(xml|rels)$/i.test(entry.entryName))
    .map((entry) => entry.getData().toString('utf8')).join('\n');
};

async function pdfText(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), disableWorker: true, useSystemFonts: true });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const text = await page.getTextContent();
  return text.items.map((item) => item.str).join(' ');
}

for (const workflow of index.workflows) {
  try {
    const result = await service.deliverDomain({
      domain: workflow.domain,
      workflowId: workflow.workflow_id,
      formats,
    });
    if (!result.ok || result.artifacts.length !== 7) throw new Error(`artifacts=${result.artifacts.length}`);
    for (const artifact of result.artifacts) {
      const file = path.join(workspaceRoot, artifact.file);
      let pass = fs.existsSync(file) && fs.statSync(file).size > 0;
      let note = `${artifact.bytes} bytes`;
      try {
        if (sha256(file) !== artifact.sha256) throw new Error('sha mismatch');
        const prefix = fs.readFileSync(file).subarray(0, 8).toString('latin1');
        if (artifact.format === 'md') {
          const text = fs.readFileSync(file, 'utf8');
          if (!text.startsWith('# ') || !text.includes(workflow.workflow_id)) throw new Error('markdown content missing');
        } else if (artifact.format === 'csv') {
          const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
          if (lines.length < 2) throw new Error('csv rows missing');
        } else if (artifact.format === 'html') {
          const text = fs.readFileSync(file, 'utf8');
          if (!/^<!DOCTYPE html>/i.test(text) || !text.includes(workflow.workflow_id)) throw new Error('html content missing');
        } else if (artifact.format === 'xlsx') {
          if (!prefix.startsWith('PK')) throw new Error('xlsx header');
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(file);
          const sheet = workbook.worksheets[0];
          let hasWorkflow = false;
          let hasFormula = false;
          sheet.eachRow((row) => row.eachCell((cell) => {
            if (String(cell.value || '').includes(workflow.workflow_id)) hasWorkflow = true;
            if (cell.value && typeof cell.value === 'object' && cell.value.formula) hasFormula = true;
          }));
          if (!hasWorkflow || !hasFormula) throw new Error(`xlsx workflow=${hasWorkflow} formula=${hasFormula}`);
        } else if (artifact.format === 'docx') {
          const xml = zipText(file, ['word/document.xml']);
          if (!xml.includes(workflow.workflow_id)) throw new Error('docx workflow missing');
        } else if (artifact.format === 'pptx') {
          const xml = zipText(file, ['ppt/presentation.xml', 'ppt/slides/slide1.xml']);
          if (!xml.includes(workflow.workflow_id)) throw new Error('pptx workflow missing');
        } else if (artifact.format === 'pdf') {
          if (!prefix.startsWith('%PDF-')) throw new Error('pdf header');
          const text = await pdfText(file);
          if (!text.includes(workflow.workflow_id)) throw new Error('pdf workflow missing');
        }
      } catch (error) {
        pass = false;
        note += ` :: ${error.message}`;
      }
      records.push({ workflow_id: workflow.workflow_id, format: artifact.format, pass, note, file: artifact.file });
    }
  } catch (error) {
    for (const format of formats) records.push({ workflow_id: workflow.workflow_id, format, pass: false, note: String(error.message || error) });
  }
}

const failed = records.filter((item) => !item.pass);
const report = {
  schema: 'pids-nexus/workflow-delivery-matrix/v1',
  generated_at: new Date().toISOString(),
  workspace_root: workspaceRoot,
  workflows: index.workflows.length,
  expected: index.workflows.length * formats.length,
  checked: records.length,
  pass: records.length - failed.length,
  fail: failed.length,
  records,
};
fs.writeFileSync(path.join(ROOT, 'reports/r12-workflow-delivery-matrix.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(ROOT, 'reports/r12-workflow-delivery-matrix.md'), [
  '# R12 Workflow Delivery Matrix',
  '',
  `- Result: ${failed.length ? 'FAIL' : 'PASS'}`,
  `- Workflows: ${report.workflows}`,
  `- Formats: ${formats.join(', ')}`,
  `- Checks: ${report.pass}/${report.checked}`,
  `- Failed: ${report.fail}`,
  '',
  ...failed.slice(0, 50).map((item) => `- FAIL ${item.workflow_id} ${item.format}: ${item.note}`),
].join('\n'), 'utf8');
console.log(`WORKFLOW_DELIVERY_MATRIX ${failed.length ? 'FAIL' : 'PASS'} ${report.pass}/${report.checked} -> reports/r12-workflow-delivery-matrix.json`);
if (failed.length) process.exit(1);
