import { useMemo, useState } from 'react'
import type { BoothEvent, BoothSession, BoothTemplate, Orientation } from '../types'
import { ScreenShell } from '../components/ScreenShell'
import { BackButton, NextButton, Pill, PrimaryButton } from '../components/Controls'
import { Icon } from '../components/Icon'
import { TemplateCanvas } from '../components/TemplateCanvas'
import { sound } from '../services/sound'
import { templatePrice } from '../utils/pricing'

interface TimedProps {
  secondsLeft: number
}

export function StartScreen({ event, onStart }: { event: BoothEvent; onStart: () => void }) {
  return (
    <ScreenShell screen="start" className="start-screen">
      <button className="start-touch" onClick={() => { sound.click(); onStart() }}>
        <div className="start-art">
          <div className="start-photo photo-one"/><div className="start-photo photo-two"/><div className="start-photo photo-three"/>
          <div className="start-heart"><Icon name="heart" size={38}/></div>
        </div>
        <div className="start-event">
          <span className="eyebrow">WELCOME TO</span>
          <h1>{event.name}</h1>
          <div className="event-meta"><span>{event.clientName}</span><i/> <span>{event.location}</span></div>
          {event.branding.tagline && <blockquote>“{event.branding.tagline}”</blockquote>}
        </div>
        <div className="touch-prompt"><span>Touch anywhere to begin</span><Icon name="arrow-right"/></div>
      </button>
    </ScreenShell>
  )
}

export function OrientationScreen({ value, onChange, onNext, onBack, secondsLeft }: {
  value: Orientation | null
  onChange: (value: Orientation) => void
  onNext: () => void
  onBack: () => void
} & TimedProps) {
  return (
    <ScreenShell screen="orientation" secondsLeft={secondsLeft} title="How should your print look?" subtitle="Choose the direction that fits your moment best.">
      <div className="orientation-grid">
        {(['portrait', 'landscape'] as Orientation[]).map((orientation) => {
          const selected = value === orientation
          return (
            <button key={orientation} className={`orientation-card ${selected ? 'is-selected' : ''}`} onClick={() => { sound.select(); onChange(orientation) }}>
              <div className={`paper-shape paper-shape--${orientation}`}><span/><span/><small>HAPPYPIX</small></div>
              <div><h2>{orientation === 'portrait' ? 'Vertical' : 'Horizontal'}</h2><p>{orientation === 'portrait' ? 'Portraits, reels & classic strips' : 'Wide moments, groups & grids'}</p></div>
              <span className="select-check"><Icon name="check"/></span>
            </button>
          )
        })}
      </div>
      <div className="screen-actions"><BackButton onClick={onBack}/><NextButton onClick={onNext} disabled={!value}>See templates</NextButton></div>
    </ScreenShell>
  )
}

