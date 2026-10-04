import { useState, useRef, useEffect, useCallback } from "react";

/**
 * CameraCapture Modal
 * Props:
 *   onCapture(dataUrl) — called when user confirms the photo
 *   onClose()          — called when user dismisses the modal
 */
function CameraCapture({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [phase, setPhase] = useState("camera"); // "camera" | "preview"
    const [capturedUrl, setCapturedUrl] = useState(null);
    const [facingMode, setFacingMode] = useState("user"); // "user" | "environment"
    const [countdown, setCountdown] = useState(null); // null | 3 | 2 | 1 | 0
    const [error, setError] = useState("");
    const [cameraReady, setCameraReady] = useState(false);

    /* ── Start / restart camera stream ────────────────────── */
    const startCamera = useCallback(async (mode) => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
        }
        setError("");
        setCameraReady(false);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: mode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera error:", err);
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setError("Camera permission denied. Please allow camera access in your browser settings and try again.");
            } else if (err.name === "NotFoundError") {
                setError("No camera found on this device.");
            } else {
                setError("Could not access camera. Make sure no other app is using it.");
            }
        }
    }, []);

    /* ── On mount: open camera ────────────────────────────── */
    useEffect(() => {
        startCamera("user");
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, [startCamera]);

    /* ── Countdown tick ───────────────────────────────────── */
    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) {
            setCountdown(null);
            snap();
            return;
        }
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdown]);

    /* ── Flip between front / back camera ────────────────── */
    const flipCamera = () => {
        const next = facingMode === "user" ? "environment" : "user";
        setFacingMode(next);
        startCamera(next);
    };

    /* ── Capture frame from live video ───────────────────── */
    const snap = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const w = video.videoWidth || 1280;
        const h = video.videoHeight || 720;
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d");

        // Mirror horizontally for front-facing selfie
        if (facingMode === "user") {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, w, h);

        const dataUrl = canvas.toDataURL("image/png");
        setCapturedUrl(dataUrl);
        setPhase("preview");

        // Release camera
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
        }
    };

    /* ── Retake: restart camera ───────────────────────────── */
    const retake = () => {
        setCapturedUrl(null);
        setPhase("camera");
        startCamera(facingMode);
    };

    /* ── Confirm captured photo ───────────────────────────── */
    const usePhoto = () => {
        if (capturedUrl) {
            onCapture(capturedUrl);
        }
        onClose();
    };

    /* ── Close and stop stream ────────────────────────────── */
    const handleClose = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
        }
        onClose();
    };

    return (
        /* Backdrop */
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
            <div className="relative bg-gray-950 rounded-3xl overflow-hidden w-full max-w-lg shadow-2xl border border-white/10 flex flex-col">

                {/* ── Header ─────────────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 flex-shrink-0">
                    <h2 className="text-white font-bold text-sm tracking-wide">
                        {phase === "camera" ? "📷 Camera" : "🖼 Preview"}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Video / Preview Area ────────────────────────── */}
                <div className="relative bg-black w-full" style={{ aspectRatio: "4 / 3" }}>

                    {/* Camera phase */}
                    {phase === "camera" && (
                        <>
                            {error ? (
                                /* Error state */
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
                                    <span className="text-5xl">🚫</span>
                                    <p className="text-red-400 text-sm font-medium leading-relaxed">{error}</p>
                                    <button
                                        onClick={() => startCamera(facingMode)}
                                        className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white px-5 py-2 rounded-xl text-sm font-bold transition"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Live video */}
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        onCanPlay={() => setCameraReady(true)}
                                        className="w-full h-full object-cover"
                                        style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
                                    />

                                    {/* Loading spinner */}
                                    {!cameraReady && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}

                                    {/* Viewfinder corners */}
                                    <div className="absolute inset-5 pointer-events-none">
                                        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/70 rounded-tl-lg" />
                                        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/70 rounded-tr-lg" />
                                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/70 rounded-bl-lg" />
                                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/70 rounded-br-lg" />
                                    </div>

                                    {/* Countdown overlay */}
                                    {countdown !== null && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                            <span
                                                key={countdown}
                                                className="text-8xl sm:text-9xl font-black text-white drop-shadow-xl"
                                                style={{ animation: "countPop 0.9s ease-out forwards" }}
                                            >
                                                {countdown}
                                            </span>
                                        </div>
                                    )}

                                    {/* Flip camera button */}
                                    <button
                                        onClick={flipCamera}
                                        title="Flip Camera"
                                        className="absolute top-3 right-3 w-9 h-9 bg-black/50 hover:bg-black/70 active:scale-90 text-white rounded-full flex items-center justify-center text-base transition"
                                    >
                                        🔄
                                    </button>

                                    {/* Facing mode badge */}
                                    <div className="absolute top-3 left-3 bg-black/50 text-white/70 text-xs px-2 py-1 rounded-full">
                                        {facingMode === "user" ? "Front" : "Back"}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Preview phase */}
                    {phase === "preview" && capturedUrl && (
                        <>
                            <img
                                src={capturedUrl}
                                alt="Captured photo"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-3 left-3 bg-green-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">
                                ✓ Captured
                            </div>
                        </>
                    )}
                </div>

                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} className="hidden" />

                {/* ── Footer actions ──────────────────────────────── */}
                <div className="px-5 py-4 border-t border-white/10 flex items-center justify-center gap-3 flex-shrink-0">

                    {phase === "camera" ? (
                        <>
                            {/* Timer button */}
                            <button
                                onClick={() => setCountdown(3)}
                                disabled={!cameraReady || !!error || countdown !== null}
                                title="3-second timer"
                                className="w-11 h-11 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 text-white rounded-full flex items-center justify-center text-lg transition"
                            >
                                ⏱
                            </button>

                            {/* Shutter button */}
                            <button
                                onClick={snap}
                                disabled={!cameraReady || !!error || countdown !== null}
                                title="Take Photo"
                                className="w-16 h-16 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 rounded-full flex items-center justify-center shadow-2xl transition-all border-4 border-gray-300"
                            >
                                <div className="w-11 h-11 bg-gray-900 rounded-full" />
                            </button>

                            {/* Spacer for symmetry */}
                            <div className="w-11 h-11" />
                        </>
                    ) : (
                        <>
                            {/* Retake */}
                            <button
                                onClick={retake}
                                className="flex-1 py-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl font-bold text-sm transition"
                            >
                                ↩ Retake
                            </button>

                            {/* Use Photo */}
                            <button
                                onClick={usePhoto}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl font-bold text-sm shadow-lg transition"
                            >
                                ✓ Use Photo
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Countdown animation */}
            <style>{`
        @keyframes countPop {
          0%   { transform: scale(1.4); opacity: 1; }
          80%  { transform: scale(1);   opacity: 1; }
          100% { transform: scale(0.8); opacity: 0; }
        }
      `}</style>
        </div>
    );
}

export default CameraCapture;