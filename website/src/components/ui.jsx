import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CRM_URL } from '../lib/api.js';
import FlowField from '../fx/FlowField.jsx';
import PaperCut from '../fx/PaperCut.jsx';
import TopoLines from '../fx/TopoLines.jsx';
import { Kinetic } from '../fx/Kinetic.jsx';
import { ScrollFade } from '../fx/ScrollFx.jsx';

/* ---------- icons (stroke set, matches booth-app icon names) ---------- */
const PATHS = {
  check: 'M4 12.5l5 5L20 6.5',
  arrow: 'M4 12h15M13 5l7 7-7 7',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 16a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z',
  clock: 'M12 21a9 9 0 110-18 9 9 0 010 18z M12 7v5l3.5 2',
  layouts: 'M4 4h16v16H4z M4 10h16 M10 10v10',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  sliders: 'M5 7h6M15 7h4M5 12h2M11 12h8M5 17h10M19 17h0 M13 4.5v5M9 9.5v5M17 14.5v5',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h3v3h-3z M20 14v.1 M14 20h.1 M18 18h2v2h-2z',
  wallet: 'M4 6a2 2 0 012-2h13v3 M4 6v12a2 2 0 002 2h14a1 1 0 001-1v-9a1 1 0 00-1-1H6a2 2 0 01-2-2z M16.5 14h.1',
  gallery: 'M4 5h16v14H4z M4 16l4.5-4.5 3 3L16 10l4 4 M9 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  chart: 'M4 20V4 M4 20h16 M8 16v-5 M12 16V8 M16 16v-3',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z M9 12l2 2 4-4',
  tablet: 'M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z M11 17.5h2',
  monitor: 'M4 5h16v11H4z M9 20h6 M12 16v4',
  download: 'M12 4v11M7 11l5 5 5-5 M4 20h16',
  play: 'M7 5l12 7-12 7z',
  phone: 'M6 4h4l1.5 4.5L9 10a12 12 0 005 5l1.5-2.5L20 14v4a2 2 0 01-2 2A15 15 0 014 6a2 2 0 012-2z',
  mail: 'M4 6h16v12H4z M4 7l8 6 8-6',
  pin: 'M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 1113 0C18.5 15.6 12 21 12 21z M12 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  share: 'M12 15V4M8 7l4-4 4 4 M5 13v7h14v-7',
  heart: 'M12 20s-7.5-4.7-9.3-9.2C1.4 7.4 3.4 4 6.7 4c2 0 3.7 1.1 5.3 3 1.6-1.9 3.3-3 5.3-3 3.3 0 5.3 3.4 4 6.8C19.5 15.3 12 20 12 20z',
};

export function Icon({ name, size = 20 }) {
  const d = PATHS[name] || PATHS.sparkles;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

/* ---------- scroll reveal ---------- */
export function Reveal({ children, delay = 0, className, style, id }) {
  return (
    <motion.div
      id={id}
      className={className}
      style={style}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- logo (real HappyPix marks) ---------- */
export function Logo({ light = true, full = false }) {
  if (full) {
    return <img src={light ? '/logo-full-on-dark.svg' : '/logo-full-on-light.svg'} alt="HappyPix" style={{ height: 110, width: 'auto' }} />;
  }
  return (
    <span className="logo-lockup">
      <img className="logo-mark" src={light ? '/logo-mark-on-dark.svg' : '/logo-mark-on-light.svg'} alt="" />
      <span className="logo-word" style={light ? undefined : { color: 'var(--ink)' }}>Happy<b>Pix</b></span>
    </span>
  );
}

/* ---------- navbar: dark bar, light links, always ---------- */
const NAV = [
  ['The Booth', '/booth'],
  ['Software', '/software'],
  ['Hardware', '/hardware'],
  ['Pricing', '/pricing'],
  ['Business', '/business'],
  ['Contact', '/contact'],
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn);
    fn();
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <header className={`nav${scrolled ? ' scrolled' : ''}`}>
      <div className="nav-inner">
        <Link to="/" onClick={() => setOpen(false)} style={{ textDecoration: 'none' }} aria-label="HappyPix home"><Logo /></Link>
        <button className="nav-burger" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
        <nav className={`nav-links${open ? ' open' : ''}`}>
          {NAV.map(([label, to]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
          ))}
          <span style={{ display: 'flex', gap: 10, marginLeft: 6 }} className="nav-mobile-cta">
            <a className="nav-btn btn-outline-light" href={CRM_URL} target="_blank" rel="noreferrer">CRM sign in</a>
            <Link className="nav-btn btn-pink" to="/pricing#checkout" onClick={() => setOpen(false)}>Buy HappyPix</Link>
          </span>
        </nav>
      </div>
    </header>
  );
}

/* ---------- inner-page hero ---------- */
export function PageHero({ kicker, title, sub, lede, children }) {
  return (
    <section className="page-hero">
      <FlowField />
      <ScrollFade className="wrap">
        <span className="kicker">{kicker}</span>
        <Kinetic as="h1" mode="mount">{title}</Kinetic>
        {(sub || lede) && <p>{sub || lede}</p>}
        {children}
      </ScrollFade>
      <PaperCut floor color="var(--paper)" />
    </section>
  );
}

/* ---------- marquee ---------- */
export function Marquee({ items }) {
  const row = items.join(' — ') + ' — ';
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track"><span>{row}</span><span>{row}</span></div>
    </div>
  );
}

