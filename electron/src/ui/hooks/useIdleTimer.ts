import { useCallback, useEffect, useRef, useState } from 'react'

export function useIdleTimer(enabled: boolean, timeoutSeconds: number, onExpire: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds)
  const expiresAt = useRef(0)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  const reset = useCallback(() => {
    expiresAt.current = Date.now() + timeoutSeconds * 1000
    setSecondsLeft(timeoutSeconds)
  }, [timeoutSeconds])

  useEffect(() => {
    if (!enabled) return
    expiresAt.current = Date.now() + timeoutSeconds * 1000
    const initialize = window.setTimeout(() => setSecondsLeft(timeoutSeconds), 0)
    const activity = () => reset()
    window.addEventListener('pointerdown', activity, { capture: true })
    window.addEventListener('keydown', activity, { capture: true })
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt.current - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) {
        window.clearInterval(interval)
        onExpireRef.current()
      }
    }, 250)
    return () => {
      window.clearTimeout(initialize)
      window.clearInterval(interval)
      window.removeEventListener('pointerdown', activity, { capture: true })
      window.removeEventListener('keydown', activity, { capture: true })
    }
  }, [enabled, reset, timeoutSeconds])

  return { secondsLeft, reset }
}
