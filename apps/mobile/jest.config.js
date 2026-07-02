/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  // Jest's 5s default has tripped multiple different, unrelated tests on CI (never locally) —
  // screens that render many components (a full question bank, several TrafficLightBars) take
  // noticeably longer on a loaded CI runner than on a fast local machine. Nothing was actually
  // hanging in any case; raise the ceiling globally instead of patching one file at a time
  // every time a different screen happens to be the slow one on a given run.
  testTimeout: 15000,
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
