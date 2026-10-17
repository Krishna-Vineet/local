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
  const [selected, setSelected] = useState<CapturedPhoto[]>(() => (initial.length > 0 ? initial : photos).slice(0, slots))

  const togglePhoto = (photo: CapturedPhoto) => {
    sound.select()
    const existing = selected.findIndex((item) => item.id === photo.id)
    if (existing >= 0) {
      setSelected(selected.filter((item) => item.id !== photo.id))
      return
    }
    if (selected.length < slots) setSelected([...selected, photo])
    else setSelected([...selected.slice(1), photo])
  }

  const clearSlot = (index: number) => setSelected(selected.filter((_, itemIndex) => itemIndex !== index))

  return (
    <ScreenShell screen="photos" secondsLeft={secondsLeft} title="Choose your best shots" subtitle={`Pick ${slots} photo${slots === 1 ? '' : 's'} for ${template.name}. Tap a selected photo to remove it.`}>
      <div className="photo-selection-layout">
        <section className="negative-gallery">
          <div className="negative-rail"><span>KODAK PORTRA 400</span><span>{photos.length} EXPOSURES</span><span>HAPPYPIX</span></div>
          <div className="negative-track">
            {photos.map((photo, index) => {
              const selectedIndex = selected.findIndex((item) => item.id === photo.id)
              return <button key={photo.id} className={selectedIndex >= 0 ? 'is-selected' : ''} onClick={() => togglePhoto(photo)}><span>{String(index + 1).padStart(2, '0')}</span><img src={photo.dataUrl} alt={`Captured option ${index + 1}`}/>{selectedIndex >= 0 && <i>{selectedIndex + 1}</i>}</button>
            })}
          </div>
          <div className="negative-rail bottom"><span>YOUR MOMENTS</span><span>TAP TO SELECT</span><span>35MM</span></div>
        </section>
        <section className="selection-preview">
          <div className="preview-title"><div><span className="section-kicker">LIVE PREVIEW</span><h2>{selected.length} of {slots} selected</h2></div><div className="slot-dots">{Array.from({ length: slots }, (_, index) => <span key={index} className={selected[index] ? 'filled' : ''}/>)}</div></div>
          <TemplateCanvas template={template} photos={selected} interactiveSlot={clearSlot}/>
          <p><Icon name="info" size={16}/> Tap a filled frame slot to clear it.</p>
        </section>
      </div>
      <div className="screen-actions"><BackButton onClick={onBack} label="Retake photos"/><NextButton disabled={selected.length !== slots} onClick={() => onComplete(selected)}>Customize my print</NextButton></div>
    </ScreenShell>
  )
}
