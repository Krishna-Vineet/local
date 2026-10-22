import { useState } from 'react'
import type { BoothTemplate, CapturedPhoto } from '../types'
import { ScreenShell } from '../components/ScreenShell'
import { BackButton, NextButton } from '../components/Controls'
import { Icon } from '../components/Icon'
import { TemplateCanvas } from '../components/TemplateCanvas'
import { sound } from '../services/sound'

export function PhotoSelectionScreen({ template, photos, initial, secondsLeft, onBack, onComplete }: {
  template: BoothTemplate
  photos: CapturedPhoto[]
  initial: CapturedPhoto[]
  secondsLeft: number
  onBack: () => void
  onComplete: (photos: CapturedPhoto[]) => void
}) {
  const slots = template.layout.slots

  // Empty initially per requirement; fill sequentially then highlight+slot-swap or slot-click-unselect
  const [selectedSlots, setSelectedSlots] = useState<(CapturedPhoto | null)[]>(() => {
    const empty: (CapturedPhoto | null)[] = Array.from({ length: slots }, () => null)
    if (initial.length > 0) {
      initial.forEach((p, idx) => { if (idx < slots) empty[idx] = p })
      return empty
    }
    return empty
  })
  const [activeSlotIndex, setActiveSlotIndex] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  const filledCount = selectedSlots.filter(Boolean).length
  const isComplete = filledCount === slots

  const handlePhotoTap = (photo: CapturedPhoto) => {
    if (transitioning) return
    sound.select()
    const newSlots = [...selectedSlots] as (CapturedPhoto | null)[]
    const existingIndex = newSlots.findIndex((item) => item && (item as any).id === photo.id || (item as any).uri === (photo as any).uri)

    if (existingIndex >= 0) {
      if (existingIndex === activeSlotIndex) {
        // Clicking photo already in active slot -> unselect it (slot-click-unselect)
        newSlots[activeSlotIndex] = null
        setSelectedSlots(newSlots)
        return
      }
      // Swap with active slot
      const prevInActive = newSlots[activeSlotIndex]
      newSlots[activeSlotIndex] = photo
      newSlots[existingIndex] = prevInActive ?? null
      setSelectedSlots(newSlots)
      const nextEmpty = newSlots.findIndex((s) => s === null)
      if (nextEmpty >= 0) setActiveSlotIndex(nextEmpty)
      return
    }

    // Sequential fill: place into active slot
    newSlots[activeSlotIndex] = photo
    setSelectedSlots(newSlots)
    // Auto-advance to next empty slot
    const nextEmptyAfter = newSlots.findIndex((s, idx) => idx > activeSlotIndex && s === null)
    if (nextEmptyAfter >= 0) {
      setActiveSlotIndex(nextEmptyAfter)
    } else {
      const anyEmpty = newSlots.findIndex((s) => s === null)
      if (anyEmpty >= 0) setActiveSlotIndex(anyEmpty)
    }
  }

  const handleSlotTap = (index: number) => {
    if (transitioning) return
    sound.select()
    if (activeSlotIndex === index && selectedSlots[index]) {
      // Same active filled slot clicked -> unselect (slot-click-unselect)
      const newSlots = [...selectedSlots] as (CapturedPhoto | null)[]
      newSlots[index] = null
      setSelectedSlots(newSlots)
    } else {
      setActiveSlotIndex(index)
    }
  }

  const handleNext = () => {
    if (!isComplete || transitioning) return
    setTransitioning(true)
    sound.success()
    // Pause interactions; App timer will be paused via transitioning flag propagation if needed
    window.setTimeout(() => {
      onComplete(selectedSlots.filter(Boolean) as CapturedPhoto[])
    }, 320)
  }

  return (
    <ScreenShell screen="photos" secondsLeft={secondsLeft} title="Choose your best shots" subtitle={`Pick ${slots} photo${slots === 1 ? '' : 's'} for ${template.name}. Empty start — tap photos to fill slots in order. When full, highlight a photo then tap a slot to swap.`}>
      <div className={`photo-selection-layout ${transitioning ? 'is-transitioning' : ''}`}>
        <section className="negative-gallery">
          <div className="negative-rail"><span>KODAK PORTRA 400</span><span>{photos.length} EXPOSURES</span><span>HAPPYPIX</span></div>
          <div className="negative-track">
            {photos.map((photo, index) => {
              const assignedIndex = selectedSlots.findIndex((item) => item && ((item as any).id === (photo as any).id || (item as any).uri === (photo as any).uri))
              const isAssigned = assignedIndex >= 0
              return (
                <button key={(photo as any).id || index} className={`${isAssigned ? 'is-selected' : ''} ${transitioning ? 'is-disabled' : ''}`} onClick={() => handlePhotoTap(photo)} disabled={transitioning}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <img src={(photo as any).dataUrl || (photo as any).uri} alt={`Captured option ${index + 1}`}/>
                  {isAssigned && <i>Slot {assignedIndex + 1}</i>}
                </button>
              )
            })}
          </div>
          <div className="negative-rail bottom"><span>YOUR MOMENTS</span><span>TAP TO SELECT</span><span>35MM</span></div>
        </section>
        <section className="selection-preview">
          <div className="preview-title">
            <div><span className="section-kicker">LIVE PREVIEW</span><h2>{filledCount} of {slots} selected • Target slot {activeSlotIndex + 1}</h2><p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>{filledCount === 0 ? 'Tap any photo to fill the first empty slot.' : filledCount < slots ? `Filling sequentially — next into slot ${activeSlotIndex + 1}.` : 'Full — tap a photo to highlight, then tap a slot to replace, or tap same slot to clear.'}</p></div>
            <div className="slot-dots">{Array.from({ length: slots }, (_, index) => <span key={index} className={selectedSlots[index] ? 'filled' : index === activeSlotIndex ? 'active' : ''} style={index === activeSlotIndex ? { background: 'var(--violet)', boxShadow: '0 0 0 3px rgba(124,58,237,.2)' } as any : undefined}/> )}</div>
          </div>
          <TemplateCanvas template={template} photos={selectedSlots as any} interactiveSlot={handleSlotTap} activeSlotIndex={activeSlotIndex} />
          <p><Icon name="info" size={16}/> Tap a filled frame slot to clear it — or pick a new photo then tap a slot to swap.</p>
          {transitioning && <div className="transition-overlay"><span><span className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> Moving to customisation…</span></div>}
        </section>
      </div>
      <div className="screen-actions"><BackButton onClick={onBack} label="Retake photos"/><NextButton disabled={!isComplete || transitioning} onClick={handleNext}>Customize my print</NextButton></div>
    </ScreenShell>
  )
}
