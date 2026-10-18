import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { money } from '../lib/api.js'
import { PLAN_HIGHLIGHTS } from '../data/content.js'

export const BILLING_PERIODS = [
  { id: 'annual', label: '12 Months', badge: 'Save up to 55%', months: 12 },
  { id: 'semiannual', label: '6 Months', badge: 'Save up to 27%', months: 6 },
  { id: 'quarterly', label: '3 Months', badge: 'Save up to 14%', months: 3 },
  { id: 'monthly', label: '1 Month', badge: null, months: 1 },
]

// Plan cards driven by the live catalogue (backend planService via
// website-backend). `billing` switches 12 / 6 / 3 / 1 Month prices (₹).
export default function PricingCards({ plans, selectedKey, onSelect, linkToCheckout = false, billing = 'annual' }) {
  return (
    <div className="plans">
      {plans.map((plan, i) => {
        const featured = plan.key === 'pro'
        const discount = plan.discount?.active
        const prices = plan.billing?.inr || {}
        const devLabel = `${plan.devices || 2} Device${(plan.devices || 2) === 1 ? '' : 's'}`

        let perMonth = null
        let total = null
        let strikePerMonth = null
        let periodEquation = null

        const isFree = plan.key === 'trial' || (plan.effectivePrice === 0 && prices.monthly === 0)
        const isCustom = plan.price == null && prices.monthly == null

        if (!isFree && !isCustom) {
          if (billing === 'annual' && prices.annual != null) {
            total = prices.annual
            perMonth = prices.annualPerMonth ?? Math.round(total / 12)
            strikePerMonth = prices.monthly
            periodEquation = `Annual: ${money(perMonth)}/Month - ${devLabel} = ${money(total)}/year (excluding GST 18%)`
          } else if (billing === 'semiannual' && prices.semiannual != null) {
            total = prices.semiannual
            perMonth = prices.semiannualPerMonth ?? Math.round(total / 6)
            strikePerMonth = prices.monthly
            periodEquation = `${money(perMonth)}/Month - ${devLabel} = ${money(total)}/6 Months (excluding GST 18%)`
          } else if (billing === 'quarterly' && prices.quarterly != null) {
            total = prices.quarterly
            perMonth = prices.quarterlyPerMonth ?? Math.round(total / 3)
            strikePerMonth = prices.monthly
            periodEquation = `${money(perMonth)}/Month - ${devLabel} = ${money(total)}/3 Months (excluding GST 18%)`
          } else {
            total = prices.monthly ?? plan.effectivePrice
            perMonth = total
            const annualized = prices.monthlyAnnualized ?? (total != null ? total * 12 : null)
            periodEquation = annualized != null
              ? `Monthly: ${money(perMonth)}/Month - ${devLabel} = ${money(annualized)}/year (excluding GST 18%)`
              : `Billed monthly · ${devLabel} · excluding GST 18%`
          }
        }

        const listTotal = total
        if (discount && total != null && !isFree && !isCustom) {
          const monthsCount = billing === 'annual' ? 12 : billing === 'semiannual' ? 6 : billing === 'quarterly' ? 3 : 1
          if (monthsCount > 1) {
            const off = plan.discount.discountType === 'percent'
              ? Math.round((total * Math.min(100, plan.discount.discountValue)) / 100)
              : Math.min(total, Math.round(plan.discount.discountValue))
            total = Math.max(0, total - off)
            perMonth = Math.round(total / monthsCount)
          } else {
            total = plan.effectivePrice
            perMonth = plan.effectivePrice
            strikePerMonth = plan.originalPrice
          }
        }

        return (
          <motion.article
            key={plan.key}
            className={`plan-card${featured ? ' hot foil' : ''}${selectedKey === plan.key ? ' selected' : ''}`}
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.07 }}
          >
            {featured && <span className="plan-tag">Most loved</span>}
            <div className="pname">{plan.name}</div>
            <p className="pfor">{plan.description}</p>

            <div className="price-row">
              {isCustom ? (
                <span className="price-now">Custom</span>
              ) : isFree ? (
                <span className="price-now">{money(0)}</span>
              ) : (
                <>
                  <span className="price-now">{money(perMonth)}<small style={{ fontSize: '.45em', fontWeight: 600 }}>/Month</small></span>
                  {strikePerMonth && strikePerMonth !== perMonth && (
                    <span className="price-was" style={{ textDecoration: 'line-through', opacity: 0.55, fontSize: '.55em', marginLeft: 8 }}>
                      {money(strikePerMonth)}
                    </span>
                  )}
                  {discount && listTotal != null && total != null && (
                    <span className="save-chip">{plan.discount.discountType === 'flat' ? `${money(listTotal - total)} off today` : `−${plan.discountPercent}% today`}</span>
                  )}
                </>
              )}
            </div>
            <div className="disc-note">
              {isCustom
                ? 'Tailored quote — customisable'
                : isFree
                  ? 'Free for 14 days · 1 device'
                  : `${periodEquation}${discount && plan.discount.discountLabel ? ` · ${plan.discount.discountLabel}` : ''}${discount && plan.slotsLeft != null ? ` · Only ${plan.slotsLeft} left at this price` : ''}`}
            </div>

            <ul className="plan-feats">
              {(PLAN_HIGHLIGHTS[plan.key] || [`${plan.devices} booth(s) included`, `${plan.events} parallel event(s)`, 'Booth app + CRM access', 'QR digital copies']).map((line) => (
                <li key={line}><span>{line}</span></li>
              ))}
              {plan.billing?.aiCredits ? <li><span>{plan.billing.aiCredits} AI template credits / period</span></li> : null}
            </ul>

            {isCustom ? (
              <Link to="/contact" className="btn btn-ink">Talk to sales</Link>
            ) : linkToCheckout ? (
              <Link to={`/pricing?plan=${plan.key}&billing=${billing}#checkout`} className={featured ? 'btn btn-pink' : 'btn btn-ghost'}>
                {isFree ? 'Start free trial' : 'Buy / renew'}
              </Link>
            ) : (
              <button className={featured ? 'btn btn-pink' : 'btn btn-ghost'} onClick={() => onSelect && onSelect(plan.key)}>
                {selectedKey === plan.key ? 'Selected ✓' : isFree ? 'Start free trial' : 'Choose ' + plan.name}
              </button>
            )}
          </motion.article>
        )
      })}
    </div>
  )
}
