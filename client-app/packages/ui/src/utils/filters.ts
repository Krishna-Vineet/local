// Photo filters as 4x5 colour matrices (row-major, RGBA + offset column).
// The same matrix drives the on-screen preview (FilteredImage) and any native
// render. Offsets are in the 0..1 range. Values are chosen so each filter looks
// like its name: "B&W" is truly grayscale, not a brown or dark tint.
import type { FilterId } from '@happypix/types';

export type ColorMatrix = number[];

const IDENTITY: ColorMatrix = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/** Multiply two colour matrices: result applies `b` first, then `a`. */
export function multiplyMatrix(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out = new Array<number>(20).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      let value = 0;
      for (let k = 0; k < 4; k += 1) value += a[row * 5 + k] * b[k * 5 + col];
      if (col === 4) value += a[row * 5 + 4];
      out[row * 5 + col] = value;
    }
  }
  return out;
}

/** Blend a matrix toward identity: amount 1 = full effect, 0 = none. */
const blend = (m: ColorMatrix, amount: number): ColorMatrix =>
  m.map((value, i) => value * amount + IDENTITY[i] * (1 - amount));

const saturate = (s: number): ColorMatrix => [
  0.2126 + 0.7874 * s, 0.7152 - 0.7152 * s, 0.0722 - 0.0722 * s, 0, 0,
  0.2126 - 0.2126 * s, 0.7152 + 0.2848 * s, 0.0722 - 0.0722 * s, 0, 0,
  0.2126 - 0.2126 * s, 0.7152 - 0.7152 * s, 0.0722 + 0.9278 * s, 0, 0,
  0, 0, 0, 1, 0,
];

const contrast = (c: number): ColorMatrix => {
  const offset = 0.5 - 0.5 * c;
  return [
    c, 0, 0, 0, offset,
    0, c, 0, 0, offset,
    0, 0, c, 0, offset,
    0, 0, 0, 1, 0,
  ];
};

const brightness = (b: number): ColorMatrix => [
  b, 0, 0, 0, 0,
  0, b, 0, 0, 0,
  0, 0, b, 0, 0,
  0, 0, 0, 1, 0,
];

const GRAYSCALE: ColorMatrix = [
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0, 0, 0, 1, 0,
];

// Classic sepia tone (full strength) before blending.
const SEPIA: ColorMatrix = [
  0.393, 0.769, 0.189, 0, 0,
  0.349, 0.686, 0.168, 0, 0,
  0.272, 0.534, 0.131, 0, 0,
  0, 0, 0, 1, 0,
];

const chain = (...matrices: ColorMatrix[]) => matrices.reduce((acc, m) => multiplyMatrix(acc, m));

export const FILTER_MATRICES: Record<FilterId, ColorMatrix | null> = {
  original: null,
  // Warm: a little more red, less blue, extra saturation.
  warm: chain(saturate(1.2), [1.08, 0, 0, 0, 0.02, 0, 1.02, 0, 0, 0, 0, 0, 0.88, 0, 0, 0, 0, 0, 1, 0]),
  // Cool: more blue, less red.
  cool: chain(saturate(1.05), [0.9, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1.12, 0, 0.02, 0, 0, 0, 1, 0]),
  // Classic B&W: true grayscale with a little contrast.
  bw: chain(contrast(1.15), GRAYSCALE),
  // Vintage: sepia at 80% plus a slightly lower brightness.
  vintage: chain(brightness(0.97), blend(SEPIA, 0.8), contrast(1.05)),
  // Soft dream: lifted brightness, softer contrast, gentle pastel saturation.
  soft: chain(saturate(0.92), contrast(0.92), brightness(1.06)),
  // Party pop: strong saturation and contrast.
  party: chain(saturate(1.6), contrast(1.1)),
};

export function filterMatrix(filter?: FilterId | string | null): ColorMatrix | null {
  if (!filter) return null;
  return (FILTER_MATRICES as Record<string, ColorMatrix | null>)[filter] ?? null;
}
