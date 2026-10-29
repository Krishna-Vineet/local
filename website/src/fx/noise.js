// Tiny value-noise helpers shared by the canvas effects (no dependencies).
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

// fractal sum, normalised to roughly 0..1
export function fbm(x, y, octaves = 4) {
  let s = 0, amp = 0.5, f = 1, norm = 0
  for (let i = 0; i < octaves; i++) {
    s += amp * vnoise(x * f, y * f)
    norm += amp
    f *= 2.03
    amp *= 0.5
  }
  return s / norm
}
