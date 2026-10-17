// HappyPix brand components — built from the official logo paths
// (src/lib/brandPaths.js). Four pieces:
//
//   <BrandMark/>  camera only (square-ish, 706×216 master → padded tile)
//   <Wordmark/>   "Happy" (purple) + "Pix" (pink) pixel letters, one line
//   <Tagline/>    "Photobooth" outlined caps
//   <FullLogo/>   the complete stacked lockup exactly as the master asset
//
// `onDark` flips the ink (camera body / Photobooth) to white; the brand
// colours never change between themes.

import { BRAND, CAMERA, RULE, HAPPY, PIX, PHOTOBOOTH } from '../lib/brandPaths.js'

const ink = (onDark) => (onDark ? '#FFFFFF' : BRAND.ink)

function CameraPaths({ color }) {
  return (
    <>
      <path fill={BRAND.green} d={CAMERA.greenLens} />
      <path fill={BRAND.blue} d={CAMERA.blueLens} />
      <path fill={color} d={CAMERA.body} />
      <path fill={BRAND.pink} d={CAMERA.pinkLens} />
      <path fill={color} d={CAMERA.flash} />
      <path fill={color} d={CAMERA.lensRing} />
    </>
  )
}

// Camera on a rounded tile (sidebar / login / favicon-like usage).
// `tile=false` renders the bare camera with transparent background.
export function BrandMark({ size = 34, onDark = false, tile = true }) {
  const color = tile ? '#FFFFFF' : ink(onDark)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="HappyPix" role="img">
      {tile ? <rect width="64" height="64" rx="15" fill={onDark ? '#2A2140' : '#141020'} /> : null}
      {/* camera master is 706.67×215.95 — scale to 52px wide, centre vertically */}
      <g transform={`translate(6 ${(64 - 215.95 * (52 / 706.67)) / 2}) scale(${52 / 706.67}) translate(-60.91 0)`}>
        <CameraPaths color={color} />
      </g>
    </svg>
  )
}

// "HappyPix" on one line. `height` is the cap height of the letters.
// Optional `suffix` (e.g. "CRM") and `sub` line rendered in system type.
export function Wordmark({ size = 19, onDark = false, sub = null, suffix = 'CRM' }) {
  const h = size * 1.05
  // Measured boxes: Happy 26.48–821.04 × 292.13–423.25 (794.56×131.1);
  // Pix 19.31–828.58 × 452.59–674.19 (809.27×221.58). Both rendered at the
  // same cap height so they share one baseline.
  const happyW = (794.56 / 131.1) * h
  const pixW = (809.27 / 221.58) * h
  const gap = h * 0.32
  const totalW = happyW + gap + pixW
  return (
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: Math.round(size * 0.35) }}>
        <svg width={totalW} height={h} viewBox={`0 0 ${totalW} ${h}`} aria-label="HappyPix" role="img" style={{ display: 'block', overflow: 'visible' }}>
          <g transform={`scale(${h / 131.1}) translate(-26.48 -292.13)`}>
            {HAPPY.map((d, i) => <path key={i} fill={BRAND.purple} d={d} />)}
          </g>
          <g transform={`translate(${happyW + gap} 0) scale(${h / 221.58}) translate(-19.31 -452.59)`}>
            {PIX.map((d, i) => <path key={i} fill={BRAND.pink} d={d} />)}
          </g>
        </svg>
        {suffix ? (
          <span style={{ fontSize: size * 0.82, fontWeight: 700, letterSpacing: '0.04em', color: onDark ? 'rgba(255,255,255,0.6)' : '#6E6780' }}>
            {suffix}
          </span>
        ) : null}
      </div>
      {sub ? (
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em', color: onDark ? 'rgba(255,255,255,0.42)' : '#9C95AD', marginTop: 3 }}>
          {sub}
        </span>
      ) : null}
    </div>
  )
}

// "Photobooth" outlined caps (master y 690–771).
export function Tagline({ width = 160, onDark = false }) {
  const h = (81.02 / 828.51) * width
  return (
    <svg width={width} height={h} viewBox="1.32 690.13 828.51 81.02" aria-label="Photobooth" role="img" style={{ display: 'block' }}>
      {PHOTOBOOTH.map((d, i) => <path key={i} fill={ink(onDark)} d={d} />)}
    </svg>
  )
}

// The complete master lockup: camera / rule / Happy / Pix / Photobooth.
export function FullLogo({ width = 180, height, onDark = false }) {
  const color = ink(onDark)
  return (
    <svg width={width} height={height || (771.15 / 829.83) * width} viewBox="0 0 829.83 771.15" aria-label="HappyPix Photobooth" role="img" style={{ display: 'block' }}>
      <path fill={color} d={RULE} />
      {PHOTOBOOTH.map((d, i) => <path key={'t' + i} fill={color} d={d} />)}
      {HAPPY.map((d, i) => <path key={'h' + i} fill={BRAND.purple} d={d} />)}
      {PIX.map((d, i) => <path key={'p' + i} fill={BRAND.pink} d={d} />)}
      <CameraPaths color={color} />
    </svg>
  )
}
