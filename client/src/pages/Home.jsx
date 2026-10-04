import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import logo from "../assets/Logo_white.png";
import logoBlack from "../assets/logo_light.svg";
import { useBooth } from "../context/BoothContext";
import { Zap, Calendar, ArrowRight, Sliders } from "lucide-react";

function Home() {
  const navigate = useNavigate();
  const { session, isAdminAssigned } = useBooth();
  const [pulse, setPulse] = useState(true);

  // Gentle pulse animation on the tap hint
  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 1500);
    return () => clearInterval(t);
  }, []);

  const hasEvent = !!session.activeEvent;

  // ── If event is loaded (admin-assigned or manual join) ──────────
  // Full-screen tap-to-start with event info
  if (hasEvent) {
    return (
      <div
        onClick={() => navigate("/booth")}
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
          padding: "2rem",
          userSelect: "none",
        }}
      >
        {/* Floating Settings Button on the right edge */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate("/login");
          }}
          style={{
            position: "absolute",
            right: 16,
            top: "55%",
            transform: "translateY(-50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#27272a",
            border: "none",
            color: "#ffffff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            zIndex: 50,
          }}
        >
          <Sliders size={20} />
        </button>

        {/* Logo (Black Logo for White Background) */}
        <img
          src={logoBlack}
          alt="Happy Pix"
          style={{
            width: 200,
            maxWidth: "80%",
            objectFit: "contain",
            marginBottom: 40,
            opacity: 0.9,
          }}
        />

        {/* Text */}
        <p
          style={{
            fontSize: "1.25rem",
            fontWeight: "600",
            textAlign: "center",
            color: "#1f2937",
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "#a855f7", animation: "pulse 1.5s infinite" }}>»»</span>
          Start by touching the screen
          <span style={{ color: "#a855f7", animation: "pulse 1.5s infinite" }}>««</span>
        </p>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  // ── No event: show splash with "Join Event" option ───────────
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        position: "relative",
        overflow: "hidden",
        padding: "2rem",
        userSelect: "none",
      }}
    >
      {/* Background orbs */}
      <div style={{
        position: "absolute", top: "-20%", left: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, #6366f133 0%, transparent 70%)",
        animation: "float 6s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", right: "-10%",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, #a855f733 0%, transparent 70%)",
        animation: "float 8s ease-in-out infinite reverse",
      }} />

      {/* Logo */}
      <img
        src={logo}
        alt="Happy Pix"
        style={{ width: 180, objectFit: "contain", marginBottom: 48, opacity: 0.9 }}
      />

      {/* No event info */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24, padding: "32px 40px",
        textAlign: "center", backdropFilter: "blur(20px)",
        marginBottom: 40, maxWidth: 400, width: "100%",
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          background: "rgba(99,102,241,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <Calendar size={28} color="#6366f1" />
        </div>
        <h2 style={{ color: "#fff", fontSize: "1.3rem", fontWeight: 700, margin: "0 0 8px" }}>
          Device Not Registered
        </h2>
        <p style={{ color: "#64748b", fontSize: "0.88rem", margin: 0, lineHeight: 1.6 }}>
          Register this device to your organization, then wait for the admin to assign an event.
        </p>
      </div>

      {/* Setup Device Button */}
      <button
        onClick={() => navigate("/login")}
        style={{
          padding: "16px 40px",
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          color: "#fff", border: "none", borderRadius: 16,
          fontSize: "1rem", fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
          transition: "all 0.25s",
          opacity: pulse ? 1 : 0.85,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(99,102,241,0.5)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(99,102,241,0.4)"; }}
      >
        <Sliders size={18} />
        Setup Booth Device
        <ArrowRight size={18} />
      </button>

      <p style={{
        color: "#334155", fontSize: "0.75rem", marginTop: 24, fontWeight: 500,
        opacity: pulse ? 0.7 : 1, transition: "opacity 1.5s ease",
      }}>
        Requires Organization Admin Credentials
      </p>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-30px); }
        }
      `}</style>
    </div>
  );
}

export default Home;