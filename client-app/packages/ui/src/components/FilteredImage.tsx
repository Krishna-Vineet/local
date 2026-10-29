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

async function loadSkiaImage(uri: string): Promise<SkImage | null> {
  if (!uri) return null;
  if (skiaImageCache.has(uri)) {
    return skiaImageCache.get(uri)!;
  }
  if (skiaLoadingPromises.has(uri)) {
    return skiaLoadingPromises.get(uri)!;
  }

  const promise = (async () => {
    try {
      let data: any = null;

      if (uri.startsWith('data:')) {
        const commaIdx = uri.indexOf(',');
        const b64 = (commaIdx >= 0 ? uri.slice(commaIdx + 1) : uri).replace(/\s/g, '');
        data = Skia.Data.fromBase64(b64);
      } else {
        // 1. Try POSIX path on Android (Skia Data.fromURI requires raw path without file://)
        if (Platform.OS === 'android' && uri.startsWith('file://')) {
          const rawPath = uri.replace(/^file:\/\//, '');
          try {
            data = await Skia.Data.fromURI(rawPath);
          } catch {
            // fallback below
          }
        }

        // 2. Try URI as-is
        if (!data) {
          try {
            data = await Skia.Data.fromURI(uri);
          } catch {
            // fallback below
          }
        }

        // 3. Try React Native fetch (React Native Android fetch supports file:// URIs via OkHttp)
        if (!data) {
          try {
            const resp = await fetch(uri);
            if (resp.ok || resp.status === 0 || resp.status === 200) {
              const arrayBuffer = await resp.arrayBuffer();
              data = Skia.Data.fromBytes(new Uint8Array(arrayBuffer));
            }
          } catch (fetchErr) {
            console.warn('[FilteredImage] fetch fallback failed:', fetchErr);
          }
        }
      }

      if (!data) return null;
      const img = Skia.Image.MakeImageFromEncoded(data);
      if (img) {
        skiaImageCache.set(uri, img);
        return img;
      }
    } catch (e) {
      console.warn('[FilteredImage] Failed to load image data for Skia:', e);
    } finally {
      skiaLoadingPromises.delete(uri);
    }
    return null;
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
