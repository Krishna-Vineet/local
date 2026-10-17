import React from 'react';

export default function TemplateRenderer({ 
  layout, 
  design, 
  cachedAssets = {}, 
  onSlotChange, 
  onSlotDelete,
  activeDecorationIndex = null,
  onDecorationSelect = null,
  onDecorationChange = null,
  onDecorationDelete = null
}) {
  if (!layout) return null;

  const { width = 1200, height = 1800, slots = [], aspect } = layout;
  
  // 1. Resolve Background Image URL
  let bgUrl = null;
  const bgAssetId = design?.background?.assetId || design?.bg?.assetId;

  if (bgAssetId && cachedAssets[bgAssetId]) {
    bgUrl = cachedAssets[bgAssetId];
  } else if (design?.background?.url) {
    bgUrl = design.background.url;
  } else if (design?.bg?.url) {
    bgUrl = design.bg.url;
  } else if (typeof design?.background === 'string' && design.background.length > 0) {
    bgUrl = design.background;
  } else if (typeof design?.backgroundImage === 'string' && design.backgroundImage.length > 0) {
    bgUrl = design.backgroundImage;
  } else if (bgAssetId) {
    if (bgAssetId.startsWith('http') || bgAssetId.startsWith('data:') || bgAssetId.startsWith('/')) {
      bgUrl = bgAssetId;
    } else {
      bgUrl = `/api/org/asset-proxy?key=${encodeURIComponent(bgAssetId)}`;
    }
  }

  // If bgUrl still points to S3 amazonaws.com, route it via /api/org/asset-proxy
  if (bgUrl && (bgUrl.includes('amazonaws.com') || bgUrl.includes('happypix-bucket'))) {
    const s3Key = bgAssetId || bgUrl.replace(/^https?:\/\/[^\/]+\//, '');
    bgUrl = `/api/org/asset-proxy?key=${encodeURIComponent(s3Key)}`;
  }

  // Normalize localhost backend URLs to relative /uploads so Vite dev proxy handles it cleanly
  if (bgUrl && bgUrl.startsWith('http://localhost:5000/uploads')) {
    bgUrl = bgUrl.replace('http://localhost:5000', '');
  }

  // 2. Resolve Theme / Background Color
  const themeColor = design?.palette?.background || 
                     (Array.isArray(design?.bg?.colors) ? design.bg.colors[0] : null) || 
                     (Array.isArray(design?.background?.colors) ? design.background.colors[0] : null) || 
                     design?.background?.color || 
                     design?.theme?.background || 
                     '#1e1b2e';

  // 3. Resolve CSS Linear Gradients
  const isGradient = (design?.bg?.type === 'gradient' && Array.isArray(design?.bg?.colors) && design.bg.colors.length >= 2) ||
                     (design?.background?.type === 'gradient' && Array.isArray(design?.background?.colors) && design.background.colors.length >= 2);
  const gradColors = design?.bg?.colors || design?.background?.colors || [];
  const gradientStyle = isGradient ? `linear-gradient(135deg, ${gradColors[0]}, ${gradColors[1]})` : 'none';

  // Common styles — use explicit properties to avoid React shorthand/non-shorthand warning
  const wrapperStyle = {
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    aspectRatio: aspect || (width / height),
    backgroundColor: themeColor,
    backgroundImage: bgUrl ? `url(${bgUrl})` : gradientStyle,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    borderRadius: '6px'
  };

  const decorationStyle = (dec) => {
    let decUrl = null;
    if (dec.assetId && cachedAssets[dec.assetId]) {
      decUrl = cachedAssets[dec.assetId];
    } else if (dec.url) {
      decUrl = dec.url;
    } else if (dec.assetId) {
      if (dec.assetId.startsWith('http') || dec.assetId.startsWith('data:') || dec.assetId.startsWith('/')) {
        decUrl = dec.assetId;
      } else {
        decUrl = `/api/org/asset-proxy?key=${encodeURIComponent(dec.assetId)}`;
      }
    }

    if (decUrl && (decUrl.includes('amazonaws.com') || decUrl.includes('happypix-bucket'))) {
      const s3Key = dec.assetId || decUrl.replace(/^https?:\/\/[^\/]+\//, '');
      decUrl = `/api/org/asset-proxy?key=${encodeURIComponent(s3Key)}`;
    }

    if (decUrl && decUrl.startsWith('http://localhost:5000/uploads')) {
      decUrl = decUrl.replace('http://localhost:5000', '');
    }
    
    // Convert absolute positions relative to canvas to percentages
    const isFullFrame = dec.width >= 0.98 && dec.height >= 0.98 && (dec.x === 0 || !dec.x) && (dec.y === 0 || !dec.y);
    const style = {
      position: 'absolute',
      backgroundImage: decUrl ? `url(${decUrl})` : 'none',
      backgroundSize: isFullFrame ? '100% 100%' : 'contain',
      backgroundRepeat: 'no-repeat',
      zIndex: dec.overlay ? 3 : 1, // 3 is above slots (zIndex 2)
      pointerEvents: 'none'
    };

    if (dec.x !== undefined && dec.y !== undefined) {
      style.left = `${dec.x * 100}%`;
      style.top = `${dec.y * 100}%`;
      style.width = `${dec.width * 100}%`;
      style.height = `${dec.height * 100}%`;
    } else if (dec.position === 'top-right') {
      style.top = 0;
      style.right = 0;
      style.width = '30%';
      style.height = '30%';
    } else if (dec.position === 'bottom-left') {
      style.bottom = 0;
      style.left = 0;
      style.width = '30%';
      style.height = '30%';
    } else {
      // background decoration
      style.inset = 0;
      style.backgroundSize = 'cover';
    }
    return style;
  };

  const slotStyle = (slot) => {
    const border = design?.photoTreatment?.border 
      ? `${design.photoTreatment.borderWidth || 4}px solid ${design?.palette?.primary || '#fff'}` 
      : '1.5px dashed rgba(255, 255, 255, 0.45)';
    const shadow = design?.photoTreatment?.shadow ? '0px 4px 12px rgba(0,0,0,0.4)' : 'none';

    return {
      position: 'absolute',
      left: `${slot.x * 100}%`,
      top: `${slot.y * 100}%`,
      width: `${slot.width * 100}%`,
      height: `${slot.height * 100}%`,
      backgroundColor: 'rgba(255, 255, 255, 0.12)', // placeholder
      borderRadius: design?.slotShape === 'rounded' ? '12px' : design?.slotShape === 'pill' ? '999px' : '4px',
      border: border,
      boxShadow: shadow,
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: design?.palette?.text || '#ffffff',
      fontSize: '12px',
      fontWeight: 'bold',
      zIndex: 2,
      boxSizing: 'border-box'
    };
  };

  const [activeSlotId, setActiveSlotId] = React.useState(null);

  return (
    <div 
      style={wrapperStyle}
      onClick={(e) => {
        // Deselect if clicked directly on background (not on a slot or decoration)
        if (e.target === e.currentTarget) {
          setActiveSlotId(null);
          onDecorationSelect?.(null);
        }
      }}
    >
      {/* Decorations Layer */}
      {design?.decorations?.map((dec, i) => (
        onDecorationChange ? (
          <InteractiveDecoration
            key={`dec-${i}-${dec.assetId || i}`}
            dec={dec}
            index={i}
            cachedAssets={cachedAssets}
            isEditable={!!onDecorationChange}
            isActive={activeDecorationIndex === i}
            onSelect={() => {
              setActiveSlotId(null);
              onDecorationSelect?.(i);
            }}
            onChange={(updatedDec) => onDecorationChange(i, updatedDec)}
            onDelete={onDecorationDelete ? () => onDecorationDelete(i) : undefined}
          />
        ) : (
          <div key={i} style={decorationStyle(dec)} />
        )
      ))}

      {/* Photo Slots Layer */}
      {slots.map(slot => (
        <InteractiveSlot 
          key={slot.id} 
          slot={slot} 
          style={slotStyle(slot)} 
          isEditable={!!onSlotChange}
          isActive={activeSlotId === slot.id}
          onSelect={() => {
            onDecorationSelect?.(null);
            setActiveSlotId(slot.id);
          }}
          onChange={(newSlot) => onSlotChange && onSlotChange(newSlot)}
          onDelete={onSlotDelete ? () => onSlotDelete(slot.id) : undefined}
        />
      ))}
      
      {/* Fallback pattern if no bg image */}
      {!bgUrl && (
         <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle at center, white 10%, transparent 10%)', backgroundSize: '20px 20px', zIndex: 0, pointerEvents: 'none' }} />
      )}

      {/* Branding Footer Indicator when no custom background image */}
      {!bgUrl && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '18%',
          borderTop: '1px dashed rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 255, 255, 0.35)',
          fontSize: '10px',
          fontWeight: '600',
          letterSpacing: '1px',
          pointerEvents: 'none',
          zIndex: 1
        }}>
          EVENT BRANDING &amp; LOGOS
        </div>
      )}
    </div>
  );
}

