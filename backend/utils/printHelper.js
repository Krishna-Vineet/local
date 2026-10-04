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
    
    // PowerShell script using standard Windows forms/drawing printing namespaces
    const psScript = `
Add-Type -AssemblyName System.Drawing
$doc = New-Object System.Drawing.Printing.PrintDocument
if ("${printerName}") {
    $doc.PrinterSettings.PrinterName = "${printerName}"
}
$doc.add_PrintPage({
    param($sender, $e)
    $img = [System.Drawing.Image]::FromFile("${absolutePath.replace(/\\/g, '\\\\')}")
    # Draw the image fitting the printable page region (borderless matching DNP/photo printers)
    $e.Graphics.DrawImage($img, $e.Graphics.VisibleClipBounds)
    $img.Dispose()
})
for ($i = 0; $i -lt ${printCount}; $i++) {
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
  
  console.log(`[PrintHelper] Starting print job for URL: ${imageUrl}, count: ${printCount}, printer: ${printerName || 'Default'}`);
  
  let tempFilePath = null;
  try {
    // 1. Download image
    const res = await fetch(imageUrl);
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
