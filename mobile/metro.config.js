// @ts-check
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;

/** @param {string} name */
function packageRoot(name, searchPaths) {
  return path.dirname(
    require.resolve(`${name}/package.json`, { paths: searchPaths })
  );
}

/** Metro often resolves @react-native/* from under react-native/; npm may hoist to the root. */
function reactNativePackageRoot(name) {
  try {
    return packageRoot(name, [projectRoot]);
  } catch {
    const reactNativeDir = path.dirname(
      require.resolve('react-native/package.json', { paths: [projectRoot] })
    );
    return packageRoot(name, [reactNativeDir, projectRoot]);
  }
}

const config = getDefaultConfig(projectRoot);

const extra = {
  ...config.resolver.extraNodeModules,
  'expo-constants': packageRoot('expo-constants', [projectRoot]),
  '@react-native/normalize-colors': reactNativePackageRoot(
    '@react-native/normalize-colors'
  ),
  '@react-native/virtualized-lists': reactNativePackageRoot(
    '@react-native/virtualized-lists'
  ),
};

config.resolver.extraNodeModules = extra;

module.exports = config;
