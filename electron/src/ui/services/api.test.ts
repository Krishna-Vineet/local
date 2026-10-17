import { describe, expect, it, vi } from 'vitest'
import { HttpApi, normalizeSnapshot, type PartnerBoothSnapshot, type LoginInput } from './api'

const loginInput: LoginInput = {
  email: 'booth@happypix.in',
  password: 'securepassword123',
  deviceUuid: 'test-device-uuid',
  deviceName: 'Test Booth',
  clientDateTime: '2026-09-27T12:00:00+05:30',
  location: { label: 'Test venue' },
  platform: 'win32',
  appVersion: '0.1.0',
  display: { width: 1920, height: 1080, scaleFactor: 1, external: true },
}

describe('booth HttpApi and snapshot normalization', () => {
  it('normalizes partner booth snapshot branding and device format', () => {
    const raw: PartnerBoothSnapshot = {
      device: { id: 'dev-1', name: 'Kiosk One', uuid: 'uuid-123' },
      organization: { id: 'org-1', name: 'Test Org' },
      branding: { organization: { logos: ['https://example.com/logo.png'], tagline: 'Say Cheese' } },
      settings: {
        organizationName: 'Test Org',
        boothTimeoutSec: 90,
        payoutMode: 'wallet',
        upiId: 'test@upi',
        paymentDisplayName: 'Test Org',
        currency: 'INR',
        maximumPrints: 10,
      },
      event: null,
      revision: 'rev-1',
      serverTime: '2026-09-27T12:00:00Z',
    }

    const normalized = normalizeSnapshot(raw)
    expect(normalized.device.uuid).toBe('uuid-123')
    expect(normalized.organization.branding?.logoUrl).toBe('https://example.com/logo.png')
    expect(normalized.organization.branding?.tagline).toBe('Say Cheese')
  })

  it('performs live HTTP requests with correct headers and payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        installation: {
          deviceUuid: 'test-device-uuid',
          deviceToken: 'jwt-device-token',
          deviceId: 'dev-1',
          organizationId: 'org-1',
          pairedAt: '2026-09-27T12:00:00Z',
          locationLabel: 'Test venue',
        },
        snapshot: {
          device: { id: 'dev-1', name: 'Kiosk One' },
          organization: { id: 'org-1', name: 'Test Org' },
          settings: {
            organizationName: 'Test Org',
            boothTimeoutSec: 90,
            payoutMode: 'wallet',
            upiId: null,
            paymentDisplayName: 'Test Org',
            currency: 'INR',
            maximumPrints: 10,
          },
          event: null,
          revision: 'rev-1',
          serverTime: '2026-09-27T12:00:00Z',
        },
      }),
    })
    globalThis.fetch = mockFetch

    const api = new HttpApi('http://localhost:5000')
    const result = await api.login(loginInput)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/booth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
    expect(result.installation.deviceToken).toBe('jwt-device-token')
  })

  it('rejects with server error message when request fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid booth credentials' }),
    })

    const api = new HttpApi('http://localhost:5000')
    await expect(api.login(loginInput)).rejects.toThrow('Invalid booth credentials')
  })
})
