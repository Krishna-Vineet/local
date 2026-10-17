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
    if (!bgUrl && bgAssetId) {
      bgUrl = bgAssetId.startsWith('http') || bgAssetId.startsWith('/') ? bgAssetId : `/api/org/asset-proxy?key=${encodeURIComponent(bgAssetId)}`;
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
        
        if (newDec.assetId && template.assets) {
           const decAsset = template.assets.find(a => a.assetId === newDec.assetId);
           if (decAsset && decAsset.url) {
              newDec.url = decAsset.url;
           }
        }

        if (newDec.x !== undefined && newDec.x <= 1 && newDec.y <= 1) {
          return {
            ...newDec,
            x: newDec.x * w,
            y: newDec.y * h,
            width: newDec.width ? newDec.width * w : undefined,
            height: newDec.height ? newDec.height * h : undefined,
            size: newDec.width ? newDec.width * w : newDec.size
          }
        }
        return newDec
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
