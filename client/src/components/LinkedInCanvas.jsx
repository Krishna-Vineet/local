import html2canvas from "html2canvas-pro";

function LinkedInCanvas({ photo, name, role, bg, filter = "none" }) {

  const downloadCard = async () => {
    const element = document.getElementById("linkedin-card");
    if (!element) return;
    const canvas = await html2canvas(element, {
      useCORS: true,
      backgroundColor: null,
    });
    const link = document.createElement("a");
    link.download = "linkedin-profile.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* Card — fluid, max width on larger screens */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl shadow-lg w-full max-w-xs sm:max-w-sm">
        <div
          id="linkedin-card"
          className="w-full rounded-2xl flex flex-col items-center justify-center p-6 sm:p-8 transition-all duration-300"
          style={{
            background: bg,
            aspectRatio: "4 / 5",
          }}
        >
          {/* Circular photo */}
          <div
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-white shadow-lg"
            style={{ filter }}
          >
            {photo ? (
              <img
                src={photo}
                className="w-full h-full object-cover"
                alt="profile"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-gray-100 text-gray-400 text-sm gap-1">
                <span className="text-3xl">📸</span>
                <span className="text-xs">Upload</span>
              </div>
            )}
          </div>

          {/* Name */}
          <h2
            className="mt-4 text-lg sm:text-xl font-bold text-center"
            style={{ color: bg === "#0a66c2" ? "#fff" : "#1e293b" }}
          >
            {name || "Your Name"}
          </h2>

          {/* Role */}
          <p
            className="text-sm mt-1 text-center"
            style={{ color: bg === "#0a66c2" ? "rgba(255,255,255,0.8)" : "#64748b" }}
          >
            {role || "Your Role / Title"}
          </p>

          {/* LinkedIn badge */}
          <div className="mt-4 flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <svg viewBox="0 0 24 24" fill="#0a66c2" className="w-3.5 h-3.5">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span className="text-xs font-bold" style={{ color: bg === "#0a66c2" ? "#fff" : "#0a66c2" }}>
              LinkedIn
            </span>
          </div>
        </div>
      </div>

      {/* Download button */}
      <button
        onClick={downloadCard}
        className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow transition-all"
      >
        ⬇ Download Card
      </button>
    </div>
  );
}

export default LinkedInCanvas;