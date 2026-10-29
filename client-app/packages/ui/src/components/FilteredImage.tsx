import React, { useState, useEffect } from 'react';
import {
  Image as RNImage,
  StyleSheet,
  View,
  Platform,
  type StyleProp,
  type ViewStyle,
  type ImageStyle,
} from 'react-native';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  Paint,
  ColorMatrix as SkiaColorMatrix,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import type { FilterId } from '@happypix/types';
import { filterMatrix } from '../utils/filters';

interface FilteredImageProps {
  uri: string;
  filter?: FilterId | null;
  style?: StyleProp<ViewStyle>;
}

// Global in-memory cache for loaded SkImage instances so switching filters is instant
const skiaImageCache = new Map<string, SkImage>();
const skiaLoadingPromises = new Map<string, Promise<SkImage | null>>();

/**
 * Reads an image into a Skia bitmap.
 *
 * This is the *only* thing standing between the guest and a filter that works:
 * if decoding fails we silently fall back to the unfiltered `<Image>`, which is
 * exactly how "the filter only shows up in the final print" happens on a tablet
 * while the print path (which uses its own loader) succeeds.
 *
 * Four strategies, cheapest first, and every failure is reported so the next
 * report of a missing filter comes with a reason instead of a guess:
 *
 *   1. `data:` → base64 decode;
 *   2. `http(s)` → fetch → bytes (never `fromURI`, which can block on Android);
 *   3. a local path → `Skia.Data.fromURI`, with and without the `file://` scheme;
 *   4. anything else (a camera URI React Native itself can read, e.g. `ph://`
 *      on iOS or a `content://` on Android) → XHR → FileReader → base64.
 */
async function loadSkiaImage(uri: string): Promise<SkImage | null> {
  if (!uri) return null;
  if (skiaImageCache.has(uri)) return skiaImageCache.get(uri)!;
  if (skiaLoadingPromises.has(uri)) return skiaLoadingPromises.get(uri)!;

  const decode = (data: any): SkImage | null => {
    if (!data) return null;
    try {
      return Skia.Image.MakeImageFromEncoded(data) || null;
    } catch (err) {
      console.warn('[FilteredImage] could not decode image bytes:', err);
      return null;
    }
  };

  const fromBase64 = (base64: string): SkImage | null => {
    try {
      return decode(Skia.Data.fromBase64(base64.replace(/\s/g, '')));
    } catch (err) {
      console.warn('[FilteredImage] base64 decode failed:', err);
      return null;
    }
  };

  const fromUri = async (raw: string): Promise<SkImage | null> => {
    try {
      return decode(await Skia.Data.fromURI(raw));
    } catch {
      return null;
    }
  };

  /** Last resort: let React Native's own loader fetch the bytes. */
  const viaXhr = (): Promise<string | null> =>
    new Promise((resolve) => {
      try {
        const request = new XMLHttpRequest();
        request.onload = () => {
          try {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result;
              resolve(typeof result === 'string' && result.startsWith('data:') ? result : null);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(request.response);
          } catch {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
        request.responseType = 'blob';
        request.open('GET', uri, true);
        request.send(null);
      } catch {
        resolve(null);
      }
    });

  const promise = (async () => {
    try {
      let image: SkImage | null = null;

      if (uri.startsWith('data:')) {
        const comma = uri.indexOf(',');
        image = fromBase64(comma >= 0 ? uri.slice(comma + 1) : uri);
      } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
        try {
          const response = await fetch(uri);
          const bytes = new Uint8Array(await response.arrayBuffer());
          image = decode(Skia.Data.fromBytes(bytes));
        } catch (err) {
          console.warn('[FilteredImage] remote fetch failed:', err);
        }
      } else {
        // A local file. Order matters: the scheme-carrying form is what Skia
        // expects on iOS, the bare path is what it expects on Android.
        if (Platform.OS === 'android' && uri.startsWith('file://')) {
          image = await fromUri(uri.replace(/^file:\/\//, ''));
        }
        if (!image) image = await fromUri(uri);
        if (!image && !uri.startsWith('file://') && uri.startsWith('/')) {
          image = await fromUri(`file://${uri}`);
        }
        if (!image) {
          const dataUrl = await viaXhr();
          if (dataUrl) {
            const comma = dataUrl.indexOf(',');
            image = fromBase64(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
          }
        }
      }

      if (image) {
        skiaImageCache.set(uri, image);
        return image;
      }
      console.warn('[FilteredImage] no Skia bitmap for uri — filters will not render for this photo:', uri);
      return null;
    } finally {
      skiaLoadingPromises.delete(uri);
    }
  })();

  skiaLoadingPromises.set(uri, promise);
  return promise;
}

/**
 * Placeholder tint shown only while the Skia bitmap is still loading.
 *
 * It used to be a 65 % dark scrim for "B&W", which made a colour photo look
 * merely dimmed — the exact complaint that the filter "isn't B&W". The real
 * conversion is the colour matrix below; keep this hint light and neutral so a
 * loading frame never looks like the finished effect.
 */
const getFilterFallbackOverlay = (filter?: FilterId | null): ViewStyle | null => {
  switch (filter) {
    case 'bw':
      return { backgroundColor: 'rgba(250, 250, 252, 0.08)' };
    case 'warm':
      return { backgroundColor: 'rgba(245, 158, 11, 0.10)' };
    case 'cool':
      return { backgroundColor: 'rgba(14, 165, 233, 0.10)' };
    case 'vintage':
      return { backgroundColor: 'rgba(180, 115, 50, 0.12)' };
    case 'soft':
      return { backgroundColor: 'rgba(255, 255, 255, 0.10)' };
    case 'party':
      return { backgroundColor: 'rgba(236, 72, 153, 0.10)' };
    default:
      return null;
  }
};

/**
 * A photo with its colour filter applied for real (Skia colour matrix), so
 * "B&W" is grayscale and not a tint. Without a filter it is a plain Image.
 */
export const FilteredImage: React.FC<FilteredImageProps> = ({ uri, filter, style }) => {
  const matrix = filterMatrix(filter);
  const [skImage, setSkImage] = useState<SkImage | null>(() => (uri ? skiaImageCache.get(uri) || null : null));
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!uri) {
      setSkImage(null);
      return;
    }
    const cached = skiaImageCache.get(uri);
    if (cached) {
      setSkImage(cached);
      return;
    }
    let isMounted = true;
    loadSkiaImage(uri).then((img) => {
      if (isMounted && img) {
        setSkImage(img);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [uri]);

  const fallbackOverlay = getFilterFallbackOverlay(filter);

  if (!matrix) {
    return (
      <RNImage
        source={{ uri }}
        style={[StyleSheet.absoluteFill, styles.fullImage, style as StyleProp<ImageStyle>]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.fullContainer, style as StyleProp<ViewStyle>]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0 && (width !== size.width || height !== size.height)) {
          setSize({ width, height });
        }
      }}
    >
      <RNImage
        source={{ uri }}
        style={[StyleSheet.absoluteFill, styles.fullImage]}
        resizeMode="cover"
      />
      {fallbackOverlay && !skImage ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, fallbackOverlay]} />
      ) : null}
      {skImage && size.width > 0 && size.height > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group layer={<Paint><SkiaColorMatrix matrix={matrix} /></Paint>}>
            <SkiaImage image={skImage} x={0} y={0} width={size.width} height={size.height} fit="cover" />
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
