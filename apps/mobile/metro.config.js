// Metro config for a pnpm workspace (https://docs.expo.dev/guides/monorepos-pnpm/).
// pnpm hoists workspace packages as symlinks rather than copies, which Metro's default
// resolver doesn't follow/watch without this. Without it, `@earlysteps/shared-types` and
// `@earlysteps/content` (both consumed as workspace:* packages) would fail to resolve.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;
// NOT disableHierarchicalLookup — tried it, it broke resolution of expo's own nested
// transitive deps (e.g. expo-modules-core) living under pnpm's .pnpm structure, since it
// stops Metro from walking up node_modules the normal way. Symlink support + watchFolders is
// sufficient; confirmed by a real `expo export --platform web` bundle succeeding.

// Workspace packages (@earlysteps/*) use explicit `.js` extensions on relative imports (real
// Node ESM style) even though the files are `.ts`. Unlike Vite/Vitest's bundler resolution,
// Metro takes a literal `.js` extension at face value and won't try `.ts` — same class of
// issue as Jest's default resolver (see apps/mobile/jest.config.js moduleNameMapper).
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    } catch {
      // Fall through — not every `.js` import is a TS-source stand-in (e.g. real .js files).
    }
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
