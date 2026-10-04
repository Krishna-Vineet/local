import { useNavigate } from "react-router-dom";
import { useBooth } from "../context/BoothContext";
import { useIdleTimer } from "../hooks/useIdleTimer";
import IdleTimerRing from "../components/IdleTimerRing";

const GRIDS = [
  {
    key: "cut1", label: "1 CUT", frames: 1, orientation: "vertical", description: "Single full photo",
    icon: `<svg width="72" height="88" viewBox="0 0 72 88" fill="none"><rect x="10" y="10" width="52" height="68" rx="4" fill="white" opacity="0.92"/></svg>`,
  },
  {
    key: "cut2", label: "2 CUT", frames: 2, orientation: "vertical", description: "2 stacked photos",
    icon: `<svg width="72" height="88" viewBox="0 0 72 88" fill="none"><rect x="10" y="8" width="52" height="32" rx="3" fill="white" opacity="0.92"/><rect x="10" y="48" width="52" height="32" rx="3" fill="white" opacity="0.92"/></svg>`,
  },
  {
    key: "cut4", label: "4 CUT", frames: 4, orientation: "grid", description: "2x2 photo grid",
    icon: `<svg width="72" height="88" viewBox="0 0 72 88" fill="none"><rect x="6" y="6" width="27" height="36" rx="3" fill="white" opacity="0.92"/><rect x="39" y="6" width="27" height="36" rx="3" fill="white" opacity="0.92"/><rect x="6" y="46" width="27" height="36" rx="3" fill="white" opacity="0.92"/><rect x="39" y="46" width="27" height="36" rx="3" fill="white" opacity="0.92"/></svg>`,
  },
  {
    key: "cut6Vertical", label: "6 CUT", frames: 6, orientation: "grid", description: "2x3 vertical grid",
    icon: `<svg width="72" height="88" viewBox="0 0 72 88" fill="none"><rect x="6" y="4" width="27" height="24" rx="2.5" fill="white" opacity="0.92"/><rect x="39" y="4" width="27" height="24" rx="2.5" fill="white" opacity="0.92"/><rect x="6" y="32" width="27" height="24" rx="2.5" fill="white" opacity="0.92"/><rect x="39" y="32" width="27" height="24" rx="2.5" fill="white" opacity="0.92"/><rect x="6" y="60" width="27" height="24" rx="2.5" fill="white" opacity="0.92"/><rect x="39" y="60" width="27" height="24" rx="2.5" fill="white" opacity="0.92"/></svg>`,
  },
  {
    key: "cut6Horizontal", label: "HORIZONTAL 6 CUT", frames: 6, orientation: "grid", description: "3x2 horizontal grid",
    icon: `<svg width="88" height="72" viewBox="0 0 88 72" fill="none"><rect x="4" y="6" width="24" height="27" rx="2.5" fill="white" opacity="0.92"/><rect x="32" y="6" width="24" height="27" rx="2.5" fill="white" opacity="0.92"/><rect x="60" y="6" width="24" height="27" rx="2.5" fill="white" opacity="0.92"/><rect x="4" y="37" width="24" height="27" rx="2.5" fill="white" opacity="0.92"/><rect x="32" y="37" width="24" height="27" rx="2.5" fill="white" opacity="0.92"/><rect x="60" y="37" width="24" height="27" rx="2.5" fill="white" opacity="0.92"/></svg>`,
  },
];

function GridCard({ grid, price, onClick }) {
  const priceLabel = price === null || price === 0 ? "Free" : `Rs.${price}`;
  const isFree = price === null || price === 0;
  return (
    <div
      onClick={onClick}
      className="grid-card"
      style={{
        background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.1)",
        borderRadius: 18, padding: "18px 12px 14px", display: "flex", flexDirection: "column",
        alignItems: "center", cursor: "pointer", gap: 10, transition: "all 0.22s ease",
      }}
      onMouseEnter={e => { Object.assign(e.currentTarget.style, { border: "1.5px solid rgba(59,130,246,0.6)", background: "rgba(59,130,246,0.08)", transform: "translateY(-3px)", boxShadow: "0 12px 40px rgba(59,130,246,0.2)" }); }}
      onMouseLeave={e => { Object.assign(e.currentTarget.style, { border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", transform: "translateY(0)", boxShadow: "none" }); }}
      onMouseDown={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 72 }}
        dangerouslySetInnerHTML={{ __html: grid.icon }} />
      <div style={{ width: 32, height: 3, borderRadius: 99, background: "linear-gradient(90deg,#3b82f6,#6366f1)", marginTop: -4 }} />
      <span style={{ color: "#e2e8f0", fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", lineHeight: 1.2 }}>
        {grid.label}
      </span>
      <div style={{ background: isFree ? "rgba(16,185,129,0.15)" : "rgba(59,130,246,0.15)", border: `1px solid ${isFree ? "rgba(16,185,129,0.35)" : "rgba(59,130,246,0.35)"}`, borderRadius: 99, padding: "3px 12px", fontSize: "0.68rem", fontWeight: 800, color: isFree ? "#10b981" : "#60a5fa" }}>
        {priceLabel}
      </div>
    </div>
  );
}

function Booth() {
  const navigate = useNavigate();
  const { session, resetSession, setGridSelection } = useBooth();

  const TIMEOUT = 30;
  const { secondsLeft } = useIdleTimer({
    timeoutSeconds: TIMEOUT,
    onTimeout: () => { resetSession(); navigate("/"); },
  });

  const resolvePrice = (gridKey) => {
    const eventPrice = session.activeEvent?.gridPrices?.[gridKey];
    if (eventPrice != null) return eventPrice;
    return session.activeEvent?.printPrice ?? session.globalSettings?.printPrice ?? null;
  };
  const handleSelect = (grid) => {
    const price = resolvePrice(grid.key);
    setGridSelection({ selectedGrid: grid.label, gridKey: grid.key, gridPrice: price, copiesPaid: 1, wantsDigitalQr: true });
    navigate("/copies-payment");
  };

  const topRow = GRIDS.slice(0, 3);
  const bottomRow = GRIDS.slice(3);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0f1e 0%,#0d1424 60%,#0a0f1e 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", padding: "20px 16px", userSelect: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-10%", left: "5%", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "0%", right: "5%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.1) 0%,transparent 70%)", pointerEvents: "none" }} />
      <IdleTimerRing secondsLeft={secondsLeft} totalSeconds={TIMEOUT} />
      <button onClick={() => navigate("/")} style={{ position: "absolute", top: 20, left: 20, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", padding: "8px 18px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", backdropFilter: "blur(10px)" }}>
        ← Back
      </button>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <p style={{ color: "#3b82f6", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Step 1 of 3</p>
        <h1 style={{ color: "#ffffff", fontSize: "clamp(1.1rem,3vw,1.5rem)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Choose Your Grid</h1>
        <p style={{ color: "#475569", fontSize: "0.76rem", marginTop: 6, fontWeight: 500 }}>Select the photo layout you want to print</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, width: "100%", maxWidth: 660, marginBottom: 12 }}>
        {topRow.map(g => <GridCard key={g.key} grid={g} price={resolvePrice(g.key)} onClick={() => handleSelect(g)} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, width: "100%", maxWidth: 660 }}>
        {bottomRow.map(g => <GridCard key={g.key} grid={g} price={resolvePrice(g.key)} onClick={() => handleSelect(g)} />)}
      </div>
      <p style={{ color: "#1e3a5f", fontSize: "0.66rem", marginTop: 24, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
        📷 Capture Memories, Frame Happiness
      </p>
    </div>
  );
}

export default Booth;
