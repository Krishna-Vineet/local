import { Link } from 'react-router-dom'
import { PageHero, Reveal, Marquee, CtaBand } from '../components/ui.jsx'
import RetroBooth from '../components/RetroBooth.jsx'

const MOMENTS = [
  { title: 'The welcome', text: 'Your event name, your logos, your tagline — the attract screen is a poster for the night, showing real sample photos from your last event.', img: '/images/hero-booth.jpg', note: 'Start screens carry sponsor branding on Pro plans and above.' },
  { title: 'The pose', text: 'A generous countdown, light that flatters everyone, filters from warm film to full party. Retakes allowed; dignity optional.', img: '/images/wedding-booth.jpg', note: 'Live view means nobody guesses where to stand.' },
  { title: 'The personal touch', text: 'Guests arrange their frames, add stickers, sign with a finger and preview the exact strip — the same pixels the printer is about to produce.', img: '/images/guests-party.jpg', note: 'Print-true geometry: what they see is what comes out.' },
  { title: 'The keep', text: 'A warm print in the tray in seconds, and a QR on screen for the digital copy. The strip goes on the fridge; the file goes on the feed.', img: '/images/retro-booth.jpg', note: 'Digital links expire in 24 hours — private by default.' },
]

const GUEST_VS_OPERATOR = [
  ['Session start', 'Taps once, sees your branding', 'Sets start screen & templates per event in the CRM'],
  ['Photos', 'Live view, countdown, retakes', 'Chooses layouts, pose count and filters allowed'],
  ['Personalising', 'Stickers, signatures, frames', 'Locks brand frames so output always looks right'],
  ['Printing', 'Collects a warm strip in ~12s', 'Sets copies, print caps and per-layout prices'],
  ['Paying (if enabled)', 'UPI / card on the booth', 'Sees revenue land in the dashboard live'],
  ['Digital copy', 'Scans QR, saves in seconds', 'Branded download page with your booking button'],
  ['After the event', 'Link expires in 24 hours', 'Full gallery, leads & analytics in the CRM'],
]

export default function Booth() {
  return (
    <>
      <PageHero
        kicker="The booth experience"
        title={<>Retro soul. <span className="accent-it">Studio standards.</span></>}
        sub="People have loved photo booths for a hundred years for one reason: the little ritual. Curtain, countdown, flash, strip. HappyPix keeps every second of that ritual — and removes every second of friction around it."
      >
        <div className="hero-actions">
          <a href="#try" className="btn btn-pink">Try the demo booth</a>
          <Link to="/hardware" className="btn btn-outline-light">Booth hardware — coming soon</Link>
        </div>
      </PageHero>
      <Marquee items={['Strike a pose', '3 · 2 · 1 · Cheese!', 'Print in ~12 seconds', 'Scan for your copy', 'Link lives 24 hours']} />

      <section className="section" id="try" style={{ scrollMarginTop: 90 }}>
        <div className="wrap">
          <Reveal className="section-head center">
            <span className="kicker c-pink">Hands-on</span>
            <h2 className="h-lg">Go on. Press the <span className="accent-it">big pink button.</span></h2>
            <p className="lead">This is the exact rhythm your guests will feel — countdown, flash, print, QR. No instructions needed, which is rather the point.</p>
          </Reveal>
          <Reveal><RetroBooth /></Reveal>
        </div>
      </section>

      <section className="section section-cream">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-blue">Anatomy of a session</span>
            <h2 className="h-lg">Four moments guests <span className="accent-it" style={{ color: 'var(--blue)' }}>talk about</span></h2>
          </Reveal>
          <div style={{ display: 'grid', gap: 64 }}>
            {MOMENTS.map((m, i) => (
              <Reveal key={m.title}>
                <div className="grid-2" style={{ direction: i % 2 ? 'rtl' : 'ltr' }}>
                  <div className="photo-card" style={{ height: 340, direction: 'ltr' }}><img src={m.img} alt={m.title} loading="lazy" /></div>
                  <div style={{ direction: 'ltr' }}>
                    <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 19 }} className="c-pink">moment {i + 1}</span>
                    <h3 className="h-md" style={{ margin: '10px 0 14px' }}>{m.title}</h3>
                    <p className="lead" style={{ fontSize: 16.5 }}>{m.text}</p>
                    <p style={{ marginTop: 14, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>↳ {m.note}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-purple">Two sides of the glass</span>
            <h2 className="h-lg">Simple for guests. <span className="accent-it" style={{ color: 'var(--purple)' }}>Serious for you.</span></h2>
            <p className="lead">Everything a guest touches is one tap deep. Everything you control sits behind it in the CRM.</p>
          </Reveal>
          <Reveal>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th style={{ width: '22%' }}>Step</th><th>What the guest experiences</th><th>What you control</th></tr></thead>
                <tbody>
                  {GUEST_VS_OPERATOR.map(([step, guest, op]) => (
                    <tr key={step}><td><b>{step}</b></td><td>{guest}</td><td>{op}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <div className="grid-2" style={{ marginTop: 64 }}>
            <Reveal>
              <div>
                <span className="kicker c-green">The digital copy</span>
                <h2 className="h-md" style={{ margin: '16px 0 14px' }}>The strip is theirs. The link is too — for 24 hours.</h2>
                <p className="lead" style={{ fontSize: 16.5 }}>
                  Every finished session creates a private page holding the final print and the individual frames.
                  The booth's success screen turns it into a QR; guests scan with any phone camera. No app. No sign-up.
                  And when the 24 hours are up, the link quietly expires.
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                  <Link to="/download/demo" className="btn btn-ink">See a sample download page</Link>
                  <Link to="/pricing" className="btn btn-outline">Get this for your booths</Link>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div style={{ display: 'flex', gap: 20, justifyContent: 'center', alignItems: 'flex-start' }}>
                <div className="filmstrip" style={{ transform: 'rotate(-4deg)', width: 180 }}>
                  {['/images/guests-party.jpg', '/images/hero-booth.jpg'].map((src, i) => <figure key={i} style={{ aspectRatio: '4/3' }}><img src={src} alt="" loading="lazy" /></figure>)}
                  <div style={{ textAlign: 'center', color: '#fff', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12, padding: '2px 0 4px' }}>HappyPix ✦ est. tonight</div>
                </div>
                <div className="filmstrip" style={{ transform: 'rotate(3deg)', width: 180, marginTop: 40 }}>
                  {['/images/wedding-booth.jpg', '/images/retro-booth.jpg'].map((src, i) => <figure key={i} style={{ aspectRatio: '4/3' }}><img src={src} alt="" loading="lazy" /></figure>)}
                  <div style={{ textAlign: 'center', color: '#fff', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12, padding: '2px 0 4px' }}>HappyPix ✦ est. tonight</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <CtaBand title="Your guests will do the marketing." sub="Every strip on a fridge and every download page carries your brand. Start with a plan and be at your first event this weekend." />
    </>
  )
}
