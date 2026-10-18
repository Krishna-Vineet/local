import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Nav, Footer } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import Booth from './pages/Booth.jsx'
import Software from './pages/Software.jsx'
import Hardware from './pages/Hardware.jsx'
import Pricing from './pages/Pricing.jsx'
import Contact from './pages/Contact.jsx'
import Business from './pages/Business.jsx'
import Download from './pages/Download.jsx'
import { useGlobalFx } from './fx/useGlobalFx.js'
import LiquidCursor from './fx/LiquidCursor.jsx'
import { ScrollProgress } from './fx/ScrollFx.jsx'

function ScrollTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])
  return null
}

function NotFound() {
  return (
    <section className="section section-ink" style={{ paddingTop: 190, paddingBottom: 120, textAlign: 'center' }}>
      <div className="wrap">
        <div style={{ fontSize: '3.4rem' }}>🎞️</div>
        <h1 className="h-lg" style={{ margin: '20px 0 14px' }}>That frame came out <span className="accent-it">blank</span></h1>
        <p className="lead" style={{ margin: '0 auto 30px' }}>The page you are looking for has left the booth. Let's get you back to the party.</p>
        <a href="/" className="btn btn-pink">Back to HappyPix</a>
      </div>
    </section>
  )
}

export default function App() {
  const { pathname } = useLocation()
  useGlobalFx()
  // The guest download page is hidden/deliberately chrome-less:
  // no marketing nav, no pricing CTAs — just the guest and their photos.
  const isDownload = pathname.startsWith('/download')

  if (isDownload) {
    return (
      <>
        <ScrollTop />
        <Routes>
          <Route path="/download/:id" element={<Download />} />
        </Routes>
      </>
    )
  }

  return (
    <>
      <ScrollTop />
      <LiquidCursor />
      <ScrollProgress />
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/booth" element={<Booth />} />
        <Route path="/software" element={<Software />} />
        <Route path="/hardware" element={<Hardware />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/business" element={<Business />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </>
  )
}
