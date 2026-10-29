// ─────────────────────────────────────────────────────────────────
//  IPPProvider — Internet Printing Protocol
//  Supports any IPP-compatible printer on the network.
//  Works with modern WiFi printers, DNP wireless print servers,
//  and Citizen printers with IPP support.
//
//  Protocol: IPP over HTTP/HTTPS (port 631)
// ─────────────────────────────────────────────────────────────────

import type {
  PrinterProvider,
  PrinterDevice,
  PrintJob,
  PrintResult,
  PrinterStatus,
} from '@happypix/types';

/** Hermes-safe fast Base64 decoder */
function decodeBase64ToUint8(base64: string): Uint8Array {
  const clean = base64.replace(/[\r\n\s]/g, '');
  if (typeof atob === 'function') {
    try {
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch {
      // Fallback
    }
  }

  // Pure JavaScript Base64 Decoding Fallback
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  let bufferLength = clean.length * 0.75;
  if (clean.endsWith('==')) bufferLength -= 2;
  else if (clean.endsWith('=')) bufferLength -= 1;

  const bytes = new Uint8Array(Math.max(0, Math.floor(bufferLength)));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const encoded1 = lookup[clean.charCodeAt(i)];
    const encoded2 = lookup[clean.charCodeAt(i + 1)];
    const encoded3 = lookup[clean.charCodeAt(i + 2)];
    const encoded4 = lookup[clean.charCodeAt(i + 3)];

    if (p < bytes.length) bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bytes.length) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < bytes.length) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }
  return bytes;
}

export class IPPProvider implements PrinterProvider {
  readonly type = 'ipp' as const;

  private connectedDevice: PrinterDevice | null = null;
  private manualAddress: string | null = null;

