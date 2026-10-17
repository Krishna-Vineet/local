import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { PageHero, Reveal } from '../components/ui.jsx'
import PricingCards from '../components/PricingCards.jsx'
import Checkout from '../components/Checkout.jsx'
import { fetchPlans, money } from '../lib/api.js'
import { PLAN_MATRIX, ADDONS, FAQS } from '../data/content.js'

const toggleWrap = { display: 'inline-flex', gap: 4, padding: 4, border: '1.5px solid var(--line)', borderRadius: 999, background: 'var(--white)' }
const toggleBtn = (active) => ({
  border: 0, cursor: 'pointer', borderRadius: 999, padding: '9px 20px', fontWeight: 700, fontSize: '.92rem',
  background: active ? 'var(--pink)' : 'transparent', color: active ? '#fff' : 'var(--ink-soft)',
})

export default function Pricing() {
  const [plans, setPlans] = useState([])
  const [addons, setAddons] = useState([])
  const [plansError, setPlansError] = useState('')
  const [selected, setSelected] = useState('')
  const [billing, setBilling] = useState('annual')
  const [selectedAddons, setSelectedAddons] = useState([])
  const [openFaq, setOpenFaq] = useState(0)
  const [params] = useSearchParams()
  const location = useLocation()

  useEffect(() => {
    let alive = true
    fetchPlans()
      .then(({ plans, addons }) => {
        if (!alive) return
        setPlans(plans)
        setAddons(addons)
        const wanted = params.get('plan')
        setSelected(
          (wanted && plans.some((p) => p.key === wanted) && wanted)
          || plans.find((p) => p.key === 'pro')?.key
          || plans[0]?.key
          || '',
        )
      })
      .catch(() => { if (alive) setPlansError('Plans are unavailable right now. Please refresh, or reach us on the contact page and we will sort you out.') })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (location.hash === '#checkout' && plans.length) {
      document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash, plans])

  const select = (key) => {
    setSelected(key)
    document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleAddon = (key) => setSelectedAddons((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  const addonPrice = (addon) => {
    const prices = addon.billing?.inr
    if (!prices) return addon.price || 0
    return billing === 'annual' ? prices.annual : prices.monthly
  }

  return (
    <>
      <PageHero
        kicker="Pricing & plans"
        title={<>Honest pricing, booth by <span className="accent-it">booth</span>.</>}
        sub="Start with a 14-day free trial — full product, one booth, no card. Scale from 2 up to 8+ booths with our flexible plans. Go annual and a booth costs less than one cancelled booking. Renewing from here extends your current plan from its expiry, so a paid day is never lost."
      />

      <section className="section" style={{ paddingTop: 64 }}>
        <div className="wrap">
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 34 }}>
            <div style={toggleWrap} role="tablist" aria-label="Billing period">
              <button style={toggleBtn(billing === 'monthly')} onClick={() => setBilling('monthly')}>Monthly</button>
              <button style={toggleBtn(billing === 'annual')} onClick={() => setBilling('annual')}>Annual · save up to 23%</button>
            </div>
          </div>

          {plans.length ? (
            <PricingCards plans={plans} selectedKey={selected} onSelect={select} billing={billing} />
          ) : (
            <p style={{ textAlign: 'center', color: plansError ? 'var(--pink-deep)' : 'var(--muted)', padding: 40 }}>{plansError || 'Loading plans…'}</p>
          )}

          <Reveal style={{ marginTop: 72 }}>
            <div className="section-head" style={{ marginBottom: 30 }}>
              <span className="kicker c-pink">Buy or renew</span>
              <h2 className="h-lg">One form. New studio or <span className="accent-it">old friend</span>.</h2>
              <p className="lead">
                Enter your organization, phone, email and password. A <b>new email</b> registers your studio the moment
                payment confirms; an <b>existing email</b> asks for your CRM password — match it, and the plan lands on
                the organization you already run.
              </p>
            </div>
            {plans.length ? (
              <Checkout
                plans={plans}
                addons={addons}
                selectedKey={selected}
                onSelect={setSelected}
                billing={billing}
                selectedAddons={selectedAddons}
                onToggleAddon={toggleAddon}
              />
            ) : null}
          </Reveal>

          <div className="grid-3" style={{ marginTop: 52 }}>
            {[
              ['No lost days', 'Renewals extend from your current expiry — never from “today”.'],
              ['GST invoice, instantly', 'Every payment produces an invoice number you can file the same minute.'],
              ['Lapse, don’t lock-in', 'No auto-card traps. If a plan lapses, your data stays yours.'],
            ].map(([title, text], i) => (
              <Reveal key={title} delay={i * 0.07}>
                <div className="card" style={{ height: '100%' }}><h3>{title}</h3><p>{text}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-cream">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-blue">Add-ons · ₹299 each</span>
            <h2 className="h-lg">Bolt on <span className="accent-it" style={{ color: 'var(--blue)' }}>superpowers</span></h2>
            <p className="lead">Every add-on is ₹299 a month per user — tick them in the checkout above, or add them later from your CRM. The props pack is a one-time unlock.</p>
          </Reveal>
          <div className="grid-3">
            {(addons.length ? addons : ADDONS).map((addon, i) => {
              const live = addon.billing != null
              const active = selectedAddons.includes(addon.key)
              return (
                <Reveal key={addon.key || addon.name} delay={i * 0.06}>
                  <div className="card" style={{ height: '100%', display: 'grid', gap: 8 }}>
                    <h3 style={{ fontSize: '1.15rem' }}>{addon.name}</h3>
                    <p>{addon.description || addon.desc}</p>
                    <p style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ color: 'var(--pink-deep)' }}>
                        {live ? `${money(addonPrice(addon))}${addon.billingNote?.includes('one-time') ? ' one-time' : billing === 'annual' ? ' / year' : ' / month'}` : addon.price}
                      </b>
                      {live ? (
                        <button className={active ? 'btn btn-pink' : 'btn btn-ghost'} style={{ padding: '8px 16px' }} onClick={() => toggleAddon(addon.key)}>
                          {active ? 'Added ✓' : 'Add'}
                        </button>
                      ) : null}
                    </p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker c-blue">Compare plans</span>
            <h2 className="h-lg">What changes as you <span className="accent-it" style={{ color: 'var(--blue)' }}>grow</span></h2>
            <p className="lead">Every plan includes the booth app, CRM, guest QR downloads and unlimited sessions. Higher plans add branding, AI and the money-making extras.</p>
          </Reveal>
          <Reveal>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Capability</th><th>Basic</th><th>Pro</th><th>Premium</th></tr></thead>
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
    </>
  )
}
