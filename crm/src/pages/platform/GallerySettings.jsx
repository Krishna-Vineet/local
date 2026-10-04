import { useEffect, useState } from 'react'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { Card, PageLoader, Toggle, WarnBanner } from '../../components/ui.jsx'
import { Icon } from '../../lib/icons.jsx'
import { ROLES } from '../../lib/roles.js'

export default function GallerySettings() {
  const { user, toast } = useApp()
  const [settings, setSettings] = useState(null)
  const [busy, setBusy] = useState(false)
  const canEdit = user.role === ROLES.OWNER || user.role === ROLES.PLATFORM_ADMIN

  useEffect(() => {
    api.platform.gallerySettings().then(setSettings).catch((e) => toast(e.message, 'error'))
  }, [])

  const change = async (patch) => {
    if (!canEdit || busy) return
    const next = { ...settings, ...patch }
    setSettings(next)
    setBusy(true)
    try {
      const result = await api.platform.saveGallerySettings(patch)
      setSettings(result.settings)
      toast('Gallery policy updated')
    } catch (e) {
      setSettings(settings)
      toast(e.message, 'error')
    } finally { setBusy(false) }
  }

  if (!settings) return <PageLoader />
  return <div>
    <div className="page-head">
      <div>
        <div className="page-title">Gallery Settings</div>
        <div className="page-sub">Platform-wide controls for organization galleries and guest publishing consent.</div>
      </div>
    </div>
    <div  className="mb-16">
    <WarnBanner tone="info" icon="shield">
      These controls apply to every organization. Final print files stay organization-scoped and are never shared across organizations.
    </WarnBanner>
    </div>
    <Card style={{ maxWidth: 720 }}>
      <div className="card-head"><div><div className="card-title">Platform gallery policy</div><div className="card-sub">Changes take effect immediately in booth capture and CRM gallery results.</div></div></div>
      <SettingRow icon="image" title="Enable organization galleries" text="Show the Gallery page and make final generated print images available to Organization Admins and Managers.">
        <Toggle on={settings.galleryEnabled} onChange={(on) => change({ galleryEnabled: on })} disabled={!canEdit || busy} />
      </SettingRow>
      <SettingRow icon="check-circle" title="Ask guests for publishing permission" text="When enabled, the booth must ask “Allow my photo to post on social media?” and only consented photos appear in the organization gallery." last>
        <Toggle on={settings.requireGuestConsent} onChange={(on) => change({ requireGuestConsent: on })} disabled={!canEdit || busy || !settings.galleryEnabled} />
      </SettingRow>
      <div style={{ padding: '14px 18px', background: 'var(--surface-2)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }} className="t12 muted">
        <b>Current behavior:</b> {!settings.galleryEnabled
          ? ' Galleries are disabled platform-wide.'
          : settings.requireGuestConsent
            ? ' Only final images whose guest explicitly allowed social-media publishing are visible.'
            : ' All final generated images are visible; the booth does not need to ask publishing permission.'}
      </div>
    </Card>
  </div>
}

function SettingRow({ icon, title, text, children, last }) {
  return <div className="row between" style={{ padding: '18px', gap: 20, borderBottom: last ? 'none' : '1px solid var(--line-soft)' }}>
    <div className="row gap-12" style={{ minWidth: 0 }}><Icon name={icon} size={20} style={{ color: 'var(--hp-pink)', flex: 'none' }} /><div><div className="t13 fw6">{title}</div><div className="t12 muted mt-4" style={{ lineHeight: 1.5 }}>{text}</div></div></div>{children}
  </div>
}
