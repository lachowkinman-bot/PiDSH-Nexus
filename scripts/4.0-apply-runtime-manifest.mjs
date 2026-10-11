#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const root = path.resolve(arg('--root', process.cwd()));
const dataRoot = path.resolve(arg('--data-root', process.env.UNIVERSAL_WORKBENCH_DATA_ROOT || ''));
const manifestPath = path.join(root, 'manifests', 'runtime-web.package.json');
const profilePath = dataRoot
  ? path.join(dataRoot, 'dsh-home', 'profiles', 'web', 'package.json')
  : path.join(root, '.dsh-home', 'profiles', 'web', 'package.json');

if (!fs.existsSync(manifestPath)) throw new Error(`runtime manifest missing: ${manifestPath}`);
if (!fs.existsSync(profilePath)) throw new Error(`runtime profile missing: ${profilePath}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const previous = Array.isArray(profile?.dsh?.profile?.bundles) ? profile.dsh.profile.bundles : [];
const loaded = Array.isArray(manifest?.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles : [];

profile.dsh = profile.dsh || {};
profile.dsh.profile = profile.dsh.profile || {};
profile.dsh.profile.bundles = loaded;
profile.version = '4.0.0';
profile.name = 'universal-workbench-runtime-web';

const backup = `${profilePath}.pre-4.0.json`;
if (!fs.existsSync(backup)) fs.copyFileSync(profilePath, backup);
const tmp = `${profilePath}.${process.pid}.${Date.now()}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(profile, null, 2), 'utf8');
fs.renameSync(tmp, profilePath);

const report = {
  schemaVersion: '1.0',
  gate: 'runtime-profile-apply',
  manifest: path.relative(root, manifestPath).replace(/\\/g, '/'),
  profile: profilePath,
  previousBundleCount: previous.length,
  loadedBundleCount: loaded.length,
  disabled: previous.filter((name) => !loaded.includes(name)),
  ok: true,
  finishedAt: new Date().toISOString()
};
const out = path.join(root, 'reports', '4.0', 'runtime-profile-apply.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
