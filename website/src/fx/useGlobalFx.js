import { useEffect } from 'react'

const prefersReduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// App-wide effect wiring (one listener each, no per-component cost):
//  • holographic foil — pointer position feeds --mx/--my on .foil elements
//  • kinetic marquee — bands tilt a touch with scroll speed, then settle
export function useGlobalFx() {
  useEffect(() => {
    const onMove = (e) => {
      const el = e.target instanceof Element ? e.target.closest('.foil') : null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`)
      el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`)
    }
    document.addEventListener('pointermove', onMove, { passive: true })

    const root = document.documentElement
    let last = window.scrollY
    let skew = 0
    let raf = 0
    const settle = () => {
      skew *= 0.86
      root.style.setProperty('--mq-skew', `${skew.toFixed(3)}deg`)
      if (Math.abs(skew) > 0.02) raf = requestAnimationFrame(settle)
      else { skew = 0; raf = 0; root.style.setProperty('--mq-skew', '0deg') }
    }
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - last
      last = y
      if (prefersReduced()) return
      skew = Math.max(-0.7, Math.min(0.7, skew * 0.4 + dy * 0.03))
      if (!raf) raf = requestAnimationFrame(settle)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      document.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])
}
