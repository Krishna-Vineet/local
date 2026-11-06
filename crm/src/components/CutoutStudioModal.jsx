import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui.jsx';
import { Icon } from '../lib/icons.jsx';
import { removeBackgroundCanvas } from '../utils/removeBackground.js';

/**
 * Precision Cutout & Crop Studio Modal.
 * Allows isolating specific characters, graphics, borders, and regions from an uploaded image.
 * Features:
 * - Interactive Box Crop with 8 handles & click-drag new box
 * - Auto-Fit to screen on load & dedicated Fit Screen button
 * - Zoom from 5% to 400% + Ctrl+Wheel zoom
 * - Precision Eraser Brush (destination-out)
 * - Restore Brush (paint original pixels back)
 * - Magic Color Eraser (click-to-erase with tolerance)
 * - Auto Smart Background Removal
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
  const [brushSize, setBrushSize] = useState(28);
  const [tolerance, setTolerance] = useState(38);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Crop rectangle state (in image pixel coordinates)
  const [cropRect, setCropRect] = useState(null); // { x, y, w, h }

  const canvasRef = useRef(null);
  const originalImgRef = useRef(null);
  const workspaceRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isPaintingRef = useRef(false);
  const lastPointRef = useRef(null);

  // Fit image inside current workspace viewport
  const fitToScreen = useCallback(() => {
    if (!workspaceRef.current || !canvasRef.current) return;
    const container = workspaceRef.current;
    const padding = 60;
    const cw = container.clientWidth - padding;
    const ch = container.clientHeight - padding;
    const canvas = canvasRef.current;
    if (cw <= 0 || ch <= 0 || !canvas.width || !canvas.height) return;

    const scale = Math.min(cw / canvas.width, ch / canvas.height, 1);
    const rounded = Math.max(0.05, Math.min(3.0, Number(scale.toFixed(2))));
    setZoom(rounded);
  }, []);

  // Listen for Ctrl+Wheel zooming on the workspace
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom(z => Math.max(0.05, Math.min(4.0, Number((z * factor).toFixed(2)))));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isOpen]);

  // Load image onto canvas when modal opens
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      originalImgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      canvas.width = iw;
      canvas.height = ih;
      setCanvasSize({ w: iw, h: ih });

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Default crop box covers 80% centered
      setCropRect({
        x: Math.round(iw * 0.1),
        y: Math.round(ih * 0.1),
        w: Math.round(iw * 0.8),
        h: Math.round(ih * 0.8)
      });

      // Initialize history
      const initialData = ctx.getImageData(0, 0, iw, ih);
      historyRef.current = [initialData];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);

      // Auto-fit to screen after render
      requestAnimationFrame(() => {
        fitToScreen();
      });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc, fitToScreen]);

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
    setCanvasSize({ w: prevData.width, h: prevData.height });
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
    setCanvasSize({ w: nextData.width, h: nextData.height });
    ctx.putImageData(nextData, 0, 0);

    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const handleReset = () => {
    if (!originalImgRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const img = originalImgRef.current;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    canvas.width = iw;
    canvas.height = ih;
    setCanvasSize({ w: iw, h: ih });
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    saveToHistory();
    setCropRect({
      x: Math.round(iw * 0.1),
      y: Math.round(ih * 0.1),
      w: Math.round(iw * 0.8),
      h: Math.round(ih * 0.8)
    });
    requestAnimationFrame(() => {
      fitToScreen();
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
    setCanvasSize({ w: rw, h: rh });
    ctx.putImageData(croppedData, 0, 0);

    setCropRect({
      x: Math.round(rw * 0.05),
      y: Math.round(rh * 0.05),
      w: Math.round(rw * 0.9),
      h: Math.round(rh * 0.9)
    });
    saveToHistory();

    // Re-fit view to the cropped bounds
    requestAnimationFrame(() => {
      fitToScreen();
    });
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
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        setCanvasSize({ w: canvas.width, h: canvas.height });
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

  // Handles resizing crop rectangle from any handle
  const startResize = (handle, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!cropRect || !canvasRef.current) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = cropRect.x;
    const startY = cropRect.y;
    const startW = cropRect.w;
    const startH = cropRect.h;
    const imgW = canvasRef.current.width;
    const imgH = canvasRef.current.height;

    const onMove = (ev) => {
      const dx = (ev.clientX - startClientX) / zoom;
      const dy = (ev.clientY - startClientY) / zoom;

      let newX = startX;
      let newY = startY;
      let newW = startW;
      let newH = startH;

      if (handle.includes('e')) {
        newW = Math.max(20, Math.min(imgW - startX, Math.round(startW + dx)));
      }
      if (handle.includes('s')) {
        newH = Math.max(20, Math.min(imgH - startY, Math.round(startH + dy)));
      }
      if (handle.includes('w')) {
        const candidateW = Math.round(startW - dx);
        const candidateX = Math.round(startX + dx);
        if (candidateW >= 20 && candidateX >= 0) {
          newX = candidateX;
          newW = candidateW;
        }
      }
      if (handle.includes('n')) {
        const candidateH = Math.round(startH - dy);
        const candidateY = Math.round(startY + dy);
        if (candidateH >= 20 && candidateY >= 0) {
          newY = candidateY;
          newH = candidateH;
        }
      }

      setCropRect({ x: newX, y: newY, w: newW, h: newH });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Painting / Erasing / Drawing crop handlers
  const startPaint = (e) => {
    const { x, y } = getCanvasCoords(e);

    if (activeTool === 'crop') {
      // Start drawing a brand new crop box by dragging on the image
      const startX = Math.max(0, Math.min(canvasRef.current.width, x));
      const startY = Math.max(0, Math.min(canvasRef.current.height, y));
      setCropRect({ x: startX, y: startY, w: 1, h: 1 });

      const onDrawMove = (ev) => {
        const curr = getCanvasCoords(ev);
        const curX = Math.max(0, Math.min(canvasRef.current.width, curr.x));
        const curY = Math.max(0, Math.min(canvasRef.current.height, curr.y));
        const left = Math.min(startX, curX);
        const top = Math.min(startY, curY);
        const width = Math.abs(curX - startX);
        const height = Math.abs(curY - startY);
        setCropRect({
          x: left,
          y: top,
          w: Math.max(10, width),
          h: Math.max(10, height)
        });
      };

      const onDrawUp = () => {
        document.removeEventListener('mousemove', onDrawMove);
        document.removeEventListener('mouseup', onDrawUp);
      };

      document.addEventListener('mousemove', onDrawMove);
      document.addEventListener('mouseup', onDrawUp);
      return;
    }

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

  // Handles configuration for crop box
  const cropHandles = [
    { id: 'nw', cursor: 'nwse-resize', style: { top: -6, left: -6 } },
    { id: 'ne', cursor: 'nesw-resize', style: { top: -6, right: -6 } },
    { id: 'sw', cursor: 'nesw-resize', style: { bottom: -6, left: -6 } },
    { id: 'se', cursor: 'nwse-resize', style: { bottom: -6, right: -6 } },
    { id: 'n', cursor: 'ns-resize', style: { top: -5, left: 'calc(50% - 5px)', width: 10, height: 10 } },
    { id: 's', cursor: 'ns-resize', style: { bottom: -5, left: 'calc(50% - 5px)', width: 10, height: 10 } },
    { id: 'w', cursor: 'ew-resize', style: { top: 'calc(50% - 5px)', left: -5, width: 10, height: 10 } },
    { id: 'e', cursor: 'ew-resize', style: { top: 'calc(50% - 5px)', right: -5, width: 10, height: 10 } }
  ];

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
                display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,200,150,0.3)'
              }}
            >
              ✂️ Apply Crop to Box
            </button>
          )}

          {(activeTool === 'eraser' || activeTool === 'restore') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>Brush Size:</span>
              <input
                type="range" min="4" max="160" value={brushSize}
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
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, background: '#25252c',
            padding: '3px 6px', borderRadius: 6, border: '1px solid #444'
          }}>
            <button
              type="button"
              title="Zoom Out (Down to 5%)"
              onClick={() => setZoom(z => Math.max(0.05, Number((z <= 0.2 ? z - 0.05 : z - 0.1).toFixed(2))))}
              style={{ background: 'none', border: 'none', color: '#fff', padding: '2px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              -
            </button>
            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 46, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              title="Zoom In (Up to 400%)"
              onClick={() => setZoom(z => Math.min(4, Number((z + 0.1).toFixed(2))))}
              style={{ background: 'none', border: 'none', color: '#fff', padding: '2px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              +
            </button>
            <button
              type="button"
              title="Fit to Screen"
              onClick={fitToScreen}
              style={{
                background: 'rgba(234,9,127,0.2)', border: '1px solid var(--hp-pink, #EA097F)',
                color: '#fff', padding: '3px 8px', cursor: 'pointer', fontSize: 11, borderRadius: 4, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              📐 Fit Screen
            </button>
            <button
              type="button"
              title="Actual Size (100%)"
              onClick={() => setZoom(1)}
              style={{ background: 'none', border: 'none', color: '#aaa', padding: '3px 6px', cursor: 'pointer', fontSize: 11 }}
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
      <div
        ref={workspaceRef}
        style={{
          flex: 1, overflow: 'auto', display: 'flex',
          padding: 30, position: 'relative',
          background: '#121216',
          backgroundImage: 'radial-gradient(circle, #252530 10%, transparent 11%)',
          backgroundSize: '24px 24px',
          boxSizing: 'border-box'
        }}
      >
        {/* Transparent Checkerboard wrapper */}
        <div style={{
          position: 'relative',
          margin: 'auto',
          flexShrink: 0,
          width: canvasSize.w ? Math.round(canvasSize.w * zoom) : 'auto',
          height: canvasSize.h ? Math.round(canvasSize.h * zoom) : 'auto',
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
              width: '100%',
              height: '100%',
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
                boxSizing: 'border-box',
                cursor: 'move'
              }}
              onMouseDown={(e) => {
                if (e.target.dataset.resizer) return;
                e.preventDefault();
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
                  document.removeEventListener('mousemove', onMove);
                  document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            >
              {/* Dimensions Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: -24,
                  left: 0,
                  background: 'rgba(0, 0, 0, 0.85)',
                  color: '#00ffd5',
                  border: '1px solid rgba(0, 255, 213, 0.5)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                {cropRect.w} × {cropRect.h} px
              </div>

              {/* 8 Resizing Handles */}
              {cropHandles.map(h => (
                <div
                  key={h.id}
                  data-resizer="true"
                  onMouseDown={(e) => startResize(h.id, e)}
                  style={{
                    position: 'absolute',
                    width: h.style.width || 13,
                    height: h.style.height || 13,
                    background: '#00ffd5',
                    border: '2px solid #000',
                    borderRadius: 3,
                    cursor: h.cursor,
                    boxShadow: '0 0 6px rgba(0, 255, 213, 0.9)',
                    zIndex: 10,
                    ...h.style
                  }}
                />
              ))}
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
            Tip: Drag box to move, drag handles to resize, or click &amp; drag anywhere to draw a new crop box. Use Ctrl+Scroll to zoom.
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
