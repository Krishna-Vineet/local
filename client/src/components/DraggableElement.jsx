import { useRef } from "react";
import Draggable from "react-draggable";

function DraggableElement({ el, setElements }) {
  const nodeRef = useRef(null);

  const handleStop = (e, data) => {
    setElements((prev) =>
      prev.map((item) =>
        item.id === el.id ? { ...item, x: data.x, y: data.y } : item
      )
    );
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setElements((prev) => prev.filter((item) => item.id !== el.id));
  };

  const handleResize = (delta) => {
    setElements((prev) =>
      prev.map((item) =>
        item.id === el.id
          ? { ...item, size: Math.max(24, Math.min(200, (item.size || 48) + delta)) }
          : item
      )
    );
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds="parent"
      defaultPosition={{ x: el.x, y: el.y }}
      onStop={handleStop}
    >
      <div
        ref={nodeRef}
        className="absolute cursor-move group select-none touch-none"
      >
        {/* Delete button */}
        <button
          onMouseDown={handleRemove}
          onTouchStart={handleRemove}
          className="absolute -top-3 -right-3 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
        >
          ✕
        </button>

        {el.type === "text" && (
          <p
            className="font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] whitespace-nowrap"
            style={{ fontSize: `${el.size || 20}px` }}
          >
            {el.content}
          </p>
        )}

        {el.type === "sticker" && (
          <div className="relative">
            <span
              className="block leading-none"
              style={{ fontSize: `${el.size || 48}px` }}
            >
              {el.content}
            </span>
            {/* Resize controls */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button
                onMouseDown={(e) => { e.stopPropagation(); handleResize(-8); }}
                onTouchStart={(e) => { e.stopPropagation(); handleResize(-8); }}
                className="w-4 h-4 bg-white border border-gray-300 rounded text-xs leading-none shadow"
              >−</button>
              <button
                onMouseDown={(e) => { e.stopPropagation(); handleResize(8); }}
                onTouchStart={(e) => { e.stopPropagation(); handleResize(8); }}
                className="w-4 h-4 bg-white border border-gray-300 rounded text-xs leading-none shadow"
              >+</button>
            </div>
          </div>
        )}

        {el.type === "image" && (
          <img
            src={el.src}
            alt="sticker"
            draggable={false}
            style={{ width: `${el.size || 80}px`, height: `${el.size || 80}px`, objectFit: "contain" }}
          />
        )}
      </div>
    </Draggable>
  );
}

export default DraggableElement;