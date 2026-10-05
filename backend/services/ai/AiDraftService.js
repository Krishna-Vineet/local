// AI template draft generation for the Template Playground.
//
// Contract (CRM v2): POST /api/platform/templates/ai-generate
//   { prompt, layoutId } → { draft } — an UNSAVED, template-shaped draft.
//
// Behaviour:
//   * With TOGETHER_API_KEY (+ AWS/S3): a real AI background is generated
//     (FLUX) and uploaded to S3; the draft points at that https URL.
//   * Without it: a deterministic, prompt-derived SVG background is
//     embedded as a data: URL — same as the CRM demo, good enough to
//     design against and costs nothing.
// Nothing is persisted here; the client saves via the normal create route.

import { slotsForLayout } from '../../lib/layouts.js';
import { uploadToS3 } from '../../utils/s3.js';
import TogetherImageProvider from './TogetherImageProvider.js';

const PALETTES = [
  { accent: '#D9B44A', textColor: '#FFFFFF' },
  { accent: '#F42E93', textColor: '#FFFFFF' },
  { accent: '#74A3E9', textColor: '#FFFFFF' },
  { accent: '#A6D76C', textColor: '#16121F' },
  { accent: '#F3D9A4', textColor: '#FFFFFF' },
];
const ORNAMENTS = ['none', 'dots', 'flourish', 'stripes'];
const FONTS = ['sans', 'serif', 'script'];
const SHAPES = ['rect', 'arch', 'round'];

function hashString(str) {
  let hash = 0;
  const pt = String(str).trim().toLowerCase();
  for (let i = 0; i < pt.length; i++) hash = (hash * 31 + pt.charCodeAt(i)) >>> 0;
  return hash;
}

function aiBackgroundSvg(w, h, accent, hash) {
  const c2 = hash % 2 === 0 ? '#221741' : '#3A1C33';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="#120D1F"/></linearGradient><radialGradient id="r" cx="0.5" cy="0.2" r="0.9"><stop offset="0" stop-color="${accent}66"/><stop offset="1" stop-color="${accent}00"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#r)"/><circle cx="${w * 0.78}" cy="${h * 0.16}" r="${w * 0.22}" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="3"/><circle cx="${w * 0.16}" cy="${h * 0.72}" r="${w * 0.16}" fill="${accent}" fill-opacity="0.08"/><circle cx="${w * 0.85}" cy="${h * 0.85}" r="${w * 0.1}" fill="#FFFFFF" fill-opacity="0.05"/></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

async function generateAiBackground(prompt, layout) {
  const togetherKey = (process.env.TOGETHER_API_KEY || '').trim();
  const hasS3 = Boolean(process.env.S3_BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  if (togetherKey && hasS3) {
    try {
      const provider = new TogetherImageProvider();
      const buffer = await provider.generateImage(
        `${prompt}. Pure background artwork only — a seamless edge-to-edge design with no photo frames, no borders, no text.`
      );
      const uploaded = await uploadToS3({
        buffer,
        mimetype: 'image/png',
        folder: 'happypix/templates/backgrounds',
        originalname: `ai-bg-${Date.now()}.png`,
      });
      return uploaded.url;
    } catch (err) {
      console.warn('⚠️ AI background generation failed, falling back to deterministic art:', err.message);
    }
  }
  const { canvas } = slotsForLayout(layout.id);
  const hash = hashString(prompt);
  const pal = PALETTES[hash % PALETTES.length];
  return aiBackgroundSvg(canvas.w, canvas.h, pal.accent, hash);
}

export async function generateAiDraft(prompt, layout) {
  const hash = hashString(prompt);
  const pal = PALETTES[hash % PALETTES.length];
  const words = String(prompt).trim().split(/\s+/).slice(0, 4).map((w) => w[0].toUpperCase() + w.slice(1));

  const bgUrl = await generateAiBackground(prompt, layout);

  return {
    name: words.join(' ') || 'AI Design',
    description: `Generated: ${String(prompt).trim()}`,
    category: 'Custom',
    layoutId: layout.id,
    source: 'ai_generated',
    status: 'draft',
    design: {
      bg: { type: 'image', url: bgUrl },
      accent: pal.accent,
      textColor: pal.textColor,
      ornament: ORNAMENTS[hash % ORNAMENTS.length],
      font: FONTS[(hash >> 2) % FONTS.length],
      slotShape: SHAPES[(hash >> 3) % SHAPES.length],
      titleBand: false,
    },
  };
}
