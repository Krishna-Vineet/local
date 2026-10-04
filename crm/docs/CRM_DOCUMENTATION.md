# HappyPix CRM — Product and Technical Documentation

## 1. Purpose

HappyPix CRM is the role-aware administration application for the HappyPix photobooth platform. It provides two isolated workspaces:

- **Platform workspace** for the HappyPix owner and internal staff.
- **Organization workspace** for photobooth businesses and their operational teams.

The CRM manages organizations, subscriptions, templates, events, booths, prices, payouts, support, coupons, teams, audit records, and final-print galleries. Booths are paired devices, not CRM users.

## 2. Technology

| Area | Implementation |
|---|---|
| UI | React 18 |
| Build and development | Vite 5 |
| Routing | Lightweight hash router in `src/lib/router.jsx` |
| API client | `src/api/client.js` and typed endpoint surface in `src/api/index.js` |
| Demo backend | In-browser API in `src/api/mock/` |
| Styling | Shared design system in `src/index.css` and `src/components/ui.jsx` |
| Authorization | Fixed role/permission matrix in `src/lib/roles.js` |
| Persistence in demo mode | Browser `localStorage` |

The application intentionally has no runtime UI framework dependency. Icons, charts, controls, templates, and layouts are implemented inside the CRM.

## 3. Getting started

### Requirements

- Node.js 18 or newer
- npm

### Local demo

```bash
cd crm
npm install
npm run dev -- --host 0.0.0.0
```

Demo mode uses seeded browser-local data. The quick-login accounts use `demo123`.

### Production build

```bash
cd crm
npm ci
npm run build
npm run preview -- --host 0.0.0.0
```

The static output is generated in `crm/dist/`.

### Automated checks

```bash
npm run build
node scripts/api-smoke.mjs
node scripts/render-test.mjs
```

- `api-smoke.mjs` validates API behavior, authorization, tenancy, and domain rules.
- `render-test.mjs` renders the allowed screens for every role and verifies protected-route redirects.

## 4. Configuration

Copy `.env.example` to `.env` or `.env.local`.

| Variable | Purpose |
|---|---|
| `VITE_MOCK` | `true` uses the browser demo API; `false` uses the real backend. |
| `VITE_API_URL` | Backend base URL. Leave empty to use same-origin `/api` requests. |
| `VITE_SESSION_TTL_MIN` | Demo session duration and production guidance. |
| `VITE_MAX_LOGIN_ATTEMPTS` | Demo sign-in lockout threshold and backend guidance. |
| `VITE_WEBSITE_URL` | Public HappyPix website link. |
| `VITE_SUPPORT_EMAIL` | Support address shown to users. |
| `VITE_LOG_LEVEL` | `silent`, `error`, or `debug`. |

Vite values are embedded into the browser bundle. Never place secrets in `VITE_*` variables.

## 5. Roles and authorization

The role model is fixed; there is no custom permission editor.

| Role | Scope | Summary |
|---|---|---|
| Owner | Platform | Full platform governance, revenue, plans, organizations, internal users, gallery policy, templates, and audit. |
| Platform Admin | Platform | Platform operations, templates, support, audit, organization visibility, and gallery policy. No platform revenue or plan management. |
| Support Manager | Platform | Platform health, organization lookup, and organization-support handling. |
| Organization Admin | One organization | Full organization administration, including revenue, defaults, coupons, team status, and operations. |
| Organization Manager | One organization | Events, devices, galleries, and support operations, with restricted financial and administrative access. |

Authorization is enforced in three places:

1. Navigation only shows allowed destinations.
2. The route table redirects forbidden page requests.
3. The API rejects unauthorized actions and derives organization scope from the authenticated user.

An Organization Admin cannot edit an existing teammate's name, email, or role. They can create an account and later only deactivate or reactivate it. Identity changes remain self-service.

## 6. Application structure

```text
crm/
├── docs/                 Product documentation and user guides
├── scripts/              API and render smoke tests
├── src/
│   ├── api/              API surface, HTTP client, and demo server
│   ├── components/       Shared UI, layout, charts, previews, and branding
│   ├── context/          Authentication, theme, and toast state
│   ├── lib/              Roles, routing, formatting, plans, layouts, and icons
│   ├── pages/
│   │   ├── org/          Organization workspace screens
│   │   └── platform/     HappyPix platform screens
│   ├── templates/        Print-template renderers
│   ├── App.jsx           Route registry and guards
│   └── main.jsx          Browser entry point
├── .env.example
├── SECURITY.md
└── README.md
```

