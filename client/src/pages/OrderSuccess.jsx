import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useBooth } from '../context/BoothContext';
import { useIdleTimer } from '../hooks/useIdleTimer';
import IdleTimerRing from '../components/IdleTimerRing';

// ─── Confetti particle system ────────────────────────────────────────────────
const COLORS = ['#7c3aed', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f43f5e'];

const randomBetween = (a, b) => a + Math.random() * (b - a);

class Particle {
  constructor(canvasW, canvasH) {
    this.reset(canvasW, canvasH);
  }
  reset(cw, ch) {
    this.x = randomBetween(0, cw);
    this.y = randomBetween(-ch * 0.5, -10);
    this.size = randomBetween(6, 14);
    this.speedX = randomBetween(-2, 2);
    this.speedY = randomBetween(2, 5);
    this.rotation = randomBetween(0, 360);
    this.rotationSpeed = randomBetween(-4, 4);
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.shape = Math.random() > 0.5 ? 'rect' : 'circle';
    this.opacity = 1;
  }
  update(cw, ch) {
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
    if (this.y > ch + 20) this.reset(cw, ch);
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    if (this.shape === 'rect') {
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.5);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

const Confetti = () => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let alive = true;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Spawn 150 particles
    particles.current = Array.from({ length: 150 }, () => new Particle(canvas.width, canvas.height));

    const animate = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current.forEach((p) => {
        p.update(canvas.width, canvas.height);
        p.draw(ctx);
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Stop after 4.5 seconds — let last particles fall off screen
    const stopTimer = setTimeout(() => {
      alive = false;
      cancelAnimationFrame(animRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 4500);

    return () => {
      alive = false;
      cancelAnimationFrame(animRef.current);
      clearTimeout(stopTimer);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
    />
  );
};

// ─── Countdown timer ─────────────────────────────────────────────────────────
const useCountdown = (expiresAt) => {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const OrderSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetSession, leaveEvent } = useBooth();

  const prints = parseInt(searchParams.get('prints') || '2', 10);
  const amount = parseFloat(searchParams.get('amount') || '0');
  const hasDigital = searchParams.get('digital') === '1';
  const qrToken = searchParams.get('qrToken');

  const qrUrl = qrToken
    ? `${window.location.origin}/download/${qrToken}`
    : null;

  // Expiry: 24 hours from page load (server creates token at the same time)
  const [expiresAt] = useState(() => qrToken ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null);
  const countdown = useCountdown(expiresAt);

  const [showConfetti, setShowConfetti] = useState(true);
  const [checkVisible, setCheckVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCheckVisible(true), 200);
    const t2 = setTimeout(() => setShowConfetti(false), 5000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  const handleDone = () => {
    resetSession();
    navigate('/');
  };

  // 30-second idle timer — auto-reset after success so next guest can start
  const TIMEOUT = 30;
  const { secondsLeft } = useIdleTimer({
    timeoutSeconds: TIMEOUT,
    onTimeout: handleDone,
  });

  // Download QR as PNG
  const downloadQR = () => {
    const svg = document.getElementById('order-qr-svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'happypix-qr.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-black flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
      {showConfetti && <Confetti />}

      {/* Idle countdown ring */}
      <IdleTimerRing secondsLeft={secondsLeft} totalSeconds={TIMEOUT} />

      {/* Glowing background blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-lg">

        {/* ✓ check animation */}
        <div className="flex justify-center mb-6">
          <div
            style={{
              opacity: checkVisible ? 1 : 0,
              transform: checkVisible ? 'scale(1)' : 'scale(0.3)',
              transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
            className="w-28 h-28 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.5)]"
          >
            <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2">
            Order Placed! 🎉
          </h1>
          <p className="text-purple-200 text-lg">
            {amount > 0 ? `₹${amount} paid successfully` : 'Your free session is confirmed'}
          </p>
        </div>

        {/* Order summary chips */}
        <div className="flex justify-center flex-wrap gap-3 mb-8">
          <span className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-5 py-2 rounded-full font-bold text-sm">
            🖨️ {prints} Print{prints > 1 ? 's' : ''}
          </span>
          {hasDigital && (
            <span className="bg-purple-500/30 backdrop-blur-sm border border-purple-400/40 text-purple-200 px-5 py-2 rounded-full font-bold text-sm">
              📱 Digital Copy
            </span>
          )}
          {amount === 0 && (
            <span className="bg-green-500/20 backdrop-blur-sm border border-green-400/30 text-green-300 px-5 py-2 rounded-full font-bold text-sm">
              FREE
            </span>
          )}
        </div>

        {/* QR Code Section */}
        {hasDigital && qrUrl ? (
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 mb-6 text-center">
            <p className="text-white font-bold text-lg mb-1">📲 Scan to Download Your Photos</p>
            <p className="text-purple-200 text-xs mb-4">
              Open your camera app and point it at this code
            </p>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <div className="bg-white p-4 rounded-2xl shadow-2xl inline-block">
                <QRCodeSVG
                  id="order-qr-svg"
                  value={qrUrl}
                  size={180}
                  level="H"
                  includeMargin={false}
                  fgColor="#1e1b4b"
                />
              </div>
            </div>

            {/* Expiry countdown */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-red-300 text-sm font-bold">
                Expires in: {countdown}
              </span>
            </div>

            {/* Download QR button */}
            <button
              onClick={downloadQR}
              className="bg-white/20 hover:bg-white/30 border border-white/30 text-white px-6 py-2 rounded-full font-bold text-sm transition-all"
            >
              ⬇ Save QR Image
            </button>
          </div>
        ) : hasDigital && !qrUrl ? (
          <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-3xl p-5 mb-6 text-center">
            <p className="text-yellow-200 font-bold text-sm">
              ⚠️ QR code could not be generated. Please contact the operator.
            </p>
          </div>
        ) : null}

        {/* Print Status Indicator */}
        {prints > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-6 text-center">
            <p className="text-purple-200 text-sm font-bold flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              Print Status: Printing {prints} copies...
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Please wait at the printer tray to collect your photos.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 w-full">
          <button
            id="order-success-done-btn"
            onClick={handleDone}
            className="flex-[2] py-5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            Done — New Session
          </button>
          <button
            type="button"
            onClick={() => {
              const btn = document.getElementById('support-widget-btn');
              if (btn) btn.click();
            }}
            className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-sm border border-white/10 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            Report Issue
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
