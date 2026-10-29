/* A faithful mini-replica of the HappyPix CRM dashboard, framed like a
   browser window — shows buyers the real product instead of a stock photo. */
export default function CrmShowcase() {
  const bars = [38, 52, 44, 66, 58, 82, 95, 74, 88, 70, 92, 84];
  const barColors = ['#3871c1', '#5f4caa', '#ea097f', '#85c536'];
  return (
    <div className="browser-frame" role="img" aria-label="HappyPix CRM dashboard preview">
      <div className="browser-bar">
        <i style={{ background: '#ff5f57' }} /><i style={{ background: '#febc2e' }} /><i style={{ background: '#28c840' }} />
        <span className="browser-url">crm.happypix — Studio Dashboard</span>
      </div>
      <div className="crm-ui">
        <aside className="crm-side">
          <div className="cs-logo"><img src="/logo-mark-on-dark.svg" alt="" /><b>HappyPix</b></div>
          <nav>
            <a className="on">▦ Dashboard</a>
            <a>▤ Events</a>
            <a>▣ Booths</a>
            <a>⧉ Galleries</a>
            <a>✎ Design Studio</a>
            <a>☰ Print Layouts</a>
            <a>◈ Campaigns</a>
            <a>⚙ Settings</a>
          </nav>
        </aside>
        <div className="crm-main">
          <div className="cm-head">
            <b>Saturday, 12 Oct — 3 events live</b>
            <span className="pill pill-g">● All booths online</span>
          </div>
          <div className="crm-kpis">
            <div className="crm-kpi"><span>Revenue · this month</span><b>₹1,84,500</b> <em>▲ 23%</em></div>
            <div className="crm-kpi"><span>Prints today</span><b>1,284</b> <em>▲ 9%</em></div>
            <div className="crm-kpi"><span>Upcoming bookings</span><b>14</b> <em>4 this week</em></div>
            <div className="crm-kpi"><span>Leads captured</span><b>326</b> <em>▲ 31%</em></div>
          </div>
          <div className="crm-panel">
            <b>Prints per hour — today</b>
            <div className="crm-bars">
              {bars.map((h, i) => <i key={i} style={{ height: `${h}%`, background: barColors[i % 4] }} />)}
            </div>
          </div>
          <div className="crm-panel">
            <b>Live events</b>
            <div className="crm-row"><span>💍 Aisha & Kabir — Udaipur Vilas</span><span className="pill pill-p">482 prints · Live</span></div>
            <div className="crm-row"><span>🎂 Aarav turns 5 — Juhu</span><span className="pill pill-b">196 prints · Live</span></div>
            <div className="crm-row"><span>🏢 Tech Mahindra Family Day — Hinjawadi</span><span className="pill pill-y">Queue: 12 guests</span></div>
            <div className="crm-row"><span>🛍️ Pay-per-print — Phoenix Mall, Pune</span><span className="pill pill-g">₹8,450 today</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
