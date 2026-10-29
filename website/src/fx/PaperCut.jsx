// ─── Paper cut edge ──────────────────────────────────────────
// A torn/cut zig-zag that makes the next section look like paper laid over the
// previous one. `color` is the colour of the section it belongs to.
// `floor` pins it to the bottom of a positioned parent (page headers).

const W = 1440
const H = 40
const TEETH = 56

function rand(i, seed) {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function zigzag(seed) {
  let d = `M0 ${H} L0 ${(4 + rand(0, seed) * 8).toFixed(1)}`
  for (let i = 1; i <= TEETH; i++) {
    const x = (i / TEETH) * W
    const y = i % 2 === 0 ? 4 + rand(i, seed) * 9 : 16 + rand(i, seed) * 14
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return `${d} L${W} ${H} Z`
}

export default function PaperCut({ color = 'var(--cream)', floor = false, seed = 1, depth = H }) {
  return (
    <div className={`paper-cut${floor ? ' floor' : ''}`} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ fill: color, height: depth }}>
        <path d={zigzag(seed)} />
      </svg>
    </div>
  )
}
