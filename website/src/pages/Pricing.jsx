import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { PageHero, Reveal } from '../components/ui.jsx'
import PricingCards, { BILLING_PERIODS } from '../components/PricingCards.jsx'
import Checkout from '../components/Checkout.jsx'
import { fetchPlans, money } from '../lib/api.js'
import { PLAN_MATRIX, ADDONS, FAQS } from '../data/content.js'

const toggleWrap = { display: 'inline-flex', gap: 4, padding: 4, border: '1.5px solid var(--line)', borderRadius: 999, background: 'var(--white)', flexWrap: 'wrap', justifyContent: 'center' }
const toggleBtn = (active) => ({
  border: 0, cursor: 'pointer', borderRadius: 999, padding: '9px 18px', fontWeight: 700, fontSize: '.9rem',
  background: active ? 'var(--pink)' : 'transparent', color: active ? '#fff' : 'var(--ink-soft)',
})

export default function Pricing() {
  const [plans, setPlans] = useState([])
  const [addons, setAddons] = useState([])
  const [plansError, setPlansError] = useState('')
  const [selected, setSelected] = useState('')
  const [params] = useSearchParams()
  const initialBilling = ['annual', 'semiannual', 'quarterly', 'monthly'].includes(params.get('billing')) ? params.get('billing') : 'annual'
  const [billing, setBilling] = useState(initialBilling)
  const [selectedAddons, setSelectedAddons] = useState([])
  const [openFaq, setOpenFaq] = useState(0)
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
    if (!prices) return addon.price || 249
    return prices.monthly ?? addon.price ?? 249
  }

  return (
    <>
      <PageHero
        kicker="Pricing & plans"
        title={<>Honest pricing, booth by <span className="accent-it">booth</span>.</>}
        sub="Start with a 14-day free trial — full product, one booth, no card. Every paid plan (Basic, Pro, Premium) includes 2 booth devices across 12, 6, 3, and 1 Month billing options (excluding GST 18%), and any modular add-on is ₹249."
      />

      <section className="section" style={{ paddingTop: 64 }}>
        <div className="wrap">
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 34 }}>
            <div style={toggleWrap} role="tablist" aria-label="Billing period">
              {BILLING_PERIODS.map((bp) => (
                <button key={bp.id} style={toggleBtn(billing === bp.id)} onClick={() => setBilling(bp.id)}>
                  {bp.label}{bp.badge ? ` · ${bp.badge}` : ''}
                </button>
              ))}
            </div>
          </div>

          {plans.length ? (
            <PricingCards plans={plans} selectedKey={selected} onSelect={select} billing={billing} />
          ) : (
            <p style={{ textAlign: 'center', color: plansError ? 'var(--pink-deep)' : 'var(--muted)', padding: 40 }}>{plansError || 'Loading plans…'}</p>
          )}

          {/* Complete 12 / 6 / 3 / 1 Month breakdown table */}
          <Reveal style={{ marginTop: 42 }}>
            <div className="card" style={{ padding: 'clamp(18px, 3vw, 28px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Complete Plan Pricing by Duration (2 Devices Included · Excluding GST 18%)</h3>
                <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--pink-deep)' }}>Any Add-on = ₹249</span>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Duration</th>
                      <th>Basic (2 Devices)</th>
                      <th>Pro (2 Devices)</th>
                      <th>Premium (2 Devices)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><b>12 Months (Annual)</b></td>
                      <td><b>₹499/Month</b> · ₹5,988/year <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                      <td className="hot"><b>₹699/Month</b> · ₹8,388/year <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                      <td><b>₹799/Month</b> · ₹9,588/year <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                    </tr>
                    <tr>
                      <td><b>6 Months</b></td>
                      <td><b>₹799/Month</b> · ₹4,794/6 Months <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                      <td className="hot"><b>₹999/Month</b> · ₹5,994/6 Months <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                      <td><b>₹1,099/Month</b> · ₹6,594/6 Months <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                    </tr>
                    <tr>
                      <td><b>3 Months</b></td>
                      <td><b>₹949/Month</b> · ₹2,847/3 Months <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                      <td className="hot"><b>₹1,149/Month</b> · ₹3,447/3 Months <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                      <td><b>₹1,299/Month</b> · ₹3,897/3 Months <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                    </tr>
                    <tr>
                      <td><b>1 Month (Monthly)</b></td>
                      <td><b>₹1,099/Month</b> · ₹13,188/year <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                      <td className="hot"><b>₹1,299/Month</b> · ₹15,588/year <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                      <td><b>₹1,499/Month</b> · ₹17,988/year <small style={{ color: 'var(--muted)' }}>(excl. GST 18%)</small></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>

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
                onBillingChange={setBilling}
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
            <span className="kicker c-blue">Add-ons · ₹249 each</span>
            <h2 className="h-lg">Bolt on <span className="accent-it" style={{ color: 'var(--blue)' }}>superpowers</span> — flat ₹249</h2>
            <p className="lead">Every modular add-on is a flat ₹249 (excluding GST 18%). Tick any add-on in the checkout above, or add them later from your CRM.</p>
          </Reveal>
          <div className="grid-3">
            {(addons.length ? addons : ADDONS).map((addon, i) => {
              const active = selectedAddons.includes(addon.key)
              return (
                <Reveal key={addon.key || addon.name} delay={i * 0.06}>
                  <div className="card" style={{ height: '100%', display: 'grid', gap: 8 }}>
                    <h3 style={{ fontSize: '1.15rem' }}>{addon.name}</h3>
                    <p>{addon.description || addon.desc}</p>
                    <p style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ color: 'var(--pink-deep)' }}>
                        {money(addonPrice(addon))} <small style={{ color: 'var(--muted)', fontWeight: 500 }}>· excl. 18% GST</small>
                      </b>
                      <button className={active ? 'btn btn-pink' : 'btn btn-ghost'} style={{ padding: '8px 16px' }} onClick={() => toggleAddon(addon.key)}>
                        {active ? 'Added ✓' : 'Add · ₹249'}
                      </button>
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
            <p className="lead">Every plan includes 2 booth devices, the booth app, CRM, guest QR downloads and unlimited sessions. Higher plans add branding, AI and the money-making extras.</p>
          </Reveal>
          <Reveal>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Capability</th><th>Basic (2 Dev)</th><th>Pro (2 Dev)</th><th>Premium (2 Dev)</th></tr></thead>
                <tbody>
                  {PLAN_MATRIX.map(([label, a, b, c]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td className={a ? 'y' : 'n'}>{a === true ? '✓ Included' : a === false ? '—' : a}</td>
                      <td className={b ? 'y hot' : 'n'}>{b === true ? '✓ Included' : b === false ? '—' : b}</td>
                      <td className={c ? 'y' : 'n'}>{c === true ? '✓ Included' : c === false ? '—' : c}</td>
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
