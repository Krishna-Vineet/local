// Template Library (platform screen).
//
// Every template on the platform lives here. A template is a hand-crafted
// design pinned to one layout variant (cut size + orientation + image
// slots). Owner / Platform Admin control what is GLOBALLY available for
// organizations to add to their booth events:
//   • Publish / unpublish (active) — unpublished templates disappear from
//     every org's event picker.
//   • Create new templates in the Template Playground: pick a layout
//     variant, shape palette/ornament/typography, optionally generate an
//     AI background, and save. The playground also exports a JSX scaffold
//     so a developer can hand-finish the design as a dedicated component.
//   • Designer templates (src/templates/designer/*) are code — they can
//     only be published/unpublished, never edited or deleted here.

import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, Chip, PageLoader, SearchInput, Select, Button, Modal, Field, TextInput, TextArea, Toggle, EmptyState, ConfirmDialog } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { copyText, downloadText } from '../../lib/clipboard.js'
import TemplatePreview from '../../components/TemplatePreview.jsx'
import {
  LAYOUTS, LAYOUT_FAMILIES, layoutById, layoutLabel,
  ORIENTATION_OPTIONS, SHEET_OPTIONS, SLOT_OPTIONS, TEMPLATE_CATEGORIES,
} from '../../lib/layouts.js'
import { dateShort } from '../../lib/format.js'

const SOURCE_META = {
  designer: { label: 'Designer', chip: 'chip-purple', hint: 'Hand-crafted component' },
  playground: { label: 'Playground', chip: 'chip-info', hint: 'Built in the Template Playground' },
  ai_generated: { label: 'AI', chip: 'chip-pink', hint: 'AI-assisted design' },
}

