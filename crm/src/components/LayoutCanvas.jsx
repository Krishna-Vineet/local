import React from 'react';
import { parseLayoutCodeword } from '../lib/layouts.js';

export default function LayoutCanvas({ 
  layout, 
  isSelected = false, 
  showFooterLabel = true,
  className = '',
  style = {} 
}) {
  if (!layout) return null;

  // Resolve normalized layout parameters
  let target = layout;
  if (!target.slots || !Array.isArray(target.slots) || !target.width || !target.height) {
    target = parseLayoutCodeword(layout.codeword || layout.id, layout.grid || layout);
  } else if (target.grid && (!target.slots || target.slots.length === 0)) {
    target = parseLayoutCodeword(layout.codeword || layout.id, layout.grid);
  }

  const {
    width = 1200,
    height = 1800,
    slots = [],
    footer = null,
    orientation = 'portrait'
  } = target;

  const isLandscape = orientation === 'landscape' || orientation === 'H' || width > height;

  const gradients = [
    'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)', // Indigo / Violet
    'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)', // Pink / Rose
    'linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)', // Sky / Ocean
    'linear-gradient(135deg, #10B981 0%, #047857 100%)', // Emerald
    'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)', // Amber
    'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', // Purple
  ];

  return (
    <div 
      className={`layout-canvas-container ${className}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        minHeight: 0,
        minWidth: 0,
        ...style
      }}
    >
      {/* 
        Responsive Aspect Frame:
        Fits within both width & height constraints without distortion or overflow,
        regardless of whether aspect ratio is ultra-tall (1:3 strip), square (1:1), 
        or ultra-wide (16:9 / 3:1).
      */}
      <div
        style={{
          aspectRatio: `${width} / ${height}`,
          maxWidth: '100%',
          maxHeight: '100%',
          width: isLandscape ? '100%' : 'auto',
          height: !isLandscape ? '100%' : 'auto',
          background: 'linear-gradient(180deg, #1c182d 0%, #131020 100%)',
          borderRadius: '6px',
          border: isSelected 
            ? '2px solid var(--hp-pink, #EA097F)' 
            : '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: isSelected 
            ? '0 0 16px rgba(234, 9, 127, 0.35), 0 4px 12px rgba(0,0,0,0.5)' 
            : '0 4px 14px rgba(0,0,0,0.3)',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          flexShrink: 0
        }}
      >
        {/* Subtle Canvas Grid Pattern */}
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.05,
            backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
            backgroundSize: '12px 12px',
            pointerEvents: 'none'
          }} 
        />

        {/* Photo Slots Layer */}
        {slots.map((slot, idx) => (
          <div
            key={slot.id || `slot-${idx + 1}`}
            style={{
              position: 'absolute',
              left: `${(slot.x * 100).toFixed(2)}%`,
              top: `${(slot.y * 100).toFixed(2)}%`,
              width: `${(slot.width * 100).toFixed(2)}%`,
              height: `${(slot.height * 100).toFixed(2)}%`,
              background: gradients[idx % gradients.length],
              border: isSelected 
                ? '1px solid rgba(255, 255, 255, 0.9)' 
                : '1px solid rgba(212, 175, 55, 0.75)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxSizing: 'border-box',
              boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.25)',
              pointerEvents: 'none'
            }}
          >
            <svg 
              width="10" 
              height="10" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ opacity: 0.9, marginBottom: '1px' }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2 L12 12 L20.5 7" />
              <path d="M12 12 L3.5 7" />
              <path d="M12 12 L7 20.5" />
              <path d="M12 12 L17 20.5" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
            <span style={{ 
              fontSize: '8px', 
              fontFamily: 'monospace, sans-serif', 
              fontWeight: '700', 
              letterSpacing: '0.4px', 
              lineHeight: 1,
              textShadow: '0 1px 2px rgba(0,0,0,0.6)'
            }}>
              P{idx + 1}
            </span>
          </div>
        ))}

        {/* Branding Footer Indicator */}
        {footer && (
          <div
            style={{
              position: 'absolute',
              left: `${(footer.x * 100).toFixed(2)}%`,
              top: `${(footer.y * 100).toFixed(2)}%`,
              width: `${(footer.width * 100).toFixed(2)}%`,
              height: `${(footer.height * 100).toFixed(2)}%`,
              borderTop: '1px dashed rgba(255, 255, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              pointerEvents: 'none'
            }}
          >
            {showFooterLabel && (
              <span style={{ 
                fontSize: '7px', 
                color: 'rgba(255, 255, 255, 0.35)', 
                letterSpacing: '0.6px', 
                fontWeight: '700',
                textTransform: 'uppercase'
              }}>
                BRANDING FOOTER
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
