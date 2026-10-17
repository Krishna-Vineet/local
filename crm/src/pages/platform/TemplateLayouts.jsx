import { useState, useEffect } from 'react'
import { Card, CardHead, Field, TextInput, Button, EmptyState } from '../../components/ui.jsx'
import { api } from '../../api/index.js'
import { parseLayoutCodeword } from '../../lib/layouts.js'
import LayoutCanvas from '../../components/LayoutCanvas.jsx'

export default function TemplateLayouts() {
  const [codeword, setCodeword] = useState('')
  const [layoutPreview, setLayoutPreview] = useState(null)
  const [savedLayouts, setSavedLayouts] = useState([])

  useEffect(() => {
    // Load global layouts from API
    api.platform.templateLayouts()
      .then(res => {
        if (res.layouts) setSavedLayouts(res.layouts)
      })
      .catch(err => console.error("Failed to fetch template layouts", err))
  }, [])

  const handleGenerate = (e) => {
    e.preventDefault()
    if (!codeword.trim()) return

    const parsed = parseLayoutCodeword(codeword)
    if (!parsed) {
      alert("Invalid format! Use format: P1-46-T04-V-GRID2X2")
      return
    }

    const newLayout = {
      id: Date.now().toString(),
      codeword: parsed.fullCode,
      createdAt: new Date().toLocaleDateString(),
      grid: parsed,
      slots: parsed.slots,
      width: parsed.width,
      height: parsed.height,
      aspect: parsed.aspect
    }
    setLayoutPreview(newLayout)
  }

  const handleSave = async () => {
    if (layoutPreview) {
      try {
        const res = await api.platform.createTemplateLayout(layoutPreview)
        if (res.layout) {
          setSavedLayouts([res.layout, ...savedLayouts])
          setLayoutPreview(null)
          setCodeword('')
        }
      } catch (err) {
        console.error("Failed to save layout", err)
        alert("Failed to save layout to backend")
      }
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.platform.deleteTemplateLayout(id)
      setSavedLayouts(savedLayouts.filter(l => l.id !== id))
    } catch (err) {
      console.error("Failed to delete layout", err)
    }
  }

  return (
    <div className="page" style={{ padding: '24px', maxWidth: '1080px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Template Layouts (Owner)</h1>
        <p className="muted" style={{ marginTop: '8px' }}>
          Create mathematical structural layouts using codewords (e.g. <code>P1-46-T04-V-GRID2X2</code>, <code>P1-26-T03-V-SQUARE</code>, <code>P1-57-T03-V-CASCADE</code>). 
          Every format auto-fits responsively and proportionally across all booth sizes.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
        <Card pad>
          <CardHead title="Generate Layout" sub="Enter a standard codeword." />
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <Field label="Layout Codeword" required hint="Format: [PIECE]-[MEDIA]-[SLOTS]-[ORIENTATION]-[STRUCTURE]">
              <TextInput
                value={codeword}
                onChange={e => setCodeword(e.target.value)}
                placeholder="e.g. P1-46-T04-V-GRID2X2"
              />
            </Field>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '-4px' }}>
              <span className="muted" style={{ fontSize: '11px', width: '100%', marginBottom: '2px' }}>Quick Examples:</span>
              {[
                'P1-46-T04-V-GRID2X2',
                'P1-26-T03-V-SQUARE',
                'P1-26-T04-V-STRIP',
                'P1-57-T03-V-CASCADE',
                'P1-46-T04-V-HERO3',
                'P1-68-T04-H-GRID2X2',
                'P1-169-T02-H-HSTACK'
              ].map(example => (
                <button
                  type="button"
                  key={example}
                  onClick={() => setCodeword(example)}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-soft)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: 'var(--text)',
                    cursor: 'pointer'
                  }}
                >
                  {example}
                </button>
              ))}
            </div>

            <Button variant="primary" type="submit" disabled={!codeword.trim()}>Generate Preview</Button>
          </form>
        </Card>

        <Card pad style={{ display: 'flex', flexDirection: 'column' }}>
          <CardHead title="Live Preview" sub="Mathematically calculated photobooth canvas." />
          <div style={{ 
            flex: 1, 
            minHeight: '280px', 
            maxHeight: '380px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            border: '1px dashed var(--line-soft)', 
            borderRadius: '8px', 
            marginTop: '16px', 
            background: 'var(--surface-2)', 
            padding: '20px', 
            overflow: 'hidden' 
          }}>
            {layoutPreview ? (
              <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ 
                  flex: '1 1 auto', 
                  width: '100%', 
                  height: '240px', 
                  minHeight: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  overflow: 'hidden' 
                }}>
                  <LayoutCanvas layout={layoutPreview} isSelected={true} />
                </div>
                <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '11px' }} className="muted">
                  Resolution: {layoutPreview.grid.width} &times; {layoutPreview.grid.height} px ({layoutPreview.grid.aspectRatio || layoutPreview.grid.aspect.toFixed(2)}) · {layoutPreview.grid.orientation} · {layoutPreview.grid.slotCount} photos · {layoutPreview.grid.structure}
                </div>
                <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <Button variant="primary" icon="check" onClick={handleSave}>Publish Globally</Button>
                </div>
              </div>
            ) : (
              <EmptyState icon="image" title="No Preview" message="Enter or pick a codeword to preview its structure." />
            )}
          </div>
        </Card>
      </div>

      <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '40px', marginBottom: '16px' }}>Published Global Layouts</h2>
      {savedLayouts.length === 0 ? (
        <Card pad>
          <EmptyState icon="template" title="No Global Layouts" message="Published layouts will appear here." />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
          {savedLayouts.map(layout => (
            <Card key={layout.id || layout._id} pad style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: '600', fontSize: '13px' }} className="ellipsis" title={layout.codeword}>{layout.codeword}</span>
                <button 
                  onClick={() => handleDelete(layout.id || layout._id)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}
                  title="Delete Layout"
                >
                  &times;
                </button>
              </div>
              <div style={{ 
                height: '170px', 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: 'var(--surface-2)', 
                borderRadius: '6px', 
                padding: '10px', 
                overflow: 'hidden' 
              }}>
                <LayoutCanvas layout={layout} />
              </div>
              <div className="muted" style={{ fontSize: '11px', marginTop: '12px', textAlign: 'center' }}>
                {layout.grid?.slotCount || layout.grid?.slots || 1} Photo{(layout.grid?.slotCount || layout.grid?.slots) === 1 ? '' : 's'} · {layout.grid?.structure || 'GRID'} · {layout.createdAt || 'Global'}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
