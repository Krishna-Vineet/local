import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import axios from 'axios';

const FILTER_MAP = {
  none: 'none',
  vintage: 'sepia(0.6) contrast(1.15) brightness(0.95) hue-rotate(-10deg)',
  blackwhite: 'grayscale(1) contrast(1.25) brightness(1.05)',
  warm: 'sepia(0.25) saturate(1.35) hue-rotate(5deg) contrast(1.05)',
  cool: 'saturate(1.15) hue-rotate(-15deg) brightness(1.05) contrast(1.02)',
  vivid: 'saturate(1.65) contrast(1.15) brightness(1.05)',
};

const Capture = () => {
  const navigate = useNavigate();
  const [customFrame, setCustomFrame] = useState(null);
  const { session, addImage, updateImageAt, resetImages, setRetakeIndex } = useBooth();

  const allowedFilters = session?.activeEvent?.allowedFilters || ['none'];
  const [selectedFilter, setSelectedFilter] = useState(() => {
    if (allowedFilters.includes('none')) return 'none';
    return allowedFilters[0] || 'none';
  });
  const isRetake = session.retakeIndex !== null;
  const [countdown, setCountdown] = useState(3);
  const [shotsLeft, setShotsLeft] = useState(isRetake ? 1 : session.frames);
  const [showFlash, setShowFlash] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: "user"
          }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("customFrame");
    if (saved) {
      setCustomFrame(JSON.parse(saved));
    }
  }, []);

  // Countdown Logic
  useEffect(() => {
    let timer;
    if (hasStarted && shotsLeft > 0) {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else {
        takePhoto();
      }
    }
    return () => clearTimeout(timer);
  }, [countdown, hasStarted, shotsLeft]);

  // Initial Start Countdown
  useEffect(() => {
    let startTimer;
    if (!hasStarted) {
      if (countdown > 0) {
        startTimer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else {
        setHasStarted(true);
        if (!isRetake) {
          resetImages();
        }
        setCountdown(3);
      }
    }
    return () => clearTimeout(startTimer);
  }, [countdown, hasStarted, isRetake]);

  // Draws logo onto a canvas at the specified position and returns a composited base64
  const applyLogoOverlay = (base64Data, logoUrl, position) => {
    return new Promise(async (resolve) => {
      try {
        const getApiUrl = () => {
          if (import.meta.env.VITE_API_URL) {
            return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
          }
          return `${window.location.protocol}//${window.location.hostname}:5000`;
        };
        const apiUrl = getApiUrl();
        // Use server proxy to avoid S3 CORS restrictions
        const proxyUrl = `${apiUrl}/api/proxy/logo?url=${encodeURIComponent(logoUrl)}`;
        const blobRes = await fetch(proxyUrl);
        if (!blobRes.ok) {
          throw new Error(`Proxy logo fetch failed with status ${blobRes.status}`);
        }
        const blob = await blobRes.blob();
        const blobUrl = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const logoImg = new Image();
          logoImg.onload = () => {
            // Target aspect ratio of the print slot is 4:3
            const targetAspect = 4 / 3;
            const currentAspect = canvas.width / canvas.height;

            let visibleWidth = canvas.width;
            let visibleHeight = canvas.height;
            let offsetX = 0;
            let offsetY = 0;

            if (currentAspect > targetAspect) {
              // Image is wider than 4:3 (e.g. 16:9), so sides are cropped horizontally in object-cover
              visibleWidth = canvas.height * targetAspect;
              offsetX = (canvas.width - visibleWidth) / 2;
            } else if (currentAspect < targetAspect) {
              // Image is taller than 4:3, so top/bottom are cropped vertically in object-cover
              visibleHeight = canvas.width / targetAspect;
              offsetY = (canvas.height - visibleHeight) / 2;
            }

            // Adjust PAD based on the canvas size so it looks proportional
            const PAD = Math.max(16, Math.round(visibleWidth * 0.04));
            const logoW = Math.min(160, visibleWidth * 0.25);
            const logoH = (logoImg.height / logoImg.width) * logoW;

            let x, y;
            if (position === 'top-left') {
              x = offsetX + PAD;
              y = offsetY + PAD;
            } else if (position === 'top-right') {
              x = offsetX + visibleWidth - logoW - PAD;
              y = offsetY + PAD;
            } else if (position === 'bottom-left') {
              x = offsetX + PAD;
              y = offsetY + visibleHeight - logoH - PAD;
            } else { // bottom-right
              x = offsetX + visibleWidth - logoW - PAD;
              y = offsetY + visibleHeight - logoH - PAD;
            }

            ctx.drawImage(logoImg, x, y, logoW, logoH);
            URL.revokeObjectURL(blobUrl);
            resolve(canvas.toDataURL('image/png'));
          };
          logoImg.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(base64Data); };
          logoImg.src = blobUrl;
        };
        img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(base64Data); };
        img.src = base64Data;
      } catch (err) {
        console.warn('Logo overlay failed, uploading without logo:', err);
        resolve(base64Data);
      }
    });
  };

  const uploadPhoto = async (base64Data, index, isRetake) => {
    try {
      const logoUrl = session?.activeEvent?.branding?.logoUrl;
      const logoPosition = session?.activeEvent?.branding?.logoPosition || 'bottom-right';

      // Apply logo overlay if event has one
      const finalBase64 = logoUrl
        ? await applyLogoOverlay(base64Data, logoUrl, logoPosition)
        : base64Data;

      const res = await fetch(finalBase64);
      const blob = await res.blob();

      const formData = new FormData();
      formData.append('photo', blob, `capture-${Date.now()}.png`);

      if (session?.activeEvent?._id) {
        formData.append('eventId', session.activeEvent._id);
      }

      const getApiUrl = () => {
        if (import.meta.env.VITE_API_URL) {
          return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
        }
        return `${window.location.protocol}//${window.location.hostname}:5000`;
      };
      const apiUrl = getApiUrl();
      const response = await axios.post(`${apiUrl}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const s3Url = response.data.url;
      console.log('✅ Photo uploaded to S3:', s3Url);
      updateImageAt(index, s3Url);
    } catch (error) {
      console.error('❌ Error uploading photo:', error);
    }
  };

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      // Mirror if front camera
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      // Apply CSS filter to the canvas context
      ctx.filter = FILTER_MAP[selectedFilter] || 'none';

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // const imageUrl = canvas.toDataURL('image/png');
      let imageUrl = canvas.toDataURL('image/png');

      // 🎨 APPLY CUSTOM FRAME
      if (customFrame) {
        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = canvas.width;
        frameCanvas.height = canvas.height;

        const ctx2 = frameCanvas.getContext("2d");

        // 1️⃣ Draw captured photo
        const img = new Image();
        img.src = imageUrl;

        await new Promise((res) => (img.onload = res));
        ctx2.drawImage(img, 0, 0);

        // 2️⃣ Apply background overlay
        if (customFrame.bgColor) {
          ctx2.fillStyle = customFrame.bgColor;
          ctx2.globalAlpha = 0.2;
          ctx2.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
          ctx2.globalAlpha = 1;
        }

        // 3️⃣ Draw elements (text / images)
        for (let el of customFrame.elements) {
          if (el.type === "text") {
            ctx2.font = "40px Arial";
            ctx2.fillStyle = "white";
            ctx2.fillText(el.content, el.x || 50, el.y || 50);
            // ctx2.fillText(el.content, 50, 50);
          }

          if (el.type === "image") {
            const logo = new Image();
            logo.src = el.src;
            await new Promise((res) => (logo.onload = res));
            ctx2.drawImage(logo, 50, 50, 100, 100);
          }
        }

        // final image
        imageUrl = frameCanvas.toDataURL("image/png");
      }

      let currentIndex;

      if (isRetake) {
        currentIndex = session.retakeIndex;
        updateImageAt(currentIndex, imageUrl);
        setRetakeIndex(null);
      } else {
        currentIndex = session.images.length;
        addImage(imageUrl);
      }

      // Upload to Backend (async, will update with S3 URL when done)
      uploadPhoto(imageUrl, currentIndex, isRetake);

      // Flash Effect
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 200);

      const nextShotsLeft = shotsLeft - 1;
      setShotsLeft(nextShotsLeft);

      if (nextShotsLeft > 0) {
        setCountdown(3);
      } else {
        // Stop the camera stream tracks immediately since we are done taking photos
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        // Delay slightly for visual feedback then navigate
        setTimeout(() => navigate('/edit-review'), 1000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden text-white font-sans p-4">

      {!hasStarted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50">
          <h2 className="text-2xl md:text-4xl font-bold mb-4 uppercase tracking-tighter">Shoot starts in...</h2>
          <span className="text-7xl md:text-9xl font-black text-purple-500 animate-ping">{countdown}</span>
        </div>
      )}

      {/* Main UI */}
      <div className="flex flex-col lg:flex-row w-full max-w-7xl justify-between items-center z-10 gap-10">

        {/* Top Stats (Mobile) / Left Stats (Desktop) */}
        <div className="flex lg:flex-col items-center gap-4 lg:gap-2 order-2 lg:order-1">
          <h3 className="text-sm md:text-xl font-bold text-center uppercase tracking-wider text-gray-400">Shots<br className="hidden lg:block" /> Left</h3>
          <span className="text-4xl md:text-6xl font-black bg-white text-black px-4 py-1 rounded-xl">{shotsLeft}</span>
        </div>

        {/* Video Preview with Film Strip */}
        <div className="relative group w-full max-w-4xl order-1 lg:order-2">
          {/* Film Strip Top */}
          <div className="bg-white p-1.5 md:p-2 rounded-t-xl flex justify-around items-center overflow-hidden">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="min-w-[20px] md:w-8 h-4 md:h-8 bg-black rounded-sm md:rounded-lg mx-0.5"></div>
            ))}
          </div>

          {/* Video Container */}
          <div className="relative border-x-[10px] md:border-x-[20px] border-white overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video object-cover scale-x-[-1]"
              style={{ filter: FILTER_MAP[selectedFilter] || 'none' }}
            />

            {/* Flash Overlay */}
            {showFlash && (
              <div className="absolute inset-0 bg-white z-20 transition-opacity"></div>
            )}

            {/* Countdown Overlay (during sequence) */}
            {hasStarted && shotsLeft > 0 && countdown > 0 && (
              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                <span className="text-2xl font-bold">READY: {countdown}</span>
              </div>
            )}
          </div>

          {/* Film Strip Bottom */}
          <div className="bg-white p-1.5 md:p-2 rounded-b-xl flex justify-around items-center overflow-hidden">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="min-w-[20px] md:w-8 h-4 md:h-8 bg-black rounded-sm md:rounded-lg mx-0.5"></div>
            ))}
          </div>

          {/* Filter Selector */}
          {allowedFilters.length > 1 && (
            <div className="mt-6 flex flex-col items-center">
              <span className="text-xs uppercase tracking-wider text-gray-400 mb-2 font-semibold">Select Filter</span>
              <div className="flex gap-3 overflow-x-auto py-2 px-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 max-w-full">
                {allowedFilters.map((filter) => {
                  const isActive = selectedFilter === filter;
                  return (
                    <button
                      key={filter}
                      onClick={() => setSelectedFilter(filter)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${isActive
                          ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 scale-105'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                      {filter === 'blackwhite' ? 'B&W' : filter}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Stats (Mobile) / Right Stats (Desktop) */}
        <div className="flex lg:flex-col items-center gap-4 lg:gap-2 order-3">
          <h3 className="text-sm md:text-xl font-bold text-center uppercase tracking-wider text-gray-400">Timer</h3>
          <span className="text-4xl md:text-6xl font-black text-purple-400">{countdown}</span>
        </div>

      </div>

      {/* Hidden Canvas for Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Background Subtle Elements */}
      <div className="absolute top-10 left-10 opacity-20">
        <div className="w-20 h-20 border-t-2 border-l-2 border-white"></div>
      </div>
      <div className="absolute bottom-10 right-10 opacity-20">
        <div className="w-20 h-20 border-b-2 border-r-2 border-white"></div>
      </div>

    </div>
  );
};

export default Capture;
