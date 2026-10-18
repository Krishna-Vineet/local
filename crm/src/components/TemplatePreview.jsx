// Renders any template (designer or playground/composable) at preview size.
// All templates are SVG at the layout's print proportions — crisp everywhere.

import { layoutById, slotsForLayout, resolveLayout } from '../lib/layouts.js'
import { getTemplateRenderer } from '../templates/registry.jsx'

export default function TemplatePreview({ template, width = 120, photos, logos, title, tagline, style, className = '' }) {
  const layout = resolveLayout(template)
  if (!layout) return <div style={{ width, aspectRatio: '2 / 3', background: 'var(--surface-2)', borderRadius: 8, ...style }} className={className} />
  
  let geo = slotsForLayout(layout)
  let mappedTemplate = template

  // Map custom slots and decorations if they exist (from Org Templates)
  if (template?.slots?.length > 0 || template?.design || template?.assets?.length > 0) {
    const { w, h } = layout.canvas || { w: 1000, h: 1500 }
    mappedTemplate = { ...template, design: { ...template?.design } }
    
    // Resolve background image from AI template (background or bg)
    let bgUrl = mappedTemplate.design.background?.url || (typeof mappedTemplate.design.background === 'string' ? mappedTemplate.design.background : null) || mappedTemplate.design.bg?.url;
    const bgAssetId = mappedTemplate.design.background?.assetId || mappedTemplate.design.bg?.assetId;
    if (!bgUrl && bgAssetId && template.assets) {
      const bgAsset = template.assets.find(a => a.assetId === bgAssetId);
      if (bgAsset && bgAsset.url) {
        bgUrl = bgAsset.url;
      }
    }
    if (!bgUrl && bgAssetId && !bgAssetId.startsWith('temp-')) {
      bgUrl = bgAssetId.startsWith('http') || bgAssetId.startsWith('data:') || bgAssetId.startsWith('/') ? bgAssetId : `/api/org/asset-proxy?key=${encodeURIComponent(bgAssetId)}`;
    }
    if (bgUrl && (bgUrl.includes('amazonaws.com') || bgUrl.includes('happypix-bucket')) && !bgUrl.includes('X-Amz-Signature')) {
      const s3Key = (bgAssetId && !bgAssetId.startsWith('temp-') && !bgAssetId.startsWith('http') && !bgAssetId.startsWith('data:'))
        ? bgAssetId
        : bgUrl.replace(/^https?:\/\/[^/]+\//, '').split('?')[0];
      bgUrl = `/api/org/asset-proxy?key=${encodeURIComponent(s3Key)}`;
    }
    if (bgUrl && bgUrl.startsWith('http://localhost:5000/uploads')) {
      bgUrl = bgUrl.replace('http://localhost:5000', '');
    }

    if (bgUrl) {
      mappedTemplate.design.bg = { type: 'image', url: bgUrl };
      if (!mappedTemplate.design.background) mappedTemplate.design.background = { type: 'image', url: bgUrl };
      else mappedTemplate.design.background.url = bgUrl;
    } else if (mappedTemplate.design.bg?.type === 'gradient' && mappedTemplate.design.bg?.colors) {
      // Preserve existing gradient
    } else if (mappedTemplate.design.palette?.background) {
      mappedTemplate.design.bg = { type: 'solid', colors: [mappedTemplate.design.palette.background] };
    }

    if (template.slots?.length > 0) {
      geo = {
        ...geo,
        photoSlots: template.slots.map(s => ({
          id: s.id,
          x: s.x <= 1 ? s.x * w : s.x,
          y: s.y <= 1 ? s.y * h : s.y,
          width: s.width <= 1 ? s.width * w : s.width,
          height: s.height <= 1 ? s.height * h : s.height
        }))
      }
    }

    if (template.design?.decorations?.length > 0) {
      mappedTemplate.design.decorations = template.design.decorations.map(dec => {
        let newDec = { ...dec };
        
        if (!newDec.url && newDec.assetId && template.assets) {
           const decAsset = template.assets.find(a => a.assetId === newDec.assetId);
           if (decAsset && decAsset.url) {
              newDec.url = decAsset.url;
           }
        }
        if (newDec.url && (newDec.url.includes('amazonaws.com') || newDec.url.includes('happypix-bucket')) && !newDec.url.includes('X-Amz-Signature')) {
           const s3Key = (newDec.assetId && !newDec.assetId.startsWith('temp-') && !newDec.assetId.startsWith('http') && !newDec.assetId.startsWith('data:'))
             ? newDec.assetId
             : newDec.url.replace(/^https?:\/\/[^/]+\//, '').split('?')[0];
           newDec.url = `/api/org/asset-proxy?key=${encodeURIComponent(s3Key)}`;
        }
        if (newDec.url && newDec.url.startsWith('http://localhost:5000/uploads')) {
           newDec.url = newDec.url.replace('http://localhost:5000', '');
        }

        const rawX = newDec.x ?? 0;
        const rawY = newDec.y ?? 0;
        const rawW = newDec.width ?? 1;
        const rawH = newDec.height ?? 1;
        if (Math.abs(rawX) <= 4 && Math.abs(rawY) <= 4 && rawW <= 4 && rawH <= 4) {
          return {
            ...newDec,
            x: rawX * w,
            y: rawY * h,
            width: rawW * w,
            height: rawH * h,
            size: rawW * w,
          };
        }
        return newDec;
      })
    }
  }

  const Render = getTemplateRenderer(mappedTemplate)
  return (
    <div style={{ width, lineHeight: 0, ...style }} className={className}>
      <Render layout={layout} geo={geo} template={mappedTemplate} photos={photos} logos={logos} title={title} tagline={tagline} />
    </div>
  )
}
