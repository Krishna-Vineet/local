import { useState } from 'react'
import type { BoothEvent, BoothTemplate, CapturedPhoto, Customization, FilterId } from '../types'
import { ScreenShell } from '../components/ScreenShell'
import { BackButton, PrimaryButton } from '../components/Controls'
import { Icon } from '../components/Icon'
import { TemplateCanvas } from '../components/TemplateCanvas'
import { sound } from '../services/sound'

const EMOJIS = ['❤️', '✨', '🎉', '📸', '👑', '🦋', '🌸', '🥳', '🔥', '💫', '🌈', '🫶']

type TabId = 'filters' | 'stickers' | 'logos' | 'text'

export function CustomizeScreen({ event, template, photos, value, secondsLeft, printing, onChange, onBack, onFinish }: {
  event: BoothEvent
  template: BoothTemplate
  photos: CapturedPhoto[]
  value: Customization
  secondsLeft: number
  printing: boolean
  onChange: (value: Customization) => void
  onBack: () => void
  onFinish: () => void
}) {
  const [tab, setTab] = useState<TabId>('filters')
  const update = (patch: Partial<Customization>) => onChange({ ...value, ...patch })

  const addSticker = (emoji: string) => {
    sound.select()
    const base = 35 + (value.stickers.length % 5) * 8
    update({
      stickers: [
        ...value.stickers,
        {
          id: `sticker-${Date.now()}-${emoji.codePointAt(0) ?? 0}`,
          emoji,
          x: base,
          y: base,
          scale: 1,
        },
      ],
    })
  }

  const moveSticker = (id: string, x: number, y: number) => {
    update({ stickers: value.stickers.map((s) => s.id === id ? { ...s, x, y } : s) })
  }

  const scaleSticker = (id: string, delta: number) => {
    update({
      stickers: value.stickers.map((s) =>
        s.id === id ? { ...s, scale: Math.max(0.5, Math.min(4, (s.scale ?? 1) + delta)) } : s
      ),
    })
  }

  const deleteSticker = (id: string) => {
    sound.click()
    update({ stickers: value.stickers.filter((s) => s.id !== id) })
  }

  const guestConsent = value.guestConsent ?? true

  return (
    <ScreenShell screen="customize" secondsLeft={secondsLeft} title="Make it yours" subtitle="A few thoughtful touches — without hiding the design you chose.">
      <div className={`customize-layout ${printing ? "is-transitioning" : ""}`}>
        <section className="custom-preview-stage">
          <TemplateCanvas
            template={template}
            photos={photos}
            customization={value}
            onStickerMove={moveSticker}
          />
          <div className="custom-hint"><Icon name="sparkles" size={17}/> Your final print preview — drag stickers to reposition</div>
          {printing && <div className="transition-overlay"><span><span className="button-loader" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: "#fff" } as any}/> Preparing your print…</span></div>}
        </section>
        <section className="custom-tools">
          <nav>{([
            ['filters', 'Filter'], ['stickers', 'Stickers'], ['logos', 'Logos'], ['text', 'Text'],
          ] as const).map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} disabled={printing} onClick={() => setTab(id)}>{label}</button>)}</nav>
          <div className="tool-content">
            {tab === 'filters' && <><span className="section-kicker">EVENT PHOTO FILTERS</span><div className="filter-options">{event.filters.map((filter) => <button key={filter} className={value.filter === filter ? `active filter-swatch filter--${filter}` : `filter-swatch filter--${filter}`} onClick={() => update({ filter: filter as FilterId })}><i/><span>{filter === 'bw' ? 'B&W' : filter}</span></button>)}</div></>}
            {tab === 'stickers' && (
              <>
                <span className="section-kicker">TAP TO ADD · DRAG TO MOVE</span>
                <p className="tool-note">Resize or remove stickers using the controls below — not on the image itself.</p>
                <div className="emoji-options">{EMOJIS.map((emoji) => <button key={emoji} onClick={() => addSticker(emoji)}>{emoji}</button>)}</div>
                {value.stickers.length > 0 && (
                  <div className="sticker-list">
                    {value.stickers.map((s) => (
                      <div key={s.id} className="sticker-list-row">
                        <span>{s.emoji}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.emoji} sticker</span>
                        <div className="sticker-size-group">
                          <button className="sticker-size-btn" onClick={() => scaleSticker(s.id, -0.25)} title="Make smaller" aria-label="Smaller">−</button>
                          <span className="sticker-size-value">{Math.round((s.scale ?? 1) * 100)}%</span>
                          <button className="sticker-size-btn" onClick={() => scaleSticker(s.id, 0.25)} title="Make larger" aria-label="Larger">+</button>
                          <button className="sticker-delete-btn" onClick={() => deleteSticker(s.id)} title="Remove sticker" aria-label="Remove">×</button>
                        </div>
                      </div>
                    ))}
                    <button className="text-action" onClick={() => update({ stickers: [] })}>Clear all stickers</button>
                  </div>
                )}
                {value.stickers.length === 0 && <p className="tool-note" style={{ marginTop: 12 }}>No stickers yet. Tap an emoji above to place it on your print. Use − / + to resize and × to remove — controls sit here alongside minimise/maximise.</p>}
              </>
            )}
            {tab === 'logos' && <><span className="section-kicker">EVENT LOGOS</span><div className="logo-options"><button className={!value.logo ? 'active none-logo' : 'none-logo'} onClick={() => update({ logo: null })}>No logo</button>{event.branding.logos.map((logo, index) => <button key={logo} className={value.logo === logo ? 'active' : ''} onClick={() => update({ logo })}><img src={logo} alt={`Event logo ${index + 1}`}/></button>)}</div></>}
            {tab === 'text' && <div className="text-tools"><label>Main text<input value={value.title} maxLength={42} onChange={(e) => update({ title: e.target.value })} placeholder={template.design.title}/></label><label>Subtext<input value={value.subtitle} maxLength={60} onChange={(e) => update({ subtitle: e.target.value })} placeholder={event.branding.tagline || template.design.subtitle}/></label><button className="text-action" onClick={() => update({ title: '', subtitle: '' })}>Use template text</button></div>}
          </div>
        </section>
      </div>
      <div className="consent-row">
        <div>
          <b>Can we feature your photos?</b>
          <span>Allow {event.name ? event.name : 'the organiser'} to showcase these images in the event gallery. You can change this anytime.</span>
        </div>
        <div className="consent-actions">
          <button type="button" className={`consent-toggle ${guestConsent ? 'active is-yes' : ''}`} onClick={() => update({ guestConsent: true })} aria-pressed={guestConsent}>Yes</button>
          <button type="button" className={`consent-toggle ${!guestConsent ? 'active is-no' : ''}`} onClick={() => update({ guestConsent: false })} aria-pressed={!guestConsent}>No</button>
        </div>
      </div>
      <div className="screen-actions"><BackButton onClick={onBack}/><PrimaryButton onClick={onFinish} disabled={printing}>{printing ? <><span className="button-loader"/>Preparing your print…</> : <><Icon name="printer"/>Print my photos</>}</PrimaryButton></div>
    </ScreenShell>
  )
}
