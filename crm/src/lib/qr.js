// Minimal QR code encoder (byte mode, EC level M, versions 1-10) — enough for
// UPI intent strings. Zero dependencies; returns a boolean matrix.
// Adapted from the public-domain "qrcodegen" algorithm (Nayuki), trimmed.

const EC_M = { ordinal: 0, fb: 0 }
const ECC_CODEWORDS_PER_BLOCK = [ -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28 ]
const NUM_ERROR_CORRECTION_BLOCKS = [ -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49 ]

function getNumRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}
function getNumDataCodewords(ver) {
  return Math.floor(getNumRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[ver] * NUM_ERROR_CORRECTION_BLOCKS[ver]
}
function rsMultiply(x, y) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}
function rsDivisor(degree) {
  const result = new Array(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = rsMultiply(root, 0x02)
  }
  return result
}
function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ result.shift()
    result.push(0)
    divisor.forEach((coef, i) => { result[i] ^= rsMultiply(coef, factor) })
  }
  return result
}

export function qrMatrix(text) {
  const bytes = new TextEncoder().encode(text)
  // pick version
  let ver = 1
  for (; ver <= 40; ver++) {
    const cap = getNumDataCodewords(ver) * 8
    const need = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8
    if (need <= cap) break
  }
  if (ver > 40) throw new Error('QR data too long')
  const size = ver * 4 + 17
  // data bits
  const bb = []
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1) }
  push(4, 4); push(bytes.length, ver <= 9 ? 8 : 16)
  for (const b of bytes) push(b, 8)
  const capBits = getNumDataCodewords(ver) * 8
  push(0, Math.min(4, capBits - bb.length))
  push(0, (8 - bb.length % 8) % 8)
  for (let pad = 0xec; bb.length < capBits; pad ^= 0xec ^ 0x11) push(pad, 8)
  const data = []
  for (let i = 0; i < bb.length; i += 8) data.push(parseInt(bb.slice(i, i + 8).join(''), 2))
  // ECC interleave
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ver]
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ver]
  const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8)
  const numShortBlocks = numBlocks - rawCodewords % numBlocks
  const shortBlockLen = Math.floor(rawCodewords / numBlocks)
  const blocks = []
  const rsDiv = rsDivisor(blockEccLen)
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, rsDiv)
    if (i < numShortBlocks) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const result = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i])
    })
  }
  // modules
  const modules = Array.from({ length: size }, () => new Array(size).fill(false))
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false))
  const setF = (x, y, v) => { modules[y][x] = v; isFunction[y][x] = true }
  const drawFinder = (x, y) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      const xx = x + dx, yy = y + dy
      if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, dist !== 2 && dist !== 4)
    }
  }
  const drawAlign = (x, y) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }
  const alignPos = () => {
    if (ver === 1) return []
    const numAlign = Math.floor(ver / 7) + 2
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2
    const res = [6]
    for (let pos = size - 7; res.length < numAlign; pos -= step) res.splice(1, 0, pos)
    return res
  }
  const drawFormat = (mask) => {
    const dataBits = (EC_M.ordinal << 3) | mask // M = 0b00
    let rem = dataBits
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((dataBits << 10) | rem) ^ 0x5412
    const getBit = (i) => ((bits >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) setF(8, i, getBit(i))
    setF(8, 7, getBit(6)); setF(8, 8, getBit(7)); setF(7, 8, getBit(8))
    for (let i = 9; i < 15; i++) setF(14 - i, 8, getBit(i))
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, getBit(i))
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, getBit(i))
    setF(8, size - 8, true)
  }
  const drawVersion = () => {
    if (ver < 7) return
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0
      const a = size - 11 + i % 3, b = Math.floor(i / 3)
      setF(a, b, bit); setF(b, a, bit)
    }
  }
  // function patterns
  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0) }
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4)
  const ap = alignPos()
  for (let i = 0; i < ap.length; i++) for (let j = 0; j < ap.length; j++) {
    if (!((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0))) drawAlign(ap[i], ap[j])
  }
  drawFormat(0); drawVersion()
  // place data
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!isFunction[y][x] && i < result.length * 8) {
          modules[y][x] = ((result[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0
          i++
        }
      }
    }
  }
  // choose best mask by penalty (simplified: try all 8, pick lowest)
  const penalty = (m) => {
    let p = 0
    for (let y = 0; y < size; y++) {
      let run = 1
      for (let x = 1; x < size; x++) { if (m[y][x] === m[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++ } else run = 1 }
    }
    for (let x = 0; x < size; x++) {
      let run = 1
      for (let y = 1; y < size; y++) { if (m[y][x] === m[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++ } else run = 1 }
    }
    let dark = 0
    for (const row of m) for (const c of row) if (c) dark++
    const k = Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1
    return p + k * 10
  }
  const maskFn = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
  ]
  let best = null, bestPen = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const m = modules.map((r) => r.slice())
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!isFunction[y][x] && maskFn[mask](x, y)) m[y][x] = !m[y][x]
    // redraw format for this mask
    const saved = modules; const savedF = isFunction
    // format bits are function modules; recompute onto m
    const tmpModules = m
    const setTmp = (x, y, v) => { tmpModules[y][x] = v }
    const dataBits = mask
    let rem = dataBits
    for (let q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((dataBits << 10) | rem) ^ 0x5412
    const gb = (q) => ((bits >>> q) & 1) !== 0
    for (let q = 0; q <= 5; q++) setTmp(8, q, gb(q))
    setTmp(8, 7, gb(6)); setTmp(8, 8, gb(7)); setTmp(7, 8, gb(8))
    for (let q = 9; q < 15; q++) setTmp(14 - q, 8, gb(q))
    for (let q = 0; q < 8; q++) setTmp(size - 1 - q, 8, gb(q))
    for (let q = 8; q < 15; q++) setTmp(8, size - 15 + q, gb(q))
    setTmp(8, size - 8, true)
    void saved; void savedF
    const pen = penalty(m)
    if (pen < bestPen) { bestPen = pen; best = m }
  }
  return best
}

// UPI deep-link payload understood by every UPI app (GPay, PhonePe, Paytm…)
export function upiIntent({ pa, pn, am, tn }) {
  const q = new URLSearchParams()
  q.set('pa', pa)
  if (pn) q.set('pn', pn)
  if (am) q.set('am', String(am))
  q.set('cu', 'INR')
  if (tn) q.set('tn', tn)
  return 'upi://pay?' + q.toString()
}
