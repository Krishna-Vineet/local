import type { BoothTemplate } from '../types'

function extractFromMapOrObj(container: any, key: string): number | null {
  if (!container || typeof container !== 'object') return null
  if (typeof container.get === 'function') {
    const val = container.get(key)
    if (typeof val === 'number') return val
    if (val !== undefined && val !== null && !isNaN(Number(val))) return Number(val)
  }
  const val = container[key]
  if (typeof val === 'number') return val
  if (val !== undefined && val !== null && !isNaN(Number(val))) return Number(val)
  return null
}

function resolveLayoutKey(template: BoothTemplate): string {
  if (!template) return ''
  const layout = (template as any).layout
  if (layout?.familyId && layout?.slots) {
    return `${layout.familyId}:${layout.slots}`
  }
  const layoutId = String(layout?.id || (template as any).layoutId || '')
  if (!layoutId) return ''
  const legacy = layoutId.match(/^(.+?)-[vh](\d+)$/i)
  if (legacy) {
    return `${legacy[1]}:${Number(legacy[2])}`
  }
  const clean = layoutId.split(' ')[0].split('—')[0].toUpperCase().replace(/\s*-\s*/g, '-')
  let parts = clean.split('-')
  if (parts.length === 4 && parts[1].startsWith('T') && (parts[2] === 'V' || parts[2] === 'H')) {
    parts = ['P1', ...parts]
  }
  if (parts.length >= 4) {
    const mediaPart = (parts[0].startsWith('P') && parts[1]) ? parts[1] : parts[0]
    const slotsPart = (parts[0].startsWith('P') && parts[2]) ? parts[2] : parts[1]
    const slotsNum = parseInt(slotsPart.replace(/[^0-9]/g, ''), 10) || 1
    return `${mediaPart}:${slotsNum}`
  }
  return layoutId
}

export function getTemplatePrice(
  template: BoothTemplate,
  eventOrSnapshotOrPrices?: any,
  orgDefaultsOrSettings?: any
): number {
  if (!template) return 0
  let event = eventOrSnapshotOrPrices
  let settings = orgDefaultsOrSettings
  if (eventOrSnapshotOrPrices && typeof eventOrSnapshotOrPrices === 'object') {
    if (eventOrSnapshotOrPrices.event) {
      event = eventOrSnapshotOrPrices.event
      if (!settings && eventOrSnapshotOrPrices.settings) {
        settings = eventOrSnapshotOrPrices.settings
      }
    }
  }
  const id1 = String((template as any).id || '')
  const id2 = String((template as any)._id || '')
  const ids = [id1, id2].filter(Boolean)
  const key = resolveLayoutKey(template)
  const isOverride = !!(event && event.overrideTemplatePrices)
  if (isOverride && event?.templatePrices) {
    for (const tid of ids) {
      const p = extractFromMapOrObj(event.templatePrices, tid)
      if (p !== null) return p
    }
  }
  if (settings?.templatePrices) {
    for (const tid of ids) {
      const p = extractFromMapOrObj(settings.templatePrices, tid)
      if (p !== null) return p
    }
  }
  if (orgDefaultsOrSettings?.templatePrices) {
    for (const tid of ids) {
      const p = extractFromMapOrObj(orgDefaultsOrSettings.templatePrices, tid)
      if (p !== null) return p
    }
  }
  if (!isOverride && event?.templatePrices) {
    for (const tid of ids) {
      const p = extractFromMapOrObj(event.templatePrices, tid)
      if (p !== null) return p
    }
  }
  if (typeof (template as any).price === 'number' && !isNaN((template as any).price) && (template as any).price > 0) {
    return (template as any).price
  }
  if (event?.layoutPrices && key) {
    const p = extractFromMapOrObj(event.layoutPrices, key)
    if (p !== null) return p
  }
  if (settings?.layoutPrices && key) {
    const p = extractFromMapOrObj(settings.layoutPrices, key)
    if (p !== null) return p
  }
  if (orgDefaultsOrSettings?.layoutPrices && key) {
    const p = extractFromMapOrObj(orgDefaultsOrSettings.layoutPrices, key)
    if (p !== null) return p
  }
  if (event && key) {
    const p = extractFromMapOrObj(event, key)
    if (p !== null) return p
  }
  if (typeof (template as any).price === 'number' && (template as any).price === 0) {
    return 0
  }
  return 0
}

export const templatePrice = getTemplatePrice
