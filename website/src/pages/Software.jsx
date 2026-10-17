import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHero, Reveal, Icon, CtaBand } from '../components/ui.jsx'
import CrmShowcase from '../components/CrmShowcase.jsx'
import { FEATURES, PLATFORMS, PLAN_MATRIX, ADDONS } from '../data/content.js'
import { sendLead } from '../lib/api.js'

const CRM_POINTS = [
  { title: 'Events & devices', text: 'Create events, assign booths, pause or resume a night mid-flight. Devices heartbeat their health; removed booths are locked out instantly.' },
  { title: 'Templates & AI studio', text: 'A library of designer layouts, a playground to build your own, and AI generation + background removal when the theme is “something with dinosaurs, but classy”.' },
  { title: 'Money, handled', text: 'Per-layout pricing, Razorpay & UPI at the booth, coupons with real redemption rules, print caps, revenue by event and by month.' },
  { title: 'Gallery & consent', text: 'Final prints stream into your gallery as sessions finish. Require guest consent before anything is featured — the booth asks, the CRM enforces.' },
  { title: 'Team & roles', text: 'Admins run the business, managers run the night. Bans, suspensions and session revocation act immediately, everywhere.' },
  { title: 'Support that reaches', text: 'Guests can raise an issue from the booth; your team answers from the CRM. Platform support is one request away when it is bigger than you.' },
]

export default function Software() {
  const [waitlist, setWaitlist] = useState({ email: '', platform: 'android' })
  const [sent, setSent] = useState('')

  const joinWaitlist = async (e) => {
    e.preventDefault()
    try {
      await sendLead({ name: 'Waitlist', email: waitlist.email, type: 'demo', message: `Platform waitlist: ${waitlist.platform}` })
    } catch { /* waitlist still acknowledged locally in demo contexts */ }
    setSent(`You're on the ${PLATFORMS.find((p) => p.id === waitlist.platform)?.name} waitlist — first invite is yours.`)
  }

  return (
    <>
      <PageHero
        kicker="Software & apps"
        title={<>One platform. Every <span className="accent-it">screen</span> at the party.</>}
        sub="Booth apps for the devices your guests touch, and a CRM for the business behind them. The booth apps are launching soon for Android tablets, iPad and Windows kiosks — the CRM is ready the day you subscribe."
      />

      <section className="section">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-pink">Booth apps — launching soon</span>
            <h2 className="h-lg">Bring your own screen. <span className="accent-it">We bring the show.</span></h2>
            <p className="lead">Three kiosk apps, one shared brain. Pair any of them with your account and your events, templates and prices follow automatically.</p>
          </Reveal>
          <div className="grid-3">
            {PLATFORMS.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.08}>
                <article className="card" style={{ height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="ic" style={{ background: ['var(--green)', 'var(--blue)', 'var(--purple)'][i] }}><Icon name={p.icon} size={23} /></span>
                    <span className="chip chip-soon">{p.status}</span>
                  </div>
                  <h3>{p.name}</h3>
                  <p>{p.text}</p>
                  <ul className="checks" style={{ marginTop: 18 }}>
                    {p.points.map((pt) => <li key={pt}><span>{pt}</span></li>)}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <form onSubmit={joinWaitlist} className="form-card" style={{ marginTop: 28, background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }}>
              <div className="grid-2" style={{ gap: 24, alignItems: 'end' }}>
                <div>
                  <h3 className="h-md">Be first when your platform lands</h3>
                  <p style={{ color: '#b9b2d4', fontSize: 15, marginTop: 8 }}>Launch invites go to the waitlist first — with founding pricing locked in.</p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: '1 1 200px' }}>
                    <label htmlFor="wl-email" style={{ color: '#fff' }}>Email</label>
                    <input id="wl-email" type="email" required value={waitlist.email} onChange={(e) => setWaitlist({ ...waitlist, email: e.target.value })} placeholder="you@studio.com" />
                  </div>
                  <div className="field">
                    <label htmlFor="wl-platform" style={{ color: '#fff' }}>Platform</label>
                    <select id="wl-platform" value={waitlist.platform} onChange={(e) => setWaitlist({ ...waitlist, platform: e.target.value })}>
                      {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-pink" type="submit">Join waitlist</button>
                </div>
              </div>
              {sent ? <div className="form-ok" style={{ marginTop: 16 }}>{sent}</div> : null}
            </form>
          </Reveal>
        </div>
      </section>

      <section className="section section-cream">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-blue">Inside the booth app</span>
            <h2 className="h-lg">The guest flow, <span className="accent-it" style={{ color: 'var(--blue)' }}>feature by feature</span></h2>
          </Reveal>
          <div className="grid-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 0.06}>
                <article className="card" style={{ height: '100%' }}>
                  <span className="ic" style={{ background: `var(--${f.tone === 'amber' ? 'amber' : f.tone})` }}><Icon name={f.icon} size={22} /></span>
                  <h3 style={{ fontSize: 19 }}>{f.title}</h3>
                  <p style={{ fontSize: 14.5 }}>{f.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-purple">And behind it, the CRM</span>
            <h2 className="h-lg">The calm dashboard your business <span className="accent-it" style={{ color: 'var(--purple)' }}>grows into</span></h2>
            <p className="lead">Included with every plan. If the booth is the theatre, the CRM is the very organised person with the clipboard who makes theatre possible.</p>
          </Reveal>
          <Reveal><CrmShowcase /></Reveal>
          <div className="grid-3" style={{ marginTop: 36 }}>
            {CRM_POINTS.map((point, i) => (
              <Reveal key={point.title} delay={(i % 3) * 0.07}>
                <article className="card" style={{ height: '100%' }}>
                  <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--pink)', fontSize: 22 }}>0{i + 1}</span>
                  <h3 style={{ fontSize: 20 }}>{point.title}</h3>
                  <p style={{ fontSize: 14.5 }}>{point.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-cream">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-green">What's in which plan</span>
            <h2 className="h-lg">Every feature, <span className="accent-it" style={{ color: '#5f9420' }}>on the table</span></h2>
            <p className="lead">No "contact us to find out". This is the whole map — booth counts and event limits scale by plan on the pricing page.</p>
          </Reveal>
          <Reveal>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Capability</th><th>Starter</th><th>Professional</th><th>Business</th></tr></thead>
                <tbody>
                  {PLAN_MATRIX.map(([label, a, b, c]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td className={a ? 'y' : 'n'}>{a ? '✓ Included' : '—'}</td>
                      <td className={b ? 'y hot' : 'n'}>{b ? '✓ Included' : '—'}</td>
                      <td className={c ? 'y' : 'n'}>{c ? '✓ Included' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal className="section-head" style={{ marginTop: 56, marginBottom: 28 }}>
            <h2 className="h-md">Add-ons, when you want them</h2>
          </Reveal>
          <div className="grid-3">
            {ADDONS.map((a, i) => (
              <Reveal key={a.name} delay={(i % 3) * 0.06}>
                <article className="card" style={{ height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                    <h3 style={{ fontSize: 19 }}>{a.name}</h3>
                    <b className="c-pink" style={{ whiteSpace: 'nowrap', fontSize: 14 }}>{a.price}</b>
                  </div>
                  <p style={{ fontSize: 14.5, marginTop: 8 }}>{a.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ marginTop: 34 }}>
            <Link to="/pricing#checkout" className="btn btn-pink btn-arrow">Start with the CRM today</Link>
          </Reveal>
        </div>
      </section>

      <CtaBand title="Software that respects the ritual." sub="Try the full CRM free for 14 days — one booth, every feature, no card required." cta="Start free" to="/pricing" />
    </>
  )
}
