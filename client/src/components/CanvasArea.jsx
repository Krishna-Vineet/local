import { useRef } from "react";
import html2canvas from "html2canvas-pro";
import DraggableElement from "./DraggableElement";

function CanvasArea({ elements, setElements, bgColor, bg, photo, frame, filter }) {

  const downloadImage = async () => {
    const canvas = await html2canvas(document.getElementById("frame"), {
      useCORS: true,
      allowTaint: true,
    });
    const link = document.createElement("a");
    link.download = "photobooth.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const clearElements = () => setElements([]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* Canvas Card — scales on small screens */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl shadow-lg w-full max-w-xs sm:max-w-sm md:max-w-md">
        <div
          id="frame"
          className="relative w-full overflow-hidden rounded-lg border border-gray-200"
          // style={{
          //   background: bgColor,
          //   /* 2:3 portrait aspect ratio */
          //   aspectRatio: "2 / 3",
          // }}
          style={{
            background: bg || bgColor || "#ffffff",
            aspectRatio: "2 / 3",
          }}
        >
          {/* PHOTO layer */}
          <div
            className="absolute inset-0"
            style={{ filter }}
          >
            {photo ? (
              <img
                src={photo}
                className="w-full h-full object-cover"
                alt="user photo"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2 select-none">
                <span className="text-5xl">📷</span>
                <span className="text-sm font-medium">Upload a photo</span>
              </div>
            )}
          </div>

          {/* ELEMENTS layer (stickers / text) */}
          {elements.map((el) => (
            <DraggableElement
              key={el.id}
              el={el}
              setElements={setElements}
            />
          ))}

          {/* FRAME overlay — top layer, non-interactive */}
          {frame && (
            <img
              src={frame}
              className="absolute inset-0 w-full h-full pointer-events-none object-cover"
              alt="frame overlay"
              crossOrigin="anonymous"
            />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={downloadImage}
          className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white px-5 py-2.5 rounded-xl shadow font-bold text-sm transition-all"
        >
          ⬇ Download
        </button>
        {elements.length > 0 && (
          <button
            onClick={clearElements}
            className="bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
          >
            🗑 Clear All
          </button>
        )}
      </div>
    </div>
  );
}

export default CanvasArea;