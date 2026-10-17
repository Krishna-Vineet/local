import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Modal } from './ui.jsx';
import { Icon } from '../lib/icons.jsx';
import { removeBackgroundCanvas } from '../utils/removeBackground.js';

/**
 * Precision Cutout & Crop Studio Modal.
 * Allows isolating specific characters, graphics, borders, and regions from an uploaded image.
 * Features:
 * - Interactive Box Crop
 * - Precision Eraser Brush (destination-out)
 * - Restore Brush (paint original pixels back)
 * - Magic Color Eraser (click-to-erase with tolerance)
 * - Auto Smart Background Removal
 * - Zoom & Pan (50% to 300%)
 * - Full Undo / Redo history
 * - Save as New Overlay OR Update Current Overlay
 */
export default function CutoutStudioModal({
  isOpen,
  onClose,
  imageSrc,
  onApplyCutout
}) {
  const [activeTool, setActiveTool] = useState('crop'); // 'crop' | 'eraser' | 'restore' | 'magic'
  const [brushSize, setBrushSize] = useState(24);
  const [tolerance, setTolerance] = useState(38);
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Crop rectangle state (in image pixel coordinates)
  const [cropRect, setCropRect] = useState(null); // { x, y, w, h }
  const [isCropDragging, setIsCropDragging] = useState(false);
  const [cropDragMode, setCropDragMode] = useState(null); // 'move' | 'nw' | 'ne' | 'se' | 'sw'

  const canvasRef = useRef(null);
  const originalImgRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isPaintingRef = useRef(false);
  const lastPointRef = useRef(null);

  // Load image onto canvas when modal opens
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      originalImgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Default crop box covers 70% centered
      const cw = canvas.width;
      const ch = canvas.height;
      setCropRect({
        x: Math.round(cw * 0.1),
        y: Math.round(ch * 0.1),
        w: Math.round(cw * 0.8),
        h: Math.round(ch * 0.8)
      });

      // Initialize history
      const initialData = ctx.getImageData(0, 0, cw, ch);
      historyRef.current = [initialData];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      setZoom(1);
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Truncate redo stack
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(currentData);
    if (historyRef.current.length > 25) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    historyIndexRef.current--;
    const ctx = canvas.getContext('2d');
    const prevData = historyRef.current[historyIndexRef.current];
    canvas.width = prevData.width;
    canvas.height = prevData.height;
    ctx.putImageData(prevData, 0, 0);

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    historyIndexRef.current++;
    const ctx = canvas.getContext('2d');
    const nextData = historyRef.current[historyIndexRef.current];
    canvas.width = nextData.width;
    canvas.height = nextData.height;
    ctx.putImageData(nextData, 0, 0);

    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const handleReset = () => {
    if (!originalImgRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const img = originalImgRef.current;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    saveToHistory();
    setCropRect({
      x: Math.round(canvas.width * 0.1),
      y: Math.round(canvas.height * 0.1),
      w: Math.round(canvas.width * 0.8),
      h: Math.round(canvas.height * 0.8)
    });
  };

  // --- Tool: Crop to Selection ---
  const applyCrop = () => {
    if (!cropRect || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clamp crop rect to canvas bounds
    const rx = Math.max(0, Math.min(canvas.width, Math.round(cropRect.x)));
    const ry = Math.max(0, Math.min(canvas.height, Math.round(cropRect.y)));
    const rw = Math.max(10, Math.min(canvas.width - rx, Math.round(cropRect.w)));
    const rh = Math.max(10, Math.min(canvas.height - ry, Math.round(cropRect.h)));

    const croppedData = ctx.getImageData(rx, ry, rw, rh);
    canvas.width = rw;
    canvas.height = rh;
    ctx.putImageData(croppedData, 0, 0);

    setCropRect({
      x: Math.round(rw * 0.05),
      y: Math.round(rh * 0.05),
      w: Math.round(rw * 0.9),
      h: Math.round(rh * 0.9)
    });
    saveToHistory();
  };

  // --- Tool: Auto Smart Background Removal ---
  const handleAutoRemoveBg = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    try {
      const currentUrl = canvasRef.current.toDataURL('image/png');
      const transparentUrl = await removeBackgroundCanvas(currentUrl, { tolerance });
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        saveToHistory();
        setIsProcessing(false);
      };
      img.src = transparentUrl;
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  // --- Tool: Magic Wand Click to Erase Color ---
  const handleMagicWandClick = (cx, cy) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const w = canvas.width;
    const h = canvas.height;

    const startIdx = (cy * w + cx) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const targetA = data[startIdx + 3];

    if (targetA === 0) return; // already transparent

    // Flood fill from clicked pixel
    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let qHead = 0;
    let qTail = 0;

    const startPixel = cy * w + cx;
    visited[startPixel] = 1;
    queue[qTail++] = startPixel;

    function dist(idx) {
      const dr = data[idx] - targetR;
      const dg = data[idx + 1] - targetG;
      const db = data[idx + 2] - targetB;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    while (qHead < qTail) {
      const curr = queue[qHead++];
      const x = curr % w;
      const y = Math.floor(curr / w);
      const byteIdx = curr * 4;

      const d = dist(byteIdx);
      if (d <= tolerance) {
        data[byteIdx + 3] = 0; // erase

        if (x > 0) {
          const n = curr - 1;
          if (!visited[n] && dist(n * 4) <= tolerance) {
            visited[n] = 1; queue[qTail++] = n;
          }
        }
        if (x < w - 1) {
          const n = curr + 1;
          if (!visited[n] && dist(n * 4) <= tolerance) {
            visited[n] = 1; queue[qTail++] = n;
          }
        }
        if (y > 0) {
          const n = curr - w;
          if (!visited[n] && dist(n * 4) <= tolerance) {
            visited[n] = 1; queue[qTail++] = n;
          }
        }
        if (y < h - 1) {
          const n = curr + w;
          if (!visited[n] && dist(n * 4) <= tolerance) {
            visited[n] = 1; queue[qTail++] = n;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    saveToHistory();
  };

  // Convert client mouse coordinates to canvas image pixel coordinates
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    };
  };

  // --- Painting / Erasing handlers ---
  const startPaint = (e) => {
    const { x, y } = getCanvasCoords(e);
    if (activeTool === 'magic') {
      handleMagicWandClick(x, y);
      return;
    }
    if (activeTool === 'eraser' || activeTool === 'restore') {
      isPaintingRef.current = true;
      lastPointRef.current = { x, y };
      paintStroke(x, y);
    }
  };

  const paintStroke = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;

    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      if (lastPointRef.current) {
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      } else {
        ctx.moveTo(x, y);
      }
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (activeTool === 'restore' && originalImgRef.current) {
      // Paint original pixels back using pattern or clipping
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.drawImage(originalImgRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    ctx.restore();
    lastPointRef.current = { x, y };
  };

  const onMouseMove = (e) => {
    if (!isPaintingRef.current) return;
    const { x, y } = getCanvasCoords(e);
    paintStroke(x, y);
  };

  const stopPaint = () => {
    if (isPaintingRef.current) {
      isPaintingRef.current = false;
      lastPointRef.current = null;
      saveToHistory();
    }
  };

  // Final apply handler
  const handleSave = (asNew) => {
    if (!canvasRef.current) return;
    const resultUrl = canvasRef.current.toDataURL('image/png');
    onApplyCutout(resultUrl, asNew);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', color: '#fff'
    }}>
      {/* Top Header */}
      <div style={{
        padding: '12px 20px', background: 'var(--surface-1, #1e1e24)',
        borderBottom: '1px solid var(--line, #333)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: 'var(--hp-pink, #EA097F)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}>
            <Icon name="sparkles" size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Precision Cutout &amp; Crop Studio</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>
              Crop specific elements, erase unwanted areas, and isolate characters or borders with pixel accuracy.
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: 8 }}
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      {/* Toolbar */}
      <div style={{
        padding: '10px 20px', background: 'var(--surface-2, #18181d)',
        borderBottom: '1px solid var(--line, #333)',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0
      }}>
        {/* Tool selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTool('crop')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
              background: activeTool === 'crop' ? 'var(--hp-pink, #EA097F)' : 'var(--surface-1, #25252c)',
              color: '#fff', border: '1px solid ' + (activeTool === 'crop' ? 'var(--hp-pink, #EA097F)' : '#444'),
              fontWeight: 600, fontSize: 12, cursor: 'pointer'
            }}
          >
            🔲 Box Crop
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('eraser')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
              background: activeTool === 'eraser' ? 'var(--hp-pink, #EA097F)' : 'var(--surface-1, #25252c)',
              color: '#fff', border: '1px solid ' + (activeTool === 'eraser' ? 'var(--hp-pink, #EA097F)' : '#444'),
              fontWeight: 600, fontSize: 12, cursor: 'pointer'
            }}
          >
            🧹 Eraser Brush
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('restore')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
              background: activeTool === 'restore' ? 'var(--hp-pink, #EA097F)' : 'var(--surface-1, #25252c)',
              color: '#fff', border: '1px solid ' + (activeTool === 'restore' ? 'var(--hp-pink, #EA097F)' : '#444'),
              fontWeight: 600, fontSize: 12, cursor: 'pointer'
            }}
          >
            🖌️ Restore Brush
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('magic')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
              background: activeTool === 'magic' ? 'var(--hp-pink, #EA097F)' : 'var(--surface-1, #25252c)',
              color: '#fff', border: '1px solid ' + (activeTool === 'magic' ? 'var(--hp-pink, #EA097F)' : '#444'),
              fontWeight: 600, fontSize: 12, cursor: 'pointer'
            }}
          >
            🪄 Click to Erase Color
          </button>
        </div>

        {/* Dynamic Tool Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {activeTool === 'crop' && (
            <button
              type="button"
              onClick={applyCrop}
              style={{
                background: '#00c896', color: '#fff', border: 'none',
                padding: '6px 14px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              ✂️ Apply Crop to Box
            </button>
          )}

          {(activeTool === 'eraser' || activeTool === 'restore') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>Brush Size:</span>
              <input
                type="range" min="3" max="80" value={brushSize}
                onChange={e => setBrushSize(Number(e.target.value))}
                style={{ width: 90 }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, minWidth: 28 }}>{brushSize}px</span>
            </div>
          )}

          {activeTool === 'magic' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>Tolerance:</span>
              <input
                type="range" min="5" max="90" value={tolerance}
                onChange={e => setTolerance(Number(e.target.value))}
                style={{ width: 80 }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, minWidth: 24 }}>{tolerance}</span>
            </div>
          )}

          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#25252c', padding: 3, borderRadius: 6 }}>
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.2).toFixed(1))))}
              style={{ background: 'none', border: 'none', color: '#fff', padding: '2px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              -
            </button>
            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 42, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(3, Number((z + 0.2).toFixed(1))))}
              style={{ background: 'none', border: 'none', color: '#fff', padding: '2px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              style={{ background: 'none', border: 'none', color: '#888', padding: '2px 6px', cursor: 'pointer', fontSize: 11 }}
            >
              100%
            </button>
          </div>

          {/* History undo/redo/reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              disabled={!canUndo}
              onClick={handleUndo}
              style={{
                background: '#25252c', border: '1px solid #444', color: canUndo ? '#fff' : '#666',
                padding: '4px 8px', borderRadius: 4, cursor: canUndo ? 'pointer' : 'default', fontSize: 11
              }}
            >
              ↩ Undo
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={handleRedo}
              style={{
                background: '#25252c', border: '1px solid #444', color: canRedo ? '#fff' : '#666',
                padding: '4px 8px', borderRadius: 4, cursor: canRedo ? 'pointer' : 'default', fontSize: 11
              }}
            >
              ↪ Redo
            </button>
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: '#25252c', border: '1px solid #444', color: '#ff7777',
                padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Workspace */}
      <div style={{
        flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 30, position: 'relative',
        background: '#121216',
        backgroundImage: 'radial-gradient(circle, #252530 10%, transparent 11%)',
        backgroundSize: '24px 24px'
      }}>
        {/* Transparent Checkerboard wrapper */}
        <div style={{
          position: 'relative',
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          transition: 'transform 0.1s ease-out',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 16px 16px',
          border: '1px solid #444'
        }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startPaint}
            onMouseMove={onMouseMove}
            onMouseUp={stopPaint}
            onMouseLeave={stopPaint}
            style={{
              display: 'block',
              cursor: activeTool === 'crop'
                ? 'crosshair'
                : activeTool === 'eraser'
                ? 'cell'
                : activeTool === 'magic'
                ? 'crosshair'
                : 'default',
              userSelect: 'none'
            }}
          />

          {/* Interactive Crop Box Overlay */}
          {activeTool === 'crop' && cropRect && canvasRef.current && (
            <div
              style={{
                position: 'absolute',
                left: `${(cropRect.x / canvasRef.current.width) * 100}%`,
                top: `${(cropRect.y / canvasRef.current.height) * 100}%`,
                width: `${(cropRect.w / canvasRef.current.width) * 100}%`,
                height: `${(cropRect.h / canvasRef.current.height) * 100}%`,
                border: '2px dashed #00ffd5',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                pointerEvents: 'auto',
                boxSizing: 'border-box'
              }}
              onMouseDown={(e) => {
                if (e.target.dataset.resizer) return;
                e.preventDefault();
                setIsCropDragging(true);
                setCropDragMode('move');
                const startClientX = e.clientX;
                const startClientY = e.clientY;
                const startX = cropRect.x;
                const startY = cropRect.y;

                const onMove = (ev) => {
                  const dx = (ev.clientX - startClientX) / zoom;
                  const dy = (ev.clientY - startClientY) / zoom;
                  setCropRect(r => ({
                    ...r,
                    x: Math.max(0, Math.min(canvasRef.current.width - r.w, Math.round(startX + dx))),
                    y: Math.max(0, Math.min(canvasRef.current.height - r.h, Math.round(startY + dy)))
                  }));
                };
                const onUp = () => {
                  setIsCropDragging(false);
                  document.removeEventListener('mousemove', onMove);
                  document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            >
              {/* Corner resize handle: SE */}
              <div
                data-resizer="true"
                style={{
                  position: 'absolute', bottom: -6, right: -6, width: 14, height: 14,
                  background: '#00ffd5', borderRadius: '50%', cursor: 'nwse-resize'
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const startClientX = e.clientX;
                  const startClientY = e.clientY;
                  const startW = cropRect.w;
                  const startH = cropRect.h;

                  const onMove = (ev) => {
                    const dw = (ev.clientX - startClientX) / zoom;
                    const dh = (ev.clientY - startClientY) / zoom;
                    setCropRect(r => ({
                      ...r,
                      w: Math.max(20, Math.min(canvasRef.current.width - r.x, Math.round(startW + dw))),
                      h: Math.max(20, Math.min(canvasRef.current.height - r.y, Math.round(startH + dh)))
                    }));
                  };
                  const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                  };
                  document.addEventListener('mousemove', onMove);
                  document.addEventListener('mouseup', onUp);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer Actions */}
      <div style={{
        padding: '14px 20px', background: 'var(--surface-1, #1e1e24)',
        borderTop: '1px solid var(--line, #333)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleAutoRemoveBg}
            style={{
              padding: '8px 14px', borderRadius: 6, background: 'var(--hp-pink-soft, rgba(234,9,127,0.15))',
              border: '1px solid var(--hp-pink, #EA097F)', color: 'var(--hp-pink, #EA097F)',
              fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Icon name="sparkles" size={14} />
            {isProcessing ? 'Processing…' : '✨ Auto-Remove Solid BG'}
          </button>
          <span style={{ fontSize: 11, color: '#888' }}>
            Tip: Use Box Crop to grab only a character or logo, or Eraser to clean unwanted parts.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSave(true)}
            style={{ borderColor: 'var(--hp-pink)', color: 'var(--hp-pink)', fontWeight: 600 }}
            title="Saves as a new additional cutout without overwriting"
          >
            ➕ Save as New Overlay Layer
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleSave(false)}
            style={{ fontWeight: 700 }}
          >
            💾 Update Current Overlay
          </Button>
        </div>
      </div>
    </div>
  );
}
