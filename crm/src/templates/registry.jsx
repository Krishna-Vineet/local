// Template registry — maps a template row to its rendering component.
//
// • Designer templates: hand-crafted components registered by
//   `componentId` (the design lives in src/templates/designer/*).
// • Playground / AI templates: rendered by ComposableTemplate from
//   their saved `design` config.
//
// The registry is UI-only (JSX); the mock server and seed DB use the
// data-only meta in src/lib/templateMeta.js.

import { DESIGNER_TEMPLATES } from '../lib/templateMeta.js'
import { ClassicPostcard, MinimalMono, PanoramaStory } from './designer/Classic.jsx'
import { RoyalWedding, VintageBookmark, GalaGold, FestiveMaroon, LegacyGuestbook } from './designer/Wedding.jsx'
import { NeonParty, SunsetStrip, FilmStrip, CollectorReel, KidsSplash } from './designer/Party.jsx'
import { CorporateGrid } from './designer/Corporate.jsx'
import { ComposableTemplate } from './ComposableTemplate.jsx'

export const TEMPLATE_COMPONENTS = {
  ClassicPostcard,
  MinimalMono,
  PanoramaStory,
  RoyalWedding,
  VintageBookmark,
  GalaGold,
  FestiveMaroon,
  LegacyGuestbook,
  NeonParty,
  SunsetStrip,
  FilmStrip,
  CollectorReel,
  KidsSplash,
  CorporateGrid,
}

export const DESIGNER_META = DESIGNER_TEMPLATES

export function getTemplateRenderer(template) {
  const id = template?.componentId
  if (id && TEMPLATE_COMPONENTS[id]) return TEMPLATE_COMPONENTS[id]
  return (props) => <ComposableTemplate {...props} />
}

export function isDesigner(template) {
  return template?.source === 'designer' && !!template?.componentId && !!TEMPLATE_COMPONENTS[template.componentId]
}
