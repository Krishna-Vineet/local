const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env };
delete env.ANDROID_PREFS_ROOT;

const boothDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';

const child = spawn(cmd, ['react-native', 'run-android', ...process.argv.slice(2)], {
  cwd: boothDir,
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
