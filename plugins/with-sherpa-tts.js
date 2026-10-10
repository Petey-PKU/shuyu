const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod, withGradleProperties } = require('@expo/config-plugins');

function setGradleProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === 'property' && item.key === key);
  if (existing) existing.value = value;
  else properties.push({ type: 'property', key, value });
}

module.exports = function withSherpaTts(config) {
  const withProperties = withGradleProperties(config, (next) => {
    // 书语只使用 TTS 推理与原生 PCM 播放；禁用未使用的音频转码功能。
    // libarchive 保留给设置页的按需 .tar.bz2 音色下载解压使用。
    setGradleProperty(next.modResults, 'sherpaOnnxDisableFfmpeg', 'true');
    setGradleProperty(next.modResults, 'sherpaOnnxDisableLibarchive', 'false');

    // Release builds should remove unused Java bytecode and Android resources.
    // Keep these in the config plugin because the android directory is generated
    // by Expo prebuild and is intentionally not checked into the repository.
    setGradleProperty(next.modResults, 'android.enableMinifyInReleaseBuilds', 'true');
    setGradleProperty(next.modResults, 'android.enableShrinkResourcesInReleaseBuilds', 'true');
    return next;
  });
  const withArmPackaging = withAppBuildGradle(withProperties, (next) => {
    const contents = next.modResults.contents;
    const packagingStart = contents.indexOf('    packagingOptions {');
    const jniStart = contents.indexOf('        jniLibs {', packagingStart);
    if (packagingStart < 0 || jniStart < 0) throw new Error('Unable to locate Android JNI packaging options');
    // The sherpa prebuilt module declares four ABIs. This app targets phones,
    // so keep only ARM native libraries in the final APK.
    const excludesLine = '            excludes += ["**/x86/**", "**/x86_64/**"]\n';
    if (!contents.slice(jniStart, jniStart + 500).includes('x86_64')) {
      next.modResults.contents = `${contents.slice(0, jniStart + '        jniLibs {\n'.length)}${excludesLine}${contents.slice(jniStart + '        jniLibs {\n'.length)}`;
    }
    return next;
  });
  return withDangerousMod(withArmPackaging, ['android', async (next) => {
    // Older checkouts may still have generated the model into the ignored
    // Android assets directory. Remove only this exact generated folder so a
    // stale local prebuild can never reintroduce the model into a release APK.
    const assetsRoot = path.resolve(next.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
    const modelRoot = path.resolve(assetsRoot, 'models', 'vits-piper-en_US-amy-medium');
    const relative = path.relative(assetsRoot, modelRoot);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe generated TTS model path');
    if (fs.existsSync(modelRoot)) fs.rmSync(modelRoot, { recursive: true, force: true });
    return next;
  }]);
};
