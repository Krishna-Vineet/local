import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHero, Reveal, Icon, CtaBand } from '../components/ui.jsx'
import { PRINTERS, CAMERAS } from '../data/content.js'
import { sendLead } from '../lib/api.js'

const IN_THE_BOX = [
  ['Booth unit', 'Compact retro body, touchscreen, studio ring light — carried by one person'],
  ['Camera', 'Canon mirrorless (EOS R-series class) with tether-ready mount'],
  ['Printer', 'DNP dye-sub inside — warm, dry prints in ~12 seconds'],
  ['Lighting', 'Adjustable pro LED lighting tuned for skin tones, any venue'],
  ['Print kit', 'Custom print templates, themed frames and your first media pack'],
  ['Software', 'HappyPix pre-wired: gallery, guest QR downloads and payments'],
  ['Travel case', 'Everything packs into one rolling case — car boot to ballroom in minutes'],
]

export default function Hardware() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sent, setSent] = useState(false)

  const notify = async (e) => {
    e.preventDefault()
    try {
      await sendLead({ ...form, type: 'hardware', message: `Booth hardware interest. ${form.message}` })
    } catch { /* demo: acknowledge anyway */ }
    setSent(true)
  }

  return (
    <>
      <PageHero
        kicker="Hardware & compatibility"
        title={<>Your gear. Our <span className="accent-it">good manners.</span></>}
        sub="HappyPix is software-first: it speaks politely to the professional printers and cameras the industry already trusts. And because everyone asks — yes, our own booth is on its way."
      />

      <section className="section">
        <div className="wrap">
          <div className="grid-2">
            <Reveal>
              <div className="photo-card" style={{ height: 420 }}><img src="/images/retro-booth.jpg" alt="The upcoming HappyPix booth" loading="lazy" /></div>
            </Reveal>
            <Reveal delay={0.1}>
              <div>
                <span className="chip chip-soon">Booth hardware — coming soon</span>
                <h2 className="h-md" style={{ margin: '18px 0 14px' }}>The HappyPix Booth</h2>
                <p className="lead" style={{ fontSize: 16.5 }}>
                  A compact, portable booth with a big touchscreen, studio ring light, Canon heart and a DNP soul —
                  designed to be carried by one person and admired by everyone else. Rental-ready shell, permanent-install manners.
                </p>
                {sent ? (
                  <div className="form-ok" style={{ marginTop: 22 }}>Lovely — you're on the booth list. We'll write the moment pre-orders open.</div>
                ) : (
                  <form onSubmit={notify} style={{ display: 'grid', gap: 12, marginTop: 22 }}>
                    <div className="form-grid">
                      <div className="field"><label htmlFor="hw-name">Name</label><input id="hw-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></div>
                      <div className="field"><label htmlFor="hw-email">Email</label><input id="hw-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@studio.com" /></div>
                    </div>
                    <button className="btn btn-ink" type="submit" style={{ justifySelf: 'start' }}>Notify me at launch</button>
                  </form>
                )}
              </div>
            </Reveal>
          </div>

          <Reveal className="section-head" style={{ marginTop: 64, marginBottom: 26 }}>
            <span className="kicker c-pink">In the box</span>
            <h2 className="h-md">What ships with the booth</h2>
          </Reveal>
          <Reveal>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th style={{ width: '26%' }}>Component</th><th>Details</th></tr></thead>
                <tbody>
                  {IN_THE_BOX.map(([item, detail]) => (
                    <tr key={item}><td><b>{item}</b></td><td>{detail}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section section-cream">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-blue">Printers — DNP dye-sub</span>
            <h2 className="h-lg">Warm prints in ~12 seconds, <span className="accent-it" style={{ color: 'var(--blue)' }}>dry on landing</span></h2>
            <p className="lead">HappyPix drives these DNP workhorses over the standard print pipeline, with per-event print caps and copy counts set from the CRM.</p>
          </Reveal>
          <Reveal>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Printer</th><th>Format</th><th>Status</th><th>Why operators love it</th></tr></thead>
                <tbody>
                  {PRINTERS.map((p) => (
                    <tr key={p.model}>
                      <td><b>{p.brand} {p.model}</b></td><td>{p.kind}</td>
                      <td><span className="pill pill-g">{p.status}</span></td>
                      <td style={{ color: 'var(--muted)' }}>{p.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-purple">Cameras — Canon tethering</span>
            <h2 className="h-lg">A real camera makes a <span className="accent-it" style={{ color: 'var(--purple)' }}>real</span> difference</h2>
            <p className="lead">Phone cameras are the backup dancers. These Canons — over USB tethering and Canon CCAPI — are the headline act: live preview, remote shutter and full-quality frames straight into the strip.</p>
          </Reveal>
          <Reveal>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Camera</th><th>Connection</th><th>Status</th></tr></thead>
                <tbody>
                  {CAMERAS.map((c) => (
                    <tr key={c.model}>
                      <td><b>{c.brand} {c.model}</b></td><td>{c.kind}</td>
                      <td><span className="pill pill-g">{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <Reveal style={{ marginTop: 24 }}>
            <div className="sticky-note">
              Running something not on the list? If it prints through the standard pipeline or tethers over USB/CCAPI, there's a good
              chance HappyPix already gets along with it — <Link to="/contact" className="c-pink" style={{ fontWeight: 700 }}>ask us about your setup</Link> before you buy anything new.
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand title="Already own the gear?" sub="Then you're most of the way there. Start the software free and put your printer and camera to work this weekend." cta="Start free — 14 days" to="/pricing" />
    </>
  )
}
