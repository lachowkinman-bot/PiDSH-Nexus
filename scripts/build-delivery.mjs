#!/usr/bin/env node
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const entry = path.join(ROOT, 'workbench-ui-plugin/src/delivery-service.mjs');
const outfile = path.join(ROOT, 'workbench-ui-plugin/lib/delivery-service.cjs');

if (!fs.existsSync(entry)) {
  console.error(`BUILD_DELIVERY_ABORT missing ${entry}`);
  process.exit(1);
}

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  sourcemap: false,
  legalComments: 'inline',
  logLevel: 'info',
});

const stat = fs.statSync(outfile);
console.log(`BUILD_DELIVERY_OK ${path.relative(ROOT, outfile).replace(/\\/g, '/')} bytes=${stat.size}`);
