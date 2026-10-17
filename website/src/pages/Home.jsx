import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Reveal, CtaBand } from '../components/ui.jsx';
import PricingCards from '../components/PricingCards.jsx';
import CrmShowcase from '../components/CrmShowcase.jsx';
import { fetchPlans } from '../lib/api.js';
import { VENUES, STORIES, WHY_POINTS, FAQS } from '../data/content.js';

const STATS = [
  ['2,300+', 'events powered', 'var(--pink)'],
  ['1.4 lakh', 'prints delivered', 'var(--blue)'],
  ['120+', 'operators earning', '#5f9420'],
  ['38', 'cities & counting', 'var(--purple)'],
];

const HERO_SLIDES = ['/images/hero-pro-1.jpg', '/images/hero-pro-2.jpg', '/images/hero-pro-3.jpg'];

export default function Home() {
  const [plans, setPlans] = useState([]);
  const [openFaq, setOpenFaq] = useState(0)
  const [heroSlide, setHeroSlide] = useState(0)

  // Crossfading professional backdrop (slow Ken Burns) — replaces the
  // old retro film-frame video with a clean corporate-event look.
  useEffect(() => {
    const timer = setInterval(() => setHeroSlide((s) => (s + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { fetchPlans().then(({ plans }) => setPlans(plans)).catch(() => setPlans([])); }, []);
  return (
    <>
      {/* ---------- professional hero (living photo backdrop) ---------- */}
      <section className="hero">
        <div className="hero-media" aria-hidden="true">
          {HERO_SLIDES.map((src, i) => (
            <img key={src} src={src} alt="" className={`hero-slide${i === heroSlide ? ' on' : ''}`} />
          ))}
        </div>
        <div className="hero-shade" />
        <div className="hero-content">
          <div className="wrap">
            <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
              <div className="hero-eyebrow">Photo booths · Software · Hardware · CRM</div>
              <h1>Every Pixel is a <em>Happy Moment.</em></h1>
              <p className="hero-sub">HappyPix is the photobooth guests queue for — and the business operators build weekends, side incomes and studios on.</p>
              <div className="hero-actions">
                <Link className="btn btn-pink btn-arrow" to="/pricing">Start your booth</Link>
                <Link className="btn btn-outline-light" to="/business">See the business case</Link>
              </div>
              <div className="hero-proof">
                <div><b>₹20–60k</b><span>typical per-event booking</span></div>
                <div><b>4–6 months</b><span>common payback period</span></div>
                <div><b>120+ operators</b><span>running on HappyPix</span></div>
              </div>
            </motion.div>
          </div>
        </div>
        <span className="hero-scroll">Scroll</span>
      </section>

      {/* ---------- stats ---------- */}
      <section className="stat-strip">
        <div className="wrap">
          {STATS.map(([n, l, c]) => (
            <div className="stat-cell" key={l}><b style={{ color: c }}>{n}</b><span>{l}</span></div>
          ))}
        </div>
      </section>

      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <span key={k}>Weddings — Corporate Events — Pay-Per-Print — Fridge Magnets — Wallet Prints — Bookmarks — Malls & Cafés — College Fests — Brand Launches —</span>
          ))}
        </div>
      </div>


      {/* ---------- where booths work ---------- */}
      <section className="section section-cream">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-blue">Where it works</span>
            <h2 className="h-lg">Anywhere people gather, <span className="accent-it" style={{ color: 'var(--blue)' }}>a queue forms</span></h2>
            <p className="lead">If there's a celebration, a crowd or a checkout line nearby, there's a booth business in it.</p>
          </Reveal>
          <Reveal>
            <div className="venue-grid">
              {VENUES.map((v) => (
                <div className={`photo-card ${v.cls}`} key={v.name}>
                  <img src={v.img} alt={v.name} loading="lazy" />
                  <div className="cap"><b>{v.name}</b><span>{v.note}</span></div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- CRM showcase ---------- */}
      <section className="section">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-purple">The control room</span>
            <h2 className="h-lg">Software that runs the <span className="accent-it" style={{ color: 'var(--purple)' }}>boring parts</span></h2>
            <p className="lead">Events, booths, galleries, designs, payments and leads — every part of the business in one dashboard, updating live while you're at the event (or not at it).</p>
          </Reveal>
          <Reveal><CrmShowcase /></Reveal>
          <Reveal delay={0.08}>
            <div className="crm-caption">
              <div><span className="dot bg-pink" /><div><b>Live event tracking</b><span>See every booth's prints and queue from your phone.</span></div></div>
              <div><span className="dot bg-blue" /><div><b>Bookings to invoices</b><span>Quotes, dates and payments without spreadsheet archaeology.</span></div></div>
              <div><span className="dot bg-green" /><div><b>Galleries that sell</b><span>Guests download from your branded page — and see your booking button.</span></div></div>
              <div style={{ marginLeft: 'auto' }}><Link className="btn btn-ink btn-arrow btn-sm" to="/software">Explore the software</Link></div>
            </div>
          </Reveal>

          {/* implicit why-us */}
          <div className="grid-4" style={{ marginTop: 56 }}>
            {WHY_POINTS.map((w, i) => (
              <Reveal key={w.title} delay={i * 0.06}>
                <div className="card" style={{ height: '100%' }}>
                  <div className="ic" style={{ background: w.color }}>{w.ic}</div>
                  <h3 style={{ fontSize: 19 }}>{w.title}</h3>
                  <p style={{ fontSize: 14.5 }}>{w.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- stories ---------- */}
      <section className="section section-ink" style={{ overflow: 'hidden' }}>
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker" style={{ color: '#ffb3d9' }}>Operator stories</span>
            <h2 className="h-lg">Real people. Real weekends. <span className="accent-it">Real money.</span></h2>
            <p className="lead">A teacher selling bookmarks at book fairs. A Goan with two booths in resorts. This is who's actually running HappyPix.</p>
          </Reveal>
        </div>
        <div className="wrap">
          <div className="story-rail">
            {STORIES.map((s) => (
              <article className="story-card" key={s.name} style={{ color: 'var(--ink)' }}>
                <div className="simg"><img src={s.img} alt={s.model} loading="lazy" /></div>
                <div className="sbody">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {s.tags.map((t) => <span key={t} className="chip" style={{ background: s.color }}>{t}</span>)}
                  </div>
                  <blockquote>“{s.quote}”</blockquote>
                  <div className="story-stats">
                    {s.stats.map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}
                  </div>
                  <div className="smeta">
                    <span className="avatar" style={{ background: s.color }}>{s.initials}</span>
                    <div><b>{s.name}</b><span>{s.model} · {s.city}</span></div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p style={{ color: '#9d94c4', fontSize: 13, marginTop: 8 }}>Operator figures shared with permission; individual results vary with city and effort.</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <Reveal className="section-head">
            <span className="kicker c-purple">Questions</span>
            <h2 className="h-lg">Before you <span className="accent-it" style={{ color: 'var(--purple)' }}>ask</span></h2>
          </Reveal>
          <Reveal>
            <div>
              {FAQS.map((f, i) => (
                <div className={`faq-item${openFaq === i ? ' open' : ''}`} key={f.q}>
                  <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>{f.q}</button>
                  {openFaq === i && <p className="faq-a">{f.a}</p>}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- pricing (compact) ---------- */}
      <section className="section">
        <div className="wrap">
          <Reveal className="section-head center">
            <span className="kicker c-green">Straightforward pricing</span>
            <h2 className="h-lg">One event can cover <span className="accent-it" style={{ color: '#5f9420' }}>months of plan</span></h2>
            <p className="lead">Plans are billed monthly, cancel anytime. The software is the small cost — the booth is the earner.</p>
          </Reveal>
          {plans.length
            ? <PricingCards plans={plans.slice(0, 6)} linkToCheckout />
            : <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Loading plans…</p>}
          <p style={{ textAlign: 'center', marginTop: 26 }}>
            <Link to="/pricing" style={{ fontWeight: 700 }} className="c-pink">Compare every feature, add-ons & FAQs →</Link>
          </p>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
