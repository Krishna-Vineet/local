import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import { getToken, ENV } from '../../api/client.js'
import { Card, PageLoader, Select, EmptyState, Chip, WarnBanner, Button, Modal } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { dateMed } from '../../lib/format.js'
import { useApp } from '../../context/AppContext.jsx'

function buildProxyUrl(photoId) {
  const base = (ENV.API_URL || '/api').replace(/\/+$/, '')
  const token = getToken()
  return `${base}/org/gallery/photo/${photoId}/view?kind=composite${token ? `&token=${encodeURIComponent(token)}` : ''}`
}

function GalleryPhoto({ photo, onPreview }) {
  const [broken, setBroken] = useState(false)
  const [useProxy, setUseProxy] = useState(false)
  const proxySrc = buildProxyUrl(photo.id)
  const rawSrc = useProxy ? proxySrc : (photo.finalImageUrl || photo.compositeUrl || photo.imageUrl || photo.url || proxySrc)
  const isSafeUrl = typeof rawSrc === 'string' && (rawSrc.startsWith('http://') || rawSrc.startsWith('https://') || rawSrc.startsWith('data:image/') || rawSrc.startsWith('/api/'))
  const src = isSafeUrl ? rawSrc : ''

  const handleError = () => {
    // If the direct S3/presigned URL fails, automatically retry using the backend proxy stream
    if (!useProxy && !src.startsWith('data:')) {
      setUseProxy(true)
    } else {
      setBroken(true)
    }
  }

  return (
    <Card style={{ overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => { if (src && !broken) onPreview?.({ ...photo, resolvedSrc: src }) }}
        style={{
          display: 'block',
          width: '100%',
          padding: 0,
          border: 'none',
          background: 'var(--surface-2)',
          cursor: src && !broken ? 'zoom-in' : 'default',
          textAlign: 'left',
        }}
      >
        {broken || !src ? (
          <div style={{ width: '100%', aspectRatio: '4 / 5', display: 'grid', placeItems: 'center', padding: 18, textAlign: 'center' }}>
            <div>
              <Icon name="image" size={26} />
              <div className="t12 muted mt-8">This image could not be loaded.</div>
              <div className="t11 faint mt-4">The photo record exists — storage access or file upload needs attention. Try refreshing in a moment.</div>
            </div>
          </div>
        ) : (
          <img src={src} alt={`Final print from ${photo.eventName}`} loading="lazy" onError={handleError} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'contain', background: '#0d0d11', display: 'block' }} />
        )}
      </button>
      <div style={{ padding: 13 }}>
        <div className="t13 fw6 ellipsis" title={photo.eventName}>{photo.eventName}</div>
        <div className="t11 muted mt-4"><Icon name="monitor" size={11} /> {photo.boothName}</div>
        <div className="t11 faint mt-4">Generated {dateMed(photo.generatedAt || photo.capturedAt)}</div>
        <div className="row wrap gap-6 mt-8">
          <Chip tone="pink">Final print</Chip>
          {photo.guestConsent ? <Chip tone="active">Consent given</Chip> : null}
        </div>
      </div>
    </Card>
  )
}

export default function Gallery() {
  const { toast } = useApp()
  const [data, setData] = useState(null)
  const [eventId, setEventId] = useState('')
  const [boothId, setBoothId] = useState('')
  const [loading, setLoading] = useState(true)
  const [previewPhoto, setPreviewPhoto] = useState(null)

  const load = () => {
    setLoading(true)
    const q = new URLSearchParams()
    if (eventId) q.set('eventId', eventId)
    if (boothId) q.set('boothId', boothId)
    api.org.gallery(q.toString() ? `?${q}` : '').then(setData).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false))
  }
  useEffect(load, [eventId, boothId])

  return <div>
    <div className="page-head">
      <div><div className="page-title">Gallery</div><div className="page-sub">Final generated images ready for print, scoped to your organization. Booth photos stay here — they are not deleted after 24 hours (only the guest's download link expires).</div></div>
      <Button variant="outline" icon="refresh" onClick={load}>Refresh</Button>
    </div>
    {data && !data.enabled ? <div className="mb-16"> <WarnBanner tone="info" icon="image">Gallery is currently disabled by the HappyPix platform policy.</WarnBanner> </div> : null}
    <Card className="mb-16">
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <label><span className="field-label">Select event</span><Select value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={!data?.enabled}><option value="">All events</option>{(data?.events || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></label>
        <label><span className="field-label">Select booth</span><Select value={boothId} onChange={(e) => setBoothId(e.target.value)} disabled={!data?.enabled}><option value="">All booths</option>{(data?.booths || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
      </div>
    </Card>
    {loading ? <PageLoader /> : !data?.enabled || data.photos.length === 0 ? <Card><EmptyState icon="image" title={data?.enabled ? 'No final images found' : 'Gallery unavailable'} message={data?.enabled ? 'Try another event or booth. New final print images will appear here automatically as booths finish sessions.' : 'HappyPix must enable the platform gallery before images can be viewed.'} /></Card> : <>
      <div className="row between mb-12"><span className="t12 muted">{data.photos.length} final image{data.photos.length === 1 ? '' : 's'}</span>{data.requireGuestConsent ? <Chip tone="active"><Icon name="check" size={12} /> Guest consent verified</Chip> : <Chip tone="neutral">All final images</Chip>}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {data.photos.map((photo) => <GalleryPhoto key={photo.id} photo={photo} onPreview={setPreviewPhoto} />)}
      </div>
    </>}

    {previewPhoto ? (
      <Modal
        open={!!previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        title={previewPhoto.eventName || 'Final Print Preview'}
        sub={`${previewPhoto.boothName || 'Booth station'} · Generated ${dateMed(previewPhoto.generatedAt || previewPhoto.capturedAt)}`}
        width="wide"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreviewPhoto(null)}>Close</Button>
            <a
              href={previewPhoto.resolvedSrc}
              download={`happypix-print-${previewPhoto.id}.jpg`}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-primary btn-sm"
            >
              Download Final Print
            </a>
          </>
        }
      >
        <div style={{ display: 'flex', justifyContent: 'center', background: '#0d0d11', padding: 20, borderRadius: 12 }}>
          <img
            src={previewPhoto.resolvedSrc}
            alt={`Final print from ${previewPhoto.eventName}`}
            style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      </Modal>
    ) : null}
  </div>
}
