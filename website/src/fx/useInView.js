import { useEffect, useState } from 'react'

// Returns [inView]. `once` keeps it true after the first intersection.
export function useInView(ref, { once = true, rootMargin = '0px 0px -8% 0px', threshold = 0.12 } = {}) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        if (once) io.disconnect()
      } else if (!once) {
        setInView(false)
      }
    }, { rootMargin, threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [inView]
}
