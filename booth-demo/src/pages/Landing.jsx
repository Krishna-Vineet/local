import React from 'react'
import { Link } from 'react-router-dom'
import LandingNav from '../components/LandingNav'

export default function Landing(){
  return (
    <div className="landing-bg" style={{ minHeight:'100vh' }}>
      <LandingNav />
      {/* HERO */}
      <section style={{ position:'relative', overflow:'hidden', padding:'40px 0 24px' }}>
        {/* ambient orbs */}
        <div style={{ position:'absolute', width:520, height:520, background:'radial-gradient(circle at 30% 30%, rgba(139,92,246,0.22), transparent 62%)', left:-80, top:-40, filter:'blur(10px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:480, height:480, background:'radial-gradient(circle at 30% 30%, rgba(236,72,153,0.18), transparent 62%)', right:-60, top:20, filter:'blur(8px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:360, height:360, background:'radial-gradient(circle at 50% 50%, rgba(6,182,214,0.12), transparent 65%)', left:'50%', top:120, transform:'translateX(-50%)', filter:'blur(10px)', pointerEvents:'none' }} />

        <div className="container" style={{ position:'relative' }}>
          <div style={{ textAlign:'center', maxWidth:780, margin:'0 auto' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#0f0f16', border:'1px solid #222232', borderRadius:999, padding:'6px 12px', fontSize:11, fontWeight:700, color:'#a1a1aa' }}>
              <span style={{ width:8, height:8, borderRadius:999, background:'#22c55e', boxShadow:'0 0 10px #22c55e' }} /> Live Booth Network • 1,200+ events powered
            </div>
            <h1 style={{ marginTop:18, fontFamily:'Fraunces, serif', fontSize:'clamp(34px, 6vw, 64px)', fontWeight:900, lineHeight:0.95, letterSpacing:-1.5 }}>
              Bring the <span style={{ background:'linear-gradient(90deg,#8b5cf6,#ec4899)', WebkitBackgroundClip:'text', color:'transparent' }}>HappyPix Magic</span> to Every Event.
            </h1>
            <p style={{ marginTop:14, color:'#a1a1aa', fontSize:17, lineHeight:1.6, maxWidth:620, margin:'14px auto 0', textAlign:'center', textWrap:'balance' }}>
              The all-in-one photo booth platform — CRM, website, Android & Desktop apps — trusted by premium venues and brands. No downloads needed to pitch: run a live booth session right in the browser.
            </p>
            <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:22, flexWrap:'wrap' }}>
              <Link to="/experience" style={{ background:'linear-gradient(90deg,#8b5cf6,#ec4899)', color:'#fff', padding:'14px 24px', borderRadius:999, fontWeight:800, fontSize:15, boxShadow:'0 12px 28px rgba(139,92,246,0.36)' }}>Get the Happypix Booth Experience →</Link>
              <a href="https://happypix.in" target="_blank" rel="noreferrer" style={{ background:'#0f0f16', border:'1px solid #222232', color:'#fff', padding:'14px 22px', borderRadius:999, fontWeight:700, fontSize:14 }}>Visit Main Website</a>
              <a href="#" style={{ background:'#18181f', border:'1px solid #27272a', color:'#d4d4d8', padding:'14px 22px', borderRadius:999, fontWeight:700, fontSize:14 }}>Open CRM Demo</a>
            </div>
            <div style={{ display:'flex', gap:18, justifyContent:'center', marginTop:18, flexWrap:'wrap', color:'#71717a', fontSize:12, fontWeight:600 }}>
              <span>✓ No app install</span><span>✓ Fake payments • Real UX</span><span>✓ Works on any device</span>
            </div>
          </div>

          {/* hero preview strip mock */}
          <div style={{ marginTop:34, display:'flex', justifyContent:'center' }}>
            <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:24, padding:14, display:'flex', gap:12, alignItems:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', maxWidth:860, width:'100%', flexWrap:'wrap' }}>
              <div style={{ background:'#000', borderRadius:16, padding:10, display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ width:10, height:10, borderRadius:999, background:'#ef4444' }} /><span style={{ width:10, height:10, borderRadius:999, background:'#f59e0b' }} /><span style={{ width:10, height:10, borderRadius:999, background:'#22c55e' }} />
                <span style={{ marginLeft:8, fontSize:11, fontWeight:700, color:'#71717a' }}>happypix-booth-demo / live session preview</span>
              </div>
              <div style={{ marginLeft:'auto', display:'flex', gap:10, flexWrap:'wrap' }}>
                <div style={{ background:'#18181f', border:'1px solid #27272a', borderRadius:12, padding:'10px 14px' }}>
                  <div style={{ fontSize:10, color:'#a1a1aa', fontWeight:700, letterSpacing:0.8 }}>AVG SESSION</div><div style={{ fontSize:18, fontWeight:900 }}>~ 92s</div>
                </div>
                <div style={{ background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:12, padding:'10px 14px' }}>
                  <div style={{ fontSize:10, color:'#a78bfa', fontWeight:800, letterSpacing:0.8 }}>PRINT + DIGITAL</div><div style={{ fontSize:18, fontWeight:900, color:'#c4b5fd' }}>4.9/5 ★</div>
                </div>
              </div>
            </div>
          </div>

          {/* floating polaroids visual */}
          <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:24, flexWrap:'wrap' }}>
            {[
              'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=400&q=80',
              'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=400&q=80',
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            ].map((src,i)=>(
              <div key={i} style={{ background:'#fff', borderRadius:14, padding:6, paddingBottom:18, width:160, boxShadow:'0 10px 30px rgba(0,0,0,0.5)', transform: i===1 ? 'rotate(-2deg) translateY(-6px)' : i===0 ? 'rotate(-4deg)' : 'rotate(3deg)' }}>
                <img src={src} alt="" style={{ width:'100%', height:110, objectFit:'cover', borderRadius:8 }} />
                <div style={{ textAlign:'center', marginTop:8, fontSize:8, fontWeight:900, letterSpacing:1, color:'#8b5cf6' }}>HAPPYPIX LIVE</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUSTED BY */}
      <section style={{ padding:'16px 0', borderTop:'1px solid #101018', borderBottom:'1px solid #101018', background:'#09090f' }}>
        <div className="container" style={{ display:'flex', gap:18, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', opacity:0.9 }}>
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:1.5, color:'#71717a' }}>TRUSTED BY LEADING HOSPITALITY & ENTERPRISE BRANDS</span>
          <div style={{ display:'flex', gap:22, flexWrap:'wrap', fontSize:12, fontWeight:800, color:'#52525b' }}>
            <span>Taj Hotels</span><span>Marriott</span><span>PVR Cinemas</span><span>WedMeGood</span><span>Nykaa</span><span>The Leela</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding:'42px 0' }}>
        <div className="container">
          <div style={{ textAlign:'center', maxWidth:680, margin:'0 auto' }}>
            <div style={{ display:'inline-block', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#a78bfa', padding:'6px 12px', borderRadius:999, fontSize:11, fontWeight:800, letterSpacing:0.8 }}>THE HappyPix ECOSYSTEM</div>
            <h2 style={{ marginTop:12, fontSize:34, fontWeight:900, letterSpacing:-0.6 }}>Everything you need to run a photo booth business</h2>
            <p style={{ marginTop:8, color:'#a1a1aa', fontSize:14, lineHeight:1.6 }}>From booking to print: one CRM, one backend, one brand — all demo-able without installing the native apps.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:16, marginTop:22 }}>
            {[
              { title:'CRM & Operations', desc:'Leads, bookings, payouts, support tickets — all in one dashboard. Show a demo account live.', icon:'📊', accent:'#8b5cf6' },
              { title:'Backend & Gallery', desc:'Secure event snapshots, templates, pricing & digital delivery. Cloud-synced.', icon:'☁️', accent:'#0ea5e9' },
              { title:'Display Website', desc:'Your public storefront with live availability, galleries & SEO ready pages.', icon:'🌐', accent:'#22c55e' },
              { title:'Android Booth App', desc:'Kiosk-grade capture, printing & offline sync. The native experience — now in browser.', icon:'🤖', accent:'#f59e0b' },
              { title:'Electron Desktop', desc:'High-performance tethered capture, DSLR support & multi-printer routing.', icon:'🖥️', accent:'#ef4444' },
              { title:'Instant Pitch Mode', desc:'This demo — a 1-tap browser booth to close deals without downloading APKs.', icon:'⚡', accent:'#ec4899' },
            ].map(c=>(
              <div key={c.title} style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:20, padding:18, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', right:-20, top:-12, width:120, height:120, background:`radial-gradient(circle at 30% 30%, ${c.accent}22, transparent 60%)`, pointerEvents:'none' }} />
                <div style={{ width:40, height:40, borderRadius:12, background:'#18181f', border:'1px solid #27272a', display:'grid', placeItems:'center', fontSize:18 }}>{c.icon}</div>
                <div style={{ marginTop:12, fontWeight:900, fontSize:16 }}>{c.title}</div>
                <div style={{ marginTop:6, color:'#a1a1aa', fontSize:12, lineHeight:1.6 }}>{c.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'center', marginTop:22 }}>
            <Link to="/experience" style={{ background:'#8b5cf6', color:'#fff', padding:'12px 22px', borderRadius:999, fontWeight:800, fontSize:14, boxShadow:'0 10px 24px rgba(139,92,246,0.35)' }}>Start Live Booth Demo — 90 seconds →</Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding:'18px 0 28px', background:'#09090f', borderTop:'1px solid #11111a', borderBottom:'1px solid #11111a' }}>
        <div className="container">
          <h3 style={{ textAlign:'center', fontSize:22, fontWeight:900 }}>How the booth demo works</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:16 }}>
            {[
              { n:'01', t:'Brand it', d:'Enter your org name, logo & event so the print feels theirs — not a generic demo.' },
              { n:'02', t:'Live booth flow', d:'Orientation → template → prints → payment → camera → select → customize → print.' },
              { n:'03', t:'Close the deal', d:'Success screen with a QR to your real site. Keep the conversation going after the wow.' },
            ].map(s=>(
              <div key={s.n} style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:18, padding:18 }}>
                <div style={{ fontSize:28, fontWeight:900, color:'#8b5cf6' }}>{s.n}</div>
                <div style={{ marginTop:6, fontWeight:800 }}>{s.t}</div>
                <div style={{ marginTop:6, color:'#a1a1aa', fontSize:12, lineHeight:1.6 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" style={{ padding:'36px 0' }}>
        <div className="container">
          <div style={{ display:'flex', alignItems:'end', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ display:'inline-block', background:'#18181f', border:'1px solid #27272a', color:'#d4d4d8', padding:'6px 10px', borderRadius:999, fontSize:11, fontWeight:700 }}>LOVED BY PARTNERS & GUESTS</div>
              <h2 style={{ marginTop:10, fontSize:30, fontWeight:900, letterSpacing:-0.5 }}>Real results from HappyPix partners</h2>
            </div>
            <div style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:999, padding:'8px 14px', fontSize:12, fontWeight:700, color:'#a1a1aa' }}>★ ★ ★ ★ ★ 4.9/5 from 2,100+ events</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14, marginTop:18 }}>
            {[
              { name:'Aarav Mehta', org:'The Leela Palace, Delhi', text:'We closed 3 venue partnerships in one week by walking clients through the browser booth. No APK installs, same wow factor.', role:'Events Head', avatar:'AM' },
              { name:'Sneha Kapoor', org:'WedMeGood Experiences', text:'Clients instantly get it — from orientation to the final bordered print. The fake QR flow makes pricing feel tangible.', role:'Founder', avatar:'SK' },
              { name:'Kabir Singh', org:'PVR INOX — Activations', text:'We pit-stopped the Electron flow on a tablet during a mall pitch. The camera, filters and stickers sealed the deal.', role:'Brand Partnerships', avatar:'KS' },
              { name:'Priya Sharma', org:'Taj Hotels — Celebrations', text:'Personalized org branding in the config step made the client feel it was theirs. Success QR to website is clever.', role:'Director of Events', avatar:'PS' },
              { name:'Rohan Das', org:'Nykaa Luxe Events', text:'Templates for every vibe — party, formal, cinema. We show how a premium print looks before they buy a package.', role:'Marketing Lead', avatar:'RD' },
              { name:'Ananya Gupta', org:'Marriott Bonvoy, Goa', text:'The lobby demo on iPad takes 90 seconds and leaves guests asking for the real booth. Instant memory.', role:'Guest Experience', avatar:'AG' },
            ].map(t=>(
              <div key={t.name} style={{ background:'#0f0f16', border:'1px solid #222232', borderRadius:18, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', gap:2, color:'#facc15', fontSize:12 }}>★★★★★</div>
                <div style={{ color:'#e4e4e7', fontSize:13, lineHeight:1.6, flex:1 }}>&quot;{t.text}&quot;</div>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:6 }}>
                  <div style={{ width:36, height:36, borderRadius:999, background:'linear-gradient(135deg,#8b5cf6,#ec4899)', display:'grid', placeItems:'center', fontWeight:800, fontSize:12 }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:13 }}>{t.name}</div>
                    <div style={{ fontSize:11, color:'#a1a1aa' }}>{t.role} • {t.org}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding:'20px 0 40px' }}>
        <div className="container">
          <div style={{ background:'linear-gradient(135deg, #1a0a2e 0%, #0f0f16 45%, #1a1030 100%)', border:'1px solid #2a2050', borderRadius:24, padding:28, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:22, fontWeight:900 }}>Ready to wow your next client?</div>
              <div style={{ color:'#a1a1aa', fontSize:13, marginTop:4 }}>Launch a branded booth session in 15 seconds — straight from this website.</div>
            </div>
            <Link to="/experience" style={{ background:'#fff', color:'#0f0f16', padding:'14px 22px', borderRadius:999, fontWeight:900, fontSize:14, whiteSpace:'nowrap' }}>Get the Happypix Booth Experience →</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop:'1px solid #11111a', padding:'18px 0', background:'#09090f' }}>
        <div className="container" style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12, color:'#71717a', fontSize:12 }}>
          <span>© {new Date().getFullYear()} Happypix • Built for pitching without installs • CRM • Website • Android • Electron</span>
          <span style={{ display:'flex', gap:14 }}><a href="https://happypix.in" target="_blank" rel="noreferrer">happypix.in</a><a href="#">Privacy</a><a href="#">Terms</a></span>
        </div>
      </footer>
    </div>
  )
}