export default function Templates() {
  const { toast, user } = useApp()
  const [templates, setTemplates] = useState(null)
  const [search, setSearch] = useState('')
  const [orientation, setOrientation] = useState('')
  const [sheet, setSheet] = useState('')
  const [slots, setSlots] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [playground, setPlayground] = useState(null) // null | { mode:'new' } | { mode:'edit', template }
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.platform.templates().then((r) => setTemplates(r.templates)).catch((e) => toast(e.message, 'error'))
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!templates) return []
    let r = templates
    if (search) {
      const s = search.toLowerCase()
      r = r.filter((t) => t.name.toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s))
    }
    if (orientation) r = r.filter((t) => t.layout?.orientation === orientation)
    if (sheet) r = r.filter((t) => t.layout?.sheets?.includes(sheet))
    if (slots) r = r.filter((t) => t.layout?.slots === Number(slots))
    if (category) r = r.filter((t) => t.category === category)
    if (status === 'published') r = r.filter((t) => t.active)
    if (status === 'hidden') r = r.filter((t) => !t.active)
    return r
  }, [templates, search, orientation, sheet, slots, category, status])

  const counts = useMemo(() => {
    if (!templates) return { published: 0, hidden: 0, designer: 0 }
    return {
      published: templates.filter((t) => t.active).length,
      hidden: templates.filter((t) => !t.active).length,
      designer: templates.filter((t) => t.source === 'designer').length,
    }
  }, [templates])

  const togglePublish = async (t) => {
    try {
      const r = await api.platform.updateTemplate(t.id, { active: !t.active })
      setTemplates((list) => list.map((x) => (x.id === t.id ? r.template : x)))
      toast(r.template.active ? `“${t.name}” published — organizations can now use it` : `“${t.name}” hidden from organizations`, 'info')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.platform.deleteTemplate(deleting.id)
      toast(`Deleted “${deleting.name}”`)
      setDeleting(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const previewWidth = (t) => {
    const l = layoutById(t.layoutId)
    if (!l) return 110
    const a = l.canvas.w / l.canvas.h
    return a < 0.45 ? 74 : a < 1 ? 122 : 168
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Template Library</div>
          <div className="page-sub">
            Every photo-booth template design, pinned to one of the {LAYOUTS.length} layout variants. Published
            templates become available for organizations to add to their booth events.
          </div>
        </div>
        <Button variant="primary" icon="sparkles" onClick={() => setPlayground({ mode: 'new' })}>
          New template
        </Button>
      </div>

      <Card style={{ paddingTop: 0 }}>
        <div className="row wrap gap-12" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" style={{ width: 210 }} />
          <Select value={orientation} onChange={(e) => setOrientation(e.target.value)} style={{ width: 130, height: 36 }}>
            <option value="">All orientations</option>
            {ORIENTATION_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Select>
          <Select value={sheet} onChange={(e) => setSheet(e.target.value)} style={{ width: 110, height: 36 }}>
            <option value="">All sheets</option>
            {SHEET_OPTIONS.map((sh) => <option key={sh} value={sh}>{sh}</option>)}
          </Select>
          <Select value={slots} onChange={(e) => setSlots(e.target.value)} style={{ width: 110, height: 36 }}>
            <option value="">All image counts</option>
            {SLOT_OPTIONS.map((n) => <option key={n} value={n}>{n} image{n > 1 ? 's' : ''}</option>)}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 130, height: 36 }}>
            <option value="">All categories</option>
            {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 130, height: 36 }}>
            <option value="">Published + hidden</option>
            <option value="published">Published only</option>
            <option value="hidden">Hidden only</option>
          </Select>
          <div className="grow" />
          <span className="chip chip-neutral">{filtered.length} of {templates?.length || 0}</span>
        </div>

        {!templates ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="template"
            title="No templates match"
            message="Adjust the filters, or create a new template in the Playground."
            action={<Button variant="primary" icon="plus" onClick={() => setPlayground({ mode: 'new' })}>New template</Button>}
          />
        ) : (
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
            {filtered.map((t) => {
              const sm = SOURCE_META[t.source] || SOURCE_META.playground
              return (
                <div
                  key={t.id}
                  className="card"
                  style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, opacity: t.active ? 1 : 0.66 }}
                >
                  <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="t13 fw6 ellipsis" title={t.name}>{t.name}</div>
                      <div className="t11 faint ellipsis" title={layoutLabel(layoutById(t.layoutId))}>{layoutLabel(layoutById(t.layoutId))}</div>
                    </div>
                    <span className={`chip ${sm.chip}`} style={{ flex: 'none' }} title={sm.hint}>{sm.label}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-soft)' }}>
                    <TemplatePreview template={t} width={previewWidth(t)} />
                  </div>
                  <div className="row wrap gap-6">
                    <Chip tone="neutral">{t.category}</Chip>
                    <Chip tone="info">{t.layout?.code}</Chip>
                    {t.usage > 0 ? <span className="t11 faint">used in {t.usage} session{t.usage > 1 ? 's' : ''}</span> : null}
                  </div>
                  <p className="t11 muted" style={{ minHeight: 30, lineHeight: 1.45 }}>{t.description}</p>
                  <div className="row between" style={{ marginTop: 'auto', borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
                    <label className="row gap-8" style={{ cursor: 'pointer', fontSize: 12 }} title="Published templates are selectable by organizations">
                      <Toggle on={t.active} onChange={() => togglePublish(t)} />
                      <span className="fw6" style={{ color: t.active ? 'var(--hp-green-ink)' : 'var(--muted)' }}>
                        {t.active ? 'Published' : 'Hidden'}
                      </span>
                    </label>
                    <div className="row gap-6">
                      {t.source !== 'designer' ? (
                        <>
                          <Button size="sm" variant="ghost" icon="edit" title="Edit in Playground" onClick={() => setPlayground({ mode: 'edit', template: t })} />
                          <Button size="sm" variant="ghost" icon="trash" style={{ color: 'var(--danger)' }} title="Delete template" onClick={() => setDeleting(t)} />
                        </>
                      ) : (
                        <span className="t10 faint" title="Designer templates are hand-crafted code — publish/unpublish only">code</span>
                      )}
                    </div>
                  </div>
                  <div className="t10 faint">added {dateShort(t.createdAt)}</div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line-soft)' }} className="row between wrap gap-8">
          <span className="t11 faint">
            <Icon name="info" size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            {counts.designer} designer component(s) in the code registry · publishing controls global availability ·
            AI/playground templates stay editable
          </span>
          <span className="t11 faint">{LAYOUT_FAMILIES.length} layout families · {LAYOUTS.length} variants (both orientations)</span>
        </div>
      </Card>

      {playground ? (
        <Playground
          initial={playground.mode === 'edit' ? playground.template : null}
          onClose={() => setPlayground(null)}
          onSaved={() => { setPlayground(null); load() }}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        danger
        loading={busy}
        title={`Delete “${deleting?.name}”?`}
        message="Templates used by events cannot be deleted — unpublish those instead."
        confirmLabel="Delete template"
      />
    </div>
  )
}

// ---------------- Template Playground ----------------

const ORNAMENTS = [
  { id: 'none', label: 'Clean' },
  { id: 'dots', label: 'Dot texture' },
  { id: 'stripes', label: 'Diagonal stripes' },
  { id: 'grid', label: 'Line grid' },
  { id: 'flourish', label: 'Corner flourishes' },
]
const FONT_OPTIONS = [
  { id: 'sans', label: 'Modern sans' },
  { id: 'serif', label: 'Classic serif' },
  { id: 'script', label: 'Script' },
]
const SHAPES = [
  { id: 'rect', label: 'Rectangles' },
  { id: 'arch', label: 'Arches' },
  { id: 'round', label: 'Rounded' },
]

function defaultDesign() {
  return {
    bg: { type: 'gradient', colors: ['#5F4CAA', '#3A3170'] },
    accent: '#D9B44A',
    textColor: '#FFFFFF',
    ornament: 'none',
    font: 'serif',
    slotShape: 'rect',
    titleBand: false,
    title: '',
    tagline: '',
  }
}

function Playground({ initial, onClose, onSaved }) {
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState(() => initial
    ? {
        name: initial.name, description: initial.description || '', category: initial.category || 'Custom',
        layoutId: initial.layoutId, design: { ...defaultDesign(), ...(initial.design || {}) },
        prompt: '',
      }
    : {
        name: '', description: '', category: 'Custom', layoutId: '46-v1', design: defaultDesign(), prompt: '',
      })
  const [pickOrient, setPickOrient] = useState('')
  const [pickSheet, setPickSheet] = useState('')
  const [pickSlots, setPickSlots] = useState('')
  const [copied, setCopied] = useState(false)
  const [showScaffold, setShowScaffold] = useState(false)

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setD = (k, v) => setF((x) => ({ ...x, design: { ...x.design, [k]: v } }))
  const layout = layoutById(f.layoutId)

  const pickable = LAYOUTS.filter((l) =>
    (!pickOrient || l.orientation === pickOrient) &&
    (!pickSheet || l.sheets.includes(pickSheet)) &&
    (!pickSlots || l.slots === Number(pickSlots))
  )

  const generateAI = async () => {
    if (!f.prompt.trim()) return setError('Describe the look you want first.')
    setBusy(true)
    setError('')
    try {
      const r = await api.platform.generateTemplateAI({ prompt: f.prompt, layoutId: f.layoutId })
      setF((x) => ({ ...x, design: { ...x.design, ...r.draft.design }, name: x.name || r.draft.name }))
      toast('AI draft applied — tweak anything, then save', 'info')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!f.name.trim()) return setError('Template name is required.')
    setBusy(true)
    setError('')
    try {
      const body = {
        name: f.name.trim(), description: f.description.trim(), category: f.category,
        layoutId: f.layoutId, design: { ...f.design, title: f.design.title?.trim(), tagline: f.design.tagline?.trim() },
      }
      if (initial) await api.platform.updateTemplate(initial.id, body)
      else await api.platform.createTemplate({ ...body, status: 'published' })
      toast(initial ? 'Template updated' : `Template “${body.name}” created and published`)
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const scaffold = () => {
    const comp = (f.name || 'MyTemplate').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join('') || 'MyTemplate'
    return `// ${f.name || 'My Template'} — hand-finished designer component.
// Generated from the Template Playground. To promote this config into a
// dedicated hand-crafted template:
//   1. Save this file as src/templates/designer/${comp}.jsx
//   2. Register it: src/templates/registry.jsx → TEMPLATE_COMPONENTS['${comp}']
//   3. Add meta to DESIGNER_TEMPLATES in src/lib/templateMeta.js
//      (id: 'hp-${comp.toLowerCase()}-<layout>', componentId: '${comp}', layoutId: '${f.layoutId}')
import { Backdrop, Photo, LogoRow, Flourish, Pattern, FONTS, uid } from '../primitives.jsx'

// Layout: ${layout ? layoutLabel(layout) : f.layoutId} (${f.layoutId})
export function ${comp}({ layout, geo, photos, logos, title = '${(f.design.title || f.name || 'HappyPix').replace(/'/g, "\\'")}', tagline = '${(f.design.tagline || '').replace(/'/g, "\\'")}' }) {
  const { w, h } = layout.canvas
  const patId = uid('pat')
  const AC = '${f.design.accent}'
  const TX = '${f.design.textColor}'
  return (
    <svg viewBox={\`0 0 \${w} \${h}\`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>{${f.design.ornament !== 'none' ? `<Pattern id={patId} type="${f.design.ornament}" color={AC} size={34} />` : 'null'}}</defs>
      <Backdrop w={w} h={h} bg={${JSON.stringify(f.design.bg)}} ${f.design.ornament !== 'none' ? 'patternId={patId} pattern' : ''} />
      ${f.design.ornament === 'flourish' ? '<Flourish x={40} y={36} size={70} color={AC} />\n      <Flourish x={w - 40} y={36} size={70} color={AC} flipX />' : '{/* custom ornaments here — this is where the hand-crafting happens */}'}
      {geo.photoSlots.map((s, i) => (
        <Photo key={s.id} x={s.x + 28} y={s.y + 28} w={s.width - 56} h={s.height - 56}
          src={photos?.[i]} index={i} shape="${f.design.slotShape}" stroke={AC} strokeWidth={4}
          label={\`PHOTO \${i + 1}\`} labelColor={TX} />
      ))}
      <LogoRow x={w * 0.05} y={geo.footer.y + geo.footer.h * 0.08} w={w * 0.9} h={geo.footer.h * 0.84}
        logos={logos} max={4} tagline={tagline} ring={AC} textColor={TX} />
    </svg>
  )
}`
  }

  const scaffoldFile = () => `${(f.name || 'NewTemplate').replace(/[^A-Za-z0-9]+/g, '') || 'NewTemplate'}.jsx`

  const copyScaffold = async () => {
    const ok = await copyText(scaffold())
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } else {
      // Clipboard blocked (insecure origin + no execCommand) — show the code
      // so it can be selected manually, and offer a download.
      setShowScaffold(true)
      toast('Clipboard blocked here — select the code below or download the file', 'info')
    }
  }
  const downloadScaffold = () => downloadText(scaffoldFile(), scaffold(), 'text/jsx')

  const previewTemplate = { layoutId: f.layoutId, design: f.design, componentId: null }
  const pw = layout ? (layout.canvas.w / layout.canvas.h < 0.45 ? 120 : layout.canvas.w / layout.canvas.h < 1 ? 190 : 280) : 190

  return (
    <Modal
      open
      onClose={onClose}
      width="xwide"
      title={initial ? `Edit “${initial.name}”` : 'Template Playground'}
      sub="Shape a template against a layout variant — preview updates live. Export the scaffold to hand-finish it as a designer component."
      footer={
        <>
          {error ? <span className="input-error" style={{ marginRight: 'auto' }}>{error}</span> : null}
          <Button variant="outline" icon="copy" onClick={copyScaffold}>{copied ? 'Copied!' : 'Copy JSX scaffold'}</Button>
          <Button variant="ghost" icon="download" title="Download the scaffold as a .jsx file" onClick={downloadScaffold}>Download .jsx</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create template'}</Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 22 }}>
        {/* ---- left: config ---- */}
        <div>
          <div className="sess-block-title"><Icon name="template" size={12} /> 1 · Layout variant</div>
          <div className="row wrap gap-8" style={{ marginBottom: 8 }}>
            <Select value={pickOrient} onChange={(e) => setPickOrient(e.target.value)} style={{ width: 120, height: 32, fontSize: 12 }}>
              <option value="">Orientation</option>
              {ORIENTATION_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
            <Select value={pickSheet} onChange={(e) => setPickSheet(e.target.value)} style={{ width: 100, height: 32, fontSize: 12 }}>
              <option value="">Sheet</option>
              {SHEET_OPTIONS.map((sh) => <option key={sh} value={sh}>{sh}</option>)}
            </Select>
            <Select value={pickSlots} onChange={(e) => setPickSlots(e.target.value)} style={{ width: 110, height: 32, fontSize: 12 }}>
              <option value="">Images</option>
              {SLOT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
            <span className="t11 faint">{pickable.length} variants</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxHeight: 168, overflowY: 'auto', padding: '2px', marginBottom: 14 }}>
            {pickable.map((l) => {
              const sel = l.id === f.layoutId
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => set('layoutId', l.id)}
                  title={`${l.name} — ${layoutLabel(l)}`}
                  style={{
                    cursor: 'pointer', borderRadius: 8, padding: '7px 6px 6px', textAlign: 'center',
                    border: `1.5px solid ${sel ? 'var(--hp-pink)' : 'var(--line)'}`,
                    background: sel ? 'var(--hp-pink-soft)' : 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ aspectRatio: `${l.canvas.w} / ${l.canvas.h}`, height: 40, background: sel ? 'var(--hp-pink)' : 'var(--line)', borderRadius: 4, opacity: sel ? 1 : 0.7 }} />
                  </div>
                  <div className="t10" style={{ fontSize: 9.5, fontWeight: 600, marginTop: 4, color: sel ? 'var(--hp-pink-deep)' : 'var(--muted)' }}>
                    {l.code}{l.orientation === 'landscape' ? ' ↭' : ''} · {l.slots}img
                  </div>
                </button>
              )
            })}
          </div>

          <div className="sess-block-title"><Icon name="sliders" size={12} /> 2 · Design</div>
          <div className="row gap-12">
            <div style={{ flex: 1 }}>
              <Field label="Template name" required>
                <TextInput value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Golden Hour" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Category">
                <Select value={f.category} onChange={(e) => set('category', e.target.value)} style={{ height: 38 }}>
                  {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
          </div>
          <Field label="Description">
            <TextInput value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="One line shown in the library" />
          </Field>

          <div className="row gap-12">
            <Field label="Background">
              <Select
                value={f.design.bg?.type || 'gradient'}
                onChange={(e) => {
                  const t = e.target.value
                  setD('bg', t === 'image' ? { type: 'image', url: f.design.bg?.url || null } : t === 'solid' ? { type: 'solid', colors: [f.design.bg?.colors?.[0] || '#191420'] } : { type: 'gradient', colors: f.design.bg?.colors || ['#5F4CAA', '#3A3170'] })
                }}
                style={{ height: 38, minWidth: 130 }}
              >
                <option value="gradient">Gradient</option>
                <option value="solid">Solid colour</option>
                <option value="image">AI artwork</option>
              </Select>
            </Field>
            {f.design.bg?.type === 'solid' ? (
              <Field label="Colour">
                <input type="color" value={f.design.bg.colors[0]} onChange={(e) => setD('bg', { type: 'solid', colors: [e.target.value] })} style={{ width: 46, height: 38, border: '1px solid var(--line)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer' }} />
              </Field>
            ) : f.design.bg?.type === 'gradient' ? (
              <Field label="Gradient colours">
                <div className="row gap-6">
                  <input type="color" value={f.design.bg.colors[0]} onChange={(e) => setD('bg', { type: 'gradient', colors: [e.target.value, f.design.bg.colors[1]] })} style={colorBoxStyle} />
                  <input type="color" value={f.design.bg.colors[1]} onChange={(e) => setD('bg', { type: 'gradient', colors: [f.design.bg.colors[0], e.target.value] })} style={colorBoxStyle} />
                </div>
              </Field>
            ) : (
              <Field label="AI artwork" hint={f.design.bg?.url ? 'AI background set' : 'Generate below'}>
                {f.design.bg?.url ? <Chip tone="pink" dot>ready</Chip> : <Chip tone="neutral">none yet</Chip>}
              </Field>
            )}
          </div>

          <div className="row gap-12">
            <Field label="Accent">
              <input type="color" value={f.design.accent} onChange={(e) => setD('accent', e.target.value)} style={colorBoxStyle} />
            </Field>
            <Field label="Text">
              <input type="color" value={f.design.textColor} onChange={(e) => setD('textColor', e.target.value)} style={colorBoxStyle} />
            </Field>
            <Field label="Ornament">
              <Select value={f.design.ornament} onChange={(e) => setD('ornament', e.target.value)} style={{ height: 38, width: 140 }}>
                {ORNAMENTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="row gap-12">
            <Field label="Typography">
              <Select value={f.design.font} onChange={(e) => setD('font', e.target.value)} style={{ height: 38, width: 140 }}>
                {FONT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Photo slots">
              <Select value={f.design.slotShape} onChange={(e) => setD('slotShape', e.target.value)} style={{ height: 38, width: 130 }}>
                {SHAPES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Title band">
              <div className="row gap-8" style={{ height: 38 }}>
                <Toggle on={!!f.design.titleBand} onChange={(v) => setD('titleBand', v)} />
                <span className="t11 muted">{f.design.titleBand ? 'Header band' : 'In footer'}</span>
              </div>
            </Field>
          </div>
          <div className="row gap-12">
            <div style={{ flex: 1 }}>
              <Field label="Title text" hint="Template's signature text — booth guests can customise it.">
                <TextInput value={f.design.title || ''} onChange={(e) => setD('title', e.target.value)} placeholder="e.g. Golden Hour" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Default tagline">
                <TextInput value={f.design.tagline || ''} onChange={(e) => setD('tagline', e.target.value)} placeholder="e.g. celebrate in style" />
              </Field>
            </div>
          </div>

          <div className="sess-block-title"><Icon name="sparkles" size={12} /> 3 · AI assist (optional)</div>
          <div className="row gap-8">
            <TextInput
              value={f.prompt}
              onChange={(e) => set('prompt', e.target.value)}
              placeholder="e.g. royal wedding gold marble · retrowave neon grid"
              style={{ flex: 1 }}
            />
            <Button variant="outline" icon="sparkles" onClick={generateAI} disabled={busy || !f.prompt.trim()}>Generate</Button>
          </div>
          <p className="t10 faint mt-8" style={{ lineHeight: 1.5 }}>
            AI drafts a palette, ornaments and background art for this layout — you keep full control and can override
            everything. Prefer code? “Copy JSX scaffold” gives you a ready component to hand-finish and register.
          </p>

          {showScaffold ? (
            <div className="mt-16">
              <div className="row between mb-8">
                <div className="sess-block-title" style={{ margin: 0 }}><Icon name="code" size={12} /> JSX scaffold · {scaffoldFile()}</div>
                <div className="row gap-8">
                  <Button size="sm" variant="ghost" icon="download" onClick={downloadScaffold}>Download</Button>
                  <Button size="sm" variant="ghost" icon="x" onClick={() => setShowScaffold(false)}>Hide</Button>
                </div>
              </div>
              <textarea
                readOnly
                value={scaffold()}
                onFocus={(e) => e.target.select()}
                spellCheck={false}
                style={{
                  width: '100%', minHeight: 220, maxHeight: 360, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11, lineHeight: 1.5, padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
                  background: 'var(--surface-2)', color: 'var(--text)', whiteSpace: 'pre', overflow: 'auto',
                }}
              />
              <p className="t10 faint mt-8">Click inside to select everything, then Ctrl/Cmd + C.</p>
            </div>
          ) : null}
        </div>

        {/* ---- right: live preview ---- */}
        <div>
          <div className="sess-block-title"><Icon name="camera" size={12} /> Live preview · {layout ? layoutLabel(layout) : '—'}</div>
          <div style={{
            position: 'sticky', top: 0, display: 'flex', justifyContent: 'center', padding: '18px 12px',
            background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
          }}>
            <TemplatePreview template={previewTemplate} width={pw} />
          </div>
          <p className="t11 faint mt-12" style={{ lineHeight: 1.55 }}>
            Photo slots show placeholders — the booth fills them with the guest's shots, and the event's sponsor /
            host / venue logos appear in the footer ring positions. Layout geometry (slots + 15% branding footer) is
            fixed by the variant you picked.
          </p>
        </div>
      </div>
    </Modal>
  )
}

const colorBoxStyle = {
  width: 46, height: 38, border: '1px solid var(--line)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', padding: 2,
}
