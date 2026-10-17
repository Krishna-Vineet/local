
import React, { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, Chip, PageLoader, SearchInput, Select, Button, Modal, Field, TextInput, Toggle, EmptyState, ConfirmDialog } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import TemplateRenderer from '../../components/TemplateRenderer.jsx'
import LayoutCanvas from '../../components/LayoutCanvas.jsx'
import { parseLayoutCodeword } from '../../lib/layouts.js'
import { dateShort } from '../../lib/format.js'
import { removeBackgroundCanvas } from '../../utils/removeBackground.js'
import CutoutStudioModal from '../../components/CutoutStudioModal.jsx'

export default function OrgCustomTemplates() {
  const { toast } = useApp()
  const [templates, setTemplates] = useState(null)
  const [globalLayouts, setGlobalLayouts] = useState([])
  const [search, setSearch] = useState('')
  const [playground, setPlayground] = useState(null)
  const [previewing, setPreviewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    api.org.templateLayouts().then((r) => {
      if (r.layouts) {
        const normalized = r.layouts.map(l => {
          const parsed = parseLayoutCodeword(l.codeword, l.grid);
          return {
            id: l._id || l.id,
            codeword: l.codeword,
            width: parsed.width,
            height: parsed.height,
            aspect: parsed.aspect,
            slotCount: parsed.slotCount,
            structure: parsed.structure,
            media: parsed.media,
            orientation: parsed.orientation,
            slots: parsed.slots,
            footer: parsed.footer,
            grid: parsed,
          };
        });
        setGlobalLayouts(normalized);
      }
    }).catch(e => console.error(e));

    api.org.aiTemplates().then((r) => {
      setTemplates(r.templates.filter(t => t.source === 'manual'));
    }).catch((e) => toast(e.message, 'error'));
  }
  
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!templates) return []
    let r = templates
    if (search) {
      const s = search.toLowerCase()
      r = r.filter((t) => t.name.toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s))
    }
    return r
  }, [templates, search])

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.org.deleteAiTemplate(deleting.id || deleting._id)
      toast(`Deleted “${deleting.name}”`)
      setDeleting(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (playground) {
    return (
      <ManualBuilder
        globalLayouts={globalLayouts}
        initial={playground.mode === 'edit' ? playground.template : null}
        onClose={() => setPlayground(null)}
        onSaved={() => { setPlayground(null); load() }}
      />
    )
  }

  return (
    <div className="page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-title" style={{ fontSize: 24, fontWeight: 600 }}>Custom Templates (Manual Builder)</div>
          <div className="page-sub" style={{ marginTop: 8, color: 'var(--muted)' }}>
            Manually build templates using Global Layouts. Move slots, upload backgrounds, and draw overlays with a brush!
          </div>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setPlayground({ mode: 'new' })}>
          Create Custom Template
        </Button>
      </div>

      <Card style={{ paddingTop: 0 }}>
        <div className="row wrap gap-12" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search custom templates…" style={{ width: 210 }} />
          <div className="grow" />
          <span className="chip chip-neutral">{filtered.length} of {templates?.length || 0}</span>
        </div>

        {!templates ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="template"
            title="No custom templates yet"
            message="Create your first manual template with custom backgrounds, overlays, and resizable slots."
            action={<Button variant="primary" icon="plus" onClick={() => setPlayground({ mode: 'new' })}>Create template</Button>}
          />
        ) : (
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
            {filtered.map((t) => {
              const lId = t.layout?.code || t.layoutId
              const aspect = t.layout?.width && t.layout?.height ? t.layout.width / t.layout.height : 2/3
              return (
                <div key={t.id || t._id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="t13 fw6 ellipsis" title={t.name}>{t.name}</div>
                      <div className="t11 faint ellipsis">Global Layout: {lId}</div>
                    </div>
                    <span className="chip chip-info" style={{ flex: 'none' }} title="Manual Builder">Manual</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-soft)' }}>
                    <div style={{ width: 120 }}>
                      <TemplateRenderer 
                        layout={{ 
                          aspect: aspect, 
                          slots: (t.slots && t.slots.length > 0) ? t.slots : (lId ? parseLayoutCodeword(lId)?.slots || [] : []) 
                        }} 
                        design={t.design} 
                        cachedAssets={(t.assets || []).reduce((acc, a) => { if (a.assetId && a.url) acc[a.assetId] = a.url; return acc; }, {})}
                      />
                    </div>
                  </div>
                  <div className="row wrap gap-6">
                    <Chip tone="info">{lId}</Chip>
                    {t.category ? <Chip tone="neutral">{t.category}</Chip> : null}
                    <Chip tone="pink">₹{Number(t.price) || 0}</Chip>
                  </div>
                  <div className="row between gap-8" style={{ marginTop: 'auto', borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
                    <div className="row gap-6">
                      <Button size="sm" variant="ghost" icon="eye" title="Preview template" onClick={() => setPreviewing(t)}>
                        Preview
                      </Button>
                      <Button size="sm" variant="outline" icon="edit" title="Edit template" onClick={() => setPlayground({ mode: 'edit', template: t })}>
                        Edit
                      </Button>
                    </div>
                    <Button size="sm" variant="ghost" icon="trash" style={{ color: 'var(--danger)' }} title="Delete template" onClick={() => setDeleting(t)} />
                  </div>
                  <div className="t10 faint">added {dateShort(t.createdAt)}</div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {previewing && (() => {
        const lId = previewing.layout?.code || previewing.layoutId || 'custom'
        const aspect = previewing.layout?.width && previewing.layout?.height
          ? previewing.layout.width / previewing.layout.height
          : (parseLayoutCodeword(lId)?.aspect || 2 / 3)
        const isLandscape = aspect > 1
        const previewSlots = (previewing.slots && previewing.slots.length > 0)
          ? previewing.slots
          : (lId ? parseLayoutCodeword(lId)?.slots || [] : [])
        const previewAssets = (previewing.assets || []).reduce((acc, a) => {
          if (a.assetId && a.url) acc[a.assetId] = a.url
          return acc
        }, {})
        return (
          <Modal
            open={!!previewing}
            onClose={() => setPreviewing(null)}
            title={previewing.name}
            sub={`Layout: ${lId} · ${previewSlots.length} photo slot${previewSlots.length === 1 ? '' : 's'} · ₹${Number(previewing.price) || 0}`}
            width="wide"
            footer={
              <>
                <Button variant="ghost" onClick={() => setPreviewing(null)}>Close</Button>
                <Button
                  variant="primary"
                  icon="edit"
                  onClick={() => {
                    const tpl = previewing
                    setPreviewing(null)
                    setPlayground({ mode: 'edit', template: tpl })
                  }}
                >
                  Edit Template
                </Button>
              </>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: '100%',
                  background: '#0d0d11',
                  borderRadius: 12,
                  padding: '28px 20px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  border: '1px solid var(--line-soft)',
                }}
              >
                <div style={{ width: isLandscape ? 520 : 320, maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
                  <TemplateRenderer
                    layout={{ aspect, slots: previewSlots }}
                    design={previewing.design}
                    cachedAssets={previewAssets}
                  />
                </div>
              </div>
              <div className="row wrap gap-8" style={{ width: '100%', justifyContent: 'space-between' }}>
                <div className="row wrap gap-8">
                  <Chip tone="info">Layout: {lId}</Chip>
                  <Chip tone="neutral">Category: {previewing.category || 'Custom'}</Chip>
                  <Chip tone="pink">Price: ₹{Number(previewing.price) || 0}</Chip>
                  <Chip tone="purple">{previewSlots.length} Photo Slot{previewSlots.length === 1 ? '' : 's'}</Chip>
                </div>
                {previewing.description ? (
                  <div className="t12 muted">{previewing.description}</div>
                ) : null}
              </div>
            </div>
          </Modal>
        )
      })()}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        danger
        loading={busy}
        title={`Delete “${deleting?.name}”?`}
        message="Are you sure you want to delete this custom template?"
        confirmLabel="Delete template"
      />
    </div>
  )
}

// ---------------- Manual Builder ----------------

const THEME_PRESETS = [
  { name: 'Neon Cyber', type: 'gradient', colors: ['#1f0036', '#0d001a'], primary: '#EA097F', bg: '#1f0036' },
  { name: 'Royal Gold', type: 'gradient', colors: ['#1c1608', '#2b1f0d'], primary: '#F59E0B', bg: '#1c1608' },
  { name: 'Sunset Strip', type: 'gradient', colors: ['#2e0854', '#8b1848'], primary: '#FF512F', bg: '#2e0854' },
  { name: 'Midnight Blue', type: 'gradient', colors: ['#090d1a', '#141c38'], primary: '#3b82f6', bg: '#090d1a' },
  { name: 'Emerald Luxe', type: 'gradient', colors: ['#061e14', '#0f3d2a'], primary: '#10B981', bg: '#061e14' },
  { name: 'Studio Black', type: 'solid', colors: ['#121216'], primary: '#EA097F', bg: '#121216' },
  { name: 'Pure White', type: 'solid', colors: ['#ffffff'], primary: '#EA097F', bg: '#ffffff' }
];

function defaultDesign() {
  return {
    bg: { type: 'gradient', colors: ['#1f0036', '#0d001a'] },
    palette: { primary: '#EA097F', background: '#1f0036', text: '#ffffff' },
    photoTreatment: { border: true, borderWidth: 4, shadow: true },
    decorations: []
  }
}

function ManualBuilder({ globalLayouts, initial = null, onClose, onSaved }) {
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const initialLayoutSyncSkipped = useRef(Boolean(initial))
  const [f, setF] = useState(() => {
    if (initial) {
      const code = initial.layout?.code || initial.layoutId || ''
      const matched = globalLayouts.find(gl => gl.codeword === code || gl.id === initial.layoutId) || globalLayouts[0]
      const parsed = code ? parseLayoutCodeword(code) : null
      const width = initial.layout?.width || matched?.width || parsed?.width || 1200
      const height = initial.layout?.height || matched?.height || parsed?.height || 1800
      const aspect = width && height ? width / height : (matched?.aspect || parsed?.aspect || 2 / 3)
      const initialSlots = Array.isArray(initial.slots) && initial.slots.length > 0
        ? initial.slots.map(s => ({ ...s }))
        : (Array.isArray(matched?.slots) ? matched.slots.map(s => ({ ...s })) : (parsed?.slots || []))
      return {
        name: initial.name || 'My Custom Template',
        description: initial.description || '',
        category: initial.category || 'Custom',
        price: initial.price != null ? Number(initial.price) : 0,
        layoutId: matched?.id || code || '',
        layoutObj: {
          ...(matched || {}),
          codeword: code || matched?.codeword || '46-v1',
          slots: initialSlots,
          aspect,
          width,
          height,
          orientation: initial.layout?.orientation || (aspect > 1 ? 'landscape' : 'portrait'),
          slotCount: initialSlots.length || initial.layout?.slotCount || matched?.slotCount || 1,
        },
        design: initial.design ? JSON.parse(JSON.stringify(initial.design)) : defaultDesign(),
        assets: Array.isArray(initial.assets) ? initial.assets.map(a => ({ ...a })) : [],
      }
    }
    const first = globalLayouts[0];
    const initialSlots = (first?.slots && Array.isArray(first.slots)) ? first.slots.map(s => ({ ...s })) : [];
    return {
      name: 'My Custom Template',
      description: '',
      category: 'Custom',
      price: 0,
      layoutId: first?.id || '',
      layoutObj: first ? {
        ...first,
        slots: initialSlots,
        aspect: first.aspect || (first.width / first.height) || (2/3),
        width: first.width || 1200,
        height: first.height || 1800,
        orientation: first.orientation || (first.aspect > 1 ? 'landscape' : 'portrait')
      } : { slots: [], aspect: 2/3, width: 1200, height: 1800, orientation: 'portrait' },
      design: defaultDesign(),
      assets: []
    };
  });
  
  const [drawMode, setDrawMode] = useState(false)
  const [brushMode, setBrushMode] = useState('theme') // 'color' or 'theme'
  const [brushColor, setBrushColor] = useState('#EA097F')
  const [brushSize, setBrushSize] = useState(25)
  const [bgPattern, setBgPattern] = useState(null)
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const historyRef = useRef([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedDecIndex, setSelectedDecIndex] = useState(null)
  const [cutoutStudioTarget, setCutoutStudioTarget] = useState(null) // { imageSrc, index, asNew }

  // Keyboard arrow keys nudge for active decoration with pixel accuracy
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedDecIndex === null) return;
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      const dec = f.design.decorations?.[selectedDecIndex];
      if (!dec) return;

      const step = e.shiftKey ? 0.05 : 0.01;
      let handled = false;
      let newX = dec.x !== undefined ? dec.x : 0;
      let newY = dec.y !== undefined ? dec.y : 0;

      if (e.key === 'ArrowLeft') { newX -= step; handled = true; }
      else if (e.key === 'ArrowRight') { newX += step; handled = true; }
      else if (e.key === 'ArrowUp') { newY -= step; handled = true; }
      else if (e.key === 'ArrowDown') { newY += step; handled = true; }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeDec(selectedDecIndex);
        setSelectedDecIndex(null);
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        updateDec(selectedDecIndex, 'x', Number(newX.toFixed(3)));
        updateDec(selectedDecIndex, 'y', Number(newY.toFixed(3)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDecIndex, f.design.decorations]);

  // Auto-select first layout if globalLayouts finishes loading after mount
  useEffect(() => {
    if (!f.layoutId && globalLayouts.length > 0) {
      const first = globalLayouts[0];
      const initialSlots = (first.slots && Array.isArray(first.slots)) ? first.slots.map(s => ({ ...s })) : [];
      setF(x => ({
        ...x,
        layoutId: first.id,
        layoutObj: {
          ...first,
          slots: initialSlots,
          aspect: first.aspect || (first.width / first.height) || (2/3),
          width: first.width || 1200,
          height: first.height || 1800,
          orientation: first.orientation || (first.aspect > 1 ? 'landscape' : 'portrait'),
          slotCount: initialSlots.length || first.slotCount || 1
        }
      }));
    }
  }, [globalLayouts, f.layoutId]);

  // Synchronize slots and aspect ratio whenever the user selects a global layout variant
  useEffect(() => {
    if (!f.layoutId) return;
    if (initialLayoutSyncSkipped.current) {
      initialLayoutSyncSkipped.current = false;
      const matched = globalLayouts.find(gl => gl.id === f.layoutId || gl.codeword === (initial?.layout?.code || initial?.layoutId));
      if (matched && f.layoutId !== matched.id) {
        initialLayoutSyncSkipped.current = true;
        setF(x => ({ ...x, layoutId: matched.id }));
      }
      return;
    }
    const l = globalLayouts.find(gl => gl.id === f.layoutId);
    if (l) {
      let initialSlots = [];
      if (Array.isArray(l.slots) && l.slots.length > 0) {
        initialSlots = l.slots.map(s => ({ ...s }));
      } else {
        const parsed = parseLayoutCodeword(l.codeword, l.grid);
        if (Array.isArray(parsed?.slots) && parsed.slots.length > 0) {
          initialSlots = parsed.slots.map(s => ({ ...s }));
        }
      }

      setF(x => ({ 
        ...x, 
        layoutObj: { 
          ...l, 
          slots: initialSlots,
          aspect: l.aspect || (l.width / l.height) || (2/3),
          width: l.width || 1200,
          height: l.height || 1800,
          orientation: l.orientation || (l.aspect > 1 ? 'landscape' : 'portrait'),
          slotCount: initialSlots.length || l.slotCount || 1
        } 
      }));
    }
  }, [f.layoutId, globalLayouts]);

  useEffect(() => {
    if (drawMode && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width = canvas.offsetWidth * 2
      canvas.height = canvas.offsetHeight * 2
      const ctx = canvas.getContext('2d')
      ctx.scale(2, 2)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctxRef.current = ctx
      historyRef.current = [] // clear history on open
      
      // Load background pattern for "Bring Theme Forward" mode
      if (f.design.bg?.type === 'image' && f.design.bg?.url) {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          const cw = canvas.offsetWidth
          const ch = canvas.offsetHeight
          const offscreen = document.createElement('canvas')
          // Use DOM dimensions so when drawn in the scaled ctx, it perfectly matches the screen
          offscreen.width = cw
          offscreen.height = ch
          const octx = offscreen.getContext('2d')
          
          const canvasAspect = cw / ch
          const imgAspect = img.width / img.height
          let dx = 0, dy = 0, dw = cw, dh = ch
          if (canvasAspect > imgAspect) {
             dh = cw / imgAspect
             dy = (ch - dh) / 2
          } else {
             dw = ch * imgAspect
             dx = (cw - dw) / 2
          }
          octx.drawImage(img, dx, dy, dw, dh)
          setBgPattern(ctx.createPattern(offscreen, 'no-repeat'))
        }
        img.src = f.design.bg.url
      } else {
        setBgPattern(null)
      }
    }
  }, [drawMode, f.design.bg])

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setD = (k, v) => setF((x) => ({ ...x, design: { ...x.design, [k]: v } }))

  const save = async () => {
    if (!f.name.trim()) return setError('Template name is required.')
    if (!f.layoutId && !f.layoutObj?.codeword) return setError('Please select a layout.')
    setBusy(true)
    setError('')
    try {
      const body = {
        name: f.name.trim(),
        description: f.description.trim(),
        category: f.category,
        price: Number(f.price || 0),
        source: 'manual', // Distinguish from 'ai'
        layout: {
          code: f.layoutObj.codeword,
          width: f.layoutObj.width,
          height: f.layoutObj.height,
          orientation: f.layoutObj.aspect > 1 ? 'landscape' : 'portrait',
          slotCount: f.layoutObj.slots?.length || f.layoutObj.slotCount || 1
        },
        slots: f.layoutObj.slots, // the custom dragged/resized slots!
        design: f.design,
        assets: f.assets
      }
      const existingId = initial?.id || initial?._id
      if (existingId) {
        await api.org.updateAiTemplate(existingId, body)
        toast(`Template “${body.name}” updated!`)
      } else {
        await api.org.saveAiTemplate(body)
        toast(`Template “${body.name}” created!`)
      }
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // --- Upload Handlers ---
  const handleUploadBg = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
        const dataUrl = ev.target.result
        const tempId = `temp-bg-${Date.now()}`
        setF(x => {
            const newAssets = x.assets.filter(a => a.role !== 'background')
            newAssets.push({ assetId: tempId, url: dataUrl, type: 'background', role: 'background', mimeType: file.type, isTemp: true })
            return {
                ...x,
                assets: newAssets,
                design: {
                    ...x.design,
                    bg: { type: 'image', url: dataUrl, assetId: tempId },
                    background: { type: 'image', url: dataUrl, assetId: tempId } // Compatibility for AI backend
                }
            }
        })
    }
    reader.readAsDataURL(file)
  }

  const handleUploadSticker = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
        const dataUrl = ev.target.result
        const tempId = `temp-dec-${Date.now()}-${Math.random().toString(36).slice(2)}`
        setF(x => {
            const newAssets = [...x.assets]
            newAssets.push({ assetId: tempId, url: dataUrl, type: 'decoration', role: 'decoration', mimeType: file.type, isTemp: true })
            const newDecs = [...(x.design.decorations || [])]
            newDecs.push({
                assetId: tempId,
                url: dataUrl,
                type: 'decoration',
                x: 0.25, y: 0.25, width: 0.5, height: 0.5, // Percentages
                overlay: true // Overlays slots by default
            })
            return { ...x, assets: newAssets, design: { ...x.design, decorations: newDecs } }
        })
    }
    reader.readAsDataURL(file)
  }

  const processBgRemoval = async (imageSource) => {
    try {
      // 1. Instant client-side HTML5 canvas background removal
      const clientResult = await removeBackgroundCanvas(imageSource, { tolerance: 42, feather: 14 });
      return clientResult;
    } catch (clientErr) {
      console.warn('Client background removal error, falling back to server API:', clientErr);
      // 2. Server-side sharp / remove.bg fallback
      const res = await api.org.removeBg({ image: imageSource, tolerance: 42, feather: 14 });
      return res?.url || imageSource;
    }
  }

  const handleUploadCutoutSticker = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result
      toast('Removing background for transparent overlay…', 'info')
      try {
        const finalUrl = await processBgRemoval(dataUrl)
        const tempId = `temp-dec-${Date.now()}-${Math.random().toString(36).slice(2)}`
        setF(x => {
          const newAssets = [...x.assets]
          newAssets.push({ assetId: tempId, url: finalUrl, type: 'decoration', role: 'decoration', mimeType: 'image/png', isTemp: true })
          const newDecs = [...(x.design.decorations || [])]
          newDecs.push({
            assetId: tempId,
            url: finalUrl,
            type: 'decoration',
            x: 0, y: 0, width: 1, height: 1, // Default full frame so overlay borders fit cleanly
            overlay: true
          })
          return { ...x, assets: newAssets, design: { ...x.design, decorations: newDecs } }
        })
        toast('Transparent overlay added! Slots are visible underneath.', 'success')
      } catch (err) {
        toast('Failed to process cutout: ' + err.message, 'error')
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleConvertBgToOverlay = async () => {
    const bgUrl = f.design.bg?.url;
    if (!bgUrl) return toast('Please upload a background image first.', 'info');
    toast('Removing background to convert photo to overlay…', 'info');
    try {
      const cutoutUrl = await processBgRemoval(bgUrl);
      const tempId = `temp-dec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setF(x => {
        const newAssets = [...x.assets];
        newAssets.push({ assetId: tempId, url: cutoutUrl, type: 'decoration', role: 'decoration', mimeType: 'image/png', isTemp: true });
        const newDecs = [...(x.design.decorations || [])];
        newDecs.push({
          assetId: tempId,
          url: cutoutUrl,
          type: 'decoration',
          x: 0, y: 0, width: 1, height: 1, // Full frame overlay
          overlay: true
        });
        return {
          ...x,
          assets: newAssets,
          design: {
            ...x.design,
            decorations: newDecs
          }
        };
      });
      toast('Photo background removed and applied as overlay! Slots are visible underneath.', 'success');
    } catch (err) {
      toast('Failed to remove background: ' + err.message, 'error');
    }
  }

  const handleRemoveBgOnDecoration = async (i) => {
    const dec = f.design.decorations?.[i];
    if (!dec || !dec.url) return;
    toast('Removing background from decoration…', 'info');
    try {
      const finalUrl = await processBgRemoval(dec.url);
      setF(x => {
        const decs = [...(x.design.decorations || [])];
        decs[i] = { ...decs[i], url: finalUrl, overlay: true };
        return { ...x, design: { ...x.design, decorations: decs } };
      });
      toast('Background removed! Item is now transparent.', 'success');
    } catch (err) {
      toast('Failed to remove background: ' + err.message, 'error');
    }
  }

  const handleFitFullFrame = (i) => {
    setF(x => {
      const decs = [...(x.design.decorations || [])];
      decs[i] = { ...decs[i], x: 0, y: 0, width: 1, height: 1, overlay: true };
      return { ...x, design: { ...x.design, decorations: decs } };
    });
    toast('Snapped overlay to full canvas!', 'info');
  }

  const handleCenterDec = (i) => {
    setF(x => {
      const decs = [...(x.design.decorations || [])];
      decs[i] = { ...decs[i], x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
      return { ...x, design: { ...x.design, decorations: decs } };
    });
  }

  const alignDec = (i, type) => {
    setF(x => {
      const decs = [...(x.design.decorations || [])];
      const dec = { ...decs[i] };
      const w = dec.width !== undefined ? dec.width : 0.5;
      const h = dec.height !== undefined ? dec.height : 0.5;

      switch (type) {
        case 'center-x':
          dec.x = Number(((1 - w) / 2).toFixed(3));
          break;
        case 'center-y':
          dec.y = Number(((1 - h) / 2).toFixed(3));
          break;
        case 'top-left':
          dec.x = 0; dec.y = 0;
          break;
        case 'top-right':
          dec.x = Number((1 - w).toFixed(3)); dec.y = 0;
          break;
        case 'bottom-left':
          dec.x = 0; dec.y = Number((1 - h).toFixed(3));
          break;
        case 'bottom-right':
          dec.x = Number((1 - w).toFixed(3)); dec.y = Number((1 - h).toFixed(3));
          break;
        case 'full-frame':
          dec.x = 0; dec.y = 0; dec.width = 1; dec.height = 1; dec.overlay = true;
          break;
        default:
          break;
      }
      decs[i] = dec;
      return { ...x, design: { ...x.design, decorations: decs } };
    });
  }

  const nudgeDec = (i, prop, delta) => {
    setF(x => {
      const decs = [...(x.design.decorations || [])];
      const curr = decs[i]?.[prop] !== undefined ? decs[i][prop] : (prop === 'width' || prop === 'height' ? 0.5 : 0);
      let next = curr + delta;
      if (prop === 'width' || prop === 'height') {
        next = Math.max(0.04, Math.min(2.0, next));
      } else {
        next = Math.max(-0.6, Math.min(1.4, next));
      }
      decs[i] = { ...decs[i], [prop]: Number(next.toFixed(3)) };
      return { ...x, design: { ...x.design, decorations: decs } };
    });
  }

  const updateDec = (i, k, v) => {
      setF(x => {
          const decs = [...(x.design.decorations || [])]
          decs[i] = { ...decs[i], [k]: v }
          return { ...x, design: { ...x.design, decorations: decs } }
      })
  }

  const removeDec = (i) => {
      setF(x => {
          const decs = [...(x.design.decorations || [])]
          decs.splice(i, 1)
          return { ...x, design: { ...x.design, decorations: decs } }
      })
  }

  // --- Draw Handlers ---
  const saveStateToHistory = () => {
    if (!canvasRef.current || !ctxRef.current) return;
    const canvas = canvasRef.current;
    // Don't use scaling ctx reference for getImageData
    const rawCtx = canvas.getContext('2d');
    historyRef.current.push(rawCtx.getImageData(0, 0, canvas.width, canvas.height));
  }

  const undoDraw = () => {
    if (!canvasRef.current) return;
    const rawCtx = canvasRef.current.getContext('2d');
    if (historyRef.current.length > 0) {
      const lastState = historyRef.current.pop();
      rawCtx.putImageData(lastState, 0, 0);
    } else {
      rawCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }

  const getCanvasCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const startDrawing = (e) => {
    if (!ctxRef.current) return
    saveStateToHistory()
    const { x, y } = getCanvasCoords(e)
    ctxRef.current.beginPath()
    ctxRef.current.moveTo(x, y)
    
    if (brushMode === 'theme') {
      if (f.design.bg?.type === 'image' && bgPattern) {
        ctxRef.current.strokeStyle = bgPattern
      } else if (f.design.bg?.type === 'solid') {
        ctxRef.current.strokeStyle = f.design.bg.colors?.[0] || '#222222'
      } else {
        ctxRef.current.strokeStyle = 'transparent'
      }
    } else {
      ctxRef.current.strokeStyle = brushColor
    }
    
    ctxRef.current.lineWidth = brushSize
    setIsDrawing(true)
  }
  
  const draw = (e) => {
    if (!isDrawing || !ctxRef.current) return
    const { x, y } = getCanvasCoords(e)
    ctxRef.current.lineTo(x, y)
    ctxRef.current.stroke()
  }

  const stopDrawing = () => {
    if (!ctxRef.current) return
    ctxRef.current.closePath()
    setIsDrawing(false)
  }

  const saveDrawing = () => {
    if (!canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const tempId = `temp-draw-${Date.now()}`
    
    setF(x => {
        const newAssets = [...x.assets]
        newAssets.push({ assetId: tempId, url: dataUrl, type: 'decoration', role: 'decoration', mimeType: 'image/png', isTemp: true })
        const newDecs = [...(x.design.decorations || [])]
        // Save drawing as a full-screen overlay decoration
        newDecs.push({
            assetId: tempId,
            url: dataUrl,
            type: 'decoration',
            x: 0, y: 0, width: 1, height: 1, // Full size percentages
            overlay: true
        })
        return { ...x, assets: newAssets, design: { ...x.design, decorations: newDecs } }
    })
    setDrawMode(false)
  }

  let computedAspect = f.layoutObj?.aspect || (2/3);
  if (typeof computedAspect === 'string' && computedAspect.includes('/')) {
    const [w, h] = computedAspect.split('/');
    computedAspect = Number(w) / Number(h);
  } else {
    computedAspect = Number(computedAspect);
  }
  const isLandscapeMode = computedAspect > 1;

  return (
    <div className="page" style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100vh', boxSizing: 'border-box' }}>
      <div className="page-head" style={{ marginBottom: 24, flexShrink: 0 }}>
        <div>
          <div className="page-title" style={{ fontSize: 24, fontWeight: 600 }}>
            {initial ? `Edit Custom Template — “${initial.name}”` : 'Custom Template Builder'}
          </div>
          <div className="page-sub" style={{ marginTop: 8, color: 'var(--muted)' }}>
            Manually design your template layout. Move/resize slots, upload backgrounds, and draw overlays!
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {error ? <span className="input-error">{error}</span> : null}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} disabled={busy || drawMode}>
            {busy ? 'Saving…' : initial ? 'Update Template' : 'Save Template'}
          </Button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
        {/* ---- left: config ---- */}
        <Card style={{ flex: '1 1 50%', overflowY: 'auto', padding: '24px' }}>
          <div className="sess-block-title"><Icon name="template" size={12} /> 1 · Select Global Layout Variant</div>
          
          {globalLayouts.length === 0 ? (
             <div className="t12 muted mt-8">No global layouts have been created by the platform owner yet!</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, maxHeight: 180, overflowY: 'auto', padding: '4px', marginBottom: 14 }}>
              {globalLayouts.map((l) => {
                const sel = l.id === f.layoutId
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => set('layoutId', l.id)}
                    title={l.codeword}
                    style={{
                      cursor: 'pointer', borderRadius: 8, padding: '8px 6px', textAlign: 'center',
                      border: `1.5px solid ${sel ? 'var(--hp-pink)' : 'var(--line)'}`,
                      background: sel ? 'var(--hp-pink-soft)' : 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ height: 48, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <LayoutCanvas layout={l} isSelected={sel} showFooterLabel={false} />
                    </div>
                    <div className="t10" style={{ fontSize: 9.5, fontWeight: 700, marginTop: 6, color: sel ? 'var(--hp-pink-deep)' : 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {l.codeword}
                    </div>
                    <div style={{ fontSize: 8.5, color: 'var(--muted)', marginTop: 1 }}>
                      {l.slotCount || l.slots?.length || 1} photo{(l.slotCount || l.slots?.length || 1) > 1 ? 's' : ''}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="sess-block-title"><Icon name="sliders" size={12} /> 2 · Background &amp; Theme Details</div>
          <div className="row gap-12">
            <div style={{ flex: 2 }}>
              <Field label="Template name" required>
                <TextInput value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Corporate Gala 2026" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Price (₹)">
                <TextInput type="number" min="0" value={f.price ?? 0} onChange={(e) => set('price', Number(e.target.value))} placeholder="0 for default" />
              </Field>
            </div>
          </div>

          {/* Quick Theme Presets */}
          <div className="mt-12 mb-8">
            <div className="t11 faint mb-6">🎨 Quick Theme Presets (Click to apply):</div>
            <div className="row wrap gap-6">
              {THEME_PRESETS.map((p) => {
                const isActive = f.design.bg?.type === p.type && f.design.bg?.colors?.[0] === p.colors[0];
                const previewBg = p.type === 'gradient' ? `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})` : p.colors[0];
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      const d = { type: p.type, colors: p.colors };
                      setF(x => ({
                        ...x,
                        design: {
                          ...x.design,
                          bg: d,
                          background: d,
                          palette: { ...x.design.palette, background: p.bg, primary: p.primary }
                        }
                      }));
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: 'var(--surface-2)',
                      border: isActive ? '2px solid var(--hp-pink)' : '1px solid var(--line-soft)',
                      color: isActive ? 'var(--hp-pink)' : 'var(--ink)'
                    }}
                  >
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: previewBg, border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="row gap-12 mt-12 wrap" style={{ alignItems: 'flex-start' }}>
            <Field label="Background Mode">
              <Select
                value={f.design.bg?.type === 'image' ? 'image' : (f.design.bg?.type === 'gradient' ? 'gradient' : 'solid')}
                onChange={(e) => {
                  const t = e.target.value
                  if (t === 'image') {
                    const d = { type: 'image', url: f.design.bg?.url || null }
                    setF(x => ({ ...x, design: { ...x.design, bg: d, background: d } }))
                  } else if (t === 'gradient') {
                    const d = { type: 'gradient', colors: ['#1f0036', '#0d001a'] }
                    setF(x => ({ ...x, design: { ...x.design, bg: d, background: d, palette: { ...x.design.palette, background: '#1f0036' } } }))
                  } else {
                    const d = { type: 'solid', colors: [f.design.bg?.colors?.[0] || '#222222'] }
                    setF(x => ({ ...x, design: { ...x.design, bg: d, background: d, palette: { ...x.design.palette, background: f.design.bg?.colors?.[0] || '#222222' } } }))
                  }
                }}
                style={{ height: 38, minWidth: 140 }}
              >
                <option value="solid">Solid Colour</option>
                <option value="gradient">Gradient Theme</option>
                <option value="image">Custom Upload Image</option>
              </Select>
            </Field>

            {f.design.bg?.type === 'solid' ? (
              <Field label="Colour">
                <input type="color" value={f.design.bg?.colors?.[0] || '#222222'} onChange={(e) => {
                  const d = { type: 'solid', colors: [e.target.value] }
                  setF(x => ({ ...x, design: { ...x.design, bg: d, background: d, palette: { ...x.design.palette, background: e.target.value } } }))
                }} style={colorBoxStyle} />
              </Field>
            ) : f.design.bg?.type === 'gradient' ? (
              <div className="row gap-8">
                <Field label="Start Color">
                  <input type="color" value={f.design.bg?.colors?.[0] || '#1f0036'} onChange={(e) => {
                    const next = [e.target.value, f.design.bg?.colors?.[1] || '#0d001a']
                    const d = { type: 'gradient', colors: next }
                    setF(x => ({ ...x, design: { ...x.design, bg: d, background: d, palette: { ...x.design.palette, background: e.target.value } } }))
                  }} style={colorBoxStyle} />
                </Field>
                <Field label="End Color">
                  <input type="color" value={f.design.bg?.colors?.[1] || '#0d001a'} onChange={(e) => {
                    const next = [f.design.bg?.colors?.[0] || '#1f0036', e.target.value]
                    const d = { type: 'gradient', colors: next }
                    setF(x => ({ ...x, design: { ...x.design, bg: d, background: d } }))
                  }} style={colorBoxStyle} />
                </Field>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <Field label="Upload Image">
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUploadBg} />
                </Field>
                {f.design.bg?.url && (
                  <div className="row gap-8 mt-4" style={{ alignItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)' }}>
                      <img src={f.design.bg.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span className="t10 faint">Active Background Image</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="row gap-12 mt-12">
            <Field label="Border Colour">
              <input type="color" value={f.design.palette?.primary || '#EA097F'} onChange={(e) => setF(x => ({ ...x, design: { ...x.design, palette: { ...x.design.palette, primary: e.target.value } } }))} style={colorBoxStyle} />
            </Field>
            <Field label="Slot Border Width">
              <input type="number" min="0" max="20" value={f.design.photoTreatment?.borderWidth || 4} onChange={(e) => setF(x => ({ ...x, design: { ...x.design, photoTreatment: { ...x.design.photoTreatment, borderWidth: Number(e.target.value), border: Number(e.target.value) > 0 } } }))} style={{ height: 38, width: 80, padding: 8 }} />
            </Field>
          </div>

          <div className="sess-block-title mt-24">
             <div className="row between" style={{ width: '100%' }}>
                <span><Icon name="brush" size={12} /> 3 · Add Overlays & Draw</span>
                <span className="t11 muted">Slots are fixed by the selected layout variant</span>
             </div>
          </div>
          <div className="row wrap gap-12">
             <input type="file" id="sticker-upload" accept="image/png" style={{display:'none'}} onChange={handleUploadSticker} />
             <input type="file" id="cutout-upload" accept="image/png,image/jpeg,image/webp" style={{display:'none'}} onChange={handleUploadCutoutSticker} />
             <input 
               type="file" 
               id="crop-cutout-upload" 
               accept="image/png,image/jpeg,image/webp" 
               style={{display:'none'}} 
               onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (!file) return;
                 const reader = new FileReader();
                 reader.onload = (ev) => {
                   setCutoutStudioTarget({ imageSrc: ev.target.result, asNew: true });
                 };
                 reader.readAsDataURL(file);
                 e.target.value = '';
               }} 
             />
             <Button variant="outline" icon="sparkles" onClick={() => document.getElementById('cutout-upload').click()} style={{ borderColor: 'var(--hp-pink)', color: 'var(--hp-pink)', fontWeight: 600 }}>
                 Upload Overlay (Auto Remove BG)
             </Button>
             <Button variant="outline" onClick={() => document.getElementById('crop-cutout-upload').click()} style={{ borderColor: '#00c896', color: '#00c896', fontWeight: 600 }}>
                 ✂️ Cut Specific Part (Crop & Mask)
             </Button>
             <Button variant="outline" icon="image" onClick={() => document.getElementById('sticker-upload').click()}>
                 Add Sticker (PNG)
             </Button>
             <Button variant={drawMode ? "primary" : "outline"} icon="brush" onClick={() => setDrawMode(!drawMode)}>
                 {drawMode ? "Cancel Drawing" : "Draw Brush Overlay"}
             </Button>
          </div>
          
          {drawMode && (
             <div className="mt-12 p-12" style={{ background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--hp-pink)' }}>
                <div className="fw6 mb-8 t12" style={{ color: 'var(--hp-pink)' }}>Brush Settings</div>
                <div className="row gap-12 mb-12">
                   <Field label="Brush Style">
                      <Select value={brushMode} onChange={e => setBrushMode(e.target.value)} style={{ height: 38 }}>
                        <option value="theme">Background Theme</option>
                        <option value="color">Solid Color</option>
                      </Select>
                   </Field>
                   {brushMode === 'color' && (
                     <Field label="Brush Color"><input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} style={colorBoxStyle} /></Field>
                   )}
                   <Field label="Brush Size">
                      <div className="row gap-8">
                        <input type="range" min="2" max="100" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} />
                        <span className="t12 fw6">{brushSize}px</span>
                      </div>
                   </Field>
                </div>
                <div className="t11 faint mb-12">
                   {brushMode === 'theme' ? 'Painting with this brush brings the background theme forward over the slots.' : 'Draw directly on the preview to the right.'}
                </div>
                <div className="row gap-8">
                   <Button variant="outline" size="sm" onClick={undoDraw}>Undo Last Stroke</Button>
                   <Button variant="primary" size="sm" onClick={saveDrawing}>Save Drawing</Button>
                </div>
             </div>
          )}

          <div style={{ maxHeight: 380, overflowY: 'auto' }} className="mt-12">
             {(f.design.decorations || []).map((dec, i) => {
               const isSelected = selectedDecIndex === i;
               const curX = Math.round((dec.x !== undefined ? dec.x : 0) * 100);
               const curY = Math.round((dec.y !== undefined ? dec.y : 0) * 100);
               const curW = Math.round((dec.width !== undefined ? dec.width : 0.5) * 100);
               const curH = Math.round((dec.height !== undefined ? dec.height : 0.5) * 100);

               return (
                 <div 
                   key={i} 
                   onClick={() => setSelectedDecIndex(i)}
                   style={{ 
                     background: isSelected ? 'var(--surface-3, #22222a)' : 'var(--surface-2)', 
                     padding: 12, 
                     borderRadius: 8, 
                     marginBottom: 8, 
                     border: isSelected ? '2px solid var(--hp-pink)' : '1px solid var(--line-soft)',
                     boxShadow: isSelected ? '0 0 12px rgba(234,9,127,0.2)' : 'none',
                     cursor: 'pointer'
                   }}
                 >
                   {/* Card Top: Thumbnail + Title + Cutout Studio + Delete */}
                   <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                     <div style={{ width: 44, height: 44, background: 'var(--line-soft)', borderRadius: 4, flexShrink: 0, overflow: 'hidden', border: '1px solid var(--line)' }}>
                       <img src={dec.url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                     </div>

                     <div style={{ flex: 1, minWidth: 0 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                         <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--hp-pink)' : 'var(--ink)' }}>
                           Overlay Layer #{i + 1}
                         </span>
                         {isSelected && (
                           <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--hp-pink)', color: '#fff', fontWeight: 700 }}>
                             SELECTED
                           </span>
                         )}
                       </div>
                       <div className="t10 faint">Click on preview to drag or resize with handles</div>
                     </div>

                     <button
                       type="button"
                       onClick={(e) => { e.stopPropagation(); setCutoutStudioTarget({ imageSrc: dec.url, index: i, asNew: false }); }}
                       style={{
                         fontSize: 11, padding: '4px 8px', borderRadius: 4,
                         background: 'rgba(0,200,150,0.15)', color: '#00c896',
                         border: '1px solid #00c896', cursor: 'pointer', fontWeight: 600,
                         display: 'inline-flex', alignItems: 'center', gap: 4
                       }}
                       title="Isolate specific character or element from this image"
                     >
                       ✂️ Cut Specific Part
                     </button>

                     <button 
                       type="button" 
                       onClick={(e) => { e.stopPropagation(); removeDec(i); if (selectedDecIndex === i) setSelectedDecIndex(null); }} 
                       style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                       title="Delete this overlay"
                     >
                       <Icon name="trash" size={16} />
                     </button>
                   </div>

                   {/* Direct Number Steppers (No more struggling with sliders!) */}
                   <div style={{ background: 'var(--surface, #1e1e24)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line-soft)' }}>
                     <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
                       Position &amp; Scale (Direct Inputs or Drag on Canvas):
                     </div>
                     <div className="row gap-6 wrap" style={{ alignItems: 'center' }}>
                       {/* X */}
                       <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface-2)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--line)' }}>
                         <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>X:</span>
                         <button type="button" onClick={(e) => { e.stopPropagation(); nudgeDec(i, 'x', -0.01); }} style={stepperBtnStyle}>-</button>
                         <input
                           type="number"
                           value={curX}
                           onClick={e => e.stopPropagation()}
                           onChange={e => updateDec(i, 'x', Number(e.target.value) / 100)}
                           style={numberInputStyle}
                         />
                         <span style={{ fontSize: 10, color: 'var(--muted)' }}>%</span>
                         <button type="button" onClick={(e) => { e.stopPropagation(); nudgeDec(i, 'x', 0.01); }} style={stepperBtnStyle}>+</button>
                       </div>

                       {/* Y */}
                       <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface-2)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--line)' }}>
                         <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>Y:</span>
                         <button type="button" onClick={(e) => { e.stopPropagation(); nudgeDec(i, 'y', -0.01); }} style={stepperBtnStyle}>-</button>
                         <input
                           type="number"
                           value={curY}
                           onClick={e => e.stopPropagation()}
                           onChange={e => updateDec(i, 'y', Number(e.target.value) / 100)}
                           style={numberInputStyle}
                         />
                         <span style={{ fontSize: 10, color: 'var(--muted)' }}>%</span>
                         <button type="button" onClick={(e) => { e.stopPropagation(); nudgeDec(i, 'y', 0.01); }} style={stepperBtnStyle}>+</button>
                       </div>

                       {/* Width */}
                       <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface-2)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--line)' }}>
                         <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>W:</span>
                         <button type="button" onClick={(e) => { e.stopPropagation(); nudgeDec(i, 'width', -0.01); }} style={stepperBtnStyle}>-</button>
                         <input
                           type="number"
                           value={curW}
                           onClick={e => e.stopPropagation()}
                           onChange={e => updateDec(i, 'width', Number(e.target.value) / 100)}
                           style={numberInputStyle}
                         />
                         <span style={{ fontSize: 10, color: 'var(--muted)' }}>%</span>
                         <button type="button" onClick={(e) => { e.stopPropagation(); nudgeDec(i, 'width', 0.01); }} style={stepperBtnStyle}>+</button>
                       </div>

                       {/* Height */}
                       <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface-2)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--line)' }}>
                         <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>H:</span>
                         <button type="button" onClick={(e) => { e.stopPropagation(); nudgeDec(i, 'height', -0.01); }} style={stepperBtnStyle}>-</button>
                         <input
                           type="number"
                           value={curH}
                           onClick={e => e.stopPropagation()}
                           onChange={e => updateDec(i, 'height', Number(e.target.value) / 100)}
                           style={numberInputStyle}
                         />
                         <span style={{ fontSize: 10, color: 'var(--muted)' }}>%</span>
                         <button type="button" onClick={(e) => { e.stopPropagation(); nudgeDec(i, 'height', 0.01); }} style={stepperBtnStyle}>+</button>
                       </div>
                     </div>
                   </div>

                   {/* Quick Snap Alignment Presets */}
                   <div className="row gap-4 wrap mt-8" style={{ alignItems: 'center' }}>
                     <span style={{ fontSize: 10, color: 'var(--muted)', marginRight: 2 }}>Align:</span>
                     <button type="button" onClick={(e) => { e.stopPropagation(); alignDec(i, 'full-frame'); }} style={alignBtnStyle} title="Cover 100% full canvas">⛶ Full Frame</button>
                     <button type="button" onClick={(e) => { e.stopPropagation(); alignDec(i, 'center-x'); }} style={alignBtnStyle} title="Center horizontally">⬌ Center X</button>
                     <button type="button" onClick={(e) => { e.stopPropagation(); alignDec(i, 'center-y'); }} style={alignBtnStyle} title="Center vertically">⬍ Center Y</button>
                     <button type="button" onClick={(e) => { e.stopPropagation(); alignDec(i, 'top-left'); }} style={alignBtnStyle} title="Top-Left corner">↖ Top-L</button>
                     <button type="button" onClick={(e) => { e.stopPropagation(); alignDec(i, 'top-right'); }} style={alignBtnStyle} title="Top-Right corner">↗ Top-R</button>
                     <button type="button" onClick={(e) => { e.stopPropagation(); alignDec(i, 'bottom-left'); }} style={alignBtnStyle} title="Bottom-Left corner">↙ Bot-L</button>
                     <button type="button" onClick={(e) => { e.stopPropagation(); alignDec(i, 'bottom-right'); }} style={alignBtnStyle} title="Bottom-Right corner">↘ Bot-R</button>
                   </div>

                   {/* Bottom Actions: Remove BG & Overlay toggle */}
                   <div className="row between mt-8" style={{ alignItems: 'center', borderTop: '1px solid var(--line-soft)', paddingTop: 6 }}>
                     <button 
                       type="button" 
                       onClick={(e) => { e.stopPropagation(); handleRemoveBgOnDecoration(i); }} 
                       style={{
                         fontSize: 11, padding: '3px 8px', borderRadius: 4, 
                         background: 'var(--hp-pink-soft)', color: 'var(--hp-pink)', 
                         border: '1px solid var(--hp-pink)', cursor: 'pointer',
                         display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600
                       }}
                       title="Remove solid background to make transparent overlay"
                     >
                       <Icon name="sparkles" size={11} /> ✨ Remove BG
                     </button>

                     <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                       <Toggle on={dec.overlay} onChange={v => updateDec(i, 'overlay', v)} />
                       <span className="t10">Overlay foreground</span>
                     </div>
                   </div>
                 </div>
               );
             })}
          </div>

        </Card>

        {/* ---- right: live preview ---- */}
        <Card style={{ flex: '1 1 50%', overflowY: 'hidden', padding: '24px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="sess-block-title" style={{ flexShrink: 0 }}><Icon name="camera" size={12} /> Live Preview (Editable)</div>
          <div style={{
            flex: 1, display: 'flex', justifyContent: 'center', padding: '18px',
            background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
            alignItems: 'center', minHeight: 0, minWidth: 0 // Allow container to shrink
          }}>
            <div style={{ 
              ...(isLandscapeMode ? { width: '100%', height: 'auto' } : { height: '100%', maxHeight: '70vh', width: 'auto' }),
              aspectRatio: computedAspect, 
              position: 'relative',
              maxHeight: isLandscapeMode ? '70vh' : undefined
            }}>
              {f.layoutObj ? (
                <TemplateRenderer 
                  layout={f.layoutObj} 
                  design={f.design} 
                  cachedAssets={(f.assets || []).reduce((acc, a) => { if (a.assetId && a.url) acc[a.assetId] = a.url; return acc; }, {})}
                  onSlotChange={(updatedSlot) => {
                    if (drawMode) return // Disable dragging while drawing
                    const newSlots = f.layoutObj.slots.map(s => s.id === updatedSlot.id ? updatedSlot : s);
                    setF(x => ({ ...x, layoutObj: { ...x.layoutObj, slots: newSlots } }));
                  }}
                  onSlotDelete={(id) => {
                    const newSlots = f.layoutObj.slots.filter(s => s.id !== id);
                    setF(x => ({ ...x, layoutObj: { ...x.layoutObj, slots: newSlots } }));
                  }}
                  activeDecorationIndex={selectedDecIndex}
                  onDecorationSelect={(idx) => setSelectedDecIndex(idx)}
                  onDecorationChange={(idx, updatedDec) => {
                    setF(x => {
                      const decs = [...(x.design.decorations || [])];
                      decs[idx] = updatedDec;
                      return { ...x, design: { ...x.design, decorations: decs } };
                    });
                  }}
                  onDecorationDelete={(idx) => {
                    removeDec(idx);
                    if (selectedDecIndex === idx) setSelectedDecIndex(null);
                  }}
                />
              ) : null}
              
              {/* Canvas Overlay for Brush tool */}
              {drawMode && (
                <canvas 
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%', height: '100%',
                    zIndex: 9999, // On top of everything to draw
                    cursor: 'crosshair',
                    touchAction: 'none'
                  }}
                />
              )}
            </div>
          </div>
          <p className="t11 faint mt-12" style={{ lineHeight: 1.55 }}>
            {drawMode ? (
               <span style={{ color: 'var(--hp-pink)' }}><b>Draw Mode Active:</b> Use your mouse to draw over the template. Click "Save Drawing" when done.</span>
            ) : (
               <span>
                 <b>Interactive Canvas:</b> Click any overlay or photo slot to select. <b>Drag to move</b>, and <b>drag 8 corner/edge handles to resize</b>! Use <b>Arrow Keys</b> to nudge with pixel perfection.
               </span>
            )}
          </p>
        </Card>
      </div>

      {/* Precision Cutout Studio Modal */}
      {cutoutStudioTarget && (
        <CutoutStudioModal
          isOpen={!!cutoutStudioTarget}
          imageSrc={cutoutStudioTarget?.imageSrc}
          onClose={() => setCutoutStudioTarget(null)}
          onApplyCutout={(resultUrl, asNew) => {
            if (asNew || cutoutStudioTarget?.asNew || cutoutStudioTarget?.index === undefined) {
              const tempId = `temp-dec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
              setF(x => {
                const newAssets = [...x.assets];
                newAssets.push({ assetId: tempId, url: resultUrl, type: 'decoration', role: 'decoration', mimeType: 'image/png', isTemp: true });
                const newDecs = [...(x.design.decorations || [])];
                newDecs.push({
                  assetId: tempId,
                  url: resultUrl,
                  type: 'decoration',
                  x: 0.2, y: 0.2, width: 0.6, height: 0.6,
                  overlay: true
                });
                return { ...x, assets: newAssets, design: { ...x.design, decorations: newDecs } };
              });
              setSelectedDecIndex((f.design.decorations || []).length);
              toast('Specific cutout element added! You can now drag and size it directly on the canvas.', 'success');
            } else {
              const idx = cutoutStudioTarget.index;
              setF(x => {
                const decs = [...(x.design.decorations || [])];
                decs[idx] = { ...decs[idx], url: resultUrl, overlay: true };
                return { ...x, design: { ...x.design, decorations: decs } };
              });
              toast('Overlay cutout updated with pixel accuracy!', 'success');
            }
            setCutoutStudioTarget(null);
          }}
        />
      )}
    </div>
  )
}

const colorBoxStyle = {
  width: 46, height: 38, border: '1px solid var(--line)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', padding: 2,
}

const stepperBtnStyle = {
  background: 'var(--surface, #333)',
  border: '1px solid var(--line, #444)',
  color: 'var(--ink, #fff)',
  width: 18,
  height: 18,
  borderRadius: 3,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
  padding: 0
}

const numberInputStyle = {
  width: 36,
  height: 18,
  background: 'transparent',
  border: 'none',
  color: 'var(--ink, #fff)',
  textAlign: 'center',
  fontSize: 11,
  fontWeight: 600,
  padding: 0
}

const alignBtnStyle = {
  fontSize: 10,
  padding: '2px 6px',
  borderRadius: 4,
  background: 'var(--surface, #25252c)',
  border: '1px solid var(--line, #444)',
  color: 'var(--ink, #fff)',
  cursor: 'pointer',
  fontWeight: 500
}
