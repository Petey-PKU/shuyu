import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const dictionary = resolve(root, 'assets/dictionary/ecdict-core.db');
const modelDirectory = resolve(root, 'android/app/src/main/assets/models/vits-piper-en_US-amy-medium');
const manifestPath = resolve(root, 'android/app/src/main/AndroidManifest.xml');

function requireFile(path: string, minimumBytes?: number) {
  assert.equal(existsSync(path), true, `Missing Android runtime asset: ${path}`);
  if (minimumBytes !== undefined) assert.ok(statSync(path).size >= minimumBytes, `Android asset is unexpectedly small: ${path}`);
}

function main() {
  const packageVersion = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version as string;
  const appVersion = (JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')) as { expo?: { version?: string } }).expo?.version;
  const gradle = readFileSync(resolve(root, 'android/app/build.gradle'), 'utf8');
  const gradleVersion = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  const gradleCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
  assert.equal(appVersion, packageVersion, 'app.json and package.json versions must match');
  assert.equal(gradleVersion, packageVersion, 'Android versionName must match package.json');
  assert.ok(Number.isInteger(gradleCode) && gradleCode > 0, 'Android versionCode must be a positive integer');
  requireFile(dictionary, 8_000_000);
  requireFile(resolve(modelDirectory, 'en_US-amy-medium.onnx'), 50_000_000);
  requireFile(resolve(modelDirectory, 'en_US-amy-medium.onnx.json'), 100);
  requireFile(resolve(modelDirectory, 'tokens.txt'), 100);
  requireFile(resolve(modelDirectory, 'MODEL_CARD'), 100);
  const manifest = readFileSync(manifestPath, 'utf8');
  assert.match(manifest, /<application[^>]+android:allowBackup="false"/, 'Android backup must stay disabled for local book privacy');
  assert.match(manifest, /android\.permission\.READ_EXTERNAL_STORAGE" tools:node="remove"/, 'Legacy broad storage permission must stay removed');
  console.log('Android asset preflight passed: bundled dictionary, offline voice model, and privacy manifest are present.');
}

main();
