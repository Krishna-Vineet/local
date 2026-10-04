import { describe, expect, it } from 'vitest'
import type { BoothTemplate } from '../types'
import { templatePrice } from './pricing'

const template = {
  layout: { familyId: '57', slots: 3 },
} as BoothTemplate

describe('event price lookup', () => {
  it('uses the event snapshot price namespace', () => {
    expect(templatePrice(template, { '57:3': 125 })).toBe(125)
  })

  it('does not invent a price when the event snapshot is missing it', () => {
    expect(templatePrice(template, {})).toBe(0)
  })
})
