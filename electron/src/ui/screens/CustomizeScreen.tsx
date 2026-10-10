import { useState } from 'react'
import type { BoothEvent, BoothTemplate, CapturedPhoto, Customization, FilterId, OrnamentId } from '../types'
import { ScreenShell } from '../components/ScreenShell'
import { BackButton, PrimaryButton } from '../components/Controls'
import { Icon } from '../components/Icon'
import { TemplateCanvas } from '../components/TemplateCanvas'
import { sound } from '../services/sound'

const ORNAMENTS: { id: OrnamentId; label: string; symbol: string }[] = [
  { id: 'none', label: 'Clean', symbol: '○' },
  { id: 'bubbles', label: 'Bubbles', symbol: '◌' },
  { id: 'hearts', label: 'Hearts', symbol: '♡' },
  { id: 'stars', label: 'Stars', symbol: '✦' },
  { id: 'confetti', label: 'Confetti', symbol: '⌁' },
]
const EMOJIS = ['❤️', '✨', '🎉', '📸', '👑', '🦋', '🌸', '🥳', '🔥', '💫', '🌈', '🫶']

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
  const [tab, setTab] = useState<'ornaments' | 'filters' | 'stickers' | 'logos' | 'text'>('ornaments')
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

  return (
    <ScreenShell screen="customize" secondsLeft={secondsLeft} title="Make it yours" subtitle="A few thoughtful touches — without hiding the design you chose.">
      <div className="customize-layout">
        <section className="custom-preview-stage">
          <TemplateCanvas
            template={template}
            photos={photos}
            customization={value}
            onStickerMove={moveSticker}
            onStickerDelete={deleteSticker}
          />
          <div className="custom-hint"><Icon name="sparkles" size={17}/> Your final print preview — drag stickers to reposition</div>
        </section>
        <section className="custom-tools">
          <nav>{([
            ['ornaments', 'Pattern'], ['filters', 'Filter'], ['stickers', 'Stickers'], ['logos', 'Logos'], ['text', 'Text'],
          ] as const).map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
          <div className="tool-content">
            {tab === 'ornaments' && <><span className="section-kicker">LIGHT BACKGROUND ORNAMENTS</span><div className="ornament-options">{ORNAMENTS.map((item) => <button key={item.id} className={value.ornament === item.id ? 'active' : ''} onClick={() => update({ ornament: item.id })}><b>{item.symbol}</b><span>{item.label}</span></button>)}</div></>}
            {tab === 'filters' && <><span className="section-kicker">EVENT PHOTO FILTERS</span><div className="filter-options">{event.filters.map((filter) => <button key={filter} className={value.filter === filter ? `active filter-swatch filter--${filter}` : `filter-swatch filter--${filter}`} onClick={() => update({ filter: filter as FilterId })}><i/><span>{filter === 'bw' ? 'B&W' : filter}</span></button>)}</div></>}
            {tab === 'stickers' && (
              <>
                <span className="section-kicker">TAP TO ADD · DRAG TO MOVE · × TO REMOVE</span>
                <div className="emoji-options">{EMOJIS.map((emoji) => <button key={emoji} onClick={() => addSticker(emoji)}>{emoji}</button>)}</div>
                {value.stickers.length > 0 && (
                  <div className="sticker-list">
                    {value.stickers.map((s) => (
                      <div key={s.id} className="sticker-list-row">
                        <span className="sticker-emoji-preview">{s.emoji}</span>
                        <button className="sticker-size-btn" onClick={() => scaleSticker(s.id, -0.25)} title="Smaller">−</button>
                        <span className="sticker-size-label">{Math.round((s.scale ?? 1) * 100)}%</span>
                        <button className="sticker-size-btn" onClick={() => scaleSticker(s.id, 0.25)} title="Larger">+</button>
                        <button className="sticker-delete-btn" onClick={() => deleteSticker(s.id)} title="Remove">×</button>
                      </div>
                    ))}
                    <button className="text-action" onClick={() => update({ stickers: [] })}>Clear all stickers</button>
                  </div>
                )}
              </>
            )}
            {tab === 'logos' && <><span className="section-kicker">EVENT LOGOS</span><div className="logo-options"><button className={!value.logo ? 'active none-logo' : 'none-logo'} onClick={() => update({ logo: null })}>No logo</button>{event.branding.logos.map((logo, index) => <button key={logo} className={value.logo === logo ? 'active' : ''} onClick={() => update({ logo })}><img src={logo} alt={`Event logo ${index + 1}`}/></button>)}</div></>}
            {tab === 'text' && <div className="text-tools"><label>Main text<input value={value.title} maxLength={42} onChange={(e) => update({ title: e.target.value })} placeholder={template.design.title}/></label><label>Subtext<input value={value.subtitle} maxLength={60} onChange={(e) => update({ subtitle: e.target.value })} placeholder={event.branding.tagline || template.design.subtitle}/></label><button className="text-action" onClick={() => update({ title: '', subtitle: '' })}>Use template text</button></div>}
          </div>
        </section>
      </div>
      <div className="screen-actions"><BackButton onClick={onBack}/><PrimaryButton onClick={onFinish} disabled={printing}>{printing ? <><span className="button-loader"/>Preparing your print…</> : <><Icon name="printer"/>Print my photos</>}</PrimaryButton></div>
    </ScreenShell>
  )
}
