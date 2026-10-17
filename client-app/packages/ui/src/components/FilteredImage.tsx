import React, { useState } from 'react';
import { Image as RNImage, StyleSheet, View, type StyleProp, type ViewStyle, type ImageStyle } from 'react-native';
import { Canvas, Group, Image as SkiaImage, Paint, ColorMatrix as SkiaColorMatrix, useImage } from '@shopify/react-native-skia';
import type { FilterId } from '@happypix/types';
import { filterMatrix } from '../utils/filters';

interface FilteredImageProps {
  uri: string;
  filter?: FilterId | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * A photo with its colour filter applied for real (Skia colour matrix), so
 * "B&W" is grayscale and not a tint. Without a filter it is a plain Image.
 */
export const FilteredImage: React.FC<FilteredImageProps> = ({ uri, filter, style }) => {
  const matrix = filterMatrix(filter);
  const image = useImage(matrix ? uri : null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  if (!matrix) {
    return <RNImage source={{ uri }} style={style as StyleProp<ImageStyle>} resizeMode="cover" />;
  }

  return (
    <View
      style={[StyleSheet.absoluteFill, style as StyleProp<ViewStyle>]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) setSize({ width, height });
      }}
    >
      {image && size.width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group layer={<Paint><SkiaColorMatrix matrix={matrix} /></Paint>}>
            <SkiaImage image={image} x={0} y={0} width={size.width} height={size.height} fit="cover" />
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
};
