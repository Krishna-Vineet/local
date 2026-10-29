import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Check if the host platform supports physical Windows-based printing.
 * In cloud/serverless environments (e.g. Linux on Vercel/AWS), physical printing is skipped.
 */
export function isPrintingSupported(platform = process.platform) {
  return platform === 'win32';
}

/**
 * Silent image printing using Windows PowerShell and System.Drawing .NET assemblies.
 * @param {string} filePath - Absolute path to local image.
 * @param {number} printCount - Number of copies.
 * @param {string} printerName - Optional printer name. If empty, default system printer is used.
 * @param {object} [options] - Optional overrides for testing/configuration.
 */
export const printLocalImage = (filePath, printCount = 1, printerName = '', options = {}) => {
  const platform = options.platform || process.platform;
  if (!isPrintingSupported(platform)) {
    console.warn(`⚠️ [PrintHelper] Physical printing is not supported on platform '${platform}'. Cloud/serverless environments do not have physical printer hardware; print skipped.`);
    return Promise.resolve({
      success: false,
      skipped: true,
      reason: 'unsupported_platform',
      platform,
    });
  }

  return new Promise((resolve, reject) => {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      return reject(new Error('File to print does not exist'));
    }

    // Sanitize printer name strictly: allow only safe characters (alphanumeric, spaces, underscores, dashes)
    const sanitizedPrinter = typeof printerName === 'string'
      ? printerName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim()
      : '';

    // Enforce safe integer print count
    const safeCount = Math.max(1, Math.min(50, parseInt(printCount, 10) || 1));

    // Escape file path for PowerShell single-quoted literal string
    const safePath = absolutePath.replace(/'/g, "''");

    // PowerShell script using standard Windows forms/drawing printing namespaces
    const psScript = `
Add-Type -AssemblyName System.Drawing
$doc = New-Object System.Drawing.Printing.PrintDocument
if ('${sanitizedPrinter}') {
    $doc.PrinterSettings.PrinterName = '${sanitizedPrinter}'
}
$doc.add_PrintPage({
    param($sender, $e)
    $img = [System.Drawing.Image]::FromFile('${safePath}')
    # Draw the image fitting the printable page region (borderless matching DNP/photo printers)
    $e.Graphics.DrawImage($img, $e.Graphics.VisibleClipBounds)
    $img.Dispose()
})
for ($i = 0; $i -lt ${safeCount}; $i++) {
    $doc.Print()
}
`;

    // Encode script in UTF-16LE + Base64 to prevent any PowerShell/cmd arg escaping issues
    const buffer = Buffer.from(psScript, 'utf16le');
    const base64Script = buffer.toString('base64');
    
    const execFn = options.execFn || exec;
    execFn(`powershell -NoProfile -EncodedCommand ${base64Script}`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ PowerShell print error:', error);
        return reject(error);
      }
      console.log('✅ PowerShell print output:', stdout);
      resolve({
        success: true,
        skipped: false,
        output: stdout,
      });
    });
  });
};

/**
 * Downloads a photo strip from an S3/external URL, writes it locally, and prints it silently.
 * @param {string} imageUrl - URL of the photo strip.
 * @param {number} printCount - Number of copies.
 * @param {string} printerName - Target printer name.
 * @param {object} [options] - Optional overrides for testing/configuration.
 */
export const printImage = async (imageUrl, printCount = 1, printerName = '', options = {}) => {
  const platform = options.platform || process.platform;
  if (!isPrintingSupported(platform)) {
    console.warn(`⚠️ [PrintHelper] Cloud host (${platform}) cannot print to physical hardware. Skipping print job.`);
    return {
      success: false,
      skipped: true,
      reason: 'unsupported_platform',
      platform,
    };
  }

  if (!imageUrl) {
    console.warn('⚠️ No image URL provided to printHelper');
    return { success: false, skipped: true, reason: 'missing_image_url' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    console.warn('⚠️ Invalid image URL provided to printHelper:', imageUrl);
    return { success: false, skipped: true, reason: 'invalid_image_url' };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    console.warn('⚠️ Unsupported protocol for printHelper:', parsedUrl.protocol);
    return { success: false, skipped: true, reason: 'unsupported_protocol' };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isPrivateOrLoopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local');

  if (isPrivateOrLoopback) {
    console.warn('⚠️ Blocked SSRF attempt in printHelper to internal/loopback address:', hostname);
    return { success: false, skipped: true, reason: 'ssrf_blocked' };
  }
  
  console.log(`[PrintHelper] Starting print job for URL: ${imageUrl}, count: ${printCount}, printer: ${printerName || 'Default'}`);
  
  let tempFilePath = null;
  try {
    // 1. Download image with 10s timeout
    const fetchFn = options.fetchFn || fetch;
    const res = await fetchFn(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      throw new Error(`Failed to download image to print: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const tempDir = options.tempDir || os.tmpdir();
    tempFilePath = path.join(tempDir, `happypix_print_${Date.now()}.png`);
    fs.writeFileSync(tempFilePath, buffer);
    
    console.log(`[PrintHelper] Saved image temporarily to: ${tempFilePath}`);
    
    // 2. Print image
    const result = await printLocalImage(tempFilePath, printCount, printerName, options);
    console.log(`[PrintHelper] Print job completed.`);
    return result;
  } catch (error) {
    console.error('❌ [PrintHelper] Error printing image:', error);
    return { success: false, skipped: false, error: error.message };
  } finally {
    // 3. Clean up
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`[PrintHelper] Cleaned up temporary file: ${tempFilePath}`);
      } catch (err) {
        console.error(`[PrintHelper] Failed to delete temp file: ${tempFilePath}`, err);
      }
    }
  }
};
