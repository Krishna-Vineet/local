import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Reveal, CtaBand } from '../components/ui.jsx';
import PricingCards from '../components/PricingCards.jsx';
import CrmShowcase from '../components/CrmShowcase.jsx';
import ParticleSwarm from '../fx/ParticleSwarm.jsx';
import LiquidOrbs from '../fx/LiquidOrbs.jsx';
import TopoLines from '../fx/TopoLines.jsx';
import PaperCut from '../fx/PaperCut.jsx';
import { Kinetic, CountUp } from '../fx/Kinetic.jsx';
import { ScrollText, ParallaxMedia, ScrollScale } from '../fx/ScrollFx.jsx';
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
  const heroRef = useRef(null)
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(heroP, [0, 1], [0, 140])
  const heroFade = useTransform(heroP, [0, 0.75], [1, 0])
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
      <section className="hero" ref={heroRef}>
        <div className="hero-media" aria-hidden="true">
          {HERO_SLIDES.map((src, i) => (
            <img key={src} src={src} alt="" className={`hero-slide${i === heroSlide ? ' on' : ''}`} />
          ))}
        </div>
        <div className="hero-shade" />
        <LiquidOrbs />
        <ParticleSwarm count={64} />
        <motion.div className="hero-content" style={{ y: heroY, opacity: heroFade }}>
          <div className="wrap">
            <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
              <div className="hero-eyebrow">Photo booths · Software · Hardware · CRM</div>
              <Kinetic as="h1" mode="mount">Every Pixel is a <em className="neon">Happy Moment.</em></Kinetic>
              <p className="hero-sub">HappyPix is the photobooth guests queue for — and the business operators build weekends, side incomes and studios on.</p>
              <div className="hero-actions">
                <Link className="btn btn-pink btn-arrow btn-neon" to="/pricing">Start your booth</Link>
                <Link className="btn btn-outline-light" to="/business">See the business case</Link>
              </div>
              <div className="hero-proof">
                <div><b>₹20–60k</b><span>typical per-event booking</span></div>
                <div><b>4–6 months</b><span>common payback period</span></div>
                <div><b>120+ operators</b><span>running on HappyPix</span></div>
              </div>
            </motion.div>
          </div>
        </motion.div>
        <div className="glass hero-glass" aria-hidden="true">
          <div className="hg-head"><span className="hg-dot" />Sample session · printing</div>
          <div className="hg-frames"><i /><i /><i /><i /></div>
          <div className="hg-bar"><span /></div>
          <div className="hg-foot"><b>Strip #0426</b><span>Ready in ~12 s</span></div>
        </div>
        <span className="hero-scroll">Scroll</span>
      </section>

      {/* ---------- stats ---------- */}
      <section className="stat-strip">
        <div className="wrap">
          {STATS.map(([n, l, c]) => (
            <div className="stat-cell" key={l}><b style={{ color: c }}><CountUp value={n} /></b><span>{l}</span></div>
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
      <PaperCut color="var(--cream)" seed={2} depth={16} />
      <section className="section section-cream">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-blue">Where it works</span>
            <Kinetic as="h2" className="h-lg">Anywhere people gather, <span className="accent-it" style={{ color: 'var(--blue)' }}>a queue forms</span></Kinetic>
            <ScrollText as="p" className="lead" text="If there's a celebration, a crowd or a checkout line nearby, there's a booth business in it." />
          </Reveal>
          <Reveal>
            <div className="venue-grid">
              {VENUES.map((v) => (
                <div className={`photo-card ${v.cls}`} key={v.name}>
                  <ParallaxMedia src={v.img} alt={v.name} />
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
            <Kinetic as="h2" className="h-lg">Software that runs the <span className="accent-it" style={{ color: 'var(--purple)' }}>boring parts</span></Kinetic>
            <ScrollText as="p" className="lead" text="Events, booths, galleries, designs, payments and leads — every part of the business in one dashboard, updating live while you're at the event (or not at it)." />
          </Reveal>
          <Reveal><ScrollScale><CrmShowcase /></ScrollScale></Reveal>
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
                <div className="card origami" style={{ height: '100%' }}>
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
      <PaperCut color="var(--ink)" seed={5} />
      <section className="section section-ink topo-host" style={{ overflow: 'hidden' }}>
        <TopoLines seed={7} color="255,190,225" alpha={0.12} />
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker" style={{ color: '#ffb3d9' }}>Operator stories</span>
            <Kinetic as="h2" className="h-lg">Real people. Real weekends. <span className="accent-it">Real money.</span></Kinetic>
            <ScrollText as="p" className="lead" text="A teacher selling bookmarks at book fairs. A Goan with two booths in resorts. This is who's actually running HappyPix." />
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
            <Kinetic as="h2" className="h-lg">Before you <span className="accent-it" style={{ color: 'var(--purple)' }}>ask</span></Kinetic>
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
            <Kinetic as="h2" className="h-lg">One event can cover <span className="accent-it" style={{ color: '#5f9420' }}>months of plan</span></Kinetic>
            <ScrollText as="p" className="lead" text="Plans are billed monthly, cancel anytime. The software is the small cost — the booth is the earner." />
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
