// ─── Liquid morph ────────────────────────────────────────────
// Organic blobs whose edges keep reshaping (animated border-radius), merged
// together by a gooey SVG filter so they pour into each other like liquid.
// Pure CSS animation — no per-frame JavaScript.

export default function LiquidOrbs() {
  return (
    <>
      <svg className="fx-defs" aria-hidden="true" focusable="false">
        <filter id="fx-goo" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>
      <div className="liquid-stage" aria-hidden="true">
        <span className="liquid-orb o1" />
        <span className="liquid-orb o2" />
        <span className="liquid-orb o3" />
        <span className="liquid-orb o4" />
      </div>
    </>
  )
}
