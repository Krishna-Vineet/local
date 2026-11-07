import { Fragment, useEffect, useMemo, useState } from 'react';
import { publicPages, boothGuides, compatibility, setupChoices } from './content/public.js';

const API_BASE = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://happypix-v2-backend.vercel.app' : '')).replace(/\/+$/, '');
const LEADS_API_BASE = (import.meta.env.VITE_LEADS_API_URL || (import.meta.env.PROD ? 'https://happypixurl.vercel.app' : '/lead-api')).replace(/\/+$/, '');
const HELP = 'You aint authorised, check there pages for any help';

async function api(path, { token, base = API_BASE, ...options } = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || `Request failed (${response.status})`), { status: response.status, data });
  return data;
}

function getInitialPage() {
  const requested = new URLSearchParams(location.search).get('page');
  return requested || 'happypix-101';
}

function Icon({ children, className = '' }) { return <span className={`icon ${className}`} aria-hidden="true">{children}</span>; }
function Badge({ children, tone = '' }) { return <span className={`badge ${tone}`}>{children}</span>; }
function Breadcrumbs({ title, onHome }) {
  return <div className="breadcrumbs"><button onClick={onHome}>Field guide</button><span>/</span><span>{title}</span></div>;
}
function Screenshot({ name, caption, onZoom }) {
  const [loaded, setLoaded] = useState(true);
  return <button className={`shot ${loaded ? '' : 'shot-placeholder'}`} onClick={() => loaded && onZoom(`/screenshots/${name}`, caption)} aria-label={`Open screenshot: ${caption}`}>
    {loaded && <img src={`/screenshots/${name}`} alt={caption} onError={() => setLoaded(false)} />}
    {!loaded && <div className="shot-empty"><span className="shot-mark">＋</span><b>Screenshot slot</b><span>Drop in <code>{name}</code></span></div>}
    <span className="shot-caption">{caption}<span>↗</span></span>
  </button>;
}
function Section({ title, children, id }) { return <section className="doc-section" id={id}><div className="section-heading"><span className="section-dot" /><h2>{title}</h2></div>{children}</section>; }
function Callout({ children, kind = 'tip' }) { return <div className={`callout ${kind}`}><span>{kind === 'warn' ? '!' : '✳'}</span><div>{children}</div></div>; }

