import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import logolight from "../assets/logo_light.svg";
import { useIdleTimer } from '../hooks/useIdleTimer';
import IdleTimerRing from '../components/IdleTimerRing';
import axios from 'axios';
import html2canvas from 'html2canvas-pro';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  return `${window.location.protocol}//${window.location.hostname}:5000`;
};
const API_URL = getApiUrl();

const FILTER_MAP = {
  none: 'none',
  vintage: 'sepia(0.6) contrast(1.15) brightness(0.95) hue-rotate(-10deg)',
  blackwhite: 'grayscale(1) contrast(1.25) brightness(1.05)',
  warm: 'sepia(0.25) saturate(1.35) hue-rotate(5deg) contrast(1.05)',
  cool: 'saturate(1.15) hue-rotate(-15deg) brightness(1.05) contrast(1.02)',
  vivid: 'saturate(1.65) contrast(1.15) brightness(1.05)',
};

const EditReview = () => {
  const navigate = useNavigate();
  const {
    session,
    setRetakeIndex,
    setSelectedImages,
    setTaglineText,
    setOptionalLogoUrl,
    setActiveFilter,
    selectTemplate,
    resetSession,
  } = useBooth();

  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [customTagline, setCustomTagline] = useState(session.taglineText || '');
  const [selectedFrameOverlay, setSelectedFrameOverlay] = useState(session.selectedTemplate?.overlayUrl || null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const TIMEOUT = 60;
  const { secondsLeft } = useIdleTimer({
    timeoutSeconds: TIMEOUT,
    disabled: loading,
    onTimeout: () => {
      resetSession();
      navigate('/');
    },
  });

  useEffect(() => {
    if (session.selectedImages.length === 0 && session.images.length > 0) {
      setSelectedImages(session.images.slice(0, session.frames));
    }
  }, [session.images, session.frames, session.selectedImages.length]);

  const eventLogo = session.activeEvent?.branding?.logoUrl || logolight;
  const eventLogos = session.activeEvent?.logos || [];
  const assignedFrameUrls = session.activeEvent?.selectedFrameUrls || [];

  const handleRetake = (index) => {
    setRetakeIndex(index);
    navigate('/capture');
  };

  const handleSwapSlots = (index) => {
    if (selectedSlotIndex === null) {
      // Pick first slot
      setSelectedSlotIndex(index);
    } else {
      if (selectedSlotIndex !== index) {
        // Swap contents of A and B
        const nextSelected = [...session.selectedImages];
        const temp = nextSelected[selectedSlotIndex];
        nextSelected[selectedSlotIndex] = nextSelected[index];
        nextSelected[index] = temp;
        setSelectedImages(nextSelected);
      }
      setSelectedSlotIndex(null);
    }
  };

  const getProxyUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/') || !url.startsWith('http')) return url;
    const getApiUrl = () => {
      if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    };
    return `${getApiUrl()}/api/proxy/logo?url=${encodeURIComponent(url)}`;
  };

  const captureAndUploadComposite = async () => {
    const element = document.getElementById("photo-strip-capture");
    if (!element) return null;
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(element, {
        useCORS: true,
        scale: 3, // High print-ready resolution
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return null;
      
      const formData = new FormData();
      formData.append('photo', blob, `composite-${Date.now()}.png`);
      if (session?.activeEvent?._id) {
        formData.append('eventId', session.activeEvent._id);
      }
      
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      return response.data.url;
    } catch (err) {
      console.error("Failed to generate or upload composite photo strip:", err);
      return null;
    }
  };

  const handlePrintAndQR = async () => {
    setErrorMessage("");
    setLoading(true);

    try {
      // Apply selected frame overlay to the current template configuration in context first
      if (session.selectedTemplate) {
        selectTemplate({
          ...session.selectedTemplate,
          overlayUrl: selectedFrameOverlay || '',
        });
      }

      // Generate and upload composite image
      const compositeUrl = await captureAndUploadComposite();
      if (!compositeUrl) {
        throw new Error("Failed to generate photo strip image.");
      }

      // Collect individual photo URLs
      const photoUrls = (session.selectedImages || [])
        .filter(Boolean)
        .map((img) => img.url)
        .filter(Boolean);

      let qrToken = null;

      if (session.paymentId) {
        // Complete pre-shoot payment record (paid or free)
        const res = await axios.post(`${API_URL}/api/payments/complete-prepaid`, {
          paymentId: session.paymentId,
          photoUrls,
          compositeUrl,
        });
        qrToken = res.data.qrToken;
      } else {
        // Fallback: create free complete order directly
        const freeRes = await axios.post(`${API_URL}/api/payments/free-complete`, {
          amount: 0,
          printCount: session.copiesPaid || 1,
          digitalCopy: session.wantsDigitalQr,
          photoUrls,
          compositeUrl,
          eventId: session.activeEvent?._id || null,
          eventName: session.activeEvent?.name || "General",
        });
        qrToken = freeRes.data.qrToken;
      }

      // Redirect to Order Success page directly (no checkout payment slide in-between!)
      const params = new URLSearchParams();
      params.set('prints', session.copiesPaid || 1);
      params.set('amount', (session.gridPrice || 0) * (session.copiesPaid || 1));
      params.set('digital', session.wantsDigitalQr ? '1' : '0');
      if (qrToken) params.set('qrToken', qrToken);

      navigate(`/order-success?${params.toString()}`);
    } catch (err) {
      console.error("Print & QR error:", err);
      setErrorMessage(err.response?.data?.error || err.message || "Failed to process print. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-4 md:p-6 font-sans py-16">

      {/* Idle countdown ring */}
      <IdleTimerRing secondsLeft={secondsLeft} totalSeconds={TIMEOUT} />

      {/* Header */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <button
          onClick={() => navigate('/capture')}
          className="bg-gray-900 hover:bg-gray-800 border border-white/10 active:scale-95 px-6 py-2.5 rounded-full text-sm font-bold transition"
        >
          ← Retake Photo
        </button>
        <div className="text-center">
          <h1 className="text-xl md:text-3xl font-black uppercase tracking-wider text-white">Edit & Review</h1>
          <p className="text-gray-400 text-xs md:text-sm mt-1">Apply filter, frame & tagline — then proceed to print</p>
        </div>
        <div className="w-28 opacity-0">Spacer</div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-col lg:flex-row w-full max-w-6xl items-stretch gap-8 my-auto">

        {/* Left Area: Canvas Preview (White Strip) */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white p-4 md:p-5 rounded-2xl shadow-2xl border border-white/20 w-full max-w-[270px]">
            <div id="photo-strip-capture" className="relative flex flex-col gap-1.5 bg-white p-1">
              {/* Image Grid */}
              <div className={`grid ${session.orientation === 'grid' ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5`}>
                {[...Array(session.frames)].map((_, i) => {
                  const img = session.selectedImages[i];
                  const isSelected = selectedSlotIndex === i;
                  return (
                    <div
                      key={i}
                      onClick={() => handleSwapSlots(i)}
                      className={`relative bg-black aspect-[4/3] w-full border-2 overflow-hidden rounded-sm cursor-pointer transition-all ${isSelected
                          ? 'border-purple-600 scale-[1.03] shadow-[0_0_15px_rgba(168,85,247,0.5)] z-10'
                          : 'border-gray-200 hover:border-purple-400'
                        }`}
                    >
                      {img ? (
                        <>
                          <img
                            src={getProxyUrl(img.url)}
                            alt={`Slot ${i + 1}`}
                            className="w-full h-full object-cover"
                            style={{ filter: FILTER_MAP[session.activeFilter] || 'none' }}
                          />
                          {/* Swap Indicator Overlay */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-purple-600/30 flex items-center justify-center">
                              <span className="text-[10px] bg-purple-600 text-white font-black px-2 py-0.5 rounded uppercase">Swap Mode</span>
                            </div>
                          )}
                          {/* Hover Retake button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetake(i);
                            }}
                            className="absolute bottom-2 right-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-[9px] px-2 py-1 rounded font-bold uppercase transition"
                          >
                            Retake
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                          <span className="text-white/20 text-[9px] font-bold uppercase">Empty Slot {i + 1}</span>
                        </div>
                      )}
                      <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        #{i + 1}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Branding Bar */}
              <div className="bg-gray-100 py-2 w-full flex flex-col items-center justify-center px-3 mt-2 rounded-md border border-gray-200">
                {session.taglineText && (
                  <p className="text-black font-extrabold text-[9px] mb-1 tracking-wide uppercase text-center w-full overflow-hidden text-ellipsis whitespace-nowrap">
                    {session.taglineText}
                  </p>
                )}
                <div className="w-full flex items-center justify-between">
                  <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
                  <div className="flex items-center gap-1.5">
                    {session.optionalLogoUrl && (
                      <img src={getProxyUrl(session.optionalLogoUrl)} alt="" className="h-4.5 object-contain" />
                    )}
                    <img
                      src={getProxyUrl(eventLogo)}
                      alt="Event Logo"
                      className="h-4.5 object-contain"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = logolight;
                      }}
                    />
                  </div>
                </div>
              </div>
              {/* Transparent PNG Frame Overlay (renders on top of preview container) */}
              {selectedFrameOverlay && (
                <img
                  src={getProxyUrl(selectedFrameOverlay)}
                  alt="Frame Overlay"
                  className="absolute inset-0 w-full h-full pointer-events-none object-fill z-10"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Area: Customize Side Panel (Filters, Logos, Taglines) */}
        <div className="w-full lg:w-96 bg-gray-900/50 border border-white/10 p-6 rounded-3xl flex flex-col gap-6">

          {/* Section 1: Filters */}
          <div>
            <h3 className="text-xs font-bold uppercase text-purple-400 tracking-wider mb-2">1. Select Style Effect</h3>
            <div className="grid grid-cols-3 gap-2">
              {['none', 'vintage', 'blackwhite', 'warm', 'cool', 'vivid'].map(f => {
                const isActive = session.activeFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`py-2 rounded-xl text-xs font-bold uppercase transition ${isActive
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                  >
                    {f === 'blackwhite' ? 'B&W' : f}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Sponsor/Optional Logos */}
          {eventLogos.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase text-purple-400 tracking-wider mb-2">2. Add Sponsor Logo</h3>
              <div className="flex gap-3 overflow-x-auto py-2">
                {eventLogos.map((logo, idx) => {
                  const isSelected = session.optionalLogoUrl === logo;
                  return (
                    <button
                      key={idx}
                      onClick={() => setOptionalLogoUrl(isSelected ? '' : logo)}
                      className={`flex-shrink-0 p-2 rounded-xl bg-white border-2 transition ${isSelected ? 'border-purple-500 scale-105' : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                    >
                      <img src={getProxyUrl(logo)} alt="" className="h-8 object-contain" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Tagline Editor */}
          <div>
            <h3 className="text-xs font-bold uppercase text-purple-400 tracking-wider mb-2">3. Add Tagline Text</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTagline}
                onChange={(e) => {
                  setCustomTagline(e.target.value);
                  setTaglineText(e.target.value);
                }}
                maxLength={40}
                placeholder="Type tagline (e.g. Wedding 2026)"
                className="flex-1 px-4 py-2.5 bg-black border border-white/10 rounded-xl focus:outline-none focus:border-purple-500 text-sm font-medium"
              />
              {customTagline && (
                <button
                  onClick={() => {
                    setCustomTagline('');
                    setTaglineText('');
                  }}
                  className="px-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Section 4: Frame Overlay */}
          {assignedFrameUrls.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase text-purple-400 tracking-wider mb-2">4. Apply Frame Overlay</h3>
              <div className="flex gap-2 overflow-x-auto py-1">
                {/* None option */}
                <button
                  onClick={() => setSelectedFrameOverlay(null)}
                  className={`flex-shrink-0 w-14 h-14 rounded-xl border-2 flex items-center justify-center text-lg transition ${
                    selectedFrameOverlay === null ? 'border-purple-500 bg-purple-900/30' : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  🚫
                </button>
                {assignedFrameUrls.map((url, idx) => {
                  const isSelected = selectedFrameOverlay === url;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedFrameOverlay(url)}
                      className={`flex-shrink-0 w-14 h-14 rounded-xl border-2 overflow-hidden transition ${
                        isSelected ? 'border-purple-500 scale-105 shadow-[0_0_12px_rgba(168,85,247,0.5)]' : 'border-white/10 opacity-80 hover:opacity-100 hover:border-white/25'
                      }`}
                    >
                      <img src={`${import.meta.env.VITE_API_URL || ''}/api/proxy/logo?url=${encodeURIComponent(url)}`} alt={`Frame ${idx+1}`} className="w-full h-full object-contain" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-3 rounded-xl font-bold text-sm max-w-md text-center">
          {errorMessage}
        </div>
      )}

      <div className="w-full max-w-6xl flex justify-center gap-4 mt-8">
        <button
          onClick={() => {
            resetSession();
            navigate('/');
          }}
          className="px-8 py-3.5 bg-gray-900 hover:bg-gray-800 text-white border border-white/10 rounded-full font-bold uppercase tracking-widest text-sm transition"
        >
          Cancel
        </button>
        <button
          onClick={handlePrintAndQR}
          disabled={loading}
          className={`px-12 py-3.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-full font-bold uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(168,85,247,0.3)] transition ${
            loading ? 'opacity-55 cursor-wait' : 'hover:scale-[1.03]'
          }`}
        >
          {loading ? 'Processing...' : '🖨️ Print & Get QR →'}
        </button>
      </div>

      {/* Loading Modal */}
      {loading && (
        <div className="fixed inset-0 bg-black/85 flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-gray-950 border border-white/10 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center text-center gap-6 shadow-2xl">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Preparing your Print &amp; QR</h2>
              <p className="text-gray-400 text-sm">Please wait while we upload your photos and dispatch them to the printer.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EditReview;
