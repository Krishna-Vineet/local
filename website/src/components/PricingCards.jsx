import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { money } from '../lib/api.js'
import { PLAN_HIGHLIGHTS } from '../data/content.js'

// Plan cards driven by the live catalogue (backend planService via
// website-backend). `billing` switches monthly/annual prices (₹ only).
// A live discount campaign (percent or flat — owner-set in the CRM with
// time window / client cap) strikes through the list price here and is
// charged the same way at checkout.
export default function PricingCards({ plans, selectedKey, onSelect, linkToCheckout = false, billing = 'monthly' }) {
  return (
    <div className="plans">
      {plans.map((plan, i) => {
        const featured = plan.key === 'pro'
        const discount = plan.discount?.active
        const prices = plan.billing?.inr
        const annual = billing === 'annual'
        let perMonth = prices ? (annual ? prices.annualPerMonth : prices.monthly) : null
        let total = prices ? (annual ? prices.annual : prices.monthly) : null
        // Discounted period figures (₹): percent off the period price, or
        // a flat ₹ off. Monthly discounts come straight from the server
        // (planPricing); annual re-derives the same rule on the total.
        let listTotal = total
        if (discount && total != null) {
          if (annual) {
            const off = plan.discount.discountType === 'percent'
              ? Math.round((total * Math.min(100, plan.discount.discountValue)) / 100)
              : Math.min(total, Math.round(plan.discount.discountValue))
            total = Math.max(0, total - off)
            perMonth = Math.round(total / 12)
          } else {
            total = plan.effectivePrice
            perMonth = plan.effectivePrice
            listTotal = plan.originalPrice
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
              {plan.price == null && perMonth == null ? (
                <span className="price-now">Custom</span>
              ) : plan.key === 'trial' || perMonth === 0 ? (
                <span className="price-now">{money(0)}</span>
              ) : (
                <>
                  <span className="price-now">{money(perMonth)}<small style={{ fontSize: '.45em', fontWeight: 600 }}>/mo</small></span>
                  {discount && (
                    <span className="price-was" style={{ textDecoration: 'line-through', opacity: 0.55, fontSize: '.55em', marginLeft: 8 }}>
                      {money(annual ? (listTotal != null ? Math.round(listTotal / 12) : null) : listTotal)}
                    </span>
                  )}
                  {discount && <span className="save-chip">{plan.discount.discountType === 'flat' ? `${money(listTotal - total)} off today` : `−${plan.discountPercent}% today`}</span>}
                </>
              )}
            </div>
            <div className="disc-note">
              {plan.price == null && perMonth == null
                ? 'Tailored quote — customisable'
                : plan.key === 'trial'
                  ? 'Free for 14 days · 1 device'
                  : annual
                    ? `${money(total)} billed annually · ${plan.devices || 2} devices included${discount && plan.discount.discountLabel ? ` · ${plan.discount.discountLabel}` : ''}${discount && plan.slotsLeft != null ? ` · Only ${plan.slotsLeft} left at this price` : ''}`
                    : `Billed monthly · ${plan.devices || 2} devices included${discount && plan.discount.discountLabel ? ` · ${plan.discount.discountLabel}` : ''}${discount && plan.slotsLeft != null ? ` · Only ${plan.slotsLeft} left at this price` : ''}`}
            </div>

            <ul className="plan-feats">
              {(PLAN_HIGHLIGHTS[plan.key] || [`${plan.devices} booth(s) included`, `${plan.events} parallel event(s)`, 'Booth app + CRM access', 'QR digital copies']).map((line) => (
                <li key={line}><span>{line}</span></li>
              ))}
              {plan.billing?.aiCredits ? <li><span>{plan.billing.aiCredits} AI template credits / period</span></li> : null}
            </ul>

            {plan.price == null && perMonth == null ? (
              <Link to="/contact" className="btn btn-ink">Talk to sales</Link>
            ) : linkToCheckout ? (
              <Link to={`/pricing?plan=${plan.key}#checkout`} className={featured ? 'btn btn-pink' : 'btn btn-ghost'}>
                {plan.key === 'trial' || perMonth === 0 ? 'Start free trial' : 'Buy / renew'}
              </Link>
            ) : (
              <button className={featured ? 'btn btn-pink' : 'btn btn-ghost'} onClick={() => onSelect && onSelect(plan.key)}>
                {selectedKey === plan.key ? 'Selected ✓' : plan.key === 'trial' || perMonth === 0 ? 'Start free trial' : 'Choose ' + plan.name}
              </button>
            )}
          </motion.article>
        )
      })}
    </div>
  )
}
