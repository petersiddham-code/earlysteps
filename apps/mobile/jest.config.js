/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  // Workspace packages (@earlysteps/*) use explicit `.js` extensions on relative imports
  // (real Node ESM style) even though the files are `.ts`. Jest's resolver doesn't do that
  // remapping by default the way bundler-style tools (Vite/webpack) do — strip the extension
  // so Jest's own moduleFileExtensions resolution finds the `.ts` sibling.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
