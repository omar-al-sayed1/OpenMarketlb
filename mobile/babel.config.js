module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 57) automatically adds the react-native-worklets
    // plugin required by Reanimated 4 — no manual reanimated plugin needed.
    presets: ['babel-preset-expo'],
  };
};