/* ---------- film strip (decorative) ---------- */
export function FilmStrip({ images = [], rotate = 0, style }) {
  return (
    <div className="filmstrip" style={{ transform: `rotate(${rotate}deg)`, ...style }}>
      {images.map((src, i) => (
        <figure key={i} style={{ aspectRatio: '4/3' }}><img src={src} alt="" loading="lazy" /></figure>
      ))}
      <div style={{ textAlign: 'center', color: '#fff', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, padding: '2px 0 4px' }}>HappyPix ✦ est. tonight</div>
    </div>
  );
}

/* ---------- footer ---------- */
export function Footer() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="fgrid">
          <div className="fbrand">
            <img src="/logo-full-on-dark.svg" alt="HappyPix" style={{ height: 92, width: 'auto' }} />
            <p>Every Pixel is a Happy Moment. The photobooth platform for events, venues and the people building businesses on them — software, hardware and a CRM that runs the boring parts.</p>
          </div>
          <div>
            <h4>Product</h4>
            <Link to="/booth">The Booth</Link>
            <Link to="/software">Software &amp; CRM</Link>
            <Link to="/hardware">Hardware &amp; Compatibility</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/pricing#checkout">Buy / Renew a Plan</Link>
          </div>
          <div>
            <h4>Business</h4>
            <Link to="/business">Run a Booth Business</Link>
            <Link to="/business#calculator">Earnings Calculator</Link>
            <Link to="/business#stories">Operator Stories</Link>
            <Link to="/hardware">Printers &amp; Cameras</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/contact">Contact &amp; Support</Link>
            <Link to="/contact">Book a Demo</Link>
            <a href={CRM_URL} target="_blank" rel="noreferrer">CRM Sign In</a>
            <Link to="/booth">Guest Download Demo</Link>
          </div>
        </div>
        <div className="fbar">
          <span>© {new Date().getFullYear()} HappyPix. Made for people who love a good photo.</span>
          <span>hello@happypix.com.au · Sydney, Australia</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------- closing CTA band ---------- */
export function CtaBand({ title = 'Put a booth where the people are.', sub = 'Start with a plan today — your booth can be earning at its first event this weekend.', cta = 'See plans & pricing', to = '/pricing' }) {
  return (
    <section className="section" style={{ paddingTop: 8 }}>
      <div className="wrap">
        <div className="center-cta foil foil-dark">
          <TopoLines seed={11} color="255,255,255" alpha={0.085} />
          <h2>{title}</h2>
          <p>{sub}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-pink btn-arrow btn-neon" to={to}>{cta}</Link>
            <Link className="btn btn-outline-light" to="/contact">Talk to us first</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Notice({ children }) {
  return <div className="notice-banner"><div className="wrap"><span aria-hidden>📌</span><div>{children}</div></div></div>;
}
