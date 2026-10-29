import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const { isPrintingSupported, printLocalImage, printImage } = await import('../utils/printHelper.js');

test('HP-DEF-02: isPrintingSupported only returns true for win32', () => {
  assert.equal(isPrintingSupported('win32'), true);
  assert.equal(isPrintingSupported('linux'), false);
  assert.equal(isPrintingSupported('darwin'), false);
  assert.equal(isPrintingSupported('freebsd'), false);
  assert.equal(isPrintingSupported(''), false);
});

test('HP-DEF-02: printLocalImage on non-Windows platforms skips printing and never spawns PowerShell', async () => {
  let execCalled = false;
  const mockExec = () => {
    execCalled = true;
  };

  const result = await printLocalImage('/path/to/image.png', 1, 'DNP', {
    platform: 'linux',
    execFn: mockExec,
  });

  assert.equal(execCalled, false, 'PowerShell must never be executed on Linux/cloud hosts');
  assert.deepEqual(result, {
    success: false,
    skipped: true,
    reason: 'unsupported_platform',
    platform: 'linux',
  });
});

test('HP-DEF-02: printImage on non-Windows platforms skips download and execution', async () => {
  let fetchCalled = false;
  let execCalled = false;

  const mockFetch = async () => {
    fetchCalled = true;
    return { ok: true, arrayBuffer: async () => Buffer.from('fake-image-bytes') };
  };
  const mockExec = () => {
    execCalled = true;
  };

  const result = await printImage('https://example.com/photos/composite.png', 2, 'DNP', {
    platform: 'linux',
    fetchFn: mockFetch,
    execFn: mockExec,
  });

  assert.equal(fetchCalled, false, 'No image download should occur on unsupported platforms');
  assert.equal(execCalled, false, 'PowerShell must never be spawned on unsupported platforms');
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'unsupported_platform');
  assert.equal(result.platform, 'linux');
});

test('HP-DEF-02: printLocalImage on Windows executes PowerShell via mock and returns success', async () => {
  // Create a real temp image file so fs.existsSync passes
  const tempFile = path.join(os.tmpdir(), `test_print_${Date.now()}.png`);
  fs.writeFileSync(tempFile, 'dummy-png-bytes');

  let executedCmd = '';
  const mockExec = (cmd, cb) => {
    executedCmd = cmd;
    cb(null, 'Simulated Print Document Sent to Printer', '');
  };

  try {
    const result = await printLocalImage(tempFile, 2, 'DNP_DS_RX1', {
      platform: 'win32',
      execFn: mockExec,
    });

    assert.ok(executedCmd.startsWith('powershell -NoProfile -EncodedCommand '), 'Must call PowerShell encoded command');
    assert.equal(result.success, true);
    assert.equal(result.skipped, false);
    assert.ok(result.output.includes('Simulated Print Document'));
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test('HP-DEF-02: printImage on Windows downloads image and prints locally via mock', async () => {
  let downloadedUrl = '';
  const fakePngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature

  const mockFetch = async (url) => {
    downloadedUrl = url;
    return {
      ok: true,
      arrayBuffer: async () => fakePngBuffer,
    };
  };

  let executedCmd = '';
  const mockExec = (cmd, cb) => {
    executedCmd = cmd;
    cb(null, 'Print OK', '');
  };

  const result = await printImage('https://happypix-storage.s3.amazonaws.com/strips/test.png', 1, 'DNP', {
    platform: 'win32',
    fetchFn: mockFetch,
    execFn: mockExec,
  });

  assert.equal(downloadedUrl, 'https://happypix-storage.s3.amazonaws.com/strips/test.png');
  assert.ok(executedCmd.startsWith('powershell -NoProfile -EncodedCommand '));
  assert.equal(result.success, true);
  assert.equal(result.skipped, false);
});
