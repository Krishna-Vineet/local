import React, { useState } from 'react';
import logolight from '../assets/logo_light.svg';
import { useNavigate } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import { useIdleTimer } from '../hooks/useIdleTimer';
import IdleTimerRing from '../components/IdleTimerRing';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const getProxiedUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `${API_BASE}/api/proxy/logo?url=${encodeURIComponent(url)}`;
};

// ─── Step dot ─────────────────────────────────────────────────────
const StepDot = ({ num, active, done, label }) => (
  <div className="flex flex-col items-center gap-0.5">
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
      ${done ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
        : active ? 'border-purple-600 text-purple-600 bg-purple-50'
          : 'border-gray-300 text-gray-400 bg-white'}`}>
      {done ? '✓' : num}
    </div>
    <span className={`text-[9px] font-bold text-center leading-tight max-w-[50px]
      ${active ? 'text-purple-600 font-extrabold' : done ? 'text-purple-400' : 'text-gray-400'}`}>
      {label}
    </span>
  </div>
);
const StepLine = ({ done }) => (
  <div className={`flex-1 h-0.5 mb-3 mx-0.5 transition-all ${done ? 'bg-purple-500' : 'bg-gray-200'}`} />
);

// ─── Template preview ─────────────────────────────────────────────
const TemplatePreview = ({ tmpl, logo }) => {
  // If this is a dynamic template from CRM
  if (tmpl.canvas && tmpl.photoSlots) {
    const cW = tmpl.canvas.width || 1200;
    const cH = tmpl.canvas.height || 1800;
    let bgImageUrl = null;
    if (tmpl.background?.assetId) {
      if (tmpl.background.assetId.startsWith('http')) {
        bgImageUrl = tmpl.background.assetId;
      } else {
        bgImageUrl = `https://happypix-bucket.s3.us-east-1.amazonaws.com/${tmpl.background.assetId}`;
      }
    }

    return (
      <svg
        viewBox={`0 0 ${cW} ${cH}`}
        className="w-full max-h-full block rounded-sm shadow-sm"
        style={{ background: tmpl.background?.color || '#ffffff' }}
      >
        {bgImageUrl && (
          <image href={bgImageUrl} x="0" y="0" width={cW} height={cH} preserveAspectRatio="xMidYMid slice" />
        )}
        {(tmpl.photoSlots || []).map((slot, i) => (
          <rect
            key={i}
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            fill="#e2e8f0"
            stroke="#94a3b8"
            strokeWidth={Math.max(cW * 0.005, 2)}
          />
        ))}
      </svg>
    );
  }

  // Fallback for hardcoded templates
  const { orientation, frames } = tmpl;
  if (orientation === 'vertical') return (
    <div className="flex flex-col gap-1 items-center w-full">
      {[...Array(frames || 1)].map((_, i) => <div key={i} className="bg-gray-800 h-6 w-full rounded-sm" />)}
      <div className="bg-gray-200 h-2.5 w-full flex items-center justify-between px-1 mt-0.5 rounded-sm">
        <div className="w-1 h-1 bg-gray-400 rounded-full" />
        <img className="h-1.5 object-contain" src={logo} alt="" onError={e => { e.currentTarget.src = logolight; }} />
      </div>
    </div>
  );
  if (orientation === 'horizontal') return (
    <div className="flex flex-row gap-1 items-stretch h-full">
      {[...Array(frames || 1)].map((_, i) => <div key={i} className="bg-gray-800 flex-1 min-h-[30px] rounded-sm" />)}
      <div className="bg-gray-200 w-2.5 flex flex-col items-center justify-between py-1 ml-0.5 rounded-sm">
        <div className="w-1 h-1 bg-gray-400 rounded-full" />
        <img className="h-1.5 object-contain rotate-90" src={logo} alt="" onError={e => { e.currentTarget.src = logolight; }} />
      </div>
    </div>
  );
  const cols = (frames || 1) <= 4 ? 2 : 3;
  return (
    <div className="w-full">
      <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {[...Array(frames || 1)].map((_, i) => <div key={i} className="bg-gray-800 aspect-square rounded-sm" />)}
      </div>
      <div className="bg-gray-200 h-2.5 w-full flex items-center justify-between px-1 rounded-sm">
        <div className="w-1 h-1 bg-gray-400 rounded-full" />
        <img className="h-1.5 object-contain" src={logo} alt="" onError={e => { e.currentTarget.src = logolight; }} />
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────
const FrameSelection = () => {
  const navigate = useNavigate();
  const { selectTemplate, session, resetSession, setOutputPreferences } = useBooth();

  const TIMEOUT = 60;
  const { secondsLeft } = useIdleTimer({
    timeoutSeconds: TIMEOUT,
    onTimeout: () => { resetSession(); navigate('/'); },
  });

  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedOverlayUrl, setSelectedOverlayUrl] = useState(null);

  // ── Event data ─────────────────────────────────────────────────
  const eventLogo = session.activeEvent?.branding?.logoUrl
    ? getProxiedUrl(session.activeEvent.branding.logoUrl)
    : logolight;

  const allowedTemplates = session.activeEvent?.allowedTemplates || [];
  const templatesToRender = allowedTemplates.length > 0 ? allowedTemplates : [
    { id: 'vertical-1', label: '1 Slot', frames: 1, orientation: 'vertical', price: null },
    { id: 'vertical-2', label: '2 Slot', frames: 2, orientation: 'vertical', price: null },
    { id: 'grid-2x2', label: '4 Slot Grid', frames: 4, orientation: 'grid', price: null },
    { id: 'grid-2x3-v', label: '6 Slot (V)', frames: 6, orientation: 'grid', price: null },
    { id: 'grid-3x2-h', label: '6 Slot (H)', frames: 6, orientation: 'grid', price: null },
  ];

  // Match template to selected grid from CopiesPayment
  const gridFrames = session.gridKey === 'cut1' ? 1
    : session.gridKey === 'cut2' ? 2
      : session.gridKey === 'cut4' ? 4
        : 6;
  const gridOrientation = session.gridKey === 'cut6Horizontal' ? 'grid' : (session.gridKey === 'cut1' || session.gridKey === 'cut2') ? 'vertical' : 'grid';

  // Overlay frames from the event
  const assignedFrameUrls = session.activeEvent?.selectedFrameUrls || [];

  // ── Navigation ─────────────────────────────────────────────────
  const goBack = () => {
    if (step === 1) navigate(session.gridPrice > 0 ? '/copies-payment' : '/booth');
    else setStep(s => s - 1);
  };

  const goNext = () => {
    if (step === 1) {
      if (!selectedTemplate) return;
      setStep(2);
    }
  };

  const handleStartShooting = () => {
    if (!selectedTemplate) return;
    selectTemplate({
      ...selectedTemplate,
      overlayUrl: selectedOverlayUrl || selectedTemplate.overlayUrl || '',
    });
    navigate('/capture');
  };

  const steps = [
    { num: 1, label: 'Template' },
    { num: 2, label: 'Frame Overlay' },
  ];

  return (
    // Full screen, strict no scroll
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-50 select-none text-gray-800">

      {/* Idle ring */}
      <IdleTimerRing secondsLeft={secondsLeft} totalSeconds={TIMEOUT} />

      {/* ── TOP BAR (compact) ── */}
      <div className="flex items-center px-4 py-2 bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <button
          onClick={goBack}
          className="bg-purple-100 hover:bg-purple-200 active:scale-95 px-3 py-1 rounded-full text-xs font-bold transition text-purple-700 flex-shrink-0"
        >
          ← Back
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-0 flex-1 mx-4 max-w-xs mx-auto">
          {steps.map((s, i) => (
            <React.Fragment key={s.num}>
              <StepDot num={s.num} label={s.label} active={step === s.num} done={step > s.num} />
              {i < steps.length - 1 && <StepLine done={step > s.num} />}
            </React.Fragment>
          ))}
        </div>

        <div className="w-16 flex-shrink-0" />
      </div>

      {/* ── CONTENT AREA (flex box with strict size limitations) ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

        {/* ══════════ STEP 1: TEMPLATE ══════════ */}
        {step === 1 && (
          <div className="flex-1 flex flex-col overflow-hidden px-4 py-3 min-h-0">
            <div className="text-center mb-2 flex-shrink-0">
              <h1 className="text-base font-extrabold text-gray-800 leading-tight">Select Your Template</h1>
              <p className="text-[11px] text-gray-400">Choose a layout for your photobooth print</p>
            </div>

            {/* Template row */}
            <div className="flex-1 flex flex-row gap-3 min-h-0 items-stretch justify-center">
              {templatesToRender.map((tmpl) => {
                const isSelected = selectedTemplate?.id === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={`flex-1 max-w-[240px] flex flex-col items-center cursor-pointer rounded-xl p-2 border-2 transition-all duration-200 min-h-0
                      ${isSelected
                        ? 'border-purple-500 bg-purple-50 shadow-md shadow-purple-100'
                        : 'border-gray-200 bg-white hover:border-purple-300'}`}
                  >
                    <p className="font-extrabold text-gray-800 text-xs text-center leading-tight">{tmpl.label}</p>
                    <p className="text-[9px] text-gray-400 mb-1">{tmpl.description || `${tmpl.frames} Slots`}</p>

                    {/* Preview box */}
                    <div className={`flex-1 w-full flex items-center justify-center p-2 rounded-lg min-h-0 overflow-hidden
                      ${isSelected ? 'bg-white shadow-inner' : 'bg-gray-50'}`}>
                      <div className="w-full max-h-full scale-90 sm:scale-100 flex justify-center">
                        <div className="w-16 h-full flex items-center justify-center">
                          <TemplatePreview tmpl={tmpl} logo={eventLogo} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1 flex-shrink-0">
                      {isSelected && <span className="text-[9px] bg-purple-600 text-white w-3 h-3 flex items-center justify-center rounded-full font-bold">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Next CTA */}
            <div className="flex justify-center py-2 flex-shrink-0">
              <button
                onClick={goNext}
                disabled={!selectedTemplate}
                className="px-8 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-100"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ══════════ STEP 2: OVERLAY FRAME ══════════ */}
        {step === 2 && (
          <div className="flex-1 flex flex-col overflow-hidden px-4 py-3 min-h-0">
            <div className="text-center mb-2 flex-shrink-0">
              <h1 className="text-base font-extrabold text-gray-800 leading-tight">Select Frame Overlay</h1>
              <p className="text-[11px] text-gray-400">Choose a decorative frame for your photo strip</p>
            </div>

            {/* Frame options or empty state */}
            <div className="flex-1 flex flex-col min-h-0 justify-center">
              {assignedFrameUrls.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center max-w-sm mx-auto shadow-sm flex-shrink-0">
                  <div className="text-3xl mb-2">🖼️</div>
                  <h3 className="font-bold text-sm text-gray-700 mb-1">No Custom Frames Assigned</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    The administrator has not linked any decorative PNG frames to this event yet.
                  </p>
                  <span className="text-xs bg-purple-100 text-purple-700 font-bold px-3 py-1.5 rounded-full">
                    No Overlay Frame will be applied
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 min-h-0 overflow-y-auto content-start py-1">
                  {/* None Option */}
                  <div
                    onClick={() => setSelectedOverlayUrl(null)}
                    className={`flex flex-col items-center cursor-pointer rounded-xl border-2 p-1.5 transition-all duration-200
                      ${selectedOverlayUrl === null
                        ? 'border-purple-500 bg-purple-50 shadow-md shadow-purple-100'
                        : 'border-gray-200 bg-white hover:border-purple-200'}`}
                  >
                    <div className="w-full h-24 sm:h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🚫</span>
                    </div>
                    <span className={`text-[9px] font-bold mt-1 text-center ${selectedOverlayUrl === null ? 'text-purple-600' : 'text-gray-500'}`}>
                      None {selectedOverlayUrl === null && '✓'}
                    </span>
                  </div>

                  {/* Dynamic frames */}
                  {assignedFrameUrls.map((url, idx) => {
                    const isSelected = selectedOverlayUrl === url;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedOverlayUrl(url)}
                        className={`flex flex-col items-center cursor-pointer rounded-xl border-2 p-1.5 transition-all duration-200
                          ${isSelected
                            ? 'border-purple-500 bg-purple-50 shadow-md shadow-purple-100'
                            : 'border-gray-200 bg-white hover:border-purple-200'}`}
                      >
                        <div
                          className="w-full h-24 sm:h-32 rounded-lg overflow-hidden relative flex items-center justify-center"
                          style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 0 0 / 8px 8px' }}
                        >
                          <img
                            src={getProxiedUrl(url)}
                            alt={`Frame ${idx + 1}`}
                            className="w-full h-full object-contain"
                            onError={e => { e.currentTarget.style.opacity = '0.3'; }}
                          />
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-white text-[8px] font-black shadow">✓</div>
                          )}
                        </div>
                        <span className={`text-[9px] font-bold mt-1 text-center ${isSelected ? 'text-purple-600' : 'text-gray-500'}`}>
                          Frame {idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2 — Start shooting CTA */}
            <div className="flex justify-center py-2 flex-shrink-0">
              <button
                onClick={handleStartShooting}
                className="px-8 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white font-extrabold rounded-xl text-sm transition-all shadow-md shadow-purple-100 flex items-center gap-2"
              >
                📸 Start Shooting
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default FrameSelection;