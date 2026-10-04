const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Monorepo root (two levels up from apps/booth/)
const monorepoRoot = path.resolve(__dirname, '../..');

// Map local packages to their directories for direct resolution
const extraNodeModules = {
  '@happypix/api': path.resolve(monorepoRoot, 'packages/api'),
  '@happypix/state-machine': path.resolve(monorepoRoot, 'packages/state-machine'),
  '@happypix/camera-core': path.resolve(monorepoRoot, 'packages/camera-core'),
  '@happypix/printer-core': path.resolve(monorepoRoot, 'packages/printer-core'),
  '@happypix/types': path.resolve(monorepoRoot, 'packages/types'),
  '@happypix/ui': path.resolve(monorepoRoot, 'packages/ui'),
  '@happypix/kiosk-core': path.resolve(monorepoRoot, 'packages/kiosk-core'),
};

/**
 * Metro configuration for pnpm monorepo
 * Watches packages/ so that changes in @happypix/* packages
 * are picked up without relinking.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // Watch the monorepo root so Metro can resolve workspace packages
  watchFolders: [monorepoRoot],

  resolver: {
    // Ignore build and C++ (.cxx) folders to prevent watch crash (ENOENT)
    blockList: /.*\/android\/(build|\.cxx)\/.*/,
    // Resolve node_modules from both the app and monorepo root
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    // Enable symlink support for pnpm workspace symlinks
    unstable_enableSymlinks: true,
    // Path mapping for package aliases
    extraNodeModules,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
