import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchDownload, downloadFileUrl } from '../lib/api.js'
import { buildDemoStrip, demoDownload } from '../lib/demo.js'
import { Icon, Logo } from '../components/ui.jsx'
import Seo from '../components/Seo.jsx'

// ─── Guest page: /download/:id ───────────────────────────────
// Reached by scanning the booth's QR on the success screen. Valid for
// 24 hours after the session, then this page becomes a polite goodbye.
// /download/demo is the public sample: the same page built from sample
// photos, so clients can see what their guests will get. Any other unknown
// or expired id shows the honest state below.

function useCountdown(expiresAt) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  if (!expiresAt) return null
  const left = Math.max(0, new Date(expiresAt).getTime() - now)
  const h = Math.floor(left / 3600000)
  const m = Math.floor((left % 3600000) / 60000)
  const s = Math.floor((left % 60000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return { left, text: `${pad(h)}:${pad(m)}:${pad(s)}` }
}

export default function Download() {
  const { id } = useParams()
  const isDemo = !id || id === 'demo'
  const [state, setState] = useState({ kind: 'loading' })

  useEffect(() => {
    let live = true
    if (isDemo) {
      buildDemoStrip()
        .catch(() => null)
        .then((strip) => live && setState({ kind: 'ready', data: demoDownload(strip) }))
      return () => { live = false }
    }

    let retries = 0
    let retryTimer = null

    const loadDownload = () => {
      fetchDownload(id)
        .then((data) => {
          if (live) setState({ kind: 'ready', data })
        })
        .catch((error) => {
          if (!live) return
          if (error.status === 410) {
            setState({ kind: 'expired' })
          } else if (error.status === 404) {
            if (retries < 6) {
              retries += 1
              setState({ kind: 'preparing', attempt: retries })
              retryTimer = setTimeout(loadDownload, 2000)
            } else {
              setState({ kind: 'invalid' })
            }
          } else {
            setState({ kind: 'error', message: error.message })
          }
        })
    }

    loadDownload()

    return () => {
      live = false
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [id, isDemo])

  const data = state.kind === 'ready' ? state.data : null
  const expiresAt = data?.expiresAt
  const countdown = useCountdown(expiresAt)

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: 'My HappyPix photos', url })
      else throw new Error('no-share')
    } catch {
      try { await navigator.clipboard.writeText(url) } catch { /* clipboard unavailable */ }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '22px 0' }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'center' }}><Logo light={false} /></div>
      </header>

      <main className="wrap" style={{ flex: 1, width: '100%', paddingBottom: 90 }}>
        {(state.kind === 'loading' || state.kind === 'preparing') && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2.5rem' }}>📸</div>
            <p style={{ marginTop: 14, fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)' }}>
              {state.kind === 'preparing'
                ? 'Your photos are being prepared from the booth…'
                : 'Fetching your photos…'}
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: 4 }}>
              Almost ready! Please hold on a moment.
            </p>
          </div>
        )}

        {(state.kind === 'expired' || (data && countdown && countdown.left === 0 && !isDemo)) && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '70px 0', maxWidth: 520, margin: '0 auto' }}>
            <div style={{ fontSize: '3rem' }}>🎞️</div>
            <h2 style={{ margin: '18px 0 12px' }}>This link has gone<br /><em>back in the drawer</em></h2>
            <p className="lede" style={{ marginInline: 'auto' }}>
              Digital copies live for 24 hours after a booth session, and this one has had its day.
              Your printed strip, of course, is forever. Still need the file? Ask your event host — they keep the gallery.
            </p>
          </motion.div>
        )}

        {state.kind === 'invalid' && (
          <div style={{ textAlign: 'center', padding: '70px 0', maxWidth: 520, margin: '0 auto' }}>
            <div style={{ fontSize: '3rem' }}>🔍</div>
            <h2 style={{ margin: '18px 0 12px' }}>We can’t find<br />that <em>photo link</em></h2>
            <p className="lede" style={{ marginInline: 'auto' }}>The link may be incomplete or mistyped. Check the QR code on the booth’s success screen and scan it once more.</p>
          </div>
        )}

        {state.kind === 'error' && (
          <div style={{ textAlign: 'center', padding: '70px 0', maxWidth: 520, margin: '0 auto' }}>
            <div style={{ fontSize: '3rem' }}>📶</div>
            <h2 style={{ margin: '18px 0 12px' }}>A small <em>hiccup</em></h2>
            <p className="lede" style={{ marginInline: 'auto' }}>{state.message || 'Could not load your photos.'} Your link is still valid — try again in a moment.</p>
          </div>
        )}

        {data && !(countdown && countdown.left === 0 && !isDemo) && state.kind === 'ready' && (
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, ease: [0.22, 1, 0.36, 1] }}>
            <div className="download-hero">
              <span className="sticker">{isDemo ? 'sample download page ✦' : 'your digital copy ✦'}</span>
              <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 3.6rem)', margin: '20px 0 10px' }}>
                Looking <em>good,</em> you.
              </h1>
              <p className="lede" style={{ marginInline: 'auto' }}>
                {data.eventName ? <>{data.eventName}{data.organizationName ? <> · by {data.organizationName}</> : null}<br /></> : null}
                Save the final print, keep the frames, share the joy.
              </p>
              {countdown ? (
                <div style={{ marginTop: 20 }}>
                  <span className="count-pill"><Icon name="clock" size={15} /> This link expires in <b>{countdown.text}</b></span>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: 'clamp(24px, 5vw, 56px)', marginTop: 48, alignItems: 'start' }} data-dlgrid>
              {/* final print */}
              <div style={{ textAlign: 'center' }}>
                <motion.div
                  initial={{ rotate: -5, y: 26, opacity: 0 }} animate={{ rotate: -2.5, y: 0, opacity: 1 }} transition={{ duration: .8, delay: .15 }}
                  style={{ background: 'var(--ink)', padding: '16px 12px 20px', borderRadius: 12, boxShadow: '0 24px 48px rgba(15,10,28,.28)', display: 'inline-block', maxWidth: 360}}
                >
                  <img src={data.compositeUrl || data.photoUrls?.[0]} alt="Your final HappyPix print" style={{  maxHeight: 500 ,borderRadius: 6, display: 'block', objectFit: 'contain', background: '#241a3d' }} />
                  </motion.div>
                <div style={{ marginTop: 20, display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {isDemo ? (
                    <a className="btn btn-pink" href={data.compositeUrl} download><Icon name="download" size={17} /> Download final print</a>
                  ) : (
                    <a className="btn btn-pink" href={downloadFileUrl(id, 'composite')}><Icon name="download" size={17} /> Download final print</a>
                  )}
                  <button className="btn btn-ghost" onClick={share}><Icon name="share" size={17} /> Share link</button>
                </div>
              </div>

              {/* frames */}
              <div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: 6 }}>The individual frames</h3>
                <p style={{ color: 'var(--ink-soft)', fontSize: '.95rem', marginBottom: 20 }}>The poses that made the strip — yours to crop, filter and frame all over again.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
                  {(data.photoUrls || []).map((url, i) => (
                    <motion.figure
                      key={i}
                      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 + i * .09 }}
                      style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', margin: 0 }}
                    >
                      <img src={url} alt={`Frame ${i + 1}`} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                      {isDemo ? (
                        <a href={url} download style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', fontWeight: 700, fontSize: '.87rem', color: 'var(--pink-deep)', textDecoration: 'none' }}><Icon name="download" size={14} /> Frame {i + 1}</a>
                      ) : (
                        <a href={downloadFileUrl(id, i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', fontWeight: 700, fontSize: '.87rem', color: 'var(--pink-deep)', textDecoration: 'none' }}><Icon name="download" size={14} /> Frame {i + 1}</a>
                      )}
                    </motion.figure>
                  ))}
                  {(data.photoUrls || []).length === 0 && !data.compositeUrl ? (
                    <p style={{ color: 'var(--muted)' }}>Your photos are still being prepared — refresh in a few seconds.</p>
                  ) : null}
                </div>

                <div style={{ marginTop: 26, background: 'var(--white)', border: '1px dashed var(--line)', borderRadius: 18, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span style={{ color: 'var(--pink-deep)', flex: 'none' }}><Icon name="heart" size={24} /></span>
                  <p style={{ fontSize: '.94rem', color: 'var(--ink-soft)' }}>
                    Loved the booth? The host runs on <b>HappyPix</b> — photo booths with prints, QR copies and galleries
                    for weddings, brands and everything worth celebrating.
                  </p>
                </div>
              </div>
            </div>
            <style>{`@media (max-width: 820px){ [data-dlgrid]{ grid-template-columns: 1fr !important; } }`}</style>
          </motion.div>
        )}
      </main>

      <footer style={{ background: 'transparent', color: 'var(--muted)', textAlign: 'center', padding: '22px 0 30px', fontSize: '.86rem' }}>
        HappyPix · digital copies expire 24 hours after the session · prints are forever
      </footer>
    </div>
  )
}