  setManualAddress(address: string | null): void {
    this.manualAddress = address ? address.trim().replace(/^http:\/\//, '').replace(/\/.*$/, '') : null;
  }

  async discover(): Promise<PrinterDevice[]> {
    const candidates: string[] = [];
    if (this.manualAddress) candidates.push(this.manualAddress);
    candidates.push('10.0.2.2'); // Emulator host
    candidates.push('127.0.0.1');

    const found: PrinterDevice[] = [];
    for (const addr of candidates) {
      const attrs = await this.getPrinterAttributes(addr);
      if (attrs) {
        found.push({
          type: 'ipp',
          name: `IPP Network Printer (${addr})`,
          address: addr,
          id: `ipp-${addr}`,
        });
        break;
      }
    }

    return found;
  }

  async connect(device: PrinterDevice): Promise<void> {
    const targetAddress = device.address || this.manualAddress;
    if (!targetAddress) {
      throw new Error('IPPProvider: No address provided for IPP printer');
    }
    const cleanAddress = targetAddress.replace(/^http:\/\//, '').replace(/:631$/, '');
    const attrs = await this.getPrinterAttributes(cleanAddress);
    if (!attrs) {
      throw new Error(`IPPProvider: Cannot reach printer at ${cleanAddress}:631`);
    }
    this.connectedDevice = {
      ...device,
      address: cleanAddress,
    };
  }

  async disconnect(): Promise<void> {
    this.connectedDevice = null;
  }

  async print(job: PrintJob): Promise<PrintResult> {
    const address = this.connectedDevice?.address || this.manualAddress;
    if (!address) {
      throw new Error('IPPProvider: Not connected to any printer');
    }
    try {
      if (!job.bitmap) {
        return { success: false, error: 'IPPProvider: Bitmap image data is required for physical printing.' };
      }

      // Convert base64 data URI to binary using safe decoder
      const base64Data = job.bitmap.includes(',') ? job.bitmap.split(',')[1] : job.bitmap;
      const bytes = decodeBase64ToUint8(base64Data);

      // Build IPP Print-Job request
      const isPng = job.bitmap.startsWith('data:image/png');
      const printerUri = `ipp://${address}:631/ipp/print`;
      const ippRequest = this.buildIPPPrintRequest(
        bytes,
        job.copies || 1,
        job.paperSize || '4x6',
        printerUri,
        isPng,
      );

      const res = await fetch(
        `http://${address}:631/ipp/print`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/ipp',
          },
          body: ippRequest as any,
          signal: AbortSignal.timeout(12000),
        },
      );

      if (!res.ok) {
        return { success: false, error: `IPP response ${res.status}` };
      }

      return { success: true, jobId: `IPP-${Date.now()}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'IPP connection failed' };
    }
  }

  async getStatus(): Promise<PrinterStatus> {
    const address = this.connectedDevice?.address || this.manualAddress;
    if (!address) {
      return { connected: false, type: 'ipp', isReady: false };
    }
    const attrs = await this.getPrinterAttributes(address);
    return {
      connected: !!attrs,
      type: 'ipp',
      isReady: attrs?.state === 'idle',
    };
  }

  // ── IPP Helpers ───────────────────────────────────────────────────

  private async getPrinterAttributes(
    address: string,
  ): Promise<{ state: string } | null> {
    try {
      const clean = address.replace(/^http:\/\//, '').replace(/:631$/, '');
      const req = this.buildIPPGetAttributesRequest();
      const res = await fetch(`http://${clean}:631/ipp/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/ipp' },
        body: req as any,
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return null;
      return { state: 'idle' };
    } catch {
      return null;
    }
  }

  /**
   * Build minimal IPP Get-Printer-Attributes request (RFC 8011)
   */
  private buildIPPGetAttributesRequest(): Uint8Array {
    return new Uint8Array([
      0x01, 0x01,             // IPP version 1.1
      0x00, 0x0B,             // Operation: Get-Printer-Attributes
      0x00, 0x00, 0x00, 0x01, // Request ID: 1
      0x01,                   // Begin-Attribute-Group: operation-attributes-tag
      0x47, 0x00, 0x12,       // charset: attributes-charset
      ...Array.from(new TextEncoder().encode('attributes-charset')),
      0x00, 0x05,
      ...Array.from(new TextEncoder().encode('utf-8')),
      0x48, 0x00, 0x1b,       // natural-language
      ...Array.from(new TextEncoder().encode('attributes-natural-language')),
      0x00, 0x05,
      ...Array.from(new TextEncoder().encode('en-us')),
      0x03,                   // End-of-Attributes
    ]);
  }

  /**
   * Helper to encode an IPP string attribute (RFC 8011)
   */
  private encodeIppString(tag: number, name: string, value: string): number[] {
    const enc = new TextEncoder();
    const nameBytes = Array.from(enc.encode(name));
    const valBytes = Array.from(enc.encode(value));
    return [
      tag,
      (nameBytes.length >> 8) & 0xff,
      nameBytes.length & 0xff,
      ...nameBytes,
      (valBytes.length >> 8) & 0xff,
      valBytes.length & 0xff,
      ...valBytes,
    ];
  }

  /**
   * Helper to encode an IPP 32-bit signed integer attribute (tag 0x21)
   */
  private encodeIppInteger(name: string, value: number): number[] {
    const enc = new TextEncoder();
    const nameBytes = Array.from(enc.encode(name));
    return [
      0x21, // integer tag
      (nameBytes.length >> 8) & 0xff,
      nameBytes.length & 0xff,
      ...nameBytes,
      0x00, 0x04, // 4-byte length
      (value >> 24) & 0xff,
      (value >> 16) & 0xff,
      (value >> 8) & 0xff,
      value & 0xff,
    ];
  }

  /**
   * Build IPP Print-Job request compliant with RFC 8011
   */
  private buildIPPPrintRequest(
    imageData: Uint8Array,
    copies: number,
    _paperSize: string,
    printerUri: string,
    isPng: boolean,
  ): Uint8Array {
    const opAttributes: number[] = [
      0x01, 0x01,             // IPP 1.1
      0x00, 0x02,             // Print-Job operation (0x0002)
      0x00, 0x00, 0x00, 0x01, // Request ID: 1
      0x01,                   // Begin Operation Attributes group (tag 0x01)
      // 0x47 = attributes-charset
      ...this.encodeIppString(0x47, 'attributes-charset', 'utf-8'),
      // 0x48 = attributes-natural-language
      ...this.encodeIppString(0x48, 'attributes-natural-language', 'en-us'),
      // 0x45 = uri (printer-uri)
      ...this.encodeIppString(0x45, 'printer-uri', printerUri),
      // 0x42 = nameWithoutLanguage (job-name)
      ...this.encodeIppString(0x42, 'job-name', 'HappyPix Print'),
      // 0x49 = mimeMediaType (document-format)
      ...this.encodeIppString(0x49, 'document-format', isPng ? 'image/png' : 'image/jpeg'),
      // Begin Job Attributes group (tag 0x02)
      0x02,
      // copies (integer)
      ...this.encodeIppInteger('copies', Math.max(1, copies)),
      // End-of-attributes tag (tag 0x03)
      0x03,
    ];

    const header = new Uint8Array(opAttributes);
    const combined = new Uint8Array(header.length + imageData.length);
    combined.set(header, 0);
    combined.set(imageData, header.length);
    return combined;
  }
}
