import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBooth } from "../context/BoothContext";
import { useIdleTimer } from "../hooks/useIdleTimer";
import IdleTimerRing from "../components/IdleTimerRing";

// Auto-map gridKey → template config
const GRID_TEMPLATE_MAP = {
  cut1:          { id: "cut1",   frames: 1, orientation: "vertical", label: "1 CUT" },
  cut2:          { id: "cut2",   frames: 2, orientation: "vertical", label: "2 CUT" },
  cut4:          { id: "cut4",   frames: 4, orientation: "grid",     label: "4 CUT" },
  cut6Vertical:  { id: "cut6v",  frames: 6, orientation: "grid",     label: "6 CUT (V)" },
  cut6Horizontal:{ id: "cut6h",  frames: 6, orientation: "grid",     label: "6 CUT (H)" },
};

function StartShooting() {
  const navigate = useNavigate();
  const { session, selectTemplate, resetSession } = useBooth();

  const TIMEOUT = 30;
  const { secondsLeft } = useIdleTimer({
    timeoutSeconds: TIMEOUT,
    onTimeout: () => { resetSession(); navigate("/"); },
  });

  // Auto-apply template from gridKey on mount
  useEffect(() => {
    const tmpl = GRID_TEMPLATE_MAP[session.gridKey] || GRID_TEMPLATE_MAP["cut4"];
    selectTemplate({ ...tmpl, overlayUrl: "" });
  }, []);

  const handleStart = () => navigate("/capture");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter','Segoe UI',sans-serif",
      userSelect: "none",
      position: "relative",
    }}>
      <IdleTimerRing secondsLeft={secondsLeft} totalSeconds={TIMEOUT} />

      {/* Timer */}
      <div style={{ position: "absolute", top: 24, right: 28, color: "#ef4444", fontWeight: 800, fontSize: "0.88rem" }}>
        Time Limit: {secondsLeft} Sec
      </div>

      {/* Payment success badge */}
      <div style={{
        background: "#f0fdf4", border: "1.5px solid #86efac",
        borderRadius: 99, padding: "6px 20px",
        color: "#16a34a", fontWeight: 800, fontSize: "0.8rem",
        marginBottom: 40, display: "flex", alignItems: "center", gap: 8,
      }}>
        <span>✓</span> Payment Successful
      </div>

      {/* Camera icon */}
      <div style={{
        width: 140, height: 140, borderRadius: "50%",
        background: "linear-gradient(135deg, #7c3aed, #a855f7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 32,
        boxShadow: "0 16px 48px rgba(124,58,237,0.35)",
        animation: "pulse 2s ease-in-out infinite",
      }}>
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <path d="M12 22C12 19.8 13.8 18 16 18H24L28 12H44L48 18H56C58.2 18 60 19.8 60 22V54C60 56.2 58.2 58 56 58H16C13.8 58 12 56.2 12 54V22Z" fill="white" fillOpacity="0.9"/>
          <circle cx="36" cy="38" r="10" fill="white" fillOpacity="0.3"/>
          <circle cx="36" cy="38" r="7" fill="white"/>
          <circle cx="48" cy="26" r="3" fill="white" fillOpacity="0.6"/>
        </svg>
      </div>

      {/* Text */}
      <h1 style={{
        fontSize: "clamp(1.8rem,4vw,2.8rem)",
        fontWeight: 900,
        color: "#111827",
        margin: 0,
        letterSpacing: "-0.02em",
        textAlign: "center",
      }}>
        Start Shooting
      </h1>
      <p style={{ color: "#6b7280", fontSize: "0.95rem", marginTop: 12, marginBottom: 48, textAlign: "center" }}>
        Grid: <strong style={{ color: "#7c3aed" }}>{session.selectedGrid || "Selected"}</strong>
        &nbsp;·&nbsp;
        {session.copiesPaid} cop{session.copiesPaid > 1 ? "ies" : "y"}
        {session.wantsDigitalQr ? " + QR" : ""}
      </p>

      {/* Big CTA button */}
      <button
        onClick={handleStart}
        style={{
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
          color: "#fff", border: "none",
          borderRadius: 99,
          padding: "20px 72px",
          fontWeight: 900, fontSize: "1.25rem",
          cursor: "pointer",
          boxShadow: "0 8px 32px rgba(124,58,237,0.45)",
          transition: "all 0.2s",
          display: "flex", alignItems: "center", gap: 12,
          letterSpacing: "0.02em",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 12px 48px rgba(124,58,237,0.55)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(124,58,237,0.45)"; }}
      >
        <span style={{ fontSize: "1.4rem" }}>📸</span>
        Start Shooting
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 16px 48px rgba(124,58,237,0.35); }
          50% { transform: scale(1.06); box-shadow: 0 20px 64px rgba(124,58,237,0.5); }
        }
      `}</style>
    </div>
  );
}

export default StartShooting;
