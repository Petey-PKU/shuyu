const { withGradleProperties } = require('@expo/config-plugins');

function setGradleProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === 'property' && item.key === key);
  if (existing) existing.value = value;
  else properties.push({ type: 'property', key, value });
}

module.exports = function withSherpaTts(config) {
  return withGradleProperties(config, (next) => {
    // 书语只使用 TTS 推理与原生 PCM 播放；禁用未使用的音频转码和归档功能，
    // 可显著减小 APK，并避免把 FFmpeg/libarchive 一并打进安装包。
    setGradleProperty(next.modResults, 'sherpaOnnxDisableFfmpeg', 'true');
    setGradleProperty(next.modResults, 'sherpaOnnxDisableLibarchive', 'true');
    return next;
  });
};
