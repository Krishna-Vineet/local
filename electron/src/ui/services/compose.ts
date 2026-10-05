import type { BoothTemplate, CapturedPhoto, Customization, FilterId } from '../types'

// Canvas rasterizer for the final print. Mirrors the visual language of
// TemplateCanvas (background, ornaments, filtered photo slots, footer with
// logo + text, stickers) at the layout's native print resolution.

const FILTER_CSS: Record<FilterId, string> = {
  original: 'none',
  warm: 'sepia(.18) saturate(1.15) hue-rotate(-8deg)',
  cool: 'saturate(.9) hue-rotate(12deg)',
  bw: 'grayscale(1) contrast(1.08)',
  vintage: 'sepia(.45) saturate(.85) contrast(.93)',
  soft: 'saturate(.85) brightness(1.08)',
  party: 'saturate(1.45) contrast(1.08)',
}

const FOOTER_RATIO = 0.15

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const image = new Image()
    if (!src.startsWith('data:')) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

// object-fit: cover
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const scale = Math.max(w / image.width, h / image.height)
  const dw = image.width * scale
  const dh = image.height * scale
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function drawOrnament(ctx: CanvasRenderingContext2D, kind: string, w: number, h: number): void {
  if (kind === 'none') return
  ctx.save()
  if (kind === 'bubbles') {
    ctx.fillStyle = 'rgba(255,255,255,.9)'
    const cellW = w * 0.18
    const cellH = h * 0.12
    for (let cx = cellW / 2; cx < w; cx += cellW) {
      for (let cy = cellH / 2; cy < h; cy += cellH) {
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(4, cellW * 0.09), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (kind === 'stars') {
    ctx.fillStyle = 'rgba(255,255,255,.95)'
    const cellW = w * 0.15
    const cellH = h * 0.1
    for (let cx = cellW / 2; cx < w; cx += cellW) {
      for (let cy = cellH / 2; cy < h; cy += cellH) {
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(2.5, cellW * 0.045), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (kind === 'hearts') {
    for (const [px, py, alpha] of [[0.15, 0.22, 0.7], [0.83, 0.35, 0.65]] as const) {
      const gradient = ctx.createRadialGradient(w * px, h * py, 0, w * px, h * py, w * 0.02)
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`)
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(w * px, h * py, w * 0.02, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 'confetti') {
    ctx.strokeStyle = 'rgba(255,213,82,.85)'
    const cellW = w * 0.16
    const cellH = h * 0.11
    ctx.lineWidth = Math.max(3, cellW * 0.06)
    for (let cx = cellW / 2; cx < w + cellW; cx += cellW) {
      for (let cy = cellH / 2; cy < h + cellH; cy += cellH) {
        const length = Math.max(cellW, cellH) * 0.7
        const angle = (-35 * Math.PI) / 180
        ctx.beginPath()
        ctx.moveTo(cx - (Math.cos(angle) * length) / 2, cy - (Math.sin(angle) * length) / 2)
        ctx.lineTo(cx + (Math.cos(angle) * length) / 2, cy + (Math.sin(angle) * length) / 2)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

export interface ComposeInput {
  template: BoothTemplate
  photos: CapturedPhoto[]
  customization: Customization
}

export interface ComposeResult {
  dataUrl: string
  width: number
  height: number
}

export async function composePrintBitmap(input: ComposeInput): Promise<ComposeResult> {
  const { template, photos, customization } = input
  const { layout, design } = template
  const width = layout.canvas.width
  const height = layout.canvas.height

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This session cannot render prints.')

  // 1. Background — image, multi-colour gradient or flat fill.
  let backgroundReady = false
  if (design.background.type === 'image' && design.background.url) {
    const image = await loadImage(design.background.url)
    if (image) {
      drawCover(ctx, image, 0, 0, width, height)
      backgroundReady = true
    }
  }
  if (!backgroundReady) {
    const colors = design.background.colors.length ? design.background.colors : ['#ffffff']
    if (colors.length > 1) {
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      const step = 1 / (colors.length - 1)
      colors.forEach((color, index) => gradient.addColorStop(index * step, color))
      ctx.fillStyle = gradient
    } else {
      ctx.fillStyle = colors[0]
    }
    ctx.fillRect(0, 0, width, height)
  }

  // 2. Ornament overlay.
  drawOrnament(ctx, customization.ornament === 'none' ? design.ornament : customization.ornament, width, height)

  // 3. Photo slots (filtered, optional rotation, rounded/pill shape).
  ctx.save()
  ctx.filter = FILTER_CSS[customization.filter] || 'none'
  for (const [index, slot] of layout.photoSlots.entries()) {
    const photo = photos[index]
    if (!photo) continue
    const image = await loadImage(photo.dataUrl)
    if (!image) continue

    ctx.save()
    if (slot.rotation) {
      ctx.translate(slot.x + slot.width / 2, slot.y + slot.height / 2)
      ctx.rotate((slot.rotation * Math.PI) / 180)
      ctx.translate(-(slot.x + slot.width / 2), -(slot.y + slot.height / 2))
    }
    const radius = design.slotShape === 'square' ? 0
      : design.slotShape === 'pill' ? Math.min(slot.width, slot.height) / 2
        : Math.min(slot.width, slot.height) * 0.07
    if (radius > 0) {
      roundRectPath(ctx, slot.x, slot.y, slot.width, slot.height, radius)
      ctx.clip()
    }
    drawCover(ctx, image, slot.x, slot.y, slot.width, slot.height)
    ctx.restore()
  }
  ctx.restore()

  // 4. Footer — selected event logo + title/subtitle.
  const footerHeight = Math.round(height * FOOTER_RATIO)
  const footerTop = height - footerHeight
  const title = customization.title || design.title
  const subtitle = customization.subtitle || design.subtitle
  const hasFooterContent = Boolean(customization.logo || title || subtitle)
  if (hasFooterContent) {
    ctx.save()
    ctx.fillStyle = design.textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let logo: HTMLImageElement | null = null
    if (customization.logo) logo = await loadImage(customization.logo)
    const textAreaTop = logo ? footerTop + footerHeight * 0.06 : footerTop
    const textAreaHeight = footerHeight * (logo ? 0.52 : 0.86)

    if (logo) {
      const logoHeight = footerHeight * 0.72
      const logoWidth = logo.width * (logoHeight / logo.height)
      const logoY = footerTop + (footerHeight - logoHeight) / 2
      ctx.drawImage(logo, (width - logoWidth) / 2, logoY, logoWidth, logoHeight)
    }
    if (title) {
      ctx.font = `700 ${Math.round(textAreaHeight * 0.52)}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`
      ctx.fillText(title, width / 2, textAreaTop + textAreaHeight * 0.34, width * 0.92)
    }
    if (subtitle) {
      ctx.font = `400 ${Math.round(textAreaHeight * 0.36)}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`
      ctx.fillText(subtitle, width / 2, textAreaTop + textAreaHeight * 0.74, width * 0.92)
    }
    ctx.restore()
  }

  // 5. Stickers.
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const stickerSize = Math.round(Math.min(width, height) * 0.075)
  ctx.font = `${stickerSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`
  for (const sticker of customization.stickers) {
    ctx.fillText(sticker.emoji, (sticker.x / 100) * width, (sticker.y / 100) * height)
  }
  ctx.restore()

  return { dataUrl: canvas.toDataURL('image/png'), width, height }
}
