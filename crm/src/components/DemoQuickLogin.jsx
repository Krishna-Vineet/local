// Demo-only quick sign-in chips. Lazily imported by Login.jsx ONLY when
// VITE_MOCK=true, so this file (and the demo credentials) never ships in a
// production build.
import { Icon } from '../lib/icons.jsx'
import { ROLES, ROLE_LABELS } from '../lib/roles.js'

const DEMO_ACCOUNTS = [
  { role: ROLES.OWNER, email: 'owner@happypix.com', name: 'Harshit Mehta', icon: 'zap' },
  { role: ROLES.PLATFORM_ADMIN, email: 'priya@happypix.com', name: 'Priya Nair', icon: 'shield' },
  { role: ROLES.SUPPORT_MANAGER, email: 'support@happypix.com', name: 'Arjun Rao', icon: 'headset' },
  { role: ROLES.ORG_ADMIN, email: 'sana@sunsetweddings.com', name: 'Sana Kapoor · Sunset Weddings', icon: 'building' },
  { role: ROLES.ORG_MANAGER, email: 'rohit@sunsetweddings.com', name: 'Rohit Das · Sunset Weddings', icon: 'calendar' },
]

export default function DemoQuickLogin({ busy, onPick }) {
  return (
    <div className="mt-24">
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="t11" style={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          Demo — quick sign in
        </span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {DEMO_ACCOUNTS.map((a) => (
          <button key={a.role} className="demo-chip" disabled={busy} onClick={() => onPick(a.email, 'demo123')}>
            <span className="role-ico" style={{ background: 'var(--hp-pink-soft)', color: 'var(--hp-pink)' }}>
              <Icon name={a.icon} size={15} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 640 }} className="ellipsis">{a.name}</span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--faint)' }}>{a.email}</span>
            </span>
            <span className="chip chip-neutral role-tag" style={{ height: 19, fontSize: 10.5 }}>{ROLE_LABELS[a.role]}</span>
          </button>
        ))}
      </div>
      <p className="t11 faint" style={{ marginTop: 14, lineHeight: 1.5 }}>
        Demo mode runs an in-app API with seeded data (password <span className="kbd">demo123</span>).
        Set <span className="kbd">VITE_MOCK=false</span> in <span className="kbd">.env</span> to go live — see <span className="kbd">.env.example</span>.
      </p>
    </div>
  )
}
