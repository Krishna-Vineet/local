// Renders any template (designer or playground/composable) at preview size.
// All templates are SVG at the layout's print proportions — crisp everywhere.

import { layoutById, slotsForLayout } from '../lib/layouts.js'
import { getTemplateRenderer } from '../templates/registry.jsx'

export default function TemplatePreview({ template, width = 120, photos, logos, title, tagline, style, className = '' }) {
  const layout = layoutById(template?.layoutId)
  if (!layout) return <div style={{ width, aspectRatio: '2 / 3', background: 'var(--surface-2)', borderRadius: 8, ...style }} className={className} />
  const geo = slotsForLayout(layout.id)
  const Render = getTemplateRenderer(template)
  return (
    <div style={{ width, lineHeight: 0, ...style }} className={className}>
      <Render layout={layout} geo={geo} template={template} photos={photos} logos={logos} title={title} tagline={tagline} />
    </div>
  )
}
