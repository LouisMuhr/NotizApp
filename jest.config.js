/** Test-Setup für das Vor-Launch-Audit. */
const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...expoPreset,
  setupFiles: [...(expoPreset.setupFiles ?? []), '<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    ...(expoPreset.moduleNameMapper ?? {}),
    '^uuid$': '<rootDir>/__mocks__/uuid.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/webapp/', '/bridge/node_modules/'],
};
