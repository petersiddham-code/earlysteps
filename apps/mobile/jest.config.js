/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  moduleNameMapper: {
    // Workspace packages (@earlysteps/*) use explicit `.js` extensions on relative imports
    // (real Node ESM style) even though the files are `.ts`. Jest's resolver doesn't do that
    // remapping by default the way bundler-style tools (Vite/webpack) do — strip the
    // extension so Jest's own moduleFileExtensions resolution finds the `.ts` sibling.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // The mock file just exports a jest.fn()-based object; it doesn't self-register via
    // jest.mock(), so every import of the real package must be redirected here directly.
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
};
