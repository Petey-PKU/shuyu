import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const dictionary = resolve(root, 'assets/dictionary/ecdict-core.db');
const androidAssets = resolve(root, 'android/app/src/main/assets');
const modelDirectory = resolve(androidAssets, 'models/vits-piper-en_US-amy-medium');
const manifestPath = resolve(root, 'android/app/src/main/AndroidManifest.xml');

function requireFile(path: string, minimumBytes?: number) {
  assert.equal(existsSync(path), true, `Missing Android runtime asset: ${path}`);
  if (minimumBytes !== undefined) assert.ok(statSync(path).size >= minimumBytes, `Android asset is unexpectedly small: ${path}`);
}

function findBundledModelFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return findBundledModelFiles(entryPath);
    return /\.(onnx|onnx\.json|tar\.bz2)$/i.test(entry.name) || /amy-medium/i.test(entry.name) ? [entryPath] : [];
  });
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
  assert.equal(existsSync(modelDirectory), false, 'Amy voice must be downloaded after install, not bundled in the APK');
  assert.deepEqual(findBundledModelFiles(androidAssets), [], 'Android assets must not contain a bundled ONNX voice model or archive');
  const manifest = readFileSync(manifestPath, 'utf8');
  assert.match(manifest, /<application[^>]+android:allowBackup="false"/, 'Android backup must stay disabled for local book privacy');
  assert.match(manifest, /android\.permission\.READ_EXTERNAL_STORAGE" tools:node="remove"/, 'Legacy broad storage permission must stay removed');
  console.log('Android asset preflight passed: bundled dictionary and privacy manifest are present; Amy voice remains an optional download.');
}

main();
