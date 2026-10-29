import { useState, useEffect } from 'react'
import { Card, CardHead, Field, TextInput, Button, EmptyState } from '../../components/ui.jsx'
import { api } from '../../api/index.js'
import TemplateRenderer from '../../components/TemplateRenderer.jsx'
import LayoutCanvas from '../../components/LayoutCanvas.jsx'
import { parseLayoutCodeword } from '../../lib/layouts.js'
import { cacheAsset, getCachedAssetUrl } from '../../utils/indexedDbCache.js'

export default function OrgTemplates() {
  const [globalLayouts, setGlobalLayouts] = useState([])
  const [selectedLayout, setSelectedLayout] = useState(null)
  
  const [prompt, setPrompt] = useState('')
  const [currentDesign, setCurrentDesign] = useState({})
  const [currentAssets, setCurrentAssets] = useState([])
  const [cachedUrls, setCachedUrls] = useState({})
  
  const [savedOrgTemplates, setSavedOrgTemplates] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [viewingTemplate, setViewingTemplate] = useState(null) // for View modal

  useEffect(() => {
    const loadData = async () => {
      try {
        const globalRes = await api.org.templateLayouts()
        if (globalRes.layouts) {
          // Normalize layouts to have precise geometric slots for the renderer
          const normalized = globalRes.layouts.map(l => {
            const parsed = parseLayoutCodeword(l.codeword, l.grid)
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
            }
          })
          setGlobalLayouts(normalized)
        }

        const orgRes = await api.org.aiTemplates()
        if (orgRes.templates) {
            setSavedOrgTemplates(orgRes.templates.filter(t => t.source !== 'manual'))
        }
      } catch (err) {
        console.error("Failed to fetch templates", err)
      }
    }
    loadData()
  }, [])

  const handleAiGenerate = async (e) => {
    e.preventDefault()
    if (!prompt.trim() || !selectedLayout) return
    
    setIsGenerating(true)
    
    try {
      const res = await api.org.generateAiTemplate({
        prompt,
        layout: {
          code: selectedLayout.codeword,
          width: selectedLayout.width,
          height: selectedLayout.height,
          orientation: selectedLayout.aspect > 1 ? 'landscape' : 'portrait',
          slotCount: selectedLayout.slotCount
        },
        currentDesign: currentDesign,
        currentAssets: currentAssets
      })
      
      const { updatedDesign, newAssets, layout: returnedLayout } = res;
      
      setCurrentDesign(updatedDesign);
      
      // Update assets list
      const mergedAssets = [...currentAssets];
      for (const na of newAssets) {
         if (!mergedAssets.find(a => a.assetId === na.assetId)) {
           mergedAssets.push(na);
         }
      }
      setCurrentAssets(mergedAssets);

      // Cache new assets in IndexedDB via backend proxy (avoids S3 CORS)
      const newUrls = { ...cachedUrls };
      for (const asset of newAssets) {
        if (asset.assetId) {
          let fetchUrl = `/api/org/asset-proxy?key=${encodeURIComponent(asset.assetId)}`;
          if (asset.isTemp && asset.url && asset.url.startsWith('data:')) {
            fetchUrl = asset.url;
          }
          try {
            await cacheAsset(asset.assetId, fetchUrl);
            const objectUrl = await getCachedAssetUrl(asset.assetId);
            if (objectUrl) newUrls[asset.assetId] = objectUrl;
          } catch (e) {
            console.error("Failed to cache asset locally:", asset.assetId, e);
          }
        }
      }
      setCachedUrls(newUrls);

      setHasUnsavedChanges(true)
    } catch (err) {
      console.error("AI Generation failed", err)
      alert(err.message || "Failed to generate design")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!selectedLayout) return
    const templateName = prompt.trim() ? prompt.slice(0, 30) : `AI ${selectedLayout.codeword}`

    try {
      const res = await api.org.saveAiTemplate({
        name: templateName,
        layoutCode: selectedLayout.codeword,
        layout: {
          code: selectedLayout.codeword,
          width: selectedLayout.width,
          height: selectedLayout.height,
          orientation: selectedLayout.aspect > 1 ? 'landscape' : 'portrait',
          slotCount: selectedLayout.slotCount
        },
        design: currentDesign,
        slots: selectedLayout.slots,
        assets: currentAssets
      })

      if (res.template) {
        setSavedOrgTemplates([res.template, ...savedOrgTemplates])
        setHasUnsavedChanges(false)
        alert("Template saved successfully!")
      }
    } catch (err) {
      console.error("Failed to save template", err)
      alert("Failed to save template")
    }
  }

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await api.org.deleteAiTemplate(id);
      setSavedOrgTemplates(savedOrgTemplates.filter(t => (t.id || t._id) !== id));
      if (viewingTemplate && (viewingTemplate.id || viewingTemplate._id) === id) {
        setViewingTemplate(null);
      }
    } catch (err) {
      console.error("Failed to delete template", err);
      alert("Failed to delete template");
    }
  };

  const handleReset = () => {
    setCurrentDesign({})
    setCurrentAssets([])
    setCachedUrls({})
    setPrompt('')
    setHasUnsavedChanges(false)
  }

  return (
    <div className="page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600' }}>AI Template Studio</h1>
        <p className="muted" style={{ marginTop: '8px' }}>
          Select a structural layout created by the platform owner, then iteratively refine artwork using AI prompts.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: '24px' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card pad>
            <CardHead title="1. Choose Layout Structure" sub="Pick a standard format defined by the owner." />
            {globalLayouts.length === 0 ? (
              <EmptyState icon="layout" title="No Layouts Found" message="The platform owner hasn't published any global layouts yet." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', marginTop: '16px', maxHeight: '360px', overflowY: 'auto', padding: '4px' }}>
                {globalLayouts.map((layout, index) => {
                  const isSelected = selectedLayout?.id === layout.id;
                  return (
                    <div 
                      key={layout.id ? `${layout.id}-${index}` : index} 
                      onClick={() => {
                         if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Discard and switch layout?")) return;
                         setSelectedLayout(layout);
                         handleReset();
                      }}
                      style={{ 
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--hp-pink)' : '1px solid var(--line-soft)',
                        borderRadius: '8px',
                        padding: '10px 8px 8px',
                        background: isSelected ? 'rgba(234, 9, 127, 0.08)' : 'var(--surface-2)',
                        boxShadow: isSelected ? '0 0 10px rgba(234, 9, 127, 0.2)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                      }}
                    >
                      {/* Photobooth Canvas Preview */}
                      <div 
                        style={{ 
                          width: '100%', 
                          height: '140px', 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '8px',
                          overflow: 'hidden'
                        }}
                      >
                         <LayoutCanvas layout={layout} isSelected={isSelected} />
                      </div>

                      {/* Codeword Label & Details */}
                      <div style={{ fontSize: '11px', fontWeight: '700', textAlign: 'center', color: isSelected ? 'var(--hp-pink)' : 'var(--text)', wordBreak: 'break-all', lineHeight: 1.2 }}>
                        {layout.codeword}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', textAlign: 'center' }}>
                        {layout.slotCount} Photo{layout.slotCount === 1 ? '' : 's'} · {layout.structure || layout.media}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card pad style={{ opacity: selectedLayout ? 1 : 0.5, pointerEvents: selectedLayout ? 'auto' : 'none' }}>
            <CardHead title="2. Design Modification (AI)" sub="Enter intent (e.g. 'Make it Marvel themed', 'Change background to gold')" />
            
            {hasUnsavedChanges && (
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--hp-pink-soft)', marginTop: '14px' }}>
                <div style={{ width: 56, height: 80, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#1c182a', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line-soft)' }}>
                  {currentDesign?.background?.url || cachedUrls[currentDesign?.background?.assetId] ? (
                    <img src={cachedUrls[currentDesign?.background?.assetId] || currentDesign?.background?.url} alt="Reference" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 10, color: '#aaa', fontWeight: 600 }}>Active</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--hp-pink)' }}>Reference Image Attached</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
                    AI regeneration will use this current artwork as reference to modify and refine your design.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleAiGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <Field label={hasUnsavedChanges ? "Refinement Prompt (Editing Reference)" : "AI Prompt"} required>
                <TextInput 
                  value={prompt} 
                  onChange={e => setPrompt(e.target.value)} 
                  placeholder={hasUnsavedChanges ? "Describe what to change from reference image (e.g., 'Make background darker and add neon borders')" : "e.g. Superhero theme with dark blue and red"} 
                />
              </Field>
              <div style={{ display: 'flex', gap: '8px' }}>
                 <Button variant="primary" type="submit" disabled={!prompt.trim() || isGenerating} style={{ flex: 1 }}>
                   {isGenerating ? 'Applying AI Patches...' : (hasUnsavedChanges ? 'Regenerate / Refine with Reference' : 'Generate Initial Design')}
                 </Button>
                 {hasUnsavedChanges && (
                   <Button variant="secondary" onClick={handleReset} type="button">Reset</Button>
                 )}
              </div>
            </form>
          </Card>
        </div>

        {/* Right Column */}
        <Card pad style={{ display: 'flex', flexDirection: 'column' }}>
          <CardHead title="Live Renderer Preview" sub="Layered preview using Cached Assets." />
          <div style={{ 
            flex: 1, 
            minHeight: '380px', 
            maxHeight: '440px', 
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
            {selectedLayout ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <div style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  width: (selectedLayout.width / selectedLayout.height) >= 1 ? '100%' : 'auto',
                  height: (selectedLayout.width / selectedLayout.height) <= 1 ? '100%' : 'auto',
                  aspectRatio: `${selectedLayout.width} / ${selectedLayout.height}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* The new layered Renderer */}
                  <TemplateRenderer 
                    layout={selectedLayout} 
                    design={currentDesign} 
                    cachedAssets={cachedUrls} 
                    onSlotChange={(updatedSlot) => {
                      const newSlots = selectedLayout.slots.map(s => 
                        s.id === updatedSlot.id ? updatedSlot : s
                      );
                      setSelectedLayout({ ...selectedLayout, slots: newSlots });
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>
              </div>
            ) : (
              <EmptyState icon="sparkles" title="Select Layout" message="Choose a layout structure to begin." />
            )}
          </div>
          {selectedLayout && hasUnsavedChanges && (
            <div style={{ marginTop: '16px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px' }} className="muted">
                Base Layout: <strong>{selectedLayout.codeword}</strong> · {currentAssets.length} assets
              </div>
              <Button variant="primary" icon="check" onClick={handleSave}>Save to Organization</Button>
            </div>
          )}
        </Card>
      </div>

      <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: '40px', marginBottom: '16px' }}>Organization Templates (Saved)</h2>
      {savedOrgTemplates.length === 0 ? (
        <Card pad>
           <EmptyState icon="template" title="No Templates Yet" message="Your AI-generated templates will appear here." />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
          {savedOrgTemplates.map(template => (
            <Card key={template.id || template._id} pad style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                 <span style={{ fontWeight: '600', fontSize: '14px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</span>
                 <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                   <button
                     onClick={() => setViewingTemplate(template)}
                     style={{
                       background: 'var(--hp-pink)',
                       color: '#fff',
                       border: 'none',
                       borderRadius: '6px',
                       padding: '4px 12px',
                       fontSize: '12px',
                       cursor: 'pointer',
                       fontWeight: '600'
                     }}
                   >
                     View
                   </button>
                   <button
                     onClick={() => handleDeleteTemplate(template.id || template._id)}
                     style={{
                       background: '#ef4444',
                       color: '#fff',
                       border: 'none',
                       borderRadius: '6px',
                       padding: '4px 12px',
                       fontSize: '12px',
                       cursor: 'pointer',
                       fontWeight: '600'
                     }}
                   >
                     Delete
                   </button>
                 </div>
               </div>
               <div style={{ 
                 height: '150px', 
                 width: '100%', 
                 display: 'flex', 
                 alignItems: 'center', 
                 justifyContent: 'center', 
                 background: 'var(--surface-2)', 
                 borderRadius: '6px', 
                 padding: '8px', 
                 overflow: 'hidden' 
               }}>
                 <div style={{
                   maxWidth: '100%',
                   maxHeight: '100%',
                   width: (template.layout?.width || 1200) >= (template.layout?.height || 1800) ? '100%' : 'auto',
                   height: (template.layout?.height || 1800) >= (template.layout?.width || 1200) ? '100%' : 'auto',
                   aspectRatio: `${template.layout?.width || 1200} / ${template.layout?.height || 1800}`,
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center'
                 }}>
                   <TemplateRenderer 
                     layout={{ 
                       width: template.layout?.width || 1200,
                       height: template.layout?.height || 1800,
                       aspect: (template.layout?.width || 1200) / (template.layout?.height || 1800), 
                       slots: template.slots 
                     }} 
                     design={template.design} 
                     cachedAssets={(template.assets || []).reduce((acc, a) => { if (a.assetId && a.url) acc[a.assetId] = a.url; return acc; }, {})}
                   />
                 </div>
               </div>
               <div className="muted" style={{ fontSize: '11px', marginTop: '12px', textAlign: 'center' }}>
                 Layout: {template.layout?.code || template.layoutCode}
               </div>
               <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                 Added {new Date(template.createdAt).toLocaleDateString()}
               </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── View Template Modal ────────────────────────────── */}
      {viewingTemplate && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setViewingTemplate(null); }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div style={{
            background: 'var(--surface-1)',
            borderRadius: '16px',
            border: '1px solid var(--line-soft)',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--line-soft)' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>{viewingTemplate.name}</h2>
                <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Layout: <strong>{viewingTemplate.layout?.code}</strong> · {viewingTemplate.layout?.slotCount} photo slots</p>
              </div>
              <button
                onClick={() => setViewingTemplate(null)}
                style={{ background: 'none', border: '1px solid var(--line-soft)', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '18px', color: 'var(--text-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>

            {/* Modal Body */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px' }}>
              {/* Left: Full Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-2)' }}>FULL PREVIEW</p>
                <div style={{ 
                  width: '100%', 
                  height: '380px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'var(--surface-2)',
                  borderRadius: '8px',
                  padding: '16px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: (viewingTemplate.layout?.width || 1200) >= (viewingTemplate.layout?.height || 1800) ? '100%' : 'auto',
                    height: (viewingTemplate.layout?.height || 1800) >= (viewingTemplate.layout?.width || 1200) ? '100%' : 'auto',
                    aspectRatio: `${viewingTemplate.layout?.width || 1200} / ${viewingTemplate.layout?.height || 1800}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <TemplateRenderer
                      layout={{ 
                        width: viewingTemplate.layout?.width || 1200,
                        height: viewingTemplate.layout?.height || 1800,
                        aspect: (viewingTemplate.layout?.width || 1200) / (viewingTemplate.layout?.height || 1800), 
                        slots: viewingTemplate.slots || [] 
                      }}
                      design={viewingTemplate.design}
                      cachedAssets={(viewingTemplate.assets || []).reduce((acc, a) => { if (a.assetId && a.url) acc[a.assetId] = a.url; return acc; }, {})}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Design Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-2)' }}>DESIGN DETAILS</p>

                {viewingTemplate.design?.theme && (
                  <div style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '14px' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Theme</p>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{viewingTemplate.design.theme.name}</p>
                    {viewingTemplate.design.theme.mood?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {viewingTemplate.design.theme.mood.map((m, i) => (
                          <span key={i} style={{ background: 'var(--hp-pink-soft)', color: 'var(--hp-pink)', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{m}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {viewingTemplate.design?.palette && (
                  <div style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '14px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Color Palette</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Object.entries(viewingTemplate.design.palette).map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: val, border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'capitalize' }}>{key}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Canvas</p>
                  <p style={{ margin: '0', fontSize: '13px' }}>{viewingTemplate.layout?.width || 1200} × {viewingTemplate.layout?.height || 1800} px</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Orientation: <strong>{viewingTemplate.layout?.orientation || 'Portrait'}</strong></p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Photo Slots: <strong>{viewingTemplate.slots?.length || 0}</strong></p>
                </div>

                {viewingTemplate.assets?.length > 0 && (
                  <div style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '14px' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Generated Assets ({viewingTemplate.assets.length})</p>
                    {viewingTemplate.assets.map((a, i) => (
                      <p key={i} style={{ margin: '2px 0', fontSize: '12px', color: 'var(--text-2)' }}>• {a.type} — {a.role}</p>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                  <p className="muted" style={{ fontSize: '12px', margin: 0 }}>Saved: {new Date(viewingTemplate.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
