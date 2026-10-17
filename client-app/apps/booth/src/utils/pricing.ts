import type { BoothTemplate } from '@happypix/types';

function extractFromMapOrObj(container: any, key: string): number | null {
  if (!container || typeof container !== 'object') return null;
  if (typeof container.get === 'function') {
    const val = container.get(key);
    if (typeof val === 'number') return val;
    if (val !== undefined && val !== null && !isNaN(Number(val))) return Number(val);
  }
  const val = container[key];
  if (typeof val === 'number') return val;
  if (val !== undefined && val !== null && !isNaN(Number(val))) return Number(val);
  return null;
}

export function getTemplatePrice(
  template: BoothTemplate,
  eventOrSnapshotOrPrices?: any,
  orgDefaultsOrSettings?: any
): number {
  if (!template) return 0;

  // 1. If template object already carries a verified non-zero resolved price from the server snapshot
  if (typeof (template as any).price === 'number' && (template as any).price > 0) {
    return (template as any).price;
  }

  // Auto-unpack if a full booth snapshot was passed
  let event = eventOrSnapshotOrPrices;
  let settings = orgDefaultsOrSettings;

  if (eventOrSnapshotOrPrices && typeof eventOrSnapshotOrPrices === 'object') {
    if (eventOrSnapshotOrPrices.event) {
      event = eventOrSnapshotOrPrices.event;
      if (!settings && eventOrSnapshotOrPrices.settings) {
        settings = eventOrSnapshotOrPrices.settings;
      }
    }
  }

  const templateId = String((template as any).id || (template as any)._id || '');
  const key = template.layout?.familyId && template.layout?.slots
    ? `${template.layout.familyId}:${template.layout.slots}`
    : (template.layout?.id || '');

  // 2. If event has overrideTemplatePrices enabled, check event-specific template price
  const isOverride = !!(event && event.overrideTemplatePrices);
  if (isOverride && event?.templatePrices) {
    const p = extractFromMapOrObj(event.templatePrices, templateId);
    if (p !== null && !isNaN(p) && p >= 0) return p;
  }

  // 3. Check Organization Defaults template price
  if (settings?.templatePrices) {
    const p = extractFromMapOrObj(settings.templatePrices, templateId);
    if (p !== null && !isNaN(p) && p >= 0) return p;
  }
  if (orgDefaultsOrSettings?.templatePrices) {
    const p = extractFromMapOrObj(orgDefaultsOrSettings.templatePrices, templateId);
    if (p !== null && !isNaN(p) && p >= 0) return p;
  }
  if (!isOverride && event?.templatePrices) {
    const p = extractFromMapOrObj(event.templatePrices, templateId);
    if (p !== null && !isNaN(p) && p >= 0) return p;
  }

  // 4. If template has an explicit price of 0 (free template from snapshot)
  if (typeof (template as any).price === 'number') {
    return (template as any).price;
  }

  // 5. Layout / Size baseline price from event
  if (event?.layoutPrices && key) {
    const p = extractFromMapOrObj(event.layoutPrices, key);
    if (p !== null && !isNaN(p) && p >= 0) return p;
  }

  // 6. Layout / Size baseline price from organization defaults / settings
  if (settings?.layoutPrices && key) {
    const p = extractFromMapOrObj(settings.layoutPrices, key);
    if (p !== null && !isNaN(p) && p >= 0) return p;
  }
  if (orgDefaultsOrSettings?.layoutPrices && key) {
    const p = extractFromMapOrObj(orgDefaultsOrSettings.layoutPrices, key);
    if (p !== null && !isNaN(p) && p >= 0) return p;
  }

  // 7. Direct layoutPrices map if passed directly
  if (event && key) {
    const p = extractFromMapOrObj(event, key);
    if (p !== null && !isNaN(p) && p >= 0) return p;
  }

  return 0;
}

export const templatePrice = getTemplatePrice;


