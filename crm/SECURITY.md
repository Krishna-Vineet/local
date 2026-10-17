# HappyPix CRM — Security model

This document lists what the CRM front-end enforces, what the mock backend
enforces (and therefore what the **real backend must replicate**), and the
hosting headers that must be set at deploy time.

## 1. Threat model in one paragraph

The CRM is a browser SPA. Everything shipped to the browser is public, so the
front-end is treated as *untrusted*: every permission, scope and validation
here is a convenience; the backend must re-check all of it. The attacker we
design against is (a) an anonymous internet user, (b) a logged-in low-privilege
user (Org Manager / Support Manager) trying to escalate, and (c) a stolen or
leaked token.

## 2. Authentication & sessions

| Control | Where | Detail |
|---|---|---|
| Real password verification | server | Password must match; the old mock accepted any 6+ char string — fixed. |
| Login throttling | server | `VITE_MAX_LOGIN_ATTEMPTS` (default 5) failures → 15-min lockout per email; returns **429** even for a correct password while locked. Failed attempts are audit-logged (`platform.auth.login_failed`). |
| Opaque session tokens | server | Login issues `mock:<uid>:<40 hex>` stored in a server session table with `expiresAt` (`VITE_SESSION_TTL_MIN`, default 8 h). Forged / legacy / expired tokens → 401. Real backend: JWT with `exp` **or** DB sessions — either is fine, but revocation must work. |
| Logout revokes | server + client | `POST /auth/logout` deletes the session. Client clears storage and broadcasts via the `storage` event so all tabs sign out. |
| Session watchdog | client | Re-validates `/auth/me` on mount, every 60 s and on tab focus; a 401 signs out with a "session expired" toast. |
| Password policy | server | ≥ 8 chars, at least one letter and one number. Applied to change / reset / new-member passwords. Existing demo password `demo123` still logs in (policy applies to *new* passwords). |
| Change password | server | Requires the **current** password; kills every other session for that user. |
| Forgot password | server | OTP (6 digits, 10-min TTL, single-use) to the account email. Always 200 (no account enumeration). Success kills all sessions. Demo returns the code in the response — production must **never** do that. |
| Change email | server | Requires current password → OTP sent to the **new** address → confirm. Uniqueness enforced twice (request and confirm). Success kills other sessions. |
| No admin password resets | server + UI | Removed everywhere (platform and org). Nobody can set or see another person's password. |

## 3. Authorisation

* Fixed permission matrix in `src/lib/roles.js` is imported by **both** the UI
  and the mock server, so they can never disagree. The real backend should
  vendor the same matrix.
* Org users are hard-scoped to their `organizationId`; every org query filters
  by it. Cross-org IDs return 404, not 403 (no existence leak).
* Org Team & Roles: only `ORG_ADMIN` mutates; managers get read-only (server
  returns `canManage:false` and rejects writes with 403). Role values are
  whitelisted (`ORG_ADMIN|ORG_MANAGER`); attempts to create `OWNER` → 400.
* Last-active-admin protection: an org can never demote/deactivate its final
  admin (409) and no one can deactivate themselves (400).
* Platform: only `OWNER` creates internal users, and only as
  `PLATFORM_ADMIN|SUPPORT_MANAGER` (Owner is a bootstrap-only account).

## 4. Input handling

* `safeStr()` trims, strips control characters and caps length on every
  free-text field written by the server (names, taglines, emails).
* Emails validated by format + length + uniqueness (case-insensitive).
* **Media URLs** (profile photo, org logo, event sponsor logos, AI artwork)
  must be `https://`, `http://` or `data:image/(png|jpeg|webp|gif|svg+xml)`.
  `javascript:`, `data:text/html`, etc. → 400. Real backend should
  additionally upload to object storage and re-serve, never echo raw data URLs.
* Numeric fields are clamped (`clampInt`) on the telemetry endpoint; prices,
  timeouts and limits are range-checked on the defaults endpoint.
* The UI never uses `dangerouslySetInnerHTML`, `innerHTML`, `eval` or
  `new Function` (verified by grep in CI — keep it that way).
* External links open with `noopener,noreferrer` (`openExternal()` in
  `src/lib/env.js`).

## 5. Production build hygiene

* `VITE_MOCK=false` builds contain **zero** mock code: the mock server, seed
  DB and demo quick-login panel are behind dynamic `import()` guarded by a
  build-time constant, so Rollup drops them. Verified: no `demo123`,
  `Sunset Weddings`, `happypix_crm_v2_db` or demo emails in the production
  bundle.
* No secrets in `.env*` — every `VITE_` var ships to the browser.
* `.env`, `.env.local` are git-ignored; commit only `.env.example`.

## 6. HTTP headers the host MUST send

`index.html` carries a `<meta http-equiv="Content-Security-Policy">` as a
floor, but meta CSP cannot set `frame-ancestors` and cannot protect the HTML
document itself. Configure these on nginx / Vercel / CloudFront:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.happypix.example;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cache-Control: no-store            (for /api/* responses)
```

Replace `https://api.happypix.example` in `connect-src` with your real
`VITE_API_URL` (or drop it if the API is same-origin).

## 7. Backend checklist (beyond what the mock can show)

- [ ] Hash passwords with Argon2id / bcrypt (cost ≥ 12). The mock stores
      plaintext only because it is a browser demo.
- [ ] Rate-limit `/auth/*` by IP **and** by email; consider CAPTCHA after the
      lockout triggers.
- [ ] OTP codes: store hashed, 10-min TTL, single-use, max 5 verify attempts.
- [ ] Send tokens as `Authorization: Bearer` (as the client does) **or**
      `HttpOnly; Secure; SameSite=Strict` cookies + CSRF token. If you switch
      to cookies, remove `localStorage` token storage in `src/api/client.js`.
- [ ] CORS: allow only the CRM origin; no `*` with credentials.
- [ ] Log every auth event and privileged mutation to an append-only audit
      store (the CRM already renders `platform.*` / `organization.*` actions).
- [ ] Booth endpoints (`/booth/*`) authenticate with the device UUID — rotate
      it on re-pair and rate-limit per device.
- [ ] Dependency scanning (`npm audit`, Dependabot) in CI.
