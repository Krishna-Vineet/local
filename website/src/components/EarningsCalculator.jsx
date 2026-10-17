import { useMemo, useState } from 'react';
import { inr } from '../lib/api.js';

/* Rough, honest event maths. Defaults are mid-market Indian rates. */
export default function EarningsCalculator() {
  const [mode, setMode] = useState('rental');
  const [events, setEvents] = useState(6);
  const [price, setPrice] = useState(30000);
  const [printsDay, setPrintsDay] = useState(180);
  const [perPrint, setPerPrint] = useState(149);
  const [days, setDays] = useState(22);
  const [investment, setInvestment] = useState(180000);

  const r = useMemo(() => {
    if (mode === 'rental') {
      const revenue = events * price;
      const costs = events * 4500 + 1499; // prints, travel, host snack budget + plan
      return { revenue, costs, profit: revenue - costs, unit: `${events} events × ${inr(price)}` };
    }
    const revenue = printsDay * perPrint * days;
    const costs = printsDay * days * 38 + 1499; // paper+ink per print + plan
    return { revenue, costs, profit: revenue - costs, unit: `${printsDay} prints × ${days} days × ${inr(perPrint)}` };
  }, [mode, events, price, printsDay, perPrint, days]);

  const payback = r.profit > 0 ? Math.max(1, Math.ceil(investment / r.profit)) : null;

  return (
    <div className="calc">
      <div className="calc-controls">
        <h3>Run your own numbers</h3>
        <p>Drag the sliders to your city, your rates, your weekends. These are the same rough figures our operators plan with — costs included, no fairy dust.</p>
        <div className="calc-field">
          <label>How would you run it?</label>
          <div className="seg">
            <button className={mode === 'rental' ? 'on' : ''} onClick={() => setMode('rental')}>Event rentals</button>
            <button className={mode === 'print' ? 'on' : ''} onClick={() => setMode('print')}>Pay-per-print</button>
          </div>
        </div>
        {mode === 'rental' ? (
          <>
            <div className="calc-field">
              <label>Events per month <output>{events}</output></label>
              <input type="range" min="1" max="20" value={events} onChange={(e) => setEvents(+e.target.value)} />
              <div className="hint">Most part-time operators do 4–8. Full-timers with two booths do 15+.</div>
            </div>
            <div className="calc-field">
              <label>Average booking price <output>{inr(price)}</output></label>
              <input type="range" min="10000" max="80000" step="1000" value={price} onChange={(e) => setPrice(+e.target.value)} />
              <div className="hint">Metro weddings: ₹35–60k. Smaller towns: ₹15–25k to start.</div>
            </div>
          </>
        ) : (
          <>
            <div className="calc-field">
              <label>Prints per day <output>{printsDay}</output></label>
              <input type="range" min="30" max="500" step="10" value={printsDay} onChange={(e) => setPrintsDay(+e.target.value)} />
              <div className="hint">A busy mall weekend clears 300+. A quiet café day might do 60.</div>
            </div>
            <div className="calc-field">
              <label>Price per print <output>{inr(perPrint)}</output></label>
              <input type="range" min="49" max="399" step="10" value={perPrint} onChange={(e) => setPerPrint(+e.target.value)} />
              <div className="hint">Wallet prints ₹99–149, magnets ₹199–249, bookmarks ₹149–199.</div>
            </div>
            <div className="calc-field">
              <label>Days placed per month <output>{days}</output></label>
              <input type="range" min="4" max="30" value={days} onChange={(e) => setDays(+e.target.value)} />
            </div>
          </>
        )}
        <div className="calc-field">
          <label>Your starting investment <output>{inr(investment)}</output></label>
          <input type="range" min="60000" max="500000" step="10000" value={investment} onChange={(e) => setInvestment(+e.target.value)} />
          <div className="hint">Booth hardware, printer, camera and first paper stock. Software is a monthly plan.</div>
        </div>
      </div>
      <div className="calc-result">
        <span className="rlabel">{mode === 'rental' ? 'Estimated monthly profit' : 'Estimated monthly profit'}</span>
        <div className="rbig">{inr(Math.max(0, r.profit))}<span style={{ fontSize: 20, color: 'var(--muted)', fontFamily: 'var(--sans)', fontWeight: 600 }}>/mo</span></div>
        <span style={{ color: 'var(--muted)', fontSize: 13.5 }}>{r.unit}</span>
        <div className="calc-rows">
          <div className="crow"><span>Gross revenue</span><b>{inr(r.revenue)}</b></div>
          <div className="crow"><span>Running costs (prints, travel, plan)</span><b>− {inr(r.costs)}</b></div>
          <div className="crow total"><span>Paid back in</span><b>{payback ? `${payback} month${payback > 1 ? 's' : ''}` : '—'}</b></div>
        </div>
        <p className="calc-note">Estimates, not promises. Your city, your hustle and your reviews decide the real number — but this is the maths successful operators start with. Equipment is a one-time cost; the plan is monthly.</p>
      </div>
    </div>
  );
}
