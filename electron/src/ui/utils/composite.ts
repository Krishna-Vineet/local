import type { BoothTemplate, CapturedPhoto, Customization } from '../types'

// Renders the final print image (the same composition the guest sees in
// TemplateCanvas) to a PNG data URL at the layout's print resolution.
// This composite is what gets printed AND what is sent to the backend
// as the session's final image — the org gallery and the guest
// download page lead with it.

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

  // Background: image, gradient, or solid (same rules as TemplateCanvas).
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

  // Photos into their print slots, cover-fit, with the chosen filter.
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

  // Stickers (emoji at percentage positions, like the preview).
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const sticker of customization.stickers) {
    const size = 90 * (sticker.scale ?? 1);
    ctx.font = `${size}px serif`;
    ctx.fillText(sticker.emoji, (sticker.x / 100) * canvas.width, (sticker.y / 100) * canvas.height);
  }

  // Branding footer: logo + title/subtitle in the reserved bottom band.
  const footerH = Math.round(canvas.height * 0.1);
  const footerY = canvas.height - footerH;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, footerY, canvas.width, footerH);
  const title = customization.title || design.title || input.eventName || '';
  const subtitle = customization.subtitle || design.subtitle || '';
  ctx.fillStyle = design.textColor || '#ffffff';
  ctx.textAlign = 'left';
  if (title) {
    ctx.font = `600 ${Math.round(footerH * 0.34)}px Georgia, serif`;
    ctx.fillText(title, 48, footerY + footerH * 0.38);
  }
  if (subtitle) {
    ctx.font = `${Math.round(footerH * 0.24)}px Georgia, serif`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(subtitle, 48, footerY + footerH * 0.72);
    ctx.globalAlpha = 1;
  }
  if (customization.logo) {
    const logo = await loadImage(customization.logo).catch(() => null);
    if (logo) {
      const lh = footerH * 0.62;
      const lw = (logo.naturalWidth / logo.naturalHeight) * lh;
      ctx.drawImage(logo, canvas.width - lw - 48, footerY + (footerH - lh) / 2, lw, lh);
    }
  }

  return canvas.toDataURL('image/png');
}