// Internal component for handling drag and resize
function InteractiveSlot({ slot, style, isEditable, isActive, onSelect, onChange, onDelete }) {
  const slotRef = React.useRef(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isEditable) return;
      
      const parent = slotRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();

      if (isDragging) {
        let newX = (e.clientX - rect.left) / rect.width - (slot.width / 2);
        let newY = (e.clientY - rect.top) / rect.height - (slot.height / 2);
        
        // Boundaries
        newX = Math.max(0, Math.min(newX, 1 - slot.width));
        newY = Math.max(0, Math.min(newY, 1 - slot.height));
        
        onChange({ ...slot, x: newX, y: newY });
      } else if (isResizing) {
        const slotRect = slotRef.current.getBoundingClientRect();
        let newWidth = (e.clientX - slotRect.left) / rect.width;
        let newHeight = (e.clientY - slotRect.top) / rect.height;

        // Boundaries & min sizes
        newWidth = Math.max(0.05, Math.min(newWidth, 1 - slot.x));
        newHeight = Math.max(0.05, Math.min(newHeight, 1 - slot.y));

        onChange({ ...slot, width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, slot, isEditable, onChange]);

  return (
    <div 
      ref={slotRef}
      style={{
        ...style, 
        cursor: isEditable ? (isDragging ? 'grabbing' : 'grab') : 'default',
        outline: isActive && isEditable ? '2px dashed #00ffd5' : 'none',
        outlineOffset: '2px'
      }}
      onMouseDown={(e) => {
        if (!isEditable) return;
        if (e.target.dataset.resizer) return; // don't drag if clicking resizer
        e.preventDefault();
        onSelect();
        setIsDragging(true);
      }}
    >
      <span style={{ pointerEvents: 'none', textAlign: 'center', padding: '4px' }}>PHOTO {String(slot.id).replace('photo-', '')}</span>

      {/* Resize Handle */}
      {isEditable && isActive && (
        <div 
          data-resizer="true"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
          }}
          style={{
            position: 'absolute',
            bottom: '-5px',
            right: '-5px',
            width: '15px',
            height: '15px',
            background: '#00ffd5',
            borderRadius: '50%',
            cursor: 'nwse-resize',
            zIndex: 10
          }}
        />
      )}
      {/* Delete Handle */}
      {isEditable && isActive && onDelete && (
        <div 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '20px',
            height: '20px',
            background: '#ff0033',
            color: 'white',
            borderRadius: '50%',
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          title="Delete Slot"
        >
          ×
        </div>
      )}
    </div>
  );
}

