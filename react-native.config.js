module.exports = {
  dependencies: {
    // The model is bundled at build time. Shuyu never invokes Sherpa's optional
    // runtime download manager, so do not link its foreground download service
    // or merge the associated Android permissions into the app.
    '@kesha-antonov/react-native-background-downloader': {
      platforms: { android: null, ios: null },
    },
  },
};
