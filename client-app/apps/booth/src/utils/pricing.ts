import type { BoothTemplate } from '@happypix/types';

export function getTemplatePrice(
  template: BoothTemplate,
  layoutPrices?: Record<string, number> | Map<string, number>
): number {
  if (!template) return 0;
  if (!layoutPrices) return 0;

  const key = `${template.layout.familyId}:${template.layout.slots}`;

  if (typeof (layoutPrices as any).get === 'function') {
    const val = (layoutPrices as Map<string, number>).get(key);
    if (typeof val === 'number') return val;
  }

  const record = layoutPrices as Record<string, number>;
  if (typeof record[key] === 'number') {
    return record[key];
  }

  return 0;
}

export const templatePrice = getTemplatePrice;
