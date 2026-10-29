import { useState } from 'react'
import { PageHero, Reveal, Icon } from '../components/ui.jsx'
import { sendLead } from '../lib/api.js'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', message: '', type: 'contact' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const result = await sendLead(form)
      setDone(result.message || 'Thank you — we will get back within one business day.')
    } catch (err) {
      if (err.status) setError(err.message)
      else setDone('Thank you — we will get back within one business day.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHero
        kicker="Contact"
        title={<>Say hello. We'll bring the <span className="accent-it">ring light</span>.</>}
        sub="Book a demo, ask about a printer you already own, or tell us about the event you are dreaming up. Real humans, one business day, no pressure."
      />

      <section className="section">
        <div className="wrap">
          <div className="grid-2" style={{ alignItems: 'start', gap: 48 }}>
            <Reveal>
              <div>
                <h2 className="h-md" style={{ marginBottom: 18 }}>Good reasons people write to us</h2>
                <div style={{ display: 'grid', gap: 12 }}>
                  {[
                    ['Book a demo', 'A 20-minute walkthrough on your own event idea — templates, prices and all.', 'demo'],
                    ['Hardware questions', 'Booth pre-orders, DNP / Canon checks, or “will my gear work?” (usually, yes).', 'hardware'],
                    ['Support', 'Already a customer? This reaches the same team that runs platform support.', 'support'],
                  ].map(([title, text, type]) => (
                    <button
                      key={type} type="button" onClick={() => setForm((f) => ({ ...f, type }))}
                      style={{ textAlign: 'left', background: form.type === type ? 'var(--pink-soft)' : '#fff', border: `1.5px solid ${form.type === type ? 'var(--pink)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)', padding: '16px 18px', cursor: 'pointer', font: 'inherit' }}
                    >
                      <b style={{ display: 'block', fontSize: 16 }}>{title}</b>
                      <span style={{ color: 'var(--muted)', fontSize: 14 }}>{text}</span>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 26, color: 'var(--muted)', fontSize: 15, display: 'grid', gap: 8 }}>
                  <span style={{ display: 'flex', gap: 9, alignItems: 'center' }}><Icon name="pin" size={17} /> HappyPix — happypix.in · happypix.com.au</span>
                  <span style={{ display: 'flex', gap: 9, alignItems: 'center' }}><Icon name="clock" size={17} /> Mon–Fri, 9am–6pm IST</span>
                  <span style={{ display: 'flex', gap: 9, alignItems: 'center' }}><Icon name="mail" size={17} /> Response within one business day</span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <form onSubmit={submit} className="form-card" style={{ display: 'grid', gap: 16 }}>
                <h3 className="h-md">Tell us everything</h3>
                <div className="form-grid">
                  <div className="field"><label htmlFor="ct-name">Your name *</label><input id="ct-name" required value={form.name} onChange={set('name')} placeholder="Priya Sharma" /></div>
                  <div className="field"><label htmlFor="ct-email">Email *</label><input id="ct-email" type="email" required value={form.email} onChange={set('email')} placeholder="you@studio.com" /></div>
                </div>
                <div className="form-grid">
                  <div className="field"><label htmlFor="ct-phone">Phone</label><input id="ct-phone" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" /></div>
                  <div className="field"><label htmlFor="ct-company">Studio / company</label><input id="ct-company" value={form.company} onChange={set('company')} placeholder="Sunset Weddings" /></div>
                </div>
                <div className="field">
                  <label htmlFor="ct-type">This is about</label>
                  <select id="ct-type" value={form.type} onChange={set('type')}>
                    <option value="contact">Something else entirely</option>
                    <option value="demo">Booking a demo</option>
                    <option value="hardware">Hardware / booth pre-order</option>
                    <option value="support">Support</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="ct-msg">Message</label>
                  <textarea id="ct-msg" rows={5} value={form.message} onChange={set('message')} placeholder="We run weddings across Pune and want two booths by December…" />
                </div>
                {done ? <div className="form-ok">{done}</div> : null}
                {error ? <div className="form-error">{error}</div> : null}
                <button className="btn btn-pink btn-arrow" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
              </form>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  )
}
