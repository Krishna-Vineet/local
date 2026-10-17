// Booth device storage.
//
// Persistent storage for booth pairing, cached configuration, and device UUID.
// The device identity is stored under its own dedicated key and is NEVER deleted
// on logout or event reset — it is only purged when the device is manually
// removed from the CRM.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setStorageAdapter, type StorageAdapter } from '@happypix/api';

export const deviceStorage: StorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (err) {
      console.warn('[DeviceStorage] setItem failed:', err);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (err) {
      console.warn('[DeviceStorage] removeItem failed:', err);
    }
  },
};

setStorageAdapter(deviceStorage);

/**
 * Captured photos are photo URIs (or data URLs).
 * Returns array of photo strings safe for session payload (Base64 data URLs or HTTP URLs).
 * Uses @shopify/react-native-skia natively on Android/iOS to read file:// camera captures,
 * downscale large raw camera frames to <=1280px, and encode as compact JPEGs.
 */
export async function photosAsDataUrls(uris: string[]): Promise<string[]> {
  const out: string[] = [];
  let Skia: any = null;
  try {
    Skia = require('@shopify/react-native-skia').Skia;
  } catch {
    Skia = null;
  }

  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), ms);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });

  for (const rawUri of uris) {
    if (!rawUri) continue;
    if (rawUri.startsWith('data:') || rawUri.startsWith('http://') || rawUri.startsWith('https://')) {
      out.push(rawUri);
      continue;
    }

    const uri = rawUri.startsWith('file://') || !rawUri.startsWith('/') ? rawUri : `file://${rawUri}`;

    // 1. Primary path: Native Skia C++ file reader + resize + JPEG encoder
    if (Skia) {
      try {
        const data = await withTimeout(Skia.Data.fromURI(uri), 4000);
        if (data) {
          const skImage = Skia.Image.MakeImageFromEncoded(data);
          if (skImage) {
            const w = typeof skImage.width === 'function' ? skImage.width() : Number(skImage.width || 0);
            const h = typeof skImage.height === 'function' ? skImage.height() : Number(skImage.height || 0);
            const MAX_DIM = 960;
            if (w > MAX_DIM || h > MAX_DIM) {
              const scale = MAX_DIM / Math.max(w, h);
              const targetW = Math.max(1, Math.round(w * scale));
              const targetH = Math.max(1, Math.round(h * scale));
              const surface = Skia.Surface.Make(targetW, targetH);
              if (surface && typeof Skia.XYWHRect === 'function') {
                const canvas = surface.getCanvas();
                const paint = Skia.Paint();
                const srcRect = Skia.XYWHRect(0, 0, w, h);
                const dstRect = Skia.XYWHRect(0, 0, targetW, targetH);
                canvas.drawImageRect(skImage, srcRect, dstRect, paint);
                const snap = surface.makeImageSnapshot();
                const b64 = snap.encodeToBase64(Skia.ImageFormat?.JPEG ?? 3, 75);
                if (b64) {
                  out.push(`data:image/jpeg;base64,${b64}`);
                  continue;
                }
              }
            }
            const b64 = skImage.encodeToBase64(Skia.ImageFormat?.JPEG ?? 3, 75);
            if (b64) {
              out.push(`data:image/jpeg;base64,${b64}`);
              continue;
            }
          }
        }
      } catch (skiaErr) {
        console.warn('[DeviceStorage] Skia file:// encode fallback:', skiaErr);
      }
    }

    // 2. Fallback path: XMLHttpRequest / fetch -> Blob -> FileReader
    try {
      const blob: Blob = await withTimeout(
        new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = () => resolve(xhr.response);
          xhr.onerror = () => reject(new Error('XHR file read failed'));
          xhr.responseType = 'blob';
          xhr.open('GET', uri, true);
          xhr.send(null);
        }),
        4000
      );
      const dataUrl = await withTimeout(
        new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(typeof reader.result === 'string' && reader.result.startsWith('data:') ? reader.result : null);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        }),
        4000
      );
      if (dataUrl) {
        out.push(dataUrl);
      }
    } catch (e) {
      console.warn('Could not convert URI to data URL:', uri, e);
    }
  }
  return out;
}
