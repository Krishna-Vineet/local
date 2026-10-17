import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

// Real, scannable QR code (not a decoration). It draws in an effect on mount,
// so it works even when the parent card mounts after an exit animation.
export default function BoothQr({ url, size = 168 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    QRCode.toCanvas(ref.current, url, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#141020', light: '#ffffff' },
    }).catch(() => {})
  }, [url, size])
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      role="img"
      aria-label={`QR code that opens ${url}`}
      style={{ width: size, height: size, margin: '16px auto 6px', display: 'block', borderRadius: 10 }}
    />
  )
}