// Internal component for handling interactive decoration dragging & resizing
function InteractiveDecoration({ 
  dec, 
  index, 
  cachedAssets, 
  isEditable, 
  isActive, 
  onSelect, 
  onChange, 
  onDelete 
}) {
  const decRef = React.useRef(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [resizeHandle, setResizeHandle] = React.useState(null);
  const dragStartRef = React.useRef(null);

  let decUrl = null;
  if (dec.assetId && cachedAssets[dec.assetId]) {
    decUrl = cachedAssets[dec.assetId];
  } else if (dec.url) {
    decUrl = dec.url;
  } else if (dec.assetId) {
    if (dec.assetId.startsWith('http') || dec.assetId.startsWith('data:') || dec.assetId.startsWith('/')) {
      decUrl = dec.assetId;
    } else {
      decUrl = `/api/org/asset-proxy?key=${encodeURIComponent(dec.assetId)}`;
    }
  }

  if (decUrl && (decUrl.includes('amazonaws.com') || decUrl.includes('happypix-bucket'))) {
    const s3Key = dec.assetId || decUrl.replace(/^https?:\/\/[^\/]+\//, '');
    decUrl = `/api/org/asset-proxy?key=${encodeURIComponent(s3Key)}`;
  }

  if (decUrl && decUrl.startsWith('http://localhost:5000/uploads')) {
    decUrl = decUrl.replace('http://localhost:5000', '');
  }

  const decX = dec.x !== undefined ? dec.x : 0;
  const decY = dec.y !== undefined ? dec.y : 0;
  const decW = dec.width !== undefined ? dec.width : 0.5;
  const decH = dec.height !== undefined ? dec.height : 0.5;
  const isFullFrame = decW >= 0.98 && decH >= 0.98 && (decX === 0 || !decX) && (decY === 0 || !decY);

  React.useEffect(() => {
    if (!isEditable) return;

    const handleMouseMove = (e) => {
      const parent = decRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();

      if (isDragging && dragStartRef.current) {
        const dx = (e.clientX - dragStartRef.current.clientX) / rect.width;
        const dy = (e.clientY - dragStartRef.current.clientY) / rect.height;
        let newX = dragStartRef.current.startX + dx;
        let newY = dragStartRef.current.startY + dy;

        // Allow slight negative offset for full bleed frames
        newX = Math.max(-0.6, Math.min(1.4, newX));
        newY = Math.max(-0.6, Math.min(1.4, newY));

        onChange({ ...dec, x: Number(newX.toFixed(3)), y: Number(newY.toFixed(3)) });
      } else if (resizeHandle && dragStartRef.current) {
        const dx = (e.clientX - dragStartRef.current.clientX) / rect.width;
        const dy = (e.clientY - dragStartRef.current.clientY) / rect.height;
        let newX = dragStartRef.current.startX;
        let newY = dragStartRef.current.startY;
        let newW = dragStartRef.current.startW;
        let newH = dragStartRef.current.startH;

        if (resizeHandle.includes('e')) {
          newW = Math.max(0.04, dragStartRef.current.startW + dx);
        }
        if (resizeHandle.includes('s')) {
          newH = Math.max(0.04, dragStartRef.current.startH + dy);
        }
        if (resizeHandle.includes('w')) {
          const possibleW = Math.max(0.04, dragStartRef.current.startW - dx);
          newX = dragStartRef.current.startX + (dragStartRef.current.startW - possibleW);
          newW = possibleW;
        }
        if (resizeHandle.includes('n')) {
          const possibleH = Math.max(0.04, dragStartRef.current.startH - dy);
          newY = dragStartRef.current.startY + (dragStartRef.current.startH - possibleH);
          newH = possibleH;
        }

        // Maintain aspect ratio if shift key held
        if (e.shiftKey && (resizeHandle === 'se' || resizeHandle === 'nw' || resizeHandle === 'ne' || resizeHandle === 'sw')) {
          const aspect = dragStartRef.current.startW / dragStartRef.current.startH;
          newH = newW / aspect;
        }

        onChange({
          ...dec,
          x: Number(newX.toFixed(3)),
          y: Number(newY.toFixed(3)),
          width: Number(newW.toFixed(3)),
          height: Number(newH.toFixed(3))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setResizeHandle(null);
      dragStartRef.current = null;
    };

    if (isDragging || resizeHandle) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, resizeHandle, dec, isEditable, onChange]);

  const style = {
    position: 'absolute',
    left: `${decX * 100}%`,
    top: `${decY * 100}%`,
    width: `${decW * 100}%`,
    height: `${decH * 100}%`,
    backgroundImage: decUrl ? `url(${decUrl})` : 'none',
    backgroundSize: isFullFrame ? '100% 100%' : 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    zIndex: isActive ? 30 : (dec.overlay ? 3 : 1),
    cursor: isEditable ? (isDragging ? 'grabbing' : 'grab') : 'default',
    outline: isActive && isEditable ? '2px dashed #EA097F' : 'none',
    outlineOffset: '2px',
    boxShadow: isActive && isEditable ? '0 0 0 1px rgba(234, 9, 127, 0.4), 0 4px 14px rgba(234, 9, 127, 0.3)' : 'none',
    pointerEvents: isEditable ? 'auto' : 'none',
    boxSizing: 'border-box'
  };

  const startResize = (handle, e) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeHandle(handle);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: decX,
      startY: decY,
      startW: decW,
      startH: decH
    };
  };

  return (
    <div
      ref={decRef}
      style={style}
      onMouseDown={(e) => {
        if (!isEditable) return;
        if (e.target.dataset.decHandle) return;
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        setIsDragging(true);
        dragStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          startX: decX,
          startY: decY,
          startW: decW,
          startH: decH
        };
      }}
    >
      {/* Active Dimensions Badge */}
      {isActive && isEditable && (
        <div style={{
          position: 'absolute',
          top: -24,
          left: 0,
          background: '#EA097F',
          color: '#fff',
          fontSize: '10px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          pointerEvents: 'auto',
          whiteSpace: 'nowrap',
          zIndex: 35
        }}>
          <span>Overlay {index + 1}: {Math.round(decW * 100)}% × {Math.round(decH * 100)}%</span>
          {onDelete && (
            <span
              onClick={(ev) => { ev.stopPropagation(); onDelete(); }}
              style={{ cursor: 'pointer', padding: '0 2px', fontWeight: 900 }}
              title="Delete overlay"
            >
              ✕
            </span>
          )}
        </div>
      )}

      {/* 8 Resize Handles when Active */}
      {isActive && isEditable && (
        <>
          {/* 4 Corners */}
          <div data-dec-handle="true" onMouseDown={(e) => startResize('nw', e)} style={handleStyle('top', 'left', 'nwse-resize')} />
          <div data-dec-handle="true" onMouseDown={(e) => startResize('ne', e)} style={handleStyle('top', 'right', 'nesw-resize')} />
          <div data-dec-handle="true" onMouseDown={(e) => startResize('se', e)} style={handleStyle('bottom', 'right', 'nwse-resize')} />
          <div data-dec-handle="true" onMouseDown={(e) => startResize('sw', e)} style={handleStyle('bottom', 'left', 'nesw-resize')} />

          {/* 4 Edges */}
          <div data-dec-handle="true" onMouseDown={(e) => startResize('n', e)} style={edgeHandleStyle('top', 'ns-resize')} />
          <div data-dec-handle="true" onMouseDown={(e) => startResize('s', e)} style={edgeHandleStyle('bottom', 'ns-resize')} />
          <div data-dec-handle="true" onMouseDown={(e) => startResize('w', e)} style={edgeHandleStyle('left', 'ew-resize')} />
          <div data-dec-handle="true" onMouseDown={(e) => startResize('e', e)} style={edgeHandleStyle('right', 'ew-resize')} />
        </>
      )}
    </div>
  );
}

const handleStyle = (v, h, cursor) => ({
  position: 'absolute',
  [v]: -5,
  [h]: -5,
  width: 10,
  height: 10,
  background: '#ffffff',
  border: '2px solid #EA097F',
  borderRadius: '2px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
  cursor,
  zIndex: 35
});

const edgeHandleStyle = (edge, cursor) => {
  const isHoriz = edge === 'left' || edge === 'right';
  return {
    position: 'absolute',
    ...(edge === 'top' ? { top: -4, left: '50%', transform: 'translateX(-50%)' } : {}),
    ...(edge === 'bottom' ? { bottom: -4, left: '50%', transform: 'translateX(-50%)' } : {}),
    ...(edge === 'left' ? { left: -4, top: '50%', transform: 'translateY(-50%)' } : {}),
    ...(edge === 'right' ? { right: -4, top: '50%', transform: 'translateY(-50%)' } : {}),
    width: isHoriz ? 5 : 12,
    height: isHoriz ? 12 : 5,
    background: '#ffffff',
    border: '1.5px solid #EA097F',
    borderRadius: '2px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    cursor,
    zIndex: 35
  };
};
