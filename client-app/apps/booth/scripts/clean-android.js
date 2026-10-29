const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const boothDir = path.resolve(__dirname, '..');
const androidDir = path.join(boothDir, 'android');

console.log('[HappyPix Clean] Stopping Gradle daemons...');
const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

try {
  spawnSync(gradlewCmd, ['--stop'], {
    cwd: androidDir,
    stdio: 'inherit',
    shell: true,
  });
} catch (e) {
  // Ignore if gradlew fails to stop
}

const pathsToClean = [
  path.join(androidDir, 'build'),
  path.join(androidDir, 'app', 'build'),
  path.join(androidDir, 'app', '.cxx'),
  path.join(androidDir, '.gradle'),
  path.join(androidDir, '.kotlin'),
];

console.log('[HappyPix Clean] Removing stale Android build caches & autolinking outputs...');
for (const p of pathsToClean) {
  if (fs.existsSync(p)) {
    try {
      fs.rmSync(p, { recursive: true, force: true, maxRetries: 3 });
      console.log(`  ✓ Removed: ${path.relative(boothDir, p)}`);
    } catch (err) {
      console.warn(`  ⚠ Could not remove ${path.relative(boothDir, p)}: ${err.message}`);
    }
  }
}

console.log('[HappyPix Clean] Android workspace is clean.');
