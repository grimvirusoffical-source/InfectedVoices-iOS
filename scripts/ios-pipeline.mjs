#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CORE_PIN = '667ae1cb2edac499b773fb9f688b6b46484a558d';
export const CORE_REPO = 'https://github.com/grimvirusoffical-source/InfectedVoices.git';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreDir = path.join(repoRoot, 'core');
const ascKey = path.join(repoRoot, '.secrets', 'AuthKey_S3527PMRV3.p8');

const KNOWN = new Set([
  '--submit',
  '--eas',
  '--help',
  '-h',
  'prepare',
  'sync',
  '--platform',
  '--platform=ios',
  'ios',
]);

function macArg(arg, next) {
  const low = String(arg).toLowerCase();
  if (/^(?:--)?(?:mac|macos|mac-catalyst|catalyst)$/.test(low)) return arg;
  if (/^--platform=(?:mac|macos|mac-catalyst|catalyst)$/.test(low)) return arg;
  if (/^--destination=/.test(low) && /mac|catalyst/.test(low) && !/iphone|ipad|ios/.test(low)) return arg;
  if ((low === '--platform' || low === '--destination') && next) {
    const n = String(next).toLowerCase();
    if (/^(?:mac|macos|mac-catalyst|catalyst)$/.test(n)) return `${arg} ${next}`;
  }
  return null;
}

function hasCredentials(env) {
  const fromEnv = env.ASC_API_KEY_PATH;
  if (fromEnv && fs.existsSync(fromEnv) && fs.statSync(fromEnv).size > 0) return true;
  return fs.existsSync(ascKey) && fs.statSync(ascKey).size > 0;
}

export function classify(argv, env = process.env) {
  const args = argv.filter((item) => item !== '--');
  for (let i = 0; i < args.length; i += 1) {
    const mac = macArg(args[i], args[i + 1]);
    if (mac) return { action: 'refuse-mac', exitCode: 2, arg: mac };
  }
  if (args.includes('--help') || args.includes('-h')) return { action: 'help', exitCode: 0 };

  let mode = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--platform') {
      const next = args[i + 1];
      if (next !== 'ios') {
        return {
          action: 'usage',
          exitCode: 1,
          message: `Unsupported platform "${next ?? ''}". This repository only builds iOS for the App Store.`,
        };
      }
      i += 1;
      continue;
    }
    if (arg === 'prepare' || arg === 'sync') {
      mode = arg;
      continue;
    }
    if (!KNOWN.has(arg)) {
      return { action: 'usage', exitCode: 1, message: `Unknown argument "${arg}".` };
    }
  }

  const eas = args.includes('--eas');
  const submit = args.includes('--submit');
  if (eas && !String(env.EXPO_TOKEN || '').trim()) return { action: 'refuse-eas', exitCode: 2 };
  if (submit && !hasCredentials(env)) return { action: 'refuse-submit', exitCode: 2 };
  if (!mode && eas) return { action: 'eas-unlocked', exitCode: 0 };
  if (!mode && submit) return { action: 'submit-present', exitCode: 0 };
  return { action: mode ?? 'sync', exitCode: null };
}

function helpText() {
  return [
    'Infected Voices iOS shell',
    `Core pin ${CORE_PIN}`,
    'Cap sync from Core ios: npm run native:ios',
    '  node scripts/ios-pipeline.mjs prepare',
    '  node scripts/ios-pipeline.mjs sync',
    'Mac is Open web or iOS Designed for iPad. Catalyst and macOS flags exit 2.',
    '--eas exits 2 until EXPO_TOKEN is set. This command does not upload to the App Store.',
    '--submit exits 2 until App Store credentials exist. No raw IPA is published on /get or the CDN.',
  ].join('\n');
}

function runNpm(args) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, args, {
    cwd: coreDir,
    stdio: 'inherit',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function assertPin() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: coreDir, encoding: 'utf8' });
  const head = (result.stdout || '').trim();
  if (head !== CORE_PIN) {
    console.error(`Core submodule HEAD ${head || '(missing)'} is not pin ${CORE_PIN} (${CORE_REPO}).`);
    process.exit(1);
  }
}

function syncFromCore(mode) {
  assertPin();
  if (mode === 'prepare' && !fs.existsSync(path.join(coreDir, 'node_modules'))) {
    runNpm(['install', '--include=dev', '--ignore-scripts']);
  }
  console.log('Cap sync from Core ios: npm run native:ios');
  runNpm(['run', 'native:ios']);
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const decision = classify(argv, env);
  if (decision.action === 'refuse-mac') {
    console.error(`No Mac native shell (${decision.arg}). Mac is Open web or iOS Designed for iPad. Catalyst and macOS flags exit 2.`);
    process.exit(decision.exitCode);
  }
  if (decision.action === 'help') {
    console.log(helpText());
    process.exit(0);
  }
  if (decision.action === 'usage') {
    console.error(decision.message);
    process.exit(decision.exitCode);
  }
  if (decision.action === 'refuse-eas') {
    console.error('EAS is blocked until EXPO_TOKEN is set. No App Store upload was attempted.');
    process.exit(2);
  }
  if (decision.action === 'refuse-submit') {
    console.error('App Store --submit is blocked until credentials exist (.secrets/AuthKey_S3527PMRV3.p8 or ASC_API_KEY_PATH). No upload was attempted.');
    process.exit(2);
  }
  if (decision.action === 'eas-unlocked') {
    console.log('EXPO_TOKEN is set. EAS is unblocked. This command does not upload to the App Store.');
    process.exit(0);
  }
  if (decision.action === 'submit-present') {
    console.log('App Store credentials are present. This command does not upload to the App Store.');
    process.exit(0);
  }
  syncFromCore(decision.action === 'prepare' ? 'prepare' : 'sync');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) main();
