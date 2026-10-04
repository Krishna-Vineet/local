import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import { Card, PageLoader, Select, EmptyState, Chip, WarnBanner } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { dateMed } from '../../lib/format.js'
import { useApp } from '../../context/AppContext.jsx'

export default function Gallery() {
  const { toast } = useApp()
  const [data, setData] = useState(null)
  const [eventId, setEventId] = useState('')
  const [boothId, setBoothId] = useState('')
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    const q = new URLSearchParams()
    if (eventId) q.set('eventId', eventId)
    if (boothId) q.set('boothId', boothId)
    api.org.gallery(q.toString() ? `?${q}` : '').then(setData).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [eventId, boothId])

  return <div>
    <div className="page-head"><div><div className="page-title">Gallery</div><div className="page-sub">Final generated images ready for print, scoped to your organization.</div></div></div>
    {data && !data.enabled ? <div  className="mb-16"> <WarnBanner tone="info" icon="image">Gallery is currently disabled by the HappyPix platform policy.</WarnBanner> </div> : null}
    <Card className="mb-16">
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <label><span className="field-label">Select event</span><Select value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={!data?.enabled}><option value="">All events</option>{(data?.events || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></label>
        <label><span className="field-label">Select booth</span><Select value={boothId} onChange={(e) => setBoothId(e.target.value)} disabled={!data?.enabled}><option value="">All booths</option>{(data?.booths || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
      </div>
    </Card>
    {loading ? <PageLoader /> : !data?.enabled || data.photos.length === 0 ? <Card><EmptyState icon="image" title={data?.enabled ? 'No final images found' : 'Gallery unavailable'} message={data?.enabled ? 'Try another event or booth. New final print images will appear here automatically.' : 'HappyPix must enable the platform gallery before images can be viewed.'} /></Card> : <>
      <div className="row between mb-12"><span className="t12 muted">{data.photos.length} final image{data.photos.length === 1 ? '' : 's'}</span>{data.requireGuestConsent ? <Chip tone="active"><Icon name="check" size={12} /> Guest consent verified</Chip> : <Chip tone="neutral">All final images</Chip>}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {data.photos.map((photo) => <Card key={photo.id} style={{ overflow: 'hidden' }}>
          <a href={photo.finalImageUrl} target="_blank" rel="noreferrer" style={{ display: 'block', background: 'var(--surface-2)' }}><img src={photo.finalImageUrl} alt={`Final print from ${photo.eventName}`} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', display: 'block' }} /></a>
          <div style={{ padding: 13 }}><div className="t13 fw6 ellipsis">{photo.eventName}</div><div className="t11 muted mt-4"><Icon name="monitor" size={11} /> {photo.boothName}</div><div className="t11 faint mt-4">Generated {dateMed(photo.generatedAt)}</div></div>
        </Card>)}
      </div>
    </>}
  </div>
}
