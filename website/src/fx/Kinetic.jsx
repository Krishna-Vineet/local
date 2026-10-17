import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from 'react'
import { useInView } from './useInView.js'

// ─── Kinetic typography ──────────────────────────────────────
// Splits text (including text nested inside accent <span>/<em>) into words
// that rise into place one after another. Works on JSX titles, so the
// existing accent colours and italics survive. Reduced-motion: no animation.

function splitNode(node, counter) {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).split(/(\s+)/).map((part) => {
      if (!part) return null
      if (/^\s+$/.test(part)) return part
      const i = counter.n++
      return (
        <span className="kx-w" key={`w${i}`}>
          <span style={{ '--kd': `${(i * 0.055).toFixed(3)}s` }}>{part}</span>
        </span>
      )
    })
  }
  if (isValidElement(node) && node.props.children != null) {
    return cloneElement(node, undefined, Children.map(node.props.children, (c) => splitNode(c, counter)))
  }
  return node
}

export function Kinetic({ as: Tag = 'span', mode = 'view', className = '', children }) {
  const ref = useRef(null)
  const [inView] = useInView(ref)
  const [mounted, setMounted] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const on = mode === 'mount' ? mounted : inView
  useEffect(() => {
    if (!on) return
    // once the reveal has finished, drop the mask so glows/shadows aren't clipped
    const t = setTimeout(() => setDone(true), 2200)
    return () => clearTimeout(t)
  }, [on])

  const counter = { n: 0 }
  const content = Children.map(children, (c) => splitNode(c, counter))
  return (
    <Tag ref={ref} className={`kx${on ? ' is-in' : ''}${done ? ' is-done' : ''}${className ? ` ${className}` : ''}`}>
      {content}
    </Tag>
  )
}

// ─── Count-up numbers ────────────────────────────────────────
// "2,300+" → counts to 2300 keeping the grouping and suffix; "1.4 lakh" keeps
// its one decimal. Falls back to plain text for anything it can't parse.
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function CountUp({ value, duration = 1600 }) {
  const ref = useRef(null)
  const [inView] = useInView(ref)
  const [n, setN] = useState(null)
  const str = String(value)
  const m = str.match(/^([\d,]*\.?\d+)(.*)$/)
  const num = m ? m[1] : ''
  const suffix = m ? m[2] : ''
  const clean = num.replace(/,/g, '')
  const target = parseFloat(clean)
  const decimals = (clean.split('.')[1] || '').length
  const grouped = num.includes(',')

  useEffect(() => {
    if (!inView || !m) return
    if (reduced()) { setN(target); return }
    let raf
    const t0 = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setN(p < 1 ? target * e : target)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView])

  if (!m) return <span>{str}</span>
  const fmt = (v) => {
    const s = v.toFixed(decimals)
    return grouped
      ? Number(s).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : s
  }
  return <span ref={ref}>{fmt(n == null ? 0 : n)}{suffix}</span>
}
