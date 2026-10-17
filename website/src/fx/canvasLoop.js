// Shared canvas lifecycle: sizes to its parent (DPR-capped), runs only while
// on screen and the tab is visible, and draws a settled still frame when the
// visitor prefers reduced motion.
export function mountCanvas(canvas, { init, tick }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const ctx = canvas.getContext('2d')
  const host = canvas.parentElement
  const st = { w: 0, h: 0, dpr: 1, running: false, raf: 0, visible: false, last: 0 }

  const size = () => {
    const r = host.getBoundingClientRect()
    if (!r.width || !r.height) return
    st.dpr = Math.min(window.devicePixelRatio || 1, 1.6)
    st.w = r.width
    st.h = r.height
    canvas.width = Math.round(st.w * st.dpr)
    canvas.height = Math.round(st.h * st.dpr)
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0)
    init(st)
    if (reduce) for (let i = 0; i < 140; i++) tick(st, ctx, 1)
  }

  const loop = (now) => {
    if (!st.running) return
    const dt = st.last ? Math.min(2, (now - st.last) / 16.67) : 1
    st.last = now
    tick(st, ctx, dt)
    st.raf = requestAnimationFrame(loop)
  }
  const start = () => {
    if (reduce || st.running || !st.visible || document.hidden || !st.w) return
    st.running = true
    st.last = 0
    st.raf = requestAnimationFrame(loop)
  }
  const stop = () => {
    st.running = false
    cancelAnimationFrame(st.raf)
  }

  const ro = new ResizeObserver(() => { stop(); size(); start() })
  ro.observe(host)
  const io = new IntersectionObserver(([entry]) => {
    st.visible = entry.isIntersecting
    if (st.visible) start(); else stop()
  })
  io.observe(canvas)
  const onVis = () => (document.hidden ? stop() : start())
  document.addEventListener('visibilitychange', onVis)

  return () => {
    stop()
    ro.disconnect()
    io.disconnect()
    document.removeEventListener('visibilitychange', onVis)
  }
}
