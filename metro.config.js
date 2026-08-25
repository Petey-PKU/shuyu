const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@lingo-reader/mobi-parser') {
    return context.resolveRequest(
      context,
      path.resolve(__dirname, 'node_modules/@lingo-reader/mobi-parser/dist/index.browser.mjs'),
      platform,
    );
  }
  if (moduleName === '@lingo-reader/shared') {
    return context.resolveRequest(
      context,
      path.resolve(__dirname, 'node_modules/@lingo-reader/shared/dist/index.browser.mjs'),
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