## 7. Major domain behavior

### Organizations and subscriptions

Organization lifecycle and plan lifecycle are separate. An organization may be active, suspended, or banned. Plan state is calculated from subscription dates and organization state. It is not trusted as a client-supplied status string.

The Owner can suspend or ban with a mandatory reason and can restore access. These actions are audit logged and immediately affect protected organization operations.

### Events and booths

Events carry dates, location, templates, filters, digital-copy availability, event pricing snapshots, and branding. Events do not use a CRM passkey or one scalar print price.

Booths are UUID-paired devices. Device records include assignment, operator contact, last-seen state, telemetry, and camera/printer/kiosk-screen health. Active plan limits are enforced when creating events and registering devices.

### Pricing and defaults

Organization Defaults hold the organization's baseline identity, payout settings, idle timeout, and print-layout prices. A new event receives a complete price snapshot. Later default changes do not silently alter existing event prices.

### Gallery and consent

The Gallery displays the final flattened image intended for printing, not raw captures. Organization Admins and Managers may filter images by event and booth.

The platform-level Gallery Settings define behavior for all organizations:

| Gallery | Ask permission | Result |
|---|---|---|
| Off | Either value | Organization galleries are unavailable. |
| On | Off | All final generated images are visible to their organization. |
| On | On | Only images with explicit guest publishing consent are visible. |

The real backend must apply consent and organization filters in its query. UI filtering alone is not a security control. See the repository-level `BACKEND_CHANGES.md` for the storage and endpoint contract.

### Support

There are two distinct support workflows:

- **HappyPix Support:** organization-to-platform review, acceptance or denial, ticket conversation, attachments, resolution, and reopening.
- **Guest Support:** booth/session issues handled by an organization's Admins and Managers.

### Teams

- Owner creates Platform Admin and Support Manager accounts.
- Organization Admin creates Organization Admin and Manager accounts.
- Existing team identity fields cannot be changed by another administrator.
- Administrators may deactivate or reactivate eligible accounts.
- Users manage their own supported profile fields and passwords.
- The last active Organization Admin cannot be deactivated.

## 8. API organization

All client calls are defined in `src/api/index.js` and use `/api/...` paths.

| Namespace | Examples |
|---|---|
| Authentication | Login, current session, logout, profile, password, forgotten password, email change |
| Platform | Dashboard, organizations, revenue, plans, templates, team, support, audit, gallery policy |
| Organization | Dashboard, revenue, events, devices, gallery, support, defaults, coupons, team, audit |
| Booth-facing backend contract | Telemetry, support tickets, and final-image/session submission |

Production requests send `Authorization: Bearer <token>`. The backend must independently enforce role permissions, tenant scope, validation, lifecycle rules, and audit logging.

## 9. Demo mode

Demo mode provides deterministic organizations, events, devices, payments, support cases, users, and gallery images. Data persists in `localStorage`. Use **Reset demo data** from the user menu to restore the seed.

Demo mode is for product review and development. It is not a production backend and does not provide durable multi-user storage.

## 10. Security and operational notes

- Serve the CRM over HTTPS.
- Prefer same-origin `/api` proxying to simplify CORS.
- Never authorize from hidden buttons alone; the backend must enforce every permission.
- Derive organization tenancy from the authenticated account or paired device.
- Keep final gallery media private and return short-lived signed URLs.
- Revoke active sessions when an account is deactivated or security credentials change.
- Audit privileged mutations such as lifecycle, plan, team-status, template, payout, and gallery-policy changes.
- Apply the hosting headers and controls documented in `SECURITY.md`.

## 11. Related documents

- [Feature List](./FEATURE_LIST.md)
- [Client, User, and Owner Guide](./USER_GUIDE.md)
- [`crm/SECURITY.md`](../SECURITY.md)
- [`BACKEND_CHANGES.md`](../../BACKEND_CHANGES.md)
