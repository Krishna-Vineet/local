import type { BoothTemplate } from '../types'

export function templatePrice(template: BoothTemplate, prices: Record<string, number>): number {
  return prices[`${template.layout.familyId}:${template.layout.slots}`] ?? 0
}