function BoothContent({ platform, setPlatform, onZoom }) {
  const guide = boothGuides[platform];
  return <>
    <div className="switcher-block"><div><span className="eyebrow">SHOW THE RIGHT FLOW</span><h2>Which booth are you setting up?</h2></div>
      <div className="segmented" role="tablist" aria-label="Booth platform">{Object.keys(boothGuides).map((item) => <button key={item} role="tab" aria-selected={platform === item} className={platform === item ? 'selected' : ''} onClick={() => setPlatform(item)}>{item}</button>)}</div>
    </div>
    <div className="platform-note"><Badge tone="green">{platform}</Badge><p>{guide.intro}</p></div>
    <Section title="The guest journey">
      <div className="journey">{guide.steps.map(([title, text], index) => <article className="journey-card" key={title}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
    </Section>
    <Section title="A quick visual check">
      <div className="shot-row"><Screenshot name={guide.screenshot} caption={`${platform} booth screen`} onZoom={onZoom} /><div className="shot-copy"><span className="eyebrow">ADD YOUR OWN SCREENSHOTS</span><h3>Make this guide yours.</h3><p>Replace the placeholder by adding an image at <code>docs-site/public/screenshots/{guide.screenshot}</code>. The frame is already sized and tap-to-zoom.</p><Badge>Screenshot slot ready</Badge></div></div>
    </Section>
    <Callout>{guide.note}</Callout>
    <Section title="When guests need a hand"><div className="help-row"><span className="help-icon">?</span><p>First, check the event is active and the booth is online. If a screen or button does not match the event setup, ask your organisation admin to review the event settings.</p></div></Section>
  </>;
}

function SetupContent() {
  const [host, setHost] = useState(setupChoices.host[0]);
  const [camera, setCamera] = useState(setupChoices.camera[0]);
  const [printer, setPrinter] = useState(setupChoices.printer[0]);
  const hostNotes = {
    'Android tablet': 'Power the tablet, grant camera and nearby/local-network permissions when prompted, then use the tablet camera or choose an external camera path. Android has no direct USB printer provider in the current app.',
    'iPad': 'Charge the iPad, allow camera and local-network access, and test the complete guest flow on the actual device. For dependable kiosk printing, start with a Windows Print Bridge on the same trusted LAN.',
    'Windows PC': 'Connect the guest display before launching Electron. Install the printer driver and camera SDK as needed; Electron is the full desktop kiosk and the preferred host for Windows Nikon SDK and printer queues.',
  };
  const cameraNotes = {
    'Built-in camera': 'Lowest wiring risk. Allow camera access and take a test capture in the booth before guests arrive.',
    'Canon CCAPI over Wi-Fi': 'Put camera and booth on the same private router, reserve the camera IP, and test capture and image transfer. On iPad, specifically validate local-network and HTTP/ATS behavior.',
    'Nikon Remote SDK': 'Connect the Nikon by USB to a Windows Electron host, install the licensed Nikon SDK files, and validate live view, capture and JPEG transfer for the exact body and firmware.',
    'USB PTP (Android only)': 'Use a data-capable OTG cable or powered hub and accept the USB permission prompt. This path is limited capture and JPEG retrieval, not live view/settings.',
    'USB webcam': 'Use a UVC webcam with the Windows/macOS Electron host, allow OS camera access and verify the live preview is the expected camera.',
  };
  const printerNotes = {
    'Windows Print Bridge': 'Install the photo printer driver on the Windows host, print a test strip, then connect tablet and host to the same trusted LAN. The bridge normally listens on port 9123.',
    'Network IPP': 'Connect the printer to the booth LAN, reserve its IP, and configure that address in the booth app. IPP is not a whole-network discovery scan.',
    'AirPrint (iPad)': 'Add the printer to the same Wi-Fi and test an actual print. The current iOS print interaction can require operator input, so do not assume unattended kiosk printing.',
    'Windows / macOS print queue': 'Install the manufacturer driver, add the queue in OS settings and confirm paper size, borderless/fit, colour profile and cut settings with a real test print.',
  };
  return <>
    <Section title="Before the gear arrives">
      <div className="feature-grid setup-first-steps">
        <article className="feature-card"><span className="feature-index">01 / PLAN</span><h3>Choose a plan</h3><p>Check the booth-device and event limits, then confirm your account and event are ready.</p><a href="https://happypix.in/pricing#checkout" target="_blank" rel="noreferrer">Plans & checkout ↗</a></article>
        <article className="feature-card"><span className="feature-index">02 / APP</span><h3>Get your booth app</h3><p>Use the product page to request the current Android, iPad or Windows installer and setup help.</p><a href="https://happypix.in/software" target="_blank" rel="noreferrer">Booth app info & access ↗</a></article>
        <article className="feature-card"><span className="feature-index">03 / HARDWARE</span><h3>Check before you buy</h3><p>Match exact camera and printer models to a tested connection path. A provider name alone is not certification.</p><a href="#contact">Ask HappyPix about a model ↗</a></article>
      </div>
    </Section>
    <div className="setup-builder">
      <div className="setup-builder-head"><Badge tone="green">SETUP BUILDER</Badge><h2>Build your own starting checklist</h2><p>Choose the pieces you have. We’ll keep the notes focused on that setup.</p></div>
      <div className="choice-grid">
        {[["Booth host", host, setHost, setupChoices.host], ["Camera path", camera, setCamera, setupChoices.camera], ["Printer path", printer, setPrinter, setupChoices.printer]].map(([label, value, setter, options]) => <label className="choice" key={label}><span>{label}</span><select value={value} onChange={(event) => setter(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>)}
      </div>
      <div className="selection-summary"><span className="eyebrow">YOUR CHECKLIST</span><h3>{host} · {camera} · {printer}</h3><div className="setup-notes"><p><b>Host</b>{hostNotes[host]}</p><p><b>Camera</b>{cameraNotes[camera]}</p><p><b>Printer</b>{printerNotes[printer]}</p></div></div>
    </div>
    <Section title="Wire it up, then connect it">
      <div className="wiring-grid">
        {[
          ['01', 'Power first', 'Use stable power for the booth host, camera and printer. A powered USB hub may be needed for camera OTG setups.'],
          ['02', 'Make one trusted LAN', 'Connect bridge host, tablet, camera and network printer to the same private router/subnet. Avoid guest Wi-Fi and client isolation.'],
          ['03', 'Keep local and cloud paths distinct', 'Camera and printer traffic can stay on the local network. Event setup, payments, uploads and guest links still need a working internet connection.'],
          ['04', 'Reserve the addresses', 'Use DHCP reservations for network camera, printer and Windows bridge. Write the IPs and Wi-Fi details on the event rig sheet.'],
        ].map(([n, title, body]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{body}</p></article>)}
      </div>
    </Section>
    <Section title="Device settings and connection handoff">
      <div className="feature-grid">
        <article className="feature-card"><span className="feature-index">ANDROID + IPAD</span><h3>Permissions & camera bridge</h3><p>Allow camera and local-network access. For a Nikon camera attached to a Windows PC, open the booth login status panel, tap the “Windows USB camera host” setting, enter the reserved PC IP or local hostname, and save. Keep both devices on the same LAN.</p></article>
        <article className="feature-card"><span className="feature-index">WINDOWS</span><h3>Driver, firewall & bridge</h3><p>Install the printer driver and Nikon SDK files required by the exact setup. Allow the local print/camera bridge on the private booth network only; never expose its port directly to the public internet.</p></article>
        <article className="feature-card"><span className="feature-index">NETWORK PRINTERS</span><h3>Verify the address controls</h3><p>IPP and printer-bridge providers support configured addresses, but the current React Native settings surface may not expose every printer-IP field. If your build has no printer-address control, ask HappyPix for the supported setup instead of assuming full-LAN discovery.</p></article>
      </div>
      <Callout kind="warn">Canon CCAPI over Wi-Fi must be verified on the exact camera and installed app; if the camera is not discovered, the current booth UI may not offer a manual Canon IP field.</Callout>
    </Section>
    <Section title="Camera and printer compatibility">
      <div className="table-wrap"><table className="compat-table"><thead><tr><th>Hardware path</th><th>Android</th><th>iPad</th><th>Windows / Electron</th></tr></thead><tbody>{compatibility.map((row) => <tr key={row.device}><td><b>{row.device}</b><small>{row.detail}</small></td><td>{row.android}</td><td>{row.ipad}</td><td>{row.windows}</td></tr>)}</tbody></table></div>
      <Callout kind="warn">A code path or provider name is not the same as a tested device. Before buying hardware, confirm the exact model, firmware, cable, driver and print media with HappyPix.</Callout>
    </Section>
    <Section title="Event-day checklist"><div className="checklist">{['Booth and printer have steady power; host display is detected.', 'Booth, camera, printer and bridge are on the intended network.', 'Camera permission is granted; a real capture has been reviewed.', 'A real test print has the right size, colour, border and cut.', 'Event and device pairing are correct; QR/download connectivity works.', 'Spare cables, OTG adapter and a printed rig sheet are packed.'].map((item) => <label key={item}><input type="checkbox" /> <span>{item}</span></label>)}</div></Section>
  </>;
}

function PublicArticle({ page, onZoom }) {
  const [platform, setPlatform] = useState('Android');
  if (page.interactive === 'booth') return <BoothContent platform={platform} setPlatform={setPlatform} onZoom={onZoom} />;
  if (page.interactive === 'setup') return <SetupContent />;
  return <>
    {page.sections.map((section) => <Section title={section.title} key={section.title}>
      {section.text && <p className="body-copy">{section.text}</p>}
      {section.cards && <div className="feature-grid">{section.cards.map((card, index) => <article className="feature-card" key={card.title}><span className="feature-index">0{index + 1}</span><h3>{card.title}</h3><p>{card.text}</p></article>)}</div>}
      {section.bullets && <ul className="clean-list">{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
    </Section>)}
    {page.id === 'happypix-101' && <div className="link-cards"><a href="https://happypix.in/pricing#checkout" target="_blank" rel="noreferrer"><span>01 / PLANS</span><b>Find a plan that fits →</b><small>HappyPix plans and checkout</small></a><a href="https://crm.happypix.in" target="_blank" rel="noreferrer"><span>02 / WORKSPACE</span><b>Open the CRM →</b><small>Sign in to your organisation</small></a><a href="https://happypix.in/software" target="_blank" rel="noreferrer"><span>03 / BOOTH APPS</span><b>Booth app info & access →</b><small>See app details and ask the team for an installer</small></a></div>}
  </>;
}

function PrivateArticle({ page, onSelectNode }) {
  if (!page) return null;
  if (page.view === 'graph') return <GraphArticle page={page} onSelectNode={onSelectNode} />;
  if (page.view === 'routes') return <BackroomsArticle page={page} />;
  if (page.view === 'calculator') return <ScalingArticle page={page} />;
  return <div className="body-copy">{page.description}</div>;
}

function GraphArticle({ page, onSelectNode }) {
  const [selected, setSelected] = useState(page.nodes?.[0]?.id);
  useEffect(() => setSelected(page.nodes?.[0]?.id), [page.id]);
  const active = page.nodes?.find((node) => node.id === selected);
  return <>
    <div className="graph-head"><div><Badge tone="green">INTERACTIVE MAP</Badge><h2>{page.graphHeading}</h2><p>{page.graphHelp}</p></div><div className="graph-legend"><span><i className="legend-dot client" />App</span><span><i className="legend-dot service" />Service</span><span><i className="legend-dot data" />Data</span></div></div>
    <div className="canvas-scroll"><div className="graph-canvas">
      <svg className="graph-lines" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">{(page.edges || []).map((edge, index) => { const from = page.nodes.find((n) => n.id === edge[0]); const to = page.nodes.find((n) => n.id === edge[1]); return from && to ? <g key={index}><line x1={from.x + 74} y1={from.y + 32} x2={to.x + 74} y2={to.y + 32} className="edge-line" /><text x={(from.x + to.x) / 2 + 74} y={(from.y + to.y) / 2 + 25} className="edge-label">{edge[2]}</text></g> : null; })}</svg>
      {page.nodes?.map((node) => <button key={node.id} className={`graph-node ${node.type} ${selected === node.id ? 'active-node' : ''}`} style={{ left: `${node.x / 10}%`, top: `${node.y / 5}%` }} onClick={() => { setSelected(node.id); onSelectNode?.(node); }}><span>{node.icon || '◈'}</span><b>{node.label}</b></button>)}
    </div></div>
    {active && <div className="node-detail"><span className="node-bubble">{active.icon || '◈'}</span><div><span className="eyebrow">{active.type} · SELECTED</span><h3>{active.label}</h3><p>{active.detail}</p>{active.fields && <div className="field-pills">{active.fields.map((field) => <code key={field}>{field}</code>)}</div>}</div></div>}
    {page.footnote && <p className="fine-print">{page.footnote}</p>}
  </>;
}

function BackroomsArticle({ page }) {
  const [filter, setFilter] = useState('All routes');
  const [open, setOpen] = useState(null);
  const groups = ['All routes', ...new Set(page.routes.map((route) => route.group))];
  const routes = page.routes.filter((route) => filter === 'All routes' || route.group === filter);
  return <>
    <Section title={page.sectionTitles.flow}><p className="body-copy">{page.overview}</p><div className="flow-strip">{page.flow.map((item, index) => <Fragment key={item}>{index > 0 && <b>→</b>}<span>{item}</span></Fragment>)}</div></Section>
    <Section title={page.sectionTitles.modules}><div className="module-grid">{page.modules.map((item) => <article key={item.name}><Badge>{item.kind}</Badge><h3>{item.name}</h3><p>{item.purpose}</p><small><b>Sender:</b> {item.sender}<br /><b>Receiver:</b> {item.receiver}</small></article>)}</div></Section>
    <Section title={page.sectionTitles.routes}><div className="segmented route-filter">{groups.map((group) => <button className={filter === group ? 'selected' : ''} key={group} onClick={() => { setFilter(group); setOpen(null); }}>{group}</button>)}</div>
      <div className="route-list">{routes.map((route) => <article className={`route-card ${open === route.path ? 'route-open' : ''}`} key={route.path}><button className="route-toggle" onClick={() => setOpen(open === route.path ? null : route.path)}><span className="method">{route.method}</span><code>{route.path}</code><span className="route-group">{route.group}</span><span className="route-arrow">{open === route.path ? '−' : '+'}</span></button>{open === route.path && <div className="route-details"><p>{route.purpose}</p><div className="request-grid"><div><span className="eyebrow">SENDER → RECEIVER</span><p>{route.sender} → {route.receiver}</p></div><div><span className="eyebrow">REQUEST</span><pre>{route.request}</pre></div><div><span className="eyebrow">RESPONSE</span><pre>{route.response}</pre></div></div></div>}</article>)}</div>
    </Section>
    <Callout kind="warn">{page.securityNote}</Callout>
  </>;
}

function ScalingArticle({ page }) {
  const [scenario, setScenario] = useState('all');
  const filtered = page.tiers.filter((tier) => scenario === 'all' || tier.id === scenario);
  return <>
    <Section title={page.sectionTitles.services}><div className="service-grid">{page.services.map((service) => <article key={service.name}><span>{service.icon}</span><div><b>{service.name}</b><p>{service.detail}</p></div><Badge>{service.kind}</Badge></article>)}</div></Section>
    <Section title={page.sectionTitles.budgets}><p className="body-copy">{page.planningIntro}</p>
      <div className="segmented tier-filter">{[['all','All stages'], ['10-50','10 clients · 50 booths'], ['100-500','100 · 500'], ['500-5000','500 · 5,000'], ['5000-50000','5,000 · 50,000']].map(([id, title]) => <button className={scenario === id ? 'selected' : ''} key={id} onClick={() => setScenario(id)}>{title}</button>)}</div>
      <div className="tier-grid">{filtered.map((tier) => <article className="tier-card" key={tier.id}><div className="tier-top"><Badge tone={tier.status === 'now' ? 'green' : ''}>{tier.statusLabel}</Badge><span>{tier.booths} booths</span></div><h3>{tier.clients} <small>organisations</small></h3><div className="tier-cost">{tier.cost}<small>estimated all-in monthly run rate</small></div><p>{tier.summary}</p><div className="tier-breakdown"><span><b>Cloud + vendors / month</b>{tier.cloudCost}</span><span><b>Staffed operations / month</b>{tier.opsCost}</span><span><b>One-time onboarding</b>{tier.onboarding}</span></div><div className="tier-bottom"><span><b>Team guide</b>{tier.staff}</span><span><b>Stage trigger</b>{tier.trigger}</span></div></article>)}</div>
    </Section>
    <Section title={page.sectionTitles.triggers}><div className="trigger-list">{page.triggers.map((trigger) => <article key={trigger.title}><span>{trigger.when}</span><div><h3>{trigger.title}</h3><p>{trigger.action}</p></div></article>)}</div></Section>
    <Section title={page.sectionTitles.operations}><p className="body-copy">{page.staffingNote}</p><div className="staffing-banner"><span>✳</span><p>{page.operatingReminder}</p></div></Section>
    <Callout kind="warn">{page.warning}</Callout>
  </>;
}

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', message: '', type: 'contact' });
  const [state, setState] = useState({ busy: false, message: '', error: false });
  const submit = async (event) => {
    event.preventDefault(); setState({ busy: true, message: '', error: false });
    try {
      const result = await api(import.meta.env.PROD ? '/api/leads' : '/leads', { base: LEADS_API_BASE, method: 'POST', body: JSON.stringify(form) });
      setState({ busy: false, message: result.message || 'Thanks — the HappyPix team will be in touch.', error: false });
      setForm({ name: '', email: '', phone: '', company: '', message: '', type: 'contact' });
    } catch (error) { setState({ busy: false, message: error.message || 'Could not send your message. Please try again.', error: true }); }
  };
  return <section className="contact-panel" id="contact"><div className="contact-copy"><span className="eyebrow">NEED A HUMAN?</span><h2>If you have any further doubt, write here, team will contact you</h2><p>Tell us what you are trying to set up. We will help you find the right next step.</p><a href="https://happypix.in/contact" target="_blank" rel="noreferrer">Prefer the main site? Visit contact ↗</a></div>
    <form onSubmit={submit} className="contact-form"><div className="form-two"><label>Your name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label><label>Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label></div><div className="form-two"><label>Phone (optional)<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label><label>Organisation (optional)<input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoComplete="organization" /></label></div><label>What would you like help with?<textarea required maxLength={4000} rows="3" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="A little about your booth, event or question…" /></label><div className="form-bottom"><small>Sent securely to the HappyPix website-leads flow.</small><button className="button primary" type="submit" disabled={state.busy}>{state.busy ? 'Sending…' : 'Send a note'} <span>↗</span></button></div>{state.message && <p className={`form-status ${state.error ? 'error' : 'success'}`} role="status">{state.message}</p>}</form>
  </section>;
}

function SignInModal({ onClose, onSuccess, onUnauthorized }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [state, setState] = useState({ busy: false, error: '' });
  useEffect(() => { const onKey = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);
  const submit = async (event) => {
    event.preventDefault(); setState({ busy: true, error: '' });
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(form) });
      const token = result.token;
      const role = result.user?.role;
      if (!token || !['OWNER', 'PLATFORM_ADMIN', 'SUPPORT_MANAGER'].includes(role)) { if (token) api('/api/auth/logout', { method: 'POST', token }).catch(() => {}); onUnauthorized(); return; }
      sessionStorage.setItem('hp_docs_session', token);
      await onSuccess(token, result.user);
    } catch (error) { setState({ busy: false, error: error.message || 'Unable to sign in right now.' }); }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="signin-modal" role="dialog" aria-modal="true" aria-labelledby="signin-title"><button className="modal-close" onClick={onClose} aria-label="Close sign-in">×</button><div className="modal-mark">✳</div><span className="eyebrow">HAPPYPIX PLATFORM</span><h2 id="signin-title">Platform sign in</h2><p>For HappyPix platform team members.</p><form onSubmit={submit}><label>Email address<input type="email" required autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Password<input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>{state.error && <p className="form-status error" role="alert">{state.error}</p>}<button className="button primary full" disabled={state.busy}>{state.busy ? 'Checking access…' : 'Sign in securely'} <span>↗</span></button></form><small className="privacy-note">Use your HappyPix account credentials. Access is checked securely by the main service.</small></section></div>;
}

export default function App() {
  const [pageId, setPageId] = useState(getInitialPage);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [memberDocs, setMemberDocs] = useState(null);
  const [memberUser, setMemberUser] = useState(null);
  const [token, setToken] = useState(() => sessionStorage.getItem('hp_docs_session') || '');
  const [authStatus, setAuthStatus] = useState(token ? 'checking' : 'public');
  const [showSignIn, setShowSignIn] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [zoom, setZoom] = useState(null);
  const [notice, setNotice] = useState('');

  const publicPage = publicPages.find((item) => item.id === pageId);
  const memberPage = memberDocs?.pages?.find((item) => item.id === pageId);
  const page = publicPage || memberPage;
  const groups = useMemo(() => [...new Set(publicPages.map((page) => page.group))], []);

  useEffect(() => {
    const onPop = () => { const next = getInitialPage(); setPageId(next); setUnauthorized(!publicPages.some((item) => item.id === next) && authStatus !== 'authorized'); };
    window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop);
  }, [authStatus]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      try {
        const session = await api('/api/auth/me', { token });
        if (!['OWNER', 'PLATFORM_ADMIN', 'SUPPORT_MANAGER'].includes(session.user?.role)) throw new Error('platform role required');
        const docs = await api('/api/docs/private', { token });
        if (!alive) return;
        setMemberUser(session.user); setMemberDocs(docs); setAuthStatus('authorized');
      } catch {
        if (!alive) return;
        sessionStorage.removeItem('hp_docs_session'); setToken(''); setMemberDocs(null); setMemberUser(null); setAuthStatus('public');
        if (!publicPages.some((item) => item.id === getInitialPage())) setUnauthorized(true);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const go = (id, { replace = false, force = false } = {}) => {
    const isMemberPage = memberDocs?.pages?.some((item) => item.id === id);
    if (isMemberPage && authStatus !== 'authorized' && !force) { setUnauthorized(true); setPageId('member'); return; }
    setPageId(id); setMobileOpen(false); setUnauthorized(false); setSearch('');
    const url = new URL(location.href); url.searchParams.set('page', id);
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const signOut = async () => {
    const active = token;
    sessionStorage.removeItem('hp_docs_session'); setToken(''); setMemberDocs(null); setMemberUser(null); setAuthStatus('public'); setUnauthorized(false); go('happypix-101');
    if (active) api('/api/auth/logout', { method: 'POST', token: active }).catch(() => {});
  };

  const handleSuccess = async (newToken, user) => {
    try {
      const docs = await api('/api/docs/private', { token: newToken });
      setToken(newToken); setMemberUser(user); setMemberDocs(docs); setAuthStatus('authorized'); setShowSignIn(false); setUnauthorized(false); go(docs.pages?.[0]?.id || 'happypix-101', { force: true });
    } catch { sessionStorage.removeItem('hp_docs_session'); setShowSignIn(false); setUnauthorized(true); }
  };
  const filteredPublic = publicPages.filter((item) => `${item.title} ${item.group} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
  const privateFailure = unauthorized || (!publicPage && authStatus !== 'authorized');

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-row"><img src="/logo-mark-on-dark.svg" alt="" /><div><b>HappyPix</b><span>FIELD GUIDE</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">×</button></div>
      <div className="sidebar-intro"><span>EVENTS, BOOTHS & THE BITS BETWEEN</span><p>Good things happen when everything clicks.</p></div>
      <div className="nav-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a guide" aria-label="Find a guide" /><kbd>⌘ K</kbd></div>
      <nav className="side-nav" aria-label="Documentation">
        {groups.map((group) => <div className="nav-group" key={group}><span className="nav-heading">{group}</span>{filteredPublic.filter((item) => item.group === group).map((item) => <button key={item.id} onClick={() => go(item.id)} className={`nav-item ${pageId === item.id ? 'active' : ''}`}><Icon>{item.icon}</Icon>{item.title}</button>)}</div>)}
        {authStatus === 'authorized' && memberDocs && <div className="nav-group member-nav"><span className="nav-heading">{memberDocs.navigationTitle}</span>{memberDocs.pages.map((item) => <button key={item.id} className={`nav-item ${pageId === item.id ? 'active' : ''}`} onClick={() => go(item.id)}><Icon>{item.icon}</Icon>{item.title}<span className="lock-open">✳</span></button>)}</div>}
      </nav>
      <div className="sidebar-bottom">
        <a className="side-link" href="https://happypix.in/pricing#checkout" target="_blank" rel="noreferrer"><span>↗</span> Plans & pricing</a>
        <a className="side-link" href="https://crm.happypix.in" target="_blank" rel="noreferrer"><span>↗</span> Open the CRM</a>
        <a className="side-link" href="https://happypix.in/software" target="_blank" rel="noreferrer"><span>↗</span> Booth app info & access</a>
        <div className="signin-row">{authStatus === 'authorized' ? <><span className="avatar">{memberUser?.name?.charAt(0) || 'H'}</span><span className="signed-name">{memberUser?.name || 'Platform member'}<small>Platform team</small></span><button className="signout" onClick={signOut}>Sign out</button></> : <button className="signin-button" onClick={() => setShowSignIn(true)}><span>↗</span> Sign in</button>}</div>
      </div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button><Breadcrumbs title={privateFailure ? 'Help' : page?.title || 'Welcome to HappyPix'} onHome={() => go('happypix-101')} /><div className="top-actions"><a href="https://happypix.in/pricing#checkout" target="_blank" rel="noreferrer">Find your plan <span>↗</span></a><span className="top-divider" /><button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>Ask us</button></div></header>
      <div className="page-wrap">
        {authStatus === 'checking' && <div className="auth-check"><span className="spinner" /> Checking your member access…</div>}
        {privateFailure && authStatus !== 'checking' ? <section className="unauthorized"><span className="unauth-mark">?</span><span className="eyebrow">NEED A HAND?</span><h1>{HELP}</h1><p>Choose one of the public help guides on the left, or write to the HappyPix team below.</p><button className="button secondary" onClick={() => go('happypix-101')}>Back to public guides</button></section> : null}
        {!privateFailure && authStatus !== 'checking' && <>
          {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}>×</button></div>}
          <section className="page-hero"><div className="hero-kicker"><span className="pulse-dot" /> THE HAPPYPIX FIELD GUIDE <span className="hero-line" /> {page?.read || ''}</div><div className="hero-grid"><div><div className="hero-tags">{(page?.tags || []).map((tag) => <Badge key={tag}>{tag}</Badge>)}</div><h1>{page?.title || 'Welcome to HappyPix'}<span className="hero-spark">✳</span></h1><p>{page?.description || 'Clear, practical help for running a lovely photo-booth experience.'}</p></div><div className="hero-stamp"><span>MADE FOR</span><b>Good<br />events.</b><i>✳</i></div></div><div className="hero-meta"><span>SHORT READS. REAL HELP.</span><span>LASTING MOMENTS, MADE SIMPLE <b>↗</b></span></div></section>
          <article className="article-content">{publicPage ? <PublicArticle page={publicPage} onZoom={(src, caption) => setZoom({ src, caption })} /> : <PrivateArticle page={memberPage} />}</article>
        </>}
        <ContactForm />
        <footer className="page-footer"><span>© HappyPix · Made for the moments worth keeping.</span><a href="https://happypix.in" target="_blank" rel="noreferrer">HappyPix.in ↗</a></footer>
      </div>
    </main>
    {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} onSuccess={handleSuccess} onUnauthorized={() => { setShowSignIn(false); setUnauthorized(true); setAuthStatus('public'); }} />}
    {zoom && <div className="zoom-backdrop" onClick={() => setZoom(null)} role="presentation"><button aria-label="Close screenshot" onClick={() => setZoom(null)}>×</button><img src={zoom.src} alt={zoom.caption} /></div>}
  </div>;
}
