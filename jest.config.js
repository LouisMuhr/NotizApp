/** Test-Setup für das Vor-Launch-Audit. */
const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...expoPreset,
  setupFiles: [...(expoPreset.setupFiles ?? []), '<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    ...(expoPreset.moduleNameMapper ?? {}),
    '^uuid$': '<rootDir>/__mocks__/uuid.js',
    // Bridge läuft auf Vercel als ESM und braucht '.js' an relativen Importen;
    // im Test auf die .ts-Quelle umbiegen.
    '^(\\.{1,2}/.*_lib/[^/]+)\\.js$': '$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/webapp/', '/bridge/node_modules/'],
};
