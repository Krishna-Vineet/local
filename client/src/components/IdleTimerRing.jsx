import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * IdleTimerRing
 * ─────────────────────────────────────────────────────────
 * Circular SVG countdown ring displayed in the top-right
 * corner of booth pages. Changes colour as time runs out.
 *
 * Props:
 *   secondsLeft  - current countdown value
 *   totalSeconds - max seconds (used to compute ring fill)
 *   size         - ring diameter in px (default 68)
 */
const IdleTimerRing = ({ secondsLeft, totalSeconds, size = 68 }) => {
  const radius = (size - 8) / 2;          // ring radius (4px stroke × 2 = 8 inset)
  const circumf = 2 * Math.PI * radius;
  const progress = Math.max(0, secondsLeft / totalSeconds);
  const dashOffset = circumf * (1 - progress);

  // Colour transitions: green → amber → red
  let ringColor = '#22c55e';
  let textColor = '#22c55e';
  let bgColor = 'rgba(22, 163, 74, 0.12)';
  let pulse = false;

  if (secondsLeft <= 8) {
    ringColor = '#ef4444';
    textColor = '#ef4444';
    bgColor = 'rgba(239, 68, 68, 0.15)';
    pulse = true;
  } else if (secondsLeft <= 15) {
    ringColor = '#f59e0b';
    textColor = '#f59e0b';
    bgColor = 'rgba(245, 158, 11, 0.12)';
  }

  return (
    <>
      <div
        id="idle-timer-ring"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 9000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          animation: pulse ? 'idlePulse 1s ease-in-out infinite' : 'none',
        }}
      >
        {/* Keyframes injected once */}
        <style>{`
          @keyframes idlePulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50%       { transform: scale(1.08); opacity: 0.8; }
          }
        `}</style>

        {/* Circular ring */}
        <div
          style={{
            width: size,
            height: size,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill={bgColor}
              stroke={`${ringColor}30`}
              strokeWidth={4}
            />
            {/* Progress arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={circumf}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
            />
          </svg>

          {/* Seconds number */}
          <span
            style={{
              color: textColor,
              fontSize: size < 60 ? '0.75rem' : '1rem',
              fontWeight: 800,
              fontFamily: 'inherit',
              lineHeight: 1,
              zIndex: 1,
              transition: 'color 0.3s ease',
              letterSpacing: '-0.02em',
            }}
          >
            {secondsLeft}
          </span>
        </div>
      </div>

      {/* Session Expiring Modal Alert */}
      {secondsLeft <= 10 && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-md z-[9999] p-4 animate-fade-in"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Keyframes for modal fade-in and icon animations */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleUp {
              from { transform: scale(0.9); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            @keyframes pulseBorder {
              0%, 100% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
              50% { border-color: rgba(239, 68, 68, 0.8); box-shadow: 0 0 20px 4px rgba(239, 68, 68, 0.2); }
            }
            @keyframes bounceNumber {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.15); }
            }
            .animate-fade-in {
              animation: fadeIn 0.3s ease-out forwards;
            }
            .animate-scale-up {
              animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            .animate-pulse-border {
              animation: pulseBorder 2s infinite;
            }
            .animate-bounce-number {
              animation: bounceNumber 1s ease-in-out infinite;
            }
          `}</style>

          <div className="bg-slate-900/95 border border-red-500/30 rounded-3xl p-8 max-w-sm w-full shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] text-center animate-scale-up animate-pulse-border">
            {/* Warning Icon Container */}
            <div className="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 rounded-full bg-red-500/10 animate-ping opacity-75"></div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mb-2">
              Are you still there?
            </h2>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">
              क्या आप यहाँ हैं?
            </h3>

            {/* Giant Countdown Number */}
            <div className="flex justify-center items-center mb-6">
              <div className="w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-500/5">
                <span className="text-5xl font-black text-red-500 font-mono tracking-tighter animate-bounce-number">
                  {secondsLeft}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-300 text-sm font-semibold leading-relaxed mb-1">
              Your session will reset shortly!
            </p>
            <p className="text-gray-400 text-xs font-medium leading-relaxed mb-6">
              सत्र समाप्त होने वाला है। जारी रखने के लिए कहीं भी क्लिक करें।
            </p>

            {/* Reset/Keep Active Action Button */}
            <button
              className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold rounded-2xl shadow-lg shadow-red-600/30 hover:shadow-red-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 uppercase tracking-wider text-xs"
            >
              Keep Session Active / जारी रखें
            </button>
          </div>
        </div>
      )}
    </>
  );

};

export default IdleTimerRing;
