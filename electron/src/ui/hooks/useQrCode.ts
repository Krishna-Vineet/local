import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function useQrCode(value: string | null, width = 360): string | null {
  const [source, setSource] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!value) return
    void QRCode.toDataURL(value, {
      width,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#160f24', light: '#ffffff' },
    }).then((url) => {
      if (active) setSource(url)
    })
    return () => {
      active = false
    }
  }, [value, width])

  return value ? source : null
}
