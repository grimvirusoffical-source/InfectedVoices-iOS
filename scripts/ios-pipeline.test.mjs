import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE_PIN, classify } from './ios-pipeline.mjs';

const root = path.resolve(import.meta.dirname, '..');
const script = path.join(root, 'scripts', 'ios-pipeline.mjs');

function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, EXPO_TOKEN: '', ASC_API_KEY_PATH: '', ...env },
  });
}

test('Core submodule is the Stress PASS pin', () => {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: path.join(root, 'core'),
    encoding: 'utf8',
  });
  assert.equal(head.status, 0);
  assert.equal(head.stdout.trim(), CORE_PIN);
  const bundle = fs.readFileSync(path.join(root, 'core', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');
  assert.match(bundle, /PRODUCT_BUNDLE_IDENTIFIER = space\.infectedvoices\.studio;/);
  assert.equal(fs.existsSync(path.join(root, 'studio')), false);
  assert.equal(fs.existsSync(path.join(root, 'android')), false);
  assert.equal(fs.existsSync(path.join(root, 'vendor')), false);
});

test('README states parity, store-only /get honesty, and Cap sync', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /Core is the parity source/);
  assert.match(readme, /Store-only App Store/);
  assert.match(readme, /no raw IPA/i);
  assert.match(readme, /Cap sync from Core ios/);
  assert.match(readme, /native:ios/);
  assert.match(readme, /\/get/);
  assert.match(readme, /EXPO_TOKEN/);
  assert.match(readme, new RegExp(CORE_PIN));
  assert.match(readme, /Designed for iPad/);
});

test('sync script calls Core native:ios', () => {
  const source = fs.readFileSync(script, 'utf8');
  assert.match(source, /native:ios/);
  assert.match(source, /\['run', 'native:ios'\]/);
});

test('Catalyst and macOS flags exit 2', () => {
  for (const args of [
    ['--catalyst'],
    ['--macos'],
    ['--mac'],
    ['--mac-catalyst'],
    ['sync', '--platform', 'macos'],
    ['prepare', '--platform=catalyst'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')} → ${result.status}\n${result.stderr}`);
  }
});

test('--eas exits 2 until EXPO_TOKEN', () => {
  const blocked = run(['--eas']);
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /EXPO_TOKEN/);
  assert.doesNotMatch(`${blocked.stdout}${blocked.stderr}`, /uploaded to App Store Connect/i);

  const unlocked = run(['--eas'], { EXPO_TOKEN: 'present-for-gate-only' });
  assert.equal(unlocked.status, 0);
  assert.match(unlocked.stdout, /does not upload/);
  assert.equal(classify(['--eas'], {}).exitCode, 2);
  assert.equal(classify(['--eas'], { EXPO_TOKEN: 'present-for-gate-only' }).action, 'eas-unlocked');
});

test('--submit exits 2 until credentials and does not upload', () => {
  const blocked = run(['--submit']);
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /No upload was attempted/);
});

test('repo does not contain a raw IPA', () => {
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'core') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else assert.equal(entry.name.endsWith('.ipa'), false, full);
    }
  }
  walk(root);
});
