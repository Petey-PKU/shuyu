import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const MODEL_FOLDER = 'vits-piper-en_US-amy-medium';
const ARCHIVE_NAME = `${MODEL_FOLDER}.tar.bz2`;
const ARCHIVE_URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${ARCHIVE_NAME}`;
const ARCHIVE_API_URL = 'https://api.github.com/repos/k2-fsa/sherpa-onnx/releases/assets/402197894';
const ARCHIVE_SHA256 = '9a5d1fc497f85e8022b785bff5f8105203b1e33099ee6265203efc70b0cb0264';
const ARCHIVE_SIZE = 67_223_746;

const projectRoot = process.cwd();
const androidApp = path.resolve(projectRoot, 'android', 'app');
const assetsRoot = path.resolve(androidApp, 'src', 'main', 'assets');
const modelsRoot = path.resolve(assetsRoot, 'models');
const modelRoot = path.resolve(modelsRoot, MODEL_FOLDER);
const cacheRoot = path.resolve(projectRoot, '.cache', 'tts-models');
const archivePath = path.resolve(cacheRoot, ARCHIVE_NAME);
const partialPath = `${archivePath}.partial`;

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe TTS model path: ${child}`);
  }
}

async function sha256(file) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

async function archiveIsValid(file) {
  if (!existsSync(file) || statSync(file).size !== ARCHIVE_SIZE) return false;
  return (await sha256(file)) === ARCHIVE_SHA256;
}

async function downloadArchive() {
  mkdirSync(cacheRoot, { recursive: true });
  if (await archiveIsValid(archivePath)) return;
  if (existsSync(partialPath)) rmSync(partialPath, { force: true });

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`Downloading bundled TTS model (${attempt}/3, 67.2 MB)…`);
      const url = attempt < 3 ? ARCHIVE_API_URL : ARCHIVE_URL;
      const authorization = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          Accept: 'application/octet-stream',
          'User-Agent': 'Shuyu-Android-Build',
          ...authorization,
        },
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(partialPath));
      if (!(await archiveIsValid(partialPath))) throw new Error('SHA-256 or file size mismatch');
      renameSync(partialPath, archivePath);
      return;
    } catch (error) {
      lastError = error;
      if (existsSync(partialPath)) rmSync(partialPath, { force: true });
    }
  }
  throw new Error(`Unable to download verified TTS model: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function main() {
  if (!existsSync(androidApp)) {
    throw new Error('Android project is missing. Run "npx expo prebuild --platform android --no-install" first.');
  }
  assertInside(assetsRoot, modelRoot);
  if (existsSync(path.join(modelRoot, 'en_US-amy-medium.onnx')) && existsSync(path.join(modelRoot, 'tokens.txt'))) {
    console.log('Bundled TTS model is already prepared.');
    return;
  }

  await downloadArchive();
  mkdirSync(modelsRoot, { recursive: true });
  if (existsSync(modelRoot)) rmSync(modelRoot, { recursive: true, force: true });
  const result = spawnSync('tar', ['-xjf', archivePath, '-C', modelsRoot], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`tar extraction failed with exit code ${result.status ?? 'unknown'}`);
  if (!existsSync(path.join(modelRoot, 'en_US-amy-medium.onnx')) || !existsSync(path.join(modelRoot, 'tokens.txt'))) {
    throw new Error('Extracted TTS model is incomplete.');
  }
  console.log(`Prepared ${MODEL_FOLDER} in Android assets.`);
}

await main();