export function TemplateScreen({ event, session, onSelect, onNext, onBack, secondsLeft }: {
  event: BoothEvent
  session: BoothSession
  onSelect: (template: BoothTemplate) => void
  onNext: () => void
  onBack: () => void
} & TimedProps) {
  const available = useMemo(() => event.templates.filter((item) => item.active && item.layout.orientation === session.orientation), [event.templates, session.orientation])
  const sizes = useMemo(() => [...new Set(available.map((item) => item.layout.printSize))], [available])
  const counts = useMemo(() => [...new Set(available.map((item) => item.layout.slots))].sort((a, b) => a - b), [available])
  const [size, setSize] = useState<string>('all')
  const [count, setCount] = useState<number | 'all'>('all')
  const filtered = available.filter((item) => (size === 'all' || item.layout.printSize === size) && (count === 'all' || item.layout.slots === count))

  return (
    <ScreenShell screen="templates" secondsLeft={secondsLeft} title="Pick your favourite look" subtitle="Filter by final print size and number of photos, then choose one design.">
      <div className="template-filters">
        <div><span>Print size</span><button className={size === 'all' ? 'active' : ''} onClick={() => setSize('all')}>All</button>{sizes.map((item) => <button key={item} className={size === item ? 'active' : ''} onClick={() => setSize(item)}>{item}</button>)}</div>
        <div><span>Photos</span><button className={count === 'all' ? 'active' : ''} onClick={() => setCount('all')}>All</button>{counts.map((item) => <button key={item} className={count === item ? 'active' : ''} onClick={() => setCount(item)}>{item}</button>)}</div>
      </div>
      <div className="template-carousel">
        {filtered.map((item) => {
          const selected = session.template?.id === item.id
          return (
            <button key={item.id} className={`template-card ${selected ? 'is-selected' : ''}`} onClick={() => { sound.select(); onSelect(item) }}>
              <div className="template-card-preview"><TemplateCanvas template={item}/>{selected && <span className="selected-badge"><Icon name="check"/>Selected</span>}</div>
              <div className="template-card-copy"><div><h2>{item.name}</h2><p>{item.layout.label} · {item.category}</p></div><Pill tone="pink">{templatePrice(item, event.layoutPrices) === 0 ? 'Free' : `₹${templatePrice(item, event.layoutPrices)}`}</Pill></div>
            </button>
          )
        })}
        {filtered.length === 0 && <div className="empty-filter"><Icon name="image" size={38}/><h3>No templates in this combination</h3><p>Try another print size or photo count.</p></div>}
      </div>
      <div className="screen-actions"><BackButton onClick={onBack}/><NextButton onClick={onNext} disabled={!session.template}>Choose this template</NextButton></div>
    </ScreenShell>
  )
}

export function PrintCountScreen({ event, session, maximumPrints, onUpdate, onNext, onBack, secondsLeft }: {
  event: BoothEvent
  session: BoothSession
  maximumPrints: number
  onUpdate: (value: { prints?: number; digitalCopy?: boolean }) => void
  onNext: () => void
  onBack: () => void
} & TimedProps) {
  if (!session.template) return null
  const unit = templatePrice(session.template, event.layoutPrices)
  const choices = [1, 2, 4, 6, 8, 10].filter((item) => item <= maximumPrints)
  return (
    <ScreenShell screen="prints" secondsLeft={secondsLeft} title="Almost ready" subtitle="Choose how many copies you want. Every copy uses the selected event price.">
      <div className="print-details-grid">
        <section className="print-option-panel">
          <span className="section-kicker">NUMBER OF PRINTS</span>
          <div className="count-options">{choices.map((item) => <button key={item} className={session.prints === item ? 'active' : ''} onClick={() => { sound.select(); onUpdate({ prints: item }) }}>{item}</button>)}</div>
          {event.digitalCopy && <div className="digital-choice"><div className="digital-icon"><Icon name="copy"/></div><div><h3>Add digital copies?</h3><p>Show a download QR after printing.</p></div><div className="yes-no"><button className={session.digitalCopy ? 'active' : ''} onClick={() => onUpdate({ digitalCopy: true })}>Yes</button><button className={!session.digitalCopy ? 'active no' : ''} onClick={() => onUpdate({ digitalCopy: false })}>No</button></div></div>}
        </section>
        <section className="order-preview-card">
          <TemplateCanvas template={session.template}/>
          <div className="order-preview-copy"><span>{session.template.name}</span><small>{session.template.layout.label}</small></div>
          <div className="price-math"><span>{session.prints} × {unit === 0 ? 'Free' : `₹${unit}`}</span><strong>{session.prints * unit === 0 ? 'Free' : `₹${session.prints * unit}`}</strong></div>
          <p>Final discount, if any, is calculated securely on the next screen.</p>
        </section>
      </div>
      <div className="screen-actions"><BackButton onClick={onBack}/><PrimaryButton onClick={onNext}>Continue to payment<Icon name="arrow-right"/></PrimaryButton></div>
    </ScreenShell>
  )
}
