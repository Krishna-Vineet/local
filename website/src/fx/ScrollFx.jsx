import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'framer-motion'

// ─── Scroll-linked motion (Framer Motion, already in the project) ───
// Every component here ties its motion directly to scroll position.
// Under prefers-reduced-motion they render static, fully visible content.

// Reading text: each word fades up from a dim tone as you scroll past it.
export function ScrollText({ text, as: Tag = 'p', className = '', dim = 0.14 }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.92', 'end 0.55'] })
  const words = text.split(/\s+/).filter(Boolean)
  return (
    <Tag ref={ref} className={`scroll-text ${className}`.trim()}>
      {words.map((w, i) => (
        <ScrollWord
          key={`${i}-${w}`}
          word={w}
          index={i}
          total={words.length}
          progress={scrollYProgress}
          dim={dim}
          reduce={reduce}
        />
      ))}
    </Tag>
  )
}

function ScrollWord({ word, index, total, progress, dim, reduce }) {
  const start = (index / total) * 0.9
  const opacity = useTransform(progress, [start, Math.min(1, start + 0.1)], [dim, 1])
  return (
    <motion.span className="sw" style={{ opacity: reduce ? 1 : opacity }}>
      {word}{' '}
    </motion.span>
  )
}

// Photo that drifts inside its frame as the card scrolls through the viewport.
// The image is oversized so the drift never shows an edge.
export function ParallaxMedia({ src, alt = '', strength = 20, loading = 'lazy' }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength])
  return (
    <div ref={ref} className="px-clip">
      <motion.img src={src} alt={alt} loading={loading} style={{ y: reduce ? 0 : y, scale: 1.14 }} />
    </div>
  )
}

// Element that grows from a slightly smaller size into place as it scrolls up.
export function ScrollScale({ children, from = 0.94, className = '' }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.95', 'start 0.35'] })
  const scale = useTransform(scrollYProgress, [0, 1], [from, 1])
  const y = useTransform(scrollYProgress, [0, 1], [40, 0])
  return (
    <motion.div ref={ref} className={className} style={{ scale: reduce ? 1 : scale, y: reduce ? 0 : y }}>
      {children}
    </motion.div>
  )
}

// Thin page-progress line under the navbar.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 32, restDelta: 0.001 })
  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />
}
