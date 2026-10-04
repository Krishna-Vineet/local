import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBooth } from "../context/BoothContext";
import { useIdleTimer } from "../hooks/useIdleTimer";
import IdleTimerRing from "../components/IdleTimerRing";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, "");
  return `${window.location.protocol}//${window.location.hostname}:5000`;
};
const API_URL = getApiUrl();

const getProxyUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/") || !url.startsWith("http")) return url;
  return `${API_URL}/api/proxy/logo?url=${encodeURIComponent(url)}`;
};

// Load Razorpay checkout script dynamically
const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) return resolve(true);
    const s = document.createElement("script");
    s.id = "razorpay-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

function CopiesPayment() {
  const navigate = useNavigate();
  const { session, setGridSelection, resetSession } = useBooth();

  const TIMEOUT = 60;
  const { secondsLeft } = useIdleTimer({
    timeoutSeconds: TIMEOUT,
    disabled: false,
    onTimeout: () => { resetSession(); navigate("/"); },
  });

  const gridPrice = session.gridPrice ?? 0;
  const printOptions = [1, 2, 4, 6, 8, 10];

  const [copies, setCopies] = useState(printOptions[0]);
  const [wantsDigital, setWantsDigital] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // UPI QR state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("razorpay"); // "razorpay" | "upi-qr"
  const [utrInput, setUtrInput] = useState("");

  const total = gridPrice * copies;
  const isFree = total === 0;

  const upiId = session.activeEvent?.upiId || session.globalSettings?.upiId || import.meta.env.VITE_MERCHANT_UPI_ID || "happypix@ybl";
  const upiName = session.globalSettings?.upiName || session.activeEvent?.organizerName || import.meta.env.VITE_MERCHANT_NAME || "HappyPix";
  const qrUrl = session.activeEvent?.qrCodeUrl || session.globalSettings?.upiQrImageUrl || null;

  // Determine if event has Razorpay configured
  const hasRazorpay = !!(session.activeEvent?.razorpayKeyId || session.globalSettings?.razorpayKeyId);

  const saveAndProceed = (paymentId) => {
    setGridSelection({
      selectedGrid: session.selectedGrid,
      gridKey: session.gridKey,
      gridPrice: session.gridPrice,
      copiesPaid: copies,
      wantsDigitalQr: wantsDigital,
      paymentId: paymentId || null,
    });
    navigate("/start-shooting");
  };

  const handleNext = async () => {
    setPaymentError("");

    // Free — skip payment
    if (isFree) {
      await recordFreePayment();
      return;
    }

    // Show payment screen
    setShowPayment(true);
  };

  const recordFreePayment = async () => {
    setPaymentLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/payments/free-complete`, {
        amount: 0,
        printCount: copies,
        digitalCopy: wantsDigital,
        photoUrls: [],
        compositeUrl: null,
        eventId: session.activeEvent?._id || null,
        eventName: session.activeEvent?.name || "General",
        preShoot: true,
      });
      saveAndProceed(res.data?.paymentId);
    } catch {
      setPaymentError("Something went wrong.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRazorpayPayment = async () => {
    setPaymentError("");
    setPaymentLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setPaymentError("Failed to load payment gateway. Check internet connection.");
        setPaymentLoading(false);
        return;
      }

      // Create order on server (uses event razorpayKeyId / razorpayKeySecret automatically)
      const orderRes = await axios.post(`${API_URL}/api/payments/create-order`, {
        amount: total,
        printCount: copies,
        digitalCopy: wantsDigital,
        photoUrls: [],
        compositeUrl: null,
        eventId: session.activeEvent?._id || null,
        eventName: session.activeEvent?.name || "General",
      });

      const { orderId, amount: rzpAmount, currency, key } = orderRes.data;

      const options = {
        key,
        amount: rzpAmount,
        currency,
        name: session.activeEvent?.name || "HappyPix",
        description: `${copies} Print${copies > 1 ? "s" : ""}${wantsDigital ? " + Digital QR" : ""}`,
        order_id: orderId,
        handler: async (response) => {
          try {
            const verifyRes = await axios.post(`${API_URL}/api/payments/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            saveAndProceed(verifyRes.data?.paymentId);
          } catch {
            setPaymentError("Payment verification failed. Please contact support.");
            setPaymentLoading(false);
          }
        },
        theme: { color: "#7c3aed" },
        modal: {
          ondismiss: () => { setPaymentLoading(false); },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (r) => {
        setPaymentError(`Payment failed: ${r.error.description}`);
        setPaymentLoading(false);
      });
      rzp.open();
    } catch (err) {
      setPaymentError(err.response?.data?.error || "Something went wrong. Please try again.");
      setPaymentLoading(false);
    }
  };

  const handleUpiConfirm = async () => {
    setPaymentError("");
    if (!utrInput) { setPaymentError("Please enter the 12-digit UPI Ref No. (UTR)."); return; }
    if (!/^\d{12}$/.test(utrInput)) { setPaymentError("UTR must be exactly 12 digits."); return; }

    setPaymentLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/payments/free-complete`, {
        amount: total,
        printCount: copies,
        digitalCopy: wantsDigital,
        photoUrls: [],
        compositeUrl: null,
        eventId: session.activeEvent?._id || null,
        eventName: session.activeEvent?.name || "General",
        utr: utrInput,
        preShoot: true,
      });
      saveAndProceed(res.data?.paymentId);
    } catch (err) {
      setPaymentError(err.response?.data?.error || "Failed to confirm payment.");
      setPaymentLoading(false);
    }
  };

  // ─── PAYMENT SCREEN ─────────────────────────────────────────────
  if (showPayment) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", padding: "40px 24px", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
        <IdleTimerRing secondsLeft={secondsLeft} totalSeconds={TIMEOUT} />
        <div style={{ position: "absolute", top: 24, right: 28, color: "#ef4444", fontWeight: 800, fontSize: "0.88rem" }}>
          Time Limit: {secondsLeft} Sec
        </div>

        <h1 style={{ fontSize: "clamp(1.1rem,2.5vw,1.5rem)", fontWeight: 800, color: "#111827", textAlign: "center", marginBottom: 8 }}>
          Pay ₹{total}
        </h1>
        <p style={{ color: "#6b7280", fontSize: "0.82rem", marginBottom: 28, textAlign: "center" }}>
          {copies} cop{copies > 1 ? "ies" : "y"} × ₹{gridPrice}
          {wantsDigital ? " + Digital QR (Free)" : ""}
        </p>

        {/* Payment method toggle */}
        <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 12, padding: 4, marginBottom: 28, gap: 4 }}>
          {hasRazorpay && (
            <button
              onClick={() => setPaymentMethod("razorpay")}
              style={{ padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", background: paymentMethod === "razorpay" ? "#7c3aed" : "transparent", color: paymentMethod === "razorpay" ? "#fff" : "#374151", transition: "all 0.2s" }}
            >
              💳 Card / UPI
            </button>
          )}
          <button
            onClick={() => setPaymentMethod("upi-qr")}
            style={{ padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", background: paymentMethod === "upi-qr" ? "#7c3aed" : "transparent", color: paymentMethod === "upi-qr" ? "#fff" : "#374151", transition: "all 0.2s" }}
          >
            📱 Scan QR
          </button>
        </div>

        {/* Razorpay */}
        {paymentMethod === "razorpay" && hasRazorpay && (
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <p style={{ color: "#6b7280", fontSize: "0.82rem", marginBottom: 24 }}>
              Click below to pay via Card, UPI, NetBanking or Wallet through Razorpay.
            </p>
            <button
              onClick={handleRazorpayPayment}
              disabled={paymentLoading}
              style={{ background: paymentLoading ? "#c4b5fd" : "#7c3aed", color: "#fff", border: "none", borderRadius: 99, padding: "16px 56px", fontWeight: 900, fontSize: "1.05rem", cursor: paymentLoading ? "wait" : "pointer", boxShadow: "0 6px 24px rgba(124,58,237,0.35)", width: "100%", transition: "all 0.2s" }}
            >
              {paymentLoading ? "Opening Payment..." : `Pay ₹${total} via Razorpay`}
            </button>
          </div>
        )}

        {/* UPI QR */}
        {paymentMethod === "upi-qr" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: 24, border: "2px solid #e5e7eb", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 320, width: "100%" }}>
            <div style={{ background: "#f9fafb", borderRadius: 14, padding: 14, border: "1px solid #e5e7eb" }}>
              {qrUrl
                ? <img src={getProxyUrl(qrUrl)} alt="UPI QR" style={{ width: 170, height: 170, objectFit: "contain" }} />
                : <QRCodeSVG value={`upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${total}&cu=INR&tn=${encodeURIComponent("HappyPix Print")}`} size={170} level="M" fgColor="#1e1b4b" />
              }
            </div>
            <p style={{ color: "#7c3aed", fontWeight: 900, fontSize: "1rem", margin: 0 }}>Scan &amp; Pay ₹{total}</p>
            <p style={{ color: "#9ca3af", fontSize: "0.72rem", margin: 0 }}>GPay · PhonePe · Paytm · BHIM</p>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ color: "#374151", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>12-Digit UPI Ref No. (UTR)</label>
              <input
                type="text" maxLength={12}
                value={utrInput}
                onChange={e => setUtrInput(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 12-digit UTR..."
                style={{ background: "#f9fafb", border: "2px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", color: "#111827", fontSize: "1rem", fontWeight: 700, textAlign: "center", fontFamily: "monospace", outline: "none", letterSpacing: "0.12em", width: "100%", boxSizing: "border-box" }}
                onFocus={e => { e.target.style.borderColor = "#7c3aed"; }}
                onBlur={e => { e.target.style.borderColor = "#e5e7eb"; }}
              />
            </div>
            <button
              onClick={handleUpiConfirm}
              disabled={paymentLoading}
              style={{ background: paymentLoading ? "#c4b5fd" : "#7c3aed", color: "#fff", border: "none", borderRadius: 99, padding: "13px 0", fontWeight: 900, fontSize: "0.95rem", cursor: paymentLoading ? "wait" : "pointer", width: "100%", transition: "all 0.2s" }}
            >
              {paymentLoading ? "Confirming..." : "Confirm Payment →"}
            </button>
          </div>
        )}

        {paymentError && (
          <p style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.82rem", marginTop: 16, textAlign: "center", maxWidth: 360 }}>{paymentError}</p>
        )}

        {/* Bypass Button for Testing */}
        <button
          onClick={() => saveAndProceed("bypass_test")}
          style={{ marginTop: 24, background: "#f59e0b", color: "#fff", border: "none", borderRadius: 99, padding: "12px 28px", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)", transition: "all 0.2s" }}
        >
          Bypass Payment (Test)
        </button>

        <button onClick={() => { setShowPayment(false); setPaymentError(""); }} style={{ position: "absolute", bottom: 32, left: 32, width: 48, height: 48, borderRadius: "50%", background: "#f3e8ff", border: "none", cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c3aed", fontWeight: 900 }}>←</button>
      </div>
    );
  }

  // ─── MAIN SCREEN ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", padding: "40px 24px", fontFamily: "'Inter','Segoe UI',sans-serif", userSelect: "none" }}>
      <IdleTimerRing secondsLeft={secondsLeft} totalSeconds={TIMEOUT} />

      <div style={{ position: "absolute", top: 24, right: 28, color: "#ef4444", fontWeight: 800, fontSize: "0.88rem" }}>
        Time Limit: {secondsLeft} Sec
      </div>

      <h1 style={{ fontSize: "clamp(1.2rem,2.8vw,1.7rem)", fontWeight: 800, color: "#111827", textAlign: "center", marginBottom: 48, maxWidth: 520 }}>
        Please select the number of prints
      </h1>

      {/* Copy count pills */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginBottom: 40 }}>
        {printOptions.map(n => (
          <button
            key={n}
            onClick={() => setCopies(n)}
            style={{
              width: 72, height: 72, borderRadius: 22, border: "none", cursor: "pointer",
              fontWeight: 900, fontSize: "1.3rem",
              background: copies === n ? "#a78bfa" : "#111827",
              color: "#ffffff",
              boxShadow: copies === n ? "0 4px 20px rgba(167,139,250,0.5)" : "0 2px 8px rgba(0,0,0,0.15)",
              transform: copies === n ? "scale(1.1)" : "scale(1)",
              transition: "all 0.18s ease",
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Price ribbon */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 48 }}>
        <div style={{ width: 0, height: 0, borderTop: "26px solid transparent", borderBottom: "26px solid transparent", borderRight: "22px solid #a78bfa" }} />
        <div style={{ background: "#a78bfa", padding: "12px 44px", color: "#fff", fontWeight: 900, fontSize: "1.3rem", letterSpacing: "0.04em" }}>
          {isFree ? "FREE" : `Rs. ${total}`}
        </div>
        <div style={{ width: 0, height: 0, borderTop: "26px solid transparent", borderBottom: "26px solid transparent", borderLeft: "22px solid #a78bfa" }} />
      </div>

      {/* Digital QR Yes/No */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <p style={{ fontWeight: 700, color: "#111827", fontSize: "0.95rem", marginBottom: 6 }}>
          Select Yes to include a QR Code link to download image and video files to your phone
        </p>
        <p style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.78rem", marginBottom: 24 }}>
          Note: The link will be valid for 24 hours, then the files will be automatically deleted
        </p>
        <div style={{ display: "flex", gap: 40, justifyContent: "center", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: "1.05rem", color: "#111827" }}>
            <div onClick={() => setWantsDigital(true)} style={{ width: 28, height: 28, border: "3px solid #111827", background: wantsDigital ? "#111827" : "#fff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
              {wantsDigital && <span style={{ color: "#fff", fontWeight: 900, fontSize: "0.9rem" }}>✓</span>}
            </div>
            Yes
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: "1.05rem", color: "#111827" }}>
            <div onClick={() => setWantsDigital(false)} style={{ width: 28, height: 28, border: "3px solid #111827", background: !wantsDigital ? "#111827" : "#fff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
              {!wantsDigital && <span style={{ color: "#fff", fontWeight: 900, fontSize: "0.9rem" }}>✓</span>}
            </div>
            No
          </label>
        </div>
      </div>

      {paymentError && (
        <p style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.82rem", marginBottom: 16, textAlign: "center" }}>{paymentError}</p>
      )}

      {/* Back */}
      <button onClick={() => navigate("/booth")} style={{ position: "absolute", bottom: 32, left: 32, width: 48, height: 48, borderRadius: "50%", background: "#f3e8ff", border: "none", cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c3aed", fontWeight: 900 }}>←</button>

      {/* Next */}
      <button
        onClick={handleNext}
        disabled={paymentLoading}
        style={{ position: "absolute", bottom: 32, right: 32, background: paymentLoading ? "#c4b5fd" : "#7c3aed", color: "#fff", border: "none", borderRadius: 99, padding: "14px 40px", fontWeight: 900, fontSize: "1rem", cursor: paymentLoading ? "wait" : "pointer", boxShadow: "0 6px 24px rgba(124,58,237,0.35)", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}
      >
        {paymentLoading ? "Please wait..." : "Next →"}
      </button>
    </div>
  );
}

export default CopiesPayment;
