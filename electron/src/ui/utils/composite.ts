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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Allow AWS S3 / CDN images to be read into canvas without tainting
    try { img.crossOrigin = 'anonymous' } catch { void 0 }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('A photo could not be loaded for printing.'));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function renderCompositeDataUrl(input: {
  template: BoothTemplate;
  photos: CapturedPhoto[];
  customization: Customization;
  eventName?: string;
}): Promise<string> {
  const { template, photos, customization } = input;
  const { layout, design } = template;
  const canvas = document.createElement('canvas');
  canvas.width = layout.canvas.width;
  canvas.height = layout.canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available on this device.');

  const colors = design.background.colors.length ? design.background.colors : ['#ffffff'];
  if (design.background.type === 'image' && design.background.url) {
    const bg = await loadImage(design.background.url).catch(() => null);
    if (bg) drawCover(ctx, bg, 0, 0, canvas.width, canvas.height);
    else { ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  } else if (colors.length > 1) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

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

  const filter = FILTER_CSS[customization.filter] || 'none';
  for (let i = 0; i < layout.photoSlots.length; i += 1) {
    const slot = layout.photoSlots[i];
    const photo = photos[i];
    if (!photo?.dataUrl) continue;
    const img = await loadImage(photo.dataUrl);
    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.width, slot.height);
    ctx.clip();
    ctx.filter = filter;
    drawCover(ctx, img, slot.x, slot.y, slot.width, slot.height);
    ctx.restore();
    ctx.filter = 'none';
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const sticker of customization.stickers) {
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

  const title = customization.title || design.title || input.eventName || '';
  const subtitle = customization.subtitle || design.subtitle || '';
  ctx.fillStyle = design.textColor || '#2a1630';
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

  return canvas.toDataURL('image/png');
}
