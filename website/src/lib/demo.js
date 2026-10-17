// ─── Sample booth session (for /download/demo) ───────────────
// The public sample download page shows what a guest sees after scanning
// the booth QR. It uses the site's own sample photos and builds the final
// print strip in the browser, so it works without any backend session.

export const DEMO_PATH = '/download/demo'
export const DEMO_FRAMES = ['/images/hero-booth.jpg', '/images/wedding-booth.jpg', '/images/guests-party.jpg']

const DAY_MS = 24 * 60 * 60 * 1000

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// object-fit: cover, drawn onto a canvas
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

/** Builds a vertical photo strip (the "final print") as a JPEG data URL. */
export async function buildDemoStrip() {
  const images = await Promise.all(DEMO_FRAMES.map(loadImage))
  const width = 540
  const pad = 30
  const gap = 18
  const frameW = width - pad * 2
  const frameH = Math.round((frameW * 3) / 4)
  const caption = 84
  const n = images.length
  const bodyBottom = pad + n * frameH + (n - 1) * gap
  const height = bodyBottom + caption

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#141020'
  ctx.fillRect(0, 0, width, height)
  images.forEach((img, i) => drawCover(ctx, img, pad, pad + i * (frameH + gap), frameW, frameH))
  ctx.fillStyle = '#fff7ea'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'italic 600 32px Georgia, serif'
  ctx.fillText('HappyPix ✦ made tonight', width / 2, bodyBottom + caption / 2)
  return canvas.toDataURL('image/jpeg', 0.92)
}

/** Shape of a download record, matching what the real /api/downloads/:id returns. */
export function demoDownload(compositeUrl) {
  return {
    eventName: 'Sample booth night',
    organizationName: 'Your business',
    compositeUrl: compositeUrl || DEMO_FRAMES[0],
    photoUrls: DEMO_FRAMES,
    expiresAt: new Date(Date.now() + DAY_MS).toISOString(),
  }
}
