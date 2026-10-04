# HappyPix CRM — v2

The complete role-aware CRM for the HappyPix photobooth platform, built from scratch against
`03-role-and-permission-spec.md`, `04-crm-screen-spec.md` and `05-crm-flow-spec.md` from the
HappyPix repo. React 18 + Vite, zero runtime dependencies beyond React itself — all icons,
charts and layout are hand-rolled SVG/CSS so the app works in fully offline previews.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
node scripts/api-smoke.mjs    # API contract test
node scripts/render-test.mjs  # role × screen render test
```

## Documentation

- [CRM product and technical documentation](docs/CRM_DOCUMENTATION.md)
- [Complete feature list](docs/FEATURE_LIST.md)
- [Client, user, and owner guide](docs/USER_GUIDE.md)

### Configuration

Copy `.env.example` → `.env`. `VITE_MOCK=true` (default) runs the in-browser demo
backend; `VITE_MOCK=false` + `VITE_API_URL` talks to the real API and ships **no**
mock/demo code. Every variable is documented in `.env.example`; security posture
and required hosting headers are in `SECURITY.md`.

### Demo mode (default)

With no `VITE_API_URL` set, the app runs against an **in-app API**
(`src/api/mock/`) — a full implementation of the v2 contract with deterministic seeded data
(world clock fixed at 2026-09-24 11:30 IST) persisted in `localStorage`.
Any password of 6+ chars signs a demo user in (the quick-login chips use `demo123`).

| Role | Email | What it can do |
|---|---|---|
| Owner | `owner@happypix.com` | Everything: revenue, plans, support, organization lifecycle, internal team |
| Platform Admin | `priya@happypix.com` | Platform console and organization support, minus revenue/plan/user management |
| Support Manager | `support@happypix.com` | Platform dashboard, organizations (read), and full organization-support ticket handling |
| Organization Admin | `sana@sunsetweddings.com` | Full org workspace: revenue, events, both support areas, defaults, coupons, team |
| Organization Manager | `rohit@sunsetweddings.com` | Operations and HappyPix/guest support — **no** revenue/default editing/coupons/audit |

Other seeded orgs worth exploring (login as their admin, e.g. `arpita@pika.in`):
Pika (professional, **expiring in 11 days**), Nova Occasions (fresh **trial**),
Tech Closet (trial, extended once), Alpha Booths (**expired**),
Riya Studio (**suspended** — billing dispute), Glow Events (**banned** — fraud).

"Reset demo data" in the user menu reseeds everything.

### Real backend

```bash
VITE_API_URL=https://happypixbackend.vercel.app npm run dev
# Live Frontend URL: https://happypixfrontend.vercel.app
```

The client (`src/api/client.js`) switches from the mock to real `fetch` calls against
`{VITE_API_URL}/api/…` with `Authorization: Bearer <token>`. **The required backend changes
are itemised in `BACKEND-CHANGES.md`** — until those land, the real backend serves the old
v1 shape and this CRM will not work against it.

## Role-aware screens

| Screen | Owner | Platform Admin | Support Manager | Org Admin | Org Manager |
|---|---|---|---|---|---|
| Login / Profile | ✔ | ✔ | ✔ | ✔ | ✔ |
| Platform Dashboard | ✔ | ✔ | ✔ | — | — |
| Platform Revenue | ✔ | — | — | — | — |
| Organizations (suspend/ban/restore = Owner) | ✔ | read | read | — | — |
| Organization Support | manage | manage | manage | — | — |
| Subscription Plans | manage | — | — | — | — |
| Template Library | manage | manage | — | — | — |
| Team & Roles | create + activate/deactivate | read | — | — | — |
| Gallery Settings | manage | manage | — | — | — |
| Audit & Logs (platform) | ✔ | ✔ | — | — | — |
| Org Dashboard | — | — | — | ✔ | ✔ |
| Org Revenue | — | — | — | ✔ | — |
| Events & Devices | — | — | — | ✔ | ✔ |
| Gallery | — | — | — | ✔ | ✔ |
| HappyPix Support (org → platform) | — | — | — | ✔ | ✔ |
| Guest Support (booth tickets) | — | — | — | ✔ | ✔ |
| Organization Defaults | — | — | — | manage | read-only |
| Coupon Management | — | — | — | ✔ | — |

The matrix is fixed in `src/lib/roles.js` (single source of truth). It is enforced three
times: the sidebar only renders what a role may see, the router redirects on forbidden paths,
and the API layer rejects forbidden calls with 403 (mock enforces the same matrix server-side).
There is **no permission editor anywhere** and **no BOOTH_OPERATOR role** — booths are
UUID-paired devices, never users.

## Domain rules implemented

- **Plan status is computed, never stored**: trial / active / expiring_soon / expired /
  not_subscribed / suspended / banned — from plan + org status + trial-extension flags.
- **Plan limits block creation server-side**: parallel *active* events only (finished events
  never count); device registration is capped; expired/suspended/banned orgs cannot create
  events or register devices. The **Owner** can view, edit, hide and add plans in the
  Subscription Plans catalogue; edited limits are enforced for subscribed organizations.
- **Device hardware health** shows the latest camera, printer and external kiosk-screen
  connection state as green-tick / red-cross icon tiles, alongside print/shutter/battery telemetry.
- **Suspend/ban with mandatory reason**, full restore path, every action audit-logged.
- **Coupons**: org-owned, quantity-limited, expiry-checked, pausable, event-scoped or
  global; the booth only ever shows an "Enter Coupon" field.
- **Events have no passkey and no single scalar price.** Creation includes *General*,
  *Customisation*, *Event print pricing* and *Branding*. Layout prices start from
  Organization Defaults, can be overridden per event, and are saved as the event's full
  effective `layoutPrices` snapshot so later default changes do not alter that event.
- **Defaults** remain the organization-wide baseline: name, logo, booth idle timeout in
  **seconds**, payout settings and a guest price for every layout iteration. Event creation
  inherits these prices before applying event-only overrides.
- **Templates** use the original HappyPix creation flow verbatim: Direct Upload or
  AI Generate, Design Scope *Universal Background* or *Specific Layout* (photo slots
  1/2/3/4/6 × portrait/landscape/strip/square), AI output previewed before saving.
  Photo-slot coordinates are always computed by the Architecture V1 engine
  (`src/lib/templates.js`; bottom 15% of every canvas reserved for branding). Orgs select
  from the active library when creating events; disabled templates cannot be selected.
- **Platform support** is a separate org↔HappyPix workflow available to every organization
  and platform role. An organization raises a review request; platform staff deny it with a
  visible reason or accept it into a numbered ticket. Both sides then chat and attach images.
  Only platform staff resolve or reopen; denied requests may be re-applied with new text.
- **Team**: org admins create organization admins/managers. Existing organization-team names,
  emails and roles cannot be edited by another admin; only deactivation or re-activation is
  available. Owners follow the same identity rule for platform teammates. Password reset is
  self-service.
- **Gallery**: organization admins/managers browse final print-ready images by event and booth.
  Owner/platform-admin policy controls platform-wide availability and whether explicit guest
  publishing consent is required before an image is returned.
- **Audit** is written on every mutating action and read is permission-gated.

## Project map

```
src/
  lib/            roles.js (the fixed matrix), plans.js (plans/limits/filters/statuses),
                  templates.js (Architecture V1: slot engine + 33 layouts),
                  frames.js (the 12-frame catalogue), format.js, router.jsx, icons.jsx
  api/
    client.js     token/session + fetch wrapper (mock ⇄ real via VITE_API_URL)
    index.js      typed endpoint surface (one function per route)
    mock/db.js    deterministic seed + localStorage persistence
    mock/server.js  the v2 API contract: routing, RBAC, tenancy, limits, audit
  context/        AppContext (auth + toasts)
  components/     Logo, ui (design system), charts (pure SVG), FramePreview
                  (the consistent frame renderer), layout/AppShell
  pages/
    Login.jsx
    platform/     Dashboard, Revenue, Organizations, PlatformSupport, SubscriptionPlans,
                  Templates, TeamAndRoles, AuditLogs
    org/          Dashboard, Revenue, EventsDevices, PlatformSupport, guest Support,
                  Team, OrgDefaults, Coupons
    Profile.jsx
```
