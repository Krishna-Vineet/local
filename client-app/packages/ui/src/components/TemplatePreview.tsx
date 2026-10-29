import React, { useState } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import type { BoothTemplate, CapturedPhoto, Customization } from '@happypix/types';
import { TemplateCanvas } from './TemplateCanvas';

/**
 * A template that always fits its box.
 *
 * `TemplateCanvas` renders at a fixed aspect ratio, so every screen used to
 * compute `width`/`height` by hand from the window size — and three of them got
 * it wrong, letting the print spill outside its card on a tablet. This wrapper
 * measures the space it is given and hands the canvas the largest size that fits
 * inside it, which is exactly what Electron's `.template-frame { max-height …
 * max-width: 94% }` does in CSS.
 *
 * `onSize` reports the resolved canvas size so a caller can position overlays
 * (the sticker layer in the customise screen) in the same coordinate space, and
 * `overlay` renders inside the frame at that size.
 */
export interface TemplatePreviewProps {
  template: BoothTemplate;
  photos?: CapturedPhoto[];
  customization?: Customization;
  /** Optional bitmap rendered by the exact printer composite pipeline. */
  printBitmapUri?: string | null;
  style?: StyleProp<ViewStyle>;
  /** hard cap per axis; the canvas still shrinks to fit the measured box */
  maxWidth?: number;
  maxHeight?: number;
  interactiveSlot?: (index: number) => void;
  activeSlotIndex?: number;
  renderStickers?: boolean;
  /** absolute-positioned layer drawn over the print, sized to the canvas */
  overlay?: (size: { width: number; height: number }) => React.ReactNode;
  /** inner radius of the print frame */
  radius?: number;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  photos,
  customization,
  printBitmapUri,
  style,
  maxWidth,
  maxHeight,
  interactiveSlot,
  activeSlotIndex,
  renderStickers = true,
  overlay,
  radius,
}) => {
  const [box, setBox] = useState({ width: 0, height: 0 });

  const canvas = template?.layout?.canvas;
  const raw = canvas?.width && canvas?.height ? canvas.width / canvas.height : null;
  const orientation = String(template?.layout?.orientation || 'portrait').toLowerCase();
  const aspect = raw || (orientation.startsWith('l') || orientation === 'h' ? 3 / 2 : 2 / 3);

  const availW = Math.min(box.width, maxWidth ?? Number.POSITIVE_INFINITY);
  const availH = Math.min(box.height, maxHeight ?? Number.POSITIVE_INFINITY);
  const width = Math.max(0, Math.min(availW, availH * aspect));
  const height = width / aspect;

  return (
    <View
      style={[styles.box, style]}
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        if (w > 0 && h > 0 && (Math.abs(w - box.width) > 0.5 || Math.abs(h - box.height) > 0.5)) {
          setBox({ width: w, height: h });
        }
      }}
    >
      {width > 1 && height > 1 ? (
        <View style={[styles.frame, { width, height }, radius ? { borderRadius: radius } : null]}>
          {printBitmapUri ? (
            <Image
              source={{ uri: printBitmapUri }}
              style={[StyleSheet.absoluteFill, { width, height, borderRadius: radius ?? 0 }]}
              resizeMode="stretch"
              accessibilityLabel="Preview of the exact print output"
            />
          ) : (
            <TemplateCanvas
              template={template}
              photos={photos}
              customization={customization}
              interactiveSlot={interactiveSlot}
              activeSlotIndex={activeSlotIndex}
              renderStickers={renderStickers}
              containerWidth={width}
              style={{ width, height, borderRadius: radius ?? 0 }}
            />
          )}
          {overlay ? (
            // box-none: the layer may hold draggable stickers, but must not
            // swallow taps meant for the slots underneath.
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {overlay({ width, height })}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  frame: { overflow: 'hidden' },
});

export default TemplatePreview;
