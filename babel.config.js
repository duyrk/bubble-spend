// Canonical Expo babel config. Equivalent to the SDK 54 default that is applied
// when no babel.config.js is present — `babel-preset-expo` auto-includes the
// react-native-worklets plugin (required by Reanimated 4) when the package is
// installed. Kept explicit so `jest-expo` can resolve a project babel config.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
