import { useState } from "react";
import CameraCapture from "./CameraCapture";

function Toolbar({
  setElements,
  setBgColor,
  setPhoto,
  setFrame,
  setFilter,
  setMode,
  mode,
  setName,
  setRole,
  setBg,
}) {
  const [showCamera, setShowCamera] = useState(false);

  const sectionClass = "mb-5";
  const titleClass = "text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block";

  const addText = () => {
    const text = prompt("Enter text:");
    if (!text) return;
    setElements((prev) => [
      ...prev,
      { id: Date.now(), type: "text", content: text, x: 50, y: 50, size: 20 },
    ]);
  };

  const filters = [
    { label: "Normal",   value: "none" },
    { label: "Gray",     value: "grayscale(1)" },
    { label: "Sepia",    value: "sepia(1)" },
    { label: "Bright",   value: "brightness(1.3)" },
    { label: "Contrast", value: "contrast(1.5)" },
    { label: "Warm",     value: "sepia(0.4) saturate(1.4)" },
    { label: "Cool",     value: "hue-rotate(30deg) saturate(1.2)" },
    { label: "Fade",     value: "brightness(1.1) contrast(0.85) saturate(0.8)" },
  ];

  const frames = [
    { label: "🌸 Floral",   value: "/frames/floral.png" },
    { label: "⭐ Stars",    value: "/frames/stars.png" },
    { label: "🎉 Party",    value: "/frames/party.png" },
    { label: "❌ No Frame", value: null },
  ];

  const stickers = [
    { emoji: "⭐", label: "Star" },
    { emoji: "❤️", label: "Heart" },
    { emoji: "🎉", label: "Party" },
    { emoji: "😊", label: "Smile" },
    { emoji: "🌸", label: "Flower" },
    { emoji: "🔥", label: "Fire" },
    { emoji: "✨", label: "Sparkle" },
    { emoji: "🎀", label: "Bow" },
  ];

  const addSticker = (emoji) => {
    setElements((prev) => [
      ...prev,
      { id: Date.now(), type: "sticker", content: emoji, x: 60, y: 60, size: 48 },
    ]);
  };

  return (
    <div className="flex flex-col">

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={(dataUrl) => setPhoto(dataUrl)}
          onClose={() => setShowCamera(false)}
        />
      )}

      <h2 className="text-base font-bold text-gray-800 mb-4">Customize</h2>

      {/* ── Photo ─────────────────────────────────────── */}
      <div className={sectionClass}>
        <span className={titleClass}>Photo</span>

        {/* Camera button — available in both Booth and LinkedIn modes */}
        <button
          onClick={() => setShowCamera(true)}
          className="w-full mb-2 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow"
        >
          📷 Open Camera
        </button>

        {/* File upload */}
        <label className="block w-full cursor-pointer">
          <div className="border-2 border-dashed border-gray-200 hover:border-purple-400 rounded-xl py-2.5 px-2 text-center text-sm text-gray-500 hover:text-purple-600 transition-colors">
            📂 Upload Photo
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) setPhoto(URL.createObjectURL(file));
            }}
          />
        </label>
      </div>

      {/* ── Background ───────────────────────────────── */}
      <div className={sectionClass}>
        <span className={titleClass}>Background</span>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {[
            { label: "White",   color: "#ffffff" },
            { label: "Dark",    color: "#111111" },
            { label: "Wedding", color: "#fdf2f8" },
            { label: "Slate",   color: "#1e293b" },
            { label: "Emerald", color: "#d1fae5" },
            { label: "Gold",    color: "#fef9c3" },
          ].map(({ label, color }) => (
            <button
              key={label}
              title={label}
              onClick={() => { setBgColor(color); setBg(color); }}
              className="h-8 rounded-lg border-2 border-transparent hover:border-purple-400 transition-all active:scale-90"
              style={{ backgroundColor: color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Custom:</span>
          <input
            type="color"
            className="h-8 w-14 rounded cursor-pointer border border-gray-200"
            onChange={(e) => { setBgColor(e.target.value); setBg(e.target.value); }}
          />
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────── */}
      <div className={sectionClass}>
        <span className={titleClass}>Filters</span>
        <div className="grid grid-cols-2 gap-1.5">
          {filters.map(({ label, value }) => (
            <button key={label} className="btn text-xs" onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Text ─────────────────────────────────────── */}
      <div className={sectionClass}>
        <span className={titleClass}>Text</span>
        <button className="btn w-full" onClick={addText}>
          ✏️ Add Text
        </button>
      </div>

      {/* ── Frames (Booth only) ──────────────────────── */}
      {mode === "photobooth" && (
        <div className={sectionClass}>
          <span className={titleClass}>Frames</span>
          <div className="grid grid-cols-2 gap-1.5">
            {frames.map(({ label, value }) => (
              <button key={label} className="btn text-xs" onClick={() => setFrame(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Stickers (Booth only) ────────────────────── */}
      {mode === "photobooth" && (
        <div className={sectionClass}>
          <span className={titleClass}>Stickers</span>
          <div className="grid grid-cols-4 gap-1.5">
            {stickers.map(({ emoji, label }) => (
              <button
                key={label}
                title={label}
                onClick={() => addSticker(emoji)}
                className="text-xl h-10 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-purple-50 hover:scale-110 active:scale-90 transition-all border border-gray-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── LinkedIn Details ─────────────────────────── */}
      {mode === "linkedin" && (
        <div className={sectionClass}>
          <span className={titleClass}>LinkedIn Details</span>
          <input
            type="text"
            placeholder="Your Name"
            className="input mb-2"
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Your Role / Title"
            className="input mb-3"
            onChange={(e) => setRole(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <button className="btn text-xs" onClick={() => setBg("#ffffff")}>White</button>
            <button className="btn text-xs" onClick={() => setBg("#0a66c2")}>LinkedIn Blue</button>
            <button className="btn text-xs" onClick={() => setBg("linear-gradient(135deg, #e0eafc, #cfdef3)")}>Gradient</button>
            <button className="btn text-xs" onClick={() => setBg("#111827")}>Dark</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Toolbar;