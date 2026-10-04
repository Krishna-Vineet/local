import { useState } from "react";
import CanvasArea from "../components/CanvasArea";
import Toolbar from "../components/Toolbar";
import LinkedInCanvas from "../components/LinkedInCanvas";
import html2canvas from "html2canvas-pro";
import { useNavigate } from "react-router-dom";

const downloadLinkedIn = async () => {
  const element = document.getElementById("linkedin-card");
  if (!element) return;
  element.style.backgroundColor = "#ffffff";
  const canvas = await html2canvas(element, {
    useCORS: true,
    backgroundColor: "#ffffff",
  });
  const link = document.createElement("a");
  link.download = "linkedin-profile.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
};

function Customize() {
  const navigate = useNavigate();
  const [elements, setElements] = useState([]);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [photo, setPhoto] = useState(null);
  const [frame, setFrame] = useState(null);
  const [filter, setFilter] = useState("none");
  const [mode, setMode] = useState("photobooth");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [bg, setBg] = useState("#ffffff");
  // Mobile sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#f3f4f6" }}>

      {/* ── Mobile Sidebar Overlay ─────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 w-72 bg-white shadow-xl border-r border-gray-100
          transform transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0 lg:z-auto lg:shadow-md lg:flex-shrink-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Close button (mobile only) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 lg:hidden">
          <span className="font-bold text-gray-700">Tools</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
          >
            ✕
          </button>
        </div>

        <div className="h-full overflow-y-auto p-4 pb-20">
          <Toolbar
            setElements={setElements}
            setBgColor={setBgColor}
            setPhoto={setPhoto}
            setFrame={setFrame}
            setFilter={setFilter}
            setMode={(m) => { setMode(m); setSidebarOpen(false); }}
            mode={mode}
            setName={setName}
            setRole={setRole}
            setBg={setBg}
          />
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger (mobile only) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
              aria-label="Open tools panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-sm font-medium">
              ← Back
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setMode("photobooth")}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${mode === "photobooth"
                ? "bg-white text-gray-800 shadow"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              📷 Booth
            </button>
            <button
              onClick={() => setMode("linkedin")}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${mode === "linkedin"
                ? "bg-white text-blue-600 shadow"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              💼 LinkedIn
            </button>
          </div>

          {/* Download button */}
          {mode === "linkedin" ? (
            <button
              onClick={downloadLinkedIn}
              className="bg-green-500 hover:bg-green-600 active:scale-95 text-white px-3 sm:px-5 py-2 rounded-lg shadow text-xs sm:text-sm font-bold transition-all"
            >
              ⬇ Download
            </button>
          ) : (
            <div className="w-[88px] sm:w-[104px]" /> /* spacer to center tabs */
          )}
        </header>

        {/* Canvas area */}
        <main className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-6">
          {mode === "linkedin" ? (
            <LinkedInCanvas photo={photo} name={name} role={role} bg={bg} filter={filter} />
          ) : (
            <CanvasArea
              elements={elements}
              setElements={setElements}
              bgColor={bgColor}
              bg={bg}
              photo={photo}
              frame={frame}
              filter={filter}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default Customize;