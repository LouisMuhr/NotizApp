/* eslint-disable no-undef */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('react-native-url-polyfill/auto', () => ({}));
// Icon-Fonts brauchen expo-asset/native Module — im Test reicht ein leeres Element.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Icon = () => React.createElement('Icon');
  return new Proxy({}, { get: () => Icon });
});
