import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Reveal } from '../components/ui.jsx';
import EarningsCalculator from '../components/EarningsCalculator';
import { PageHero, CtaBand } from '../components/ui';
import { BUSINESS_MODELS, STORIES } from '../data/content';

const PLAYBOOK = [
  { color: 'var(--pink)', title: 'Pick your first market', desc: 'One city, one crowd you already know — your housing society, your college alumni, three banquet halls near home. Familiar beats big.' },
  { color: 'var(--blue)', title: 'Get the kit together', desc: 'Booth hardware, a DNP or Canon printer, camera, backdrop and your first paper stock. Most operators start between ₹1.2–2.5 lakh all-in.' },
  { color: 'var(--green)', title: 'Do two free events', desc: 'A friend’s birthday and a society function. You’re buying photos, reviews and your first gallery of proof — the cheapest marketing there is.' },
  { color: 'var(--purple)', title: 'List, quote, book', desc: 'Put your gallery link everywhere, quote within the hour, take a 30% advance. The CRM tracks dates so you never double-book a Saturday.' },
  { color: 'var(--pink)', title: 'Add a second income line', desc: 'Magnets for corporates, bookmarks for fairs, a pay-per-print placement for weekdays. Same booth, three tills.' },
];

export default function Business() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  return (
    <>
      <PageHero
        kicker="The business case"
        title={<>A photobooth is a <span className="accent-it">small business</span>, not a side gadget</>}
        sub="Weekend rentals, unattended pay-per-print placements, products people keep for years. Here's the honest maths and the playbook behind 120+ HappyPix operators."
      >
        <div className="hero-actions">
          <Link className="btn btn-pink btn-arrow" to="/pricing#checkout">Start with a plan</Link>
          <a className="btn btn-outline-light" href="#calculator">Run the numbers</a>
        </div>
      </PageHero>

      <section className="section">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-pink">The three tills</span>
            <h2 className="h-lg">One booth, <span className="accent-it">three revenue models</span></h2>
            <p className="lead">Most operators start with rentals, then add a weekday placement so the booth earns while they're at their day job.</p>
          </Reveal>
          <div className="grid-3">
            {BUSINESS_MODELS.map((m, i) => (
              <Reveal key={m.id} delay={i * 0.08}>
                <div className="card" style={{ height: '100%' }}>
                  <span className="chip" style={{ background: m.color }}>{m.chip}</span>
                  <h3 style={{ marginTop: 16 }}>{m.title}</h3>
                  <p>{m.desc}</p>
                  <div style={{ marginTop: 18, borderTop: '1px solid var(--line)' }}>
                    {m.facts.map(([k, v]) => <div className="spec-row" key={k} style={{ padding: '10px 0' }}><span>{k}</span><b>{v}</b></div>)}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <div id="calculator" style={{ marginTop: 56, scrollMarginTop: 100 }}>
            <Reveal className="section-head"><h2 className="h-md">The earnings calculator</h2></Reveal>
            <Reveal><EarningsCalculator /></Reveal>
          </div>

          <div className="grid-2" style={{ marginTop: 64, alignItems: 'start' }}>
            <div>
              <Reveal className="section-head" style={{ marginBottom: 8 }}>
                <span className="kicker c-blue">What it costs to start</span>
                <h2 className="h-md">Honest startup maths</h2>
              </Reveal>
              <div className="tbl-wrap"><table className="tbl"><tbody>
                <tr><td>Booth hardware (retro or kiosk unit)</td><td style={{ textAlign: 'right' }}><b>₹80,000 – 1,60,000</b></td></tr>
                <tr><td>Dye-sub printer (DNP DS-RX1HS class)</td><td style={{ textAlign: 'right' }}><b>₹55,000 – 75,000</b></td></tr>
                <tr><td>Camera (Canon EOS R50 class) + lens</td><td style={{ textAlign: 'right' }}><b>₹60,000 – 85,000</b></td></tr>
                <tr><td>Backdrop, props, first paper & ink</td><td style={{ textAlign: 'right' }}><b>₹15,000 – 30,000</b></td></tr>
                <tr><td>HappyPix plan (2 devices included)</td><td style={{ textAlign: 'right' }}><b>from ₹499/month (excl. 18% GST)</b></td></tr>
                <tr><td><b>Typical all-in start</b></td><td style={{ textAlign: 'right' }}><b className="c-pink">₹1.2 – 2.5 lakh</b></td></tr>
              </tbody></table></div>
              <div className="sticky-note" style={{ marginTop: 16 }}>Already own a camera or printer? HappyPix works with the gear on our <Link to="/hardware">compatibility list</Link> — many operators start with what’s in their cupboard.</div>
            </div>
            <div>
              <Reveal className="section-head" style={{ marginBottom: 8 }}>
                <span className="kicker c-green">The playbook</span>
                <h2 className="h-md">From box to booked Saturdays</h2>
              </Reveal>
              <div className="steps">
                {PLAYBOOK.map((s, i) => (
                  <div className="step" key={s.title}>
                    <span className="step-num" style={{ borderColor: s.color, color: s.color }}>{i + 1}</span>
                    <div><h3>{s.title}</h3><p>{s.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-ink" style={{ overflow: 'hidden' }} id="stories">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker" style={{ color: '#ffb3d9' }}>Operator stories</span>
            <h2 className="h-lg">The people already <span className="accent-it">doing it</span></h2>
            <p className="lead">Wallet prints in Mumbai housing societies. Magnets in Pune boardrooms. Bookmarks at Bengaluru book fairs. Resorts in Goa that pay for themselves.</p>
          </Reveal>
          <div className="story-rail">
            {STORIES.map((s) => (
              <article className="story-card" key={s.name} style={{ color: 'var(--ink)' }}>
                <div className="simg"><img src={s.img} alt={s.model} loading="lazy" /></div>
                <div className="sbody">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{s.tags.map((t) => <span key={t} className="chip" style={{ background: s.color }}>{t}</span>)}</div>
                  <blockquote>“{s.quote}”</blockquote>
                  <div className="story-stats">{s.stats.map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}</div>
                  <div className="smeta"><span className="avatar" style={{ background: s.color }}>{s.initials}</span><div><b>{s.name}</b><span>{s.model} · {s.city}</span></div></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CtaBand title="Your first Saturday is closer than you think." sub="Start on the cheapest plan, do two events, and let the booth make the argument for the upgrade." cta="See plans" to="/pricing" />
    </>
  );
}
