import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Silent image printing using Windows PowerShell and System.Drawing .NET assemblies.
 * @param {string} filePath - Absolute path to local image.
 * @param {number} printCount - Number of copies.
 * @param {string} printerName - Optional printer name. If empty, default system printer is used.
 */
export const printLocalImage = (filePath, printCount = 1, printerName = '') => {
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
    
    exec(`powershell -NoProfile -EncodedCommand ${base64Script}`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ PowerShell print error:', error);
        return reject(error);
      }
      console.log('✅ PowerShell print output:', stdout);
      resolve(stdout);
    });
  });
};

/**
 * Downloads a photo strip from an S3/external URL, writes it locally, and prints it silently.
 * @param {string} imageUrl - URL of the photo strip.
 * @param {number} printCount - Number of copies.
 * @param {string} printerName - Target printer name.
 */
export const printImage = async (imageUrl, printCount = 1, printerName = '') => {
  if (!imageUrl) {
    console.warn('⚠️ No image URL provided to printHelper');
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    console.warn('⚠️ Invalid image URL provided to printHelper:', imageUrl);
    return;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    console.warn('⚠️ Unsupported protocol for printHelper:', parsedUrl.protocol);
    return;
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
    return;
  }
  
  console.log(`[PrintHelper] Starting print job for URL: ${imageUrl}, count: ${printCount}, printer: ${printerName || 'Default'}`);
  
  let tempFilePath = null;
  try {
    // 1. Download image with 10s timeout
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      throw new Error(`Failed to download image to print: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `happypix_print_${Date.now()}.png`);
    fs.writeFileSync(tempFilePath, buffer);
    
    console.log(`[PrintHelper] Saved image temporarily to: ${tempFilePath}`);
    
    // 2. Print image
    await printLocalImage(tempFilePath, printCount, printerName);
    console.log(`[PrintHelper] Print job completed.`);
  } catch (error) {
    console.error('❌ [PrintHelper] Error printing image:', error);
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
