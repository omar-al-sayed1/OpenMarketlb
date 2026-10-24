// Expo default Metro config + one web-only tweak: react-native-maps has no web build, so on the
// web platform we resolve it to a lightweight stub (web-stubs/react-native-maps.js). Native
// (ios/android) builds are completely unaffected — the divert is gated on platform === 'web'.
// This exists purely to let non-map screens be previewed in a browser via `expo start --web`.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { type: 'sourceFile', filePath: path.resolve(__dirname, 'web-stubs/react-native-maps.js') };
  }
  return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
