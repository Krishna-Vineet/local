import { describe, expect, it } from 'vitest'
import { demoBoothApi, type LoginInput } from './api'

const loginInput = (overrides: Partial<LoginInput> = {}): LoginInput => ({
  email: 'booth@happypix.in',
  password: 'demo123',
  deviceUuid: 'test-device-uuid',
  deviceName: 'Test Booth',
  clientDateTime: '2026-09-27T12:00:00+05:30',
  location: { label: 'Test venue' },
  platform: 'win32',
  appVersion: '0.1.0',
  display: { width: 1920, height: 1080, scaleFactor: 1, external: true },
  ...overrides,
})

describe('demo booth contract', () => {
  it('pairs a persistent UUID and returns a complete live-event snapshot', async () => {
    const result = await demoBoothApi.login(loginInput())

    expect(result.installation.deviceUuid).toBe('test-device-uuid')
    expect(result.installation.deviceToken).toContain('test-device-uuid')
    expect(result.snapshot.event?.status).toBe('live')
    expect(result.snapshot.event?.templates.length).toBeGreaterThan(1)
    expect(result.snapshot.event?.layoutPrices['57:3']).toBe(120)
    expect(result.snapshot.settings.boothTimeoutSec).toBeGreaterThanOrEqual(10)
  })

  it('rejects incorrect pairing credentials', async () => {
    await expect(demoBoothApi.login(loginInput({ password: 'wrong-password' }))).rejects.toThrow('Login failed')
  })

  it('calculates coupon discounts from event pricing', async () => {
    const { installation, snapshot } = await demoBoothApi.login(loginInput())
    const selected = snapshot.event!.templates.find((template) => template.id === 'tpl-royal-57')!

    const quote = await demoBoothApi.quote(installation, {
      eventId: snapshot.event!.id,
      templateId: selected.id,
      layoutId: selected.layout.id,
      prints: 2,
      digitalCopy: true,
      couponCode: 'PIX20',
    })

    expect(quote.unitPrice).toBe(120)
    expect(quote.gross).toBe(240)
    expect(quote.discount).toBe(48)
    expect(quote.finalAmount).toBe(192)
    expect(quote.settlement).toBe('wallet')
  })

  it('registers a fully discounted order as a zero-value quote', async () => {
    const { installation, snapshot } = await demoBoothApi.login(loginInput())
    const selected = snapshot.event!.templates[0]
    const quote = await demoBoothApi.quote(installation, {
      eventId: snapshot.event!.id,
      templateId: selected.id,
      layoutId: selected.layout.id,
      prints: 1,
      digitalCopy: false,
      couponCode: 'FREEPIX',
    })

    expect(quote.finalAmount).toBe(0)
    await expect(demoBoothApi.completeFree(installation, quote)).resolves.toBeUndefined()
  })

  it('rejects an invalid coupon instead of trusting the booth', async () => {
    const { installation, snapshot } = await demoBoothApi.login(loginInput())
    const selected = snapshot.event!.templates[0]

    await expect(demoBoothApi.quote(installation, {
      eventId: snapshot.event!.id,
      templateId: selected.id,
      layoutId: selected.layout.id,
      prints: 1,
      digitalCopy: true,
      couponCode: 'NOTREAL',
    })).rejects.toThrow('invalid')
  })
})
