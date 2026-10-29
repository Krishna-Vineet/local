import type { BoothTemplate, CapturedPhoto, Customization } from '../types'

const FILTER_CSS: Record<string, string> = {
  original: 'none',
  warm: 'sepia(0.25) saturate(1.35) hue-rotate(5deg) contrast(1.05)',
  cool: 'saturate(1.15) hue-rotate(-15deg) brightness(1.05) contrast(1.02)',
  bw: 'grayscale(1) contrast(1.25) brightness(1.05)',
  blackwhite: 'grayscale(1) contrast(1.25) brightness(1.05)',
  vintage: 'sepia(0.6) contrast(1.15) brightness(0.95) hue-rotate(-10deg)',
  soft: 'brightness(1.05) contrast(0.95) saturate(1.1)',
  party: 'saturate(1.5) contrast(1.2) hue-rotate(15deg)',
};

function resolveAssetUrl(src?: string | null): string {
  if (!src || typeof src !== 'string') return '';
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) return src;
  const base = (import.meta as any).env?.VITE_BOOTH_API_URL || 'http://localhost:5000';
  return `${String(base).replace(/\/+$/, '')}/${src.replace(/^\/+/, '')}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!src || typeof src !== 'string') {
      return reject(new Error('Invalid image source'));
    }
    const resolved = resolveAssetUrl(src);
    const img = new Image();
    // Only set crossOrigin for remote URLs; never for data URLs (avoids Chromium CORS violation)
    if (!resolved.startsWith('data:')) {
      try { img.crossOrigin = 'anonymous'; } catch { void 0; }
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('A photo could not be loaded for printing.'));
    img.src = resolved;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const scale = Math.max(w / (img.naturalWidth || w), h / (img.naturalHeight || h));
  const dw = (img.naturalWidth || w) * scale;
  const dh = (img.naturalHeight || h) * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function renderCompositeDataUrl(input: {
  template: BoothTemplate;
  photos: CapturedPhoto[];
  customization: Customization;
  eventName?: string;
}): Promise<string> {
  const { template, photos, customization } = input;
  const layout = template?.layout;
  const design: any = template?.design;
  const canvas = document.createElement('canvas');
  canvas.width = layout?.canvas?.width || 1200;
  canvas.height = layout?.canvas?.height || 1800;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available on this device.');

  const templateAssets: any[] = Array.isArray((template as any)?.assets) ? (template as any).assets : [];
  const bg: any = design?.background;
  const rawBgUrl: string | null =
    (typeof bg === 'string' ? bg : bg?.url) ||
    design?.bg?.url ||
    templateAssets.find((a: any) => a.role === 'background' || a.type === 'background')?.url ||
    null;
  const bgColors: string[] = (Array.isArray(bg?.colors) && bg.colors.length > 0)
    ? bg.colors
    : (Array.isArray(design?.bg?.colors) && design.bg.colors.length > 0)
      ? design.bg.colors
      : ['#ffffff'];

  if (rawBgUrl) {
    const bgImg = await loadImage(rawBgUrl).catch(() => null);
    if (bgImg) drawCover(ctx, bgImg, 0, 0, canvas.width, canvas.height);
    else { ctx.fillStyle = bgColors[0]; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  } else if (bgColors.length > 1) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgColors.forEach((color: string, i: number) => gradient.addColorStop(i / (bgColors.length - 1), color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = bgColors[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Collect decorations and frame overlays
  const decorations: any[] = Array.isArray(design?.decorations) ? [...design.decorations] : [];
  for (const asset of templateAssets) {
    if (asset?.role === 'overlay' || asset?.role === 'frame' || asset?.type === 'overlay') {
      if (!decorations.some((d) => d.url === asset.url || (d.assetId && d.assetId === asset.assetId))) {
        decorations.push({ url: asset.url, overlay: true, x: 0, y: 0, width: 1, height: 1 });
      }
    }
  }

  const drawDecorationsLayer = async (overlayPass: boolean) => {
    for (const dec of decorations) {
      if (!dec || !dec.url) continue;
      const isOverlay = dec.overlay !== false && dec.position !== 'background';
      if (isOverlay !== overlayPass) continue;
      const decImg = await loadImage(dec.url).catch(() => null);
      if (!decImg) continue;
      let dx = 0;
      let dy = 0;
      let dw = canvas.width;
      let dh = canvas.height;
      if (dec.position === 'top-right') {
        dw = canvas.width * 0.3;
        dh = canvas.height * 0.3;
        dx = canvas.width - dw;
        dy = 0;
      } else if (dec.position === 'bottom-left') {
        dw = canvas.width * 0.3;
        dh = canvas.height * 0.3;
        dx = 0;
        dy = canvas.height - dh;
      } else {
        if (dec.x !== undefined) dx = Math.abs(Number(dec.x)) <= 4 ? Number(dec.x) * canvas.width : Number(dec.x);
        if (dec.y !== undefined) dy = Math.abs(Number(dec.y)) <= 4 ? Number(dec.y) * canvas.height : Number(dec.y);
        if (dec.width !== undefined) dw = Number(dec.width) <= 4 ? Number(dec.width) * canvas.width : Number(dec.width);
        if (dec.height !== undefined) dh = Number(dec.height) <= 4 ? Number(dec.height) * canvas.height : Number(dec.height);
      }
      ctx.drawImage(decImg, dx, dy, dw, dh);
    }
  };

  // 1.5 Under-slot decorations
  await drawDecorationsLayer(false);

  // Ornament / decor overlay — subtle but visible so CRM composite matches preview
  const rawDecor = (customization as any).decor
  const rawOrnament = (customization as any).ornament
  let ornament: string | undefined
  if (rawOrnament === 'none' || rawDecor === 'none') ornament = 'none'
  else if (rawOrnament) ornament = rawOrnament
  else if (rawDecor) ornament = rawDecor
  else ornament = (design as any).decor || design.ornament
  if (ornament && ornament !== 'none') {
    ctx.save()
    ctx.globalAlpha = 0.32
    if (ornament === 'bubbles') {
      ctx.fillStyle = 'rgba(255,255,255,.9)'
      for (let i = 0; i < 18; i++) {
        const x = (i * 97 % canvas.width)
        const y = (i * 53 % canvas.height)
        const r = 8 + (i % 3) * 6
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill()
      }
    } else if (ornament === 'hearts') {
      ctx.fillStyle = 'rgba(255,255,255,.85)'
      ctx.font = `${Math.round(canvas.width*0.04)}px serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const hearts = ['♡','♥','♡','♥']
      for (let i=0;i<8;i++) ctx.fillText(hearts[i%4], (i*0.13)*canvas.width+20, (i%2?0.2:0.08)*canvas.height+40)
    } else if (ornament === 'stars') {
      ctx.fillStyle = 'rgba(255,255,255,.9)'
      ctx.font = `${Math.round(canvas.width*0.035)}px serif`
      for (let i=0;i<10;i++) ctx.fillText('✦', (i*0.11)*canvas.width+10, (i%3*0.06+0.06)*canvas.height)
    } else if (ornament === 'confetti') {
      const cols = ['#ffd552','#ff6b8a','#7ec8a0','#8b5cf6']
      for (let i=0;i<24;i++) {
        ctx.fillStyle = cols[i%4]
        ctx.globalAlpha = 0.5
        const x = (i*73 % canvas.width)
        const y = (i*41 % canvas.height)
        ctx.fillRect(x, y, 14, 6)
      }
      ctx.globalAlpha = 0.32
    }
    ctx.restore()
  }

  // 2. Photo slots
  const filter = FILTER_CSS[customization?.filter || 'original'] || 'none';
  const photoSlots = Array.isArray(layout?.photoSlots) ? layout.photoSlots : [];
  for (let i = 0; i < photoSlots.length; i += 1) {
    const slot = photoSlots[i];
    const photo = photos[i];
    const photoData = photo?.dataUrl || (photo as any)?.uri;
    if (!photoData) continue;
    const img = await loadImage(photoData).catch(() => null);
    if (!img) continue;
    ctx.save();
    ctx.beginPath();
    if (design?.slotShape === 'rounded' || design?.slotShape === 'pill') {
      if (typeof (ctx as any).roundRect === 'function') {
        const radius = design.slotShape === 'pill' ? Math.min(slot.width, slot.height) / 2 : 16;
        (ctx as any).roundRect(slot.x, slot.y, slot.width, slot.height, radius);
      } else {
        ctx.rect(slot.x, slot.y, slot.width, slot.height);
      }
    } else {
      ctx.rect(slot.x, slot.y, slot.width, slot.height);
    }
    ctx.clip();
    if (filter && filter !== 'none') {
      ctx.filter = filter;
    }
    drawCover(ctx, img, slot.x, slot.y, slot.width, slot.height);
    ctx.restore();
    ctx.filter = 'none';
  }

  // 2.5 Over-slot decorations & frame overlays (draws frame cutout on top of photos)
  await drawDecorationsLayer(true);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const stickers = Array.isArray(customization?.stickers) ? customization.stickers : [];
  for (const sticker of stickers) {
    const size = 90 * (sticker.scale ?? 1);
    ctx.font = `${size}px serif`;
    ctx.fillText(sticker.emoji, (sticker.x / 100) * canvas.width, (sticker.y / 100) * canvas.height);
  }

  const footerH = Math.round(canvas.height * 0.11);
  const footerY = canvas.height - footerH;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillRect(0, footerY, canvas.width, footerH);

  // Sponsor logos in footer (up to 3) — matches TemplateCanvas
  const logos: string[] = []
  const custom: any = customization
  if (Array.isArray(custom.sponsorLogos) && custom.sponsorLogos.length) logos.push(...custom.sponsorLogos.filter(Boolean))
  if (custom.sponsorLogo && !logos.includes(custom.sponsorLogo)) logos.push(custom.sponsorLogo)
  if (customization.logo && !logos.includes(customization.logo)) logos.push(customization.logo)
  const templateLogos: string[] = Array.isArray((template as any).sponsorLogos) ? (template as any).sponsorLogos : []
  const headerLogos = logos.length ? logos.slice(0, 3) : templateLogos.slice(0, 3)
  let logoX = 18
  for (const src of headerLogos) {
    const logo = await loadImage(src).catch(() => null)
    if (!logo) continue
    const lh = footerH * 0.62
    const lw = (logo.naturalWidth / logo.naturalHeight) * lh
    if (logoX + lw > canvas.width * 0.42) break
    ctx.drawImage(logo, logoX, footerY + (footerH - lh)/2, lw, lh)
    logoX += lw + 10
  }

  const title = customization?.title || design?.title || input?.eventName || '';
  const subtitle = customization?.subtitle || design?.subtitle || '';
  ctx.fillStyle = design?.textColor || '#2a1630';
  ctx.textAlign = 'right';
  if (title) {
    ctx.font = `700 ${Math.round(footerH * 0.30)}px 'Fredoka Variable', Nunito, sans-serif`;
    ctx.fillText(title, canvas.width - 18, footerY + footerH * 0.36, canvas.width * 0.52);
  }
  if (subtitle) {
    ctx.font = `${Math.round(footerH * 0.20)}px Nunito, sans-serif`;
    ctx.globalAlpha = 0.72;
    ctx.fillText(subtitle, canvas.width - 18, footerY + footerH * 0.70, canvas.width * 0.52);
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}
