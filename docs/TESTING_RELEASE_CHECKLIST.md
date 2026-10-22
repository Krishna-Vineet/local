# HappyPix — Testing & Release Acceptance

> **Scope:** what is tested today, how, what is knowingly untested, and the exact checklist that must
> be completed before a release reaches a customer.
> **Last verified:** 2026-10-23, branch `arena/097e52ae-local`.

---

## Table of contents

1. [Test strategy](#1-test-strategy)
2. [Automated tests](#2-automated-tests)
3. [Manual functional test suites](#3-manual-functional-test-suites)
4. [Payment testing](#4-payment-testing)
5. [Camera, printer and photo-delivery testing](#5-camera-printer-and-photo-delivery-testing)
6. [Compatibility matrix](#6-compatibility-matrix)
7. [Performance and load testing](#7-performance-and-load-testing)
8. [Security checks](#8-security-checks)
9. [Known bugs and workarounds](#9-known-bugs-and-workarounds)
10. [Release acceptance checklist](#10-release-acceptance-checklist)
11. [Sign-off](#11-sign-off)

---

## 1. Test strategy

### 1.1 The pyramid we actually have

```
        ▲  Manual booth end-to-end (per release, per hardware rig)
       ╱ ╲
      ╱   ╲   Contract tests (CRM mock ↔ API shapes, permissions parity)
     ╱─────╲
    ╱       ╲  Unit tests (backend services, Electron API client, utils)
   ╱─────────╲
  ╱───────────╲ Static analysis (TypeScript, ESLint) — runs on every commit
```

**Honest assessment:** the backend has meaningful unit and contract coverage; the two booth apps are
verified by typecheck/lint/unit tests plus manual hardware runs. There is **no automated E2E** for
the kiosk flows yet. That gap is the highest testing risk in the project and is called out in §9.

### 1.2 What we optimise for

| Priority | Rationale |
|---|---|
| 1. Money is never wrong | Prices computed server-side; payment confirmation verified twice |
| 2. A guest never loses a photo | Upload retries, idempotent completion, queue |
| 3. A print is never faked | Hardware failures surface, never masked |
| 4. A tenant never sees another tenant | Isolation tests + code review rule |
| 5. A booth survives bad Wi-Fi | Offline-first paths tested manually every release |

### 1.3 Test environments

| Environment | Used for | Data |
|---|---|---|
| Local | Unit tests, feature dev | Local Mongo |
| Preview (Vercel) | Contract checks, UI review | Dev database |
| Staging | Full manual regression, migration rehearsal | Staging database |
| Production | Post-deploy verification only | Real |

---

## 2. Automated tests

### 2.1 Backend (`node --test`)

```bash
cd backend
npm test
```

| Suite | What it proves |
|---|---|
| `boothSnapshot.test.js` | Snapshot contains templates with normalised slot coordinates; `revision` is stable for identical input and changes when content changes |
| `coupons.test.js` | Percentage and fixed discounts, min-spend, expiry, max uses, cross-org rejection |
| `crypto.test.js` | Token hashing is deterministic, HMAC verification accepts valid and rejects tampered signatures |
| `permissions.parity.test.js` | The CRM role matrix and the backend route guards agree for every permission |
| `planService.test.js` | Computed status (trial/active/expiring/expired/suspended/banned), billing price maths for 4 periods, entitlement caps |

Adding a test: put a `*.test.js` file in `backend/tests/`, use `node:test` + `node:assert`. Milestone:
**any new service function must ship with a test.**

### 2.2 Electron (`vitest`)

```bash
cd electron
npm run typecheck      # tsc -b
npm run lint           # eslint (flat config)
npm test               # vitest run
npm run verify         # all of the above + transpile + vite build
```

| Area | Covered |
|---|---|
| `services/api.test.ts` | API client contract, including `CompleteSessionInput` accepting `string | { url, isComposite }` |
| Composite utilities | Deterministic slot maths, filter application, footer reservation |
| Pricing helpers | Price resolution chain matches the backend vocabulary |
| Type safety | Main/renderer boundary types (preload surface) |

### 2.3 CRM

```bash
cd crm
node scripts/api-smoke.mjs      # contract test against the in-browser mock server
node scripts/render-test.mjs    # role × screen render matrix
npm run build                   # build failure = smoke failure
```

`render-test.mjs` is the practical guard for the permission matrix: it renders every screen for every
role and asserts that forbidden screens are not reachable.

### 2.4 Website / website backend

```bash
cd website-backend && npm test
cd website && npm run build
```

Website-backend tests cover pricing (discounts, GST, per-period prices) and download resolution.

### 2.5 Static analysis

| App | Command | Gate |
|---|---|---|
| Electron | `npm run typecheck && npm run lint` | Zero errors |
| Electron | `npm run build:react` | Must succeed |
| Client-app | `pnpm typecheck` | Zero errors |
| Others | build must succeed | Warnings tolerated, errors not |

### 2.6 Coverage expectations

| Layer | Target | Current |
|---|---|---|
| Backend services | 70 % lines | Partial — services with money logic covered |
| Backend routes | 40 % (critical paths) | Low — covered via contract/manual |
| Electron renderer utils | 60 % | Partial |
| CRM | Contract + render matrix | Good |
| Booth hardware | Manual only | — |

Do not chase a coverage number. Cover money, isolation and data-loss paths first.

---

## 3. Manual functional test suites

### 3.1 Authentication and roles (30 min)

| # | Step | Expected |
|---|---|---|
| A1 | Log in as Owner | Platform dashboard; all platform nav entries |
| A2 | Log in as Platform Admin | No revenue/plans/team entries |
| A3 | Log in as Support Manager | Organizations read-only, support queue only |
| A4 | Log in as Org Admin | Full org workspace |
| A5 | Log in as Org Manager | No revenue, coupons, defaults edit or team |
| A6 | Deep-link a forbidden route | Redirect to role home, no empty shell |
| A7 | 5 wrong passwords | Lockout message with clear copy |
| A8 | Forgot password | OTP arrives; reset works; old password rejected |
| A9 | Deactivated user attempts login | Clear "account deactivated" message |
| A10 | Suspended org logs in | Read-only state; mutations blocked with a reason |

### 3.2 Tenancy isolation (20 min)

| # | Step | Expected |
|---|---|---|
| B1 | Org A admin requests an Org B event id via API | 404 (not 403 with data) |
| B2 | Org A admin requests Org B gallery photo | 404 |
| B3 | Org A admin calls a platform route | 403 |
| B4 | Platform Admin calls an org mutation | 403 |
| B5 | Denials appear in the audit log | Yes, with actor + route |

### 3.3 Event and device lifecycle (30 min)

| # | Step | Expected |
|---|---|---|
| C1 | Create event with defaults pricing | Prices cloned; pairing code issued |
| C2 | Change org defaults | Existing event price unchanged; new event uses new price |
| C3 | Exceed plan parallel-event cap | Blocked with an upgrade message |
| C4 | Pair a booth with the code | Snapshot downloaded; device online |
| C5 | Re-pair the same booth | New token; old token rejected |
| C6 | Assign device to event | Booth picks up the change on the next heartbeat |
| C7 | Pause the event | Booth blocks new sessions |
| C8 | Delete the device | Booth receives 410 and returns to pairing |
| C9 | Block the device | Booth receives 403 with a clear message |

### 3.4 Guest session — free (20 min)

| # | Step | Expected |
|---|---|---|
| D1 | Trigger the idle attract screen | Tap starts the flow |
| D2 | Select orientation and template | Price shown matches the CRM |
| D3 | Capture N slots | Countdown, flash, retake available |
| D4 | Deselect/reselect photos | Cards are tappable; no empty slot printable |
| D5 | Apply each filter | Preview updates; print matches preview |
| D6 | Add ornaments/stickers | Preview updates; footer stays clear |
| D7 | Print | Real sheet out; success screen honest |
| D8 | Scan the QR | Download page opens; composite downloads |
| D9 | Check the gallery | Session shows the **composite** as the cover |
| D10 | Wait for idle timeout | Session resets; no partial state remains |

### 3.5 Guest session — paid (20 min)

| # | Step | Expected |
|---|---|---|
| E1 | Quote a paid layout | Amount matches event price × copies |
| E2 | Apply a valid coupon | Discount applied; total correct |
| E3 | Apply an expired coupon | Clear rejection |
| E4 | Pay (test card/UPI) | Camera unlocks only after confirmation |
| E5 | Abandon payment | Timeout state; no print; retry available |
| E6 | Duplicate payment attempt | Single charge; second attempt blocked |
| E7 | Refund in gateway | Recorded; session remains printed |

### 3.6 Issue raising (10 min)

| # | Step | Expected |
|---|---|---|
| F1 | Open the issue modal on success | Timer pauses |
| F2 | Submit "printing" category | Ticket id shown to guest |
| F3 | Check CRM Guest Support | Ticket with session, device and payment context |
| F4 | Reply and resolve | Guest notified (if email given); photos released from hold |

### 3.7 Support escalation (10 min)

| # | Step | Expected |
|---|---|---|
| G1 | Org Manager raises a platform-support request | Appears in Platform Support |
| G2 | Platform Admin accepts and replies | Org sees the reply |
| G3 | Platform denies with reason | Org can reapply; reason visible |
| G4 | Resolve and reopen | Both transitions recorded with timestamps |

### 3.8 Gallery and downloads (15 min)

| # | Step | Expected |
|---|---|---|
| H1 | Gallery groups by session | One row per session |
| H2 | Cover is the composite | Yes for multi-slot templates |
| H3 | Open a session | All individual frames visible |
| H4 | Download a photo | Presigned redirect; file opens |
| H5 | Wait 24 h (or force `expiresAt`) | Download returns 410 with a friendly page |
| H6 | Delete a session | Gone from the gallery; S3 objects removed |

### 3.9 Website and checkout (20 min)

| # | Step | Expected |
|---|---|---|
| I1 | Pricing page shows live plans | Prices match backend |
| I2 | Switch billing period | Totals recalculate; URL reflects it |
| I3 | Apply an active discount campaign | Effective price shown with the original struck through |
| I4 | Complete checkout (test key) | Org + user + subscription created |
| I5 | Provisioning failure path | Payment recorded; support can provision manually |
| I6 | Contact form | Lead appears in CRM Website Leads |

---

## 4. Payment testing

### 4.1 Gateway test credentials

Use `rzp_test_*` keys outside production. The backend logs `🟡 TEST` vs `🟢 LIVE` on boot — check it
before every payment test.

| Scenario | Method | Expected |
|---|---|---|
| Successful card | Test card from provider docs | `paid`; session unlocks |
| Successful UPI | Test VPA | `paid` |
| Failed payment | Declined test card | `failed`; booth shows retry |
| Abandoned | Close the sheet | `pending` → timeout → retry allowed |
| Duplicate webhook | Replay the same event | No double credit |
| Forged webhook | Wrong signature | 400 `SIGNATURE_INVALID`; no state change |
| Refund | Gateway dashboard | Status recorded; audit entry |
| Currency/amount | Tamper the client quote | Server ignores; charges correct amount |

### 4.2 What must never happen

| Failure | Why it is critical | Guard |
|---|---|---|
| Print without payment | Direct revenue loss | Server quote + webhook/poll gate |
| Double charge | Chargebacks, trust loss | Order uniqueness per session |
| Free session from a tampered payload | Revenue loss | Server-authoritative pricing |
| Payment marked paid by a client call alone | Fraud | Signature verification |

### 4.3 Production smoke (₹1 or a test event)

Before enabling a new gateway in production, run one real minimum-value transaction and refund it.
Confirm: webhook received, `payments` record correct, receipt email sent, refund visible.

---

## 5. Camera, printer and photo-delivery testing

### 5.1 Printer acceptance (per rig, per model)

| # | Test | Pass criteria |
|---|---|---|
| P1 | Discovery | Printer appears in the device panel with the correct model |
| P2 | Test print | One sheet, correct size, no clipping |
| P3 | Multi-copy | 2 and 3 copies produce the correct count |
| P4 | Orientation | Portrait and landscape layouts both correct |
| P5 | Quality setting | High vs draft visibly differs (or is ignored — note which) |
| P6 | Footer | Sponsor logos fully visible, not cut |
| P7 | Colour | Skin tones acceptable vs screen; no double colour management |
| P8 | Media end | Simulate/observe paper end → status reported, guest warned |
| P9 | Jam recovery | Clear jam → queue resumes → next print correct |
| P10 | Queue depth | 3 queued jobs shows `queueDepth: 3` in telemetry |
| P11 | Offline printer | Status `offline`, print returns a real error |
| P12 | Restart host | Counters persist; printer rediscovered |

### 5.2 Camera acceptance (per body)

| # | Test | Pass criteria |
|---|---|---|
| C1 | Discovery | Model correct in the device panel |
| C2 | Live view | ≥ 15 fps, acceptable latency |
| C3 | Capture | Sharp, correctly exposed, saved to the session |
| C4 | Battery | Reported, or `null` where unavailable (never a fake number) |
| C5 | Reconnect | Sleep/wake recovers without restarting the app |
| C6 | Slot accuracy | Each captured frame lands in the intended slot |
| C7 | Long session | 50 captures without memory growth or dropped frames |

### 5.3 Photo delivery acceptance

| # | Test | Pass criteria |
|---|---|---|
| D1 | Individuals uploaded | All N frames present in S3 |
| D2 | Composite uploaded | Present with `isComposite: true` |
| D3 | Gallery cover | Composite, not a single frame |
| D4 | QR resolves | Same composite as the gallery |
| D5 | Expiry | 410 after 24 h with a friendly page |
| D6 | Retry | Re-completing the same session does not duplicate rows |
| D7 | Large session | 8-slot template uploads within timeout |

### 5.4 Offline acceptance (run at every release)

| # | Test | Pass criteria |
|---|---|---|
| O1 | Boot with no internet | Snapshot from cache; entry screen renders |
| O2 | Capture + print offline | Both succeed |
| O3 | Reconnect | Queue drains; photos appear in the gallery |
| O4 | Heartbeat failure | Device shows offline in CRM after 3 misses |
| O5 | Snapshot change while offline | Applied on reconnect |

---

## 6. Compatibility matrix

### 6.1 Operating systems

| OS | Electron booth | CRM | Website | Status |
|---|---|---|---|---|
| Windows 11 Pro 23H2+ | ✅ Primary | ✅ Chrome/Edge | ✅ | Supported |
| Windows 10 22H2 | ✅ | ✅ | ✅ | Supported (until EOL) |
| macOS 14/15 (Apple silicon) | ✅ | ✅ Safari/Chrome | ✅ | Supported |
| macOS 13 (Intel) | ☑️ untested recently | ✅ | ✅ | Best effort |
| Ubuntu 22.04/24.04 | ☑️ CUPS path | ✅ | ✅ | Best effort |
| Android 13/14/15 | — | ✅ browser | ✅ | Booth app |
| iOS/iPadOS | — | ✅ browser | ✅ | No native booth app |

### 6.2 Browsers

| Browser | CRM | Website | Notes |
|---|---|---|---|
| Chrome/Edge (latest 2) | ✅ | ✅ | Primary |
| Safari 17+ | ✅ | ✅ | Canvas filters differ slightly; verify exports |
| Firefox (latest) | ✅ | ✅ | `ctx.filter` support varies by version |
| Mobile Safari/Chrome | ✅ (read-only use) | ✅ | Download portal is mobile-first |
| IE / old Edge | ✖ | ✖ | Unsupported |

### 6.3 Hardware

| Device class | Support | Verified |
|---|---|---|
| Android tablet (Samsung Tab S8/S9 class) | ✅ | See device log |
| Windows kiosk PC (i5 11th gen+, 8 GB) | ✅ | See device log |
| DNP DS-RX1HS / DS620A | ☑️ | Pending physical log |
| Citizen CY-02 | ☑️ | Pending physical log |
| Canon EOS R50 / R100 / M50 II (CCAPI) | ⚠️ | Pending physical log |
| Generic USB webcam | ☑️ | OS-verified |

> Hardware rows are only upgraded to ✅ when a physical verification entry exists in
> [`HARDWARE_PRINTING.md` §2.4](HARDWARE_PRINTING.md#24-verification-log-fill-in-per-rig).

### 6.4 Network conditions

| Condition | Requirement |
|---|---|
| Venue Wi-Fi 5 GHz | Recommended |
| 2.4 GHz only | Supported; expect slower uploads |
| No internet, LAN only | Booth fully functional; sync deferred |
| Captive portal | Must be authenticated before bootstrapping |
| Mobile hotspot | Acceptable fallback; watch data for uploads |

---

## 7. Performance and load testing

### 7.1 Targets

| Metric | Target | Measured by |
|---|---|---|
| CRM dashboard load | < 1.5 s p95 | Browser devtools / Vercel analytics |
| API `GET /api/org/dashboard` | < 400 ms p95 | Logs |
| Snapshot fetch (20 templates) | < 800 ms | Logs |
| Booth heartbeat | < 250 ms | Logs |
| Session complete (4 photos) | < 2.5 s | Logs |
| Gallery page (25 sessions) | < 1 s | Logs |
| Booth composite render | < 2.5 s | Client timing |
| Print dispatch (after first call) | < 500 ms | Client timing |

### 7.2 Load test plan (run before each scaling milestone)

```bash
# Heartbeats — simulate 500 booths beating every 2 minutes
hey -n 2000 -c 100 -m POST \
  -H "Authorization: Bearer <deviceToken>" \
  -H "Content-Type: application/json" \
  -d '{"currentRevision":"rev_x"}' \
  https://api.happypix.in/api/booth/heartbeat

# Gallery read
hey -n 500 -c 20 -H "Authorization: Bearer <jwt>" \
  "https://api.happypix.in/api/org/gallery?page=1&limit=25"

# Download metadata (public)
hey -n 1000 -c 50 https://happypix.in/api/downloads/<downloadId>
```

| Scenario | Load | Pass criteria |
|---|---|---|
| 100 concurrent booths | 50 req/s heartbeats | p95 < 300 ms, no 5xx |
| 1,000 concurrent booths | 500 req/s | p95 < 600 ms, no 5xx |
| Event burst | 200 sessions in 30 min | Session complete p95 < 3 s |
| Gallery spike | 50 concurrent admins | p95 < 1.2 s |
| Download spike | 300 concurrent guests | p95 < 800 ms |

Record results with date, commit, region and instance type. A regression in any row blocks a scale
milestone.

### 7.3 Cost/performance sanity

Watch for N+1 queries in gallery and dashboard endpoints; both aggregate across sessions and can
degrade silently as photo counts grow. Indexes in
[`BACKEND_API_DATABASE.md` §13](BACKEND_API_DATABASE.md#13-indexes-and-migrations) exist for exactly
these queries — verify them after any schema change.

---

## 8. Security checks

Run before every release (30 minutes).

| # | Check | How |
|---|---|---|
| S1 | No secrets in the diff | `git diff origin/main | grep -Ei 'AKIA|secret|password|BEGIN .*PRIVATE KEY'` |
| S2 | Fail-closed boot | Remove `JWT_SECRET` locally → server must refuse to start |
| S3 | Tenant isolation | Attempt Org A → Org B read (API) |
| S4 | Role denial | Org Admin → platform route → 403 |
| S5 | Webhook forgery | POST with a bad signature → 400, no state change |
| S6 | Expired download | Force `expiresAt` in the past → 410 |
| S7 | Upload validation | Upload a 20 MB file → rejected |
| S8 | Rate limits | 20 rapid logins → 429 with `Retry-After` |
| S9 | Presigned URL lifetime | URL expires within the configured window |
| S10 | No stack traces to clients | Trigger a 500 → generic error + correlation id |
| S11 | Audit coverage | Perform a mutation → row present with actor + IP |
| S12 | Dependency audit | `npm audit --omit=dev` — no critical unfixed |

Deeper testing (pen test, automated isolation suite) is listed as a known gap in
[`SECURITY_PRIVACY.md` §9.5](SECURITY_PRIVACY.md#95-known-gaps-tracked-not-hidden).

---

## 9. Known bugs and workarounds

Severity scale: **S1** data loss/security, **S2** blocks a core flow, **S3** degraded but workable,
**S4** cosmetic.

| # | Sev | Issue | Workaround | Status |
|---|---|---|---|---|
| 1 | S2 | macOS CUPS often cannot report dye-sub media levels (`paperRemaining: null`) | Track media by print count; keep a spare roll; DNP Windows rig for full telemetry | By design — vendor limitation |
| 2 | S2 | Canon USB tether on Windows/macOS unsupported (no EDSDK) | Use CCAPI over Wi-Fi, or a UVC webcam | Accepted limitation |
| 3 | S2 | Nikon/Sony capture not shipped | Use Canon CCAPI or device camera | Roadmap |
| 4 | S3 | iOS booth app does not exist | Android tablet or Windows/Mac kiosk | Roadmap |
| 5 | S3 | No automated E2E for booth flows | Manual suite §3.4/3.5 every release | Roadmap |
| 6 | S3 | Video/GIF booth add-on is sellable in the catalogue but not implemented | Do not sell the add-on until shipped | Product action required |
| 7 | S3 | Deactivated user's existing session remains valid up to 8 h | Rotate `JWT_SECRET` for immediate revocation | Accepted risk |
| 8 | S3 | Print bridge `:9123` has no auth | Keep it LAN-only; never port-forward | Accepted risk |
| 9 | S3 | Discount logic duplicated (backend + website backend) | Change both files together; shared fixtures | Tracked tech debt |
| 10 | S4 | Safari renders canvas filters slightly differently | Verify exports per release on Safari | Cosmetic |
| 11 | S4 | Long event names truncate on the booth entry screen | Keep event names ≤ 40 chars | Cosmetic |

**Bug intake rule:** anything that can lose a photo, take money without printing, or expose another
tenant's data is **S1/S2 by default** regardless of how cosmetic it looks.

---

## 10. Release acceptance checklist

Copy this block into the release PR or issue and tick every line. A release is not approved until all
mandatory lines are checked.

### 10.1 Build and static checks

- [ ] `backend npm test` — green
- [ ] `crm npm run build` — succeeds
- [ ] `crm node scripts/api-smoke.mjs` — passes
- [ ] `crm node scripts/render-test.mjs` — passes
- [ ] `website npm run build` — succeeds
- [ ] `website-backend npm test` — passes
- [ ] `electron npm run verify` — typecheck + lint + vitest + build pass
- [ ] `client-app pnpm typecheck` — clean (if boot app changed)

### 10.2 Architecture and data

- [ ] No new endpoint without auth + permission + tenant scoping
- [ ] Any schema change is additive and has a written migration/rollback
- [ ] No destructive migration in the same release as dependent code
- [ ] Indexes verified for any new query pattern
- [ ] `photos` has **no** TTL index (`db.photos.getIndexes()`)
- [ ] `guestdownloads` TTL index present

### 10.3 Money

- [ ] Quote endpoint returns the correct price for all resolution levels (event → defaults → suggested)
- [ ] Coupon validation tested (valid, expired, exhausted, wrong org)
- [ ] Payment confirms only via signature/webhook or verified poll
- [ ] Refund path tested in a gateway sandbox
- [ ] `payments` records reconcile with the provider dashboard

### 10.4 Booth — free session

- [ ] Full session completes on real hardware
- [ ] Print produced and inspected
- [ ] QR opens the correct composite
- [ ] Gallery shows the composite as the session cover
- [ ] Idle timeout resets cleanly

### 10.5 Booth — paid session

- [ ] Camera unlocks only after payment
- [ ] Abandoned payment leaves a retryable state
- [ ] Duplicate submission does not double-charge

### 10.6 Offline

- [ ] Boot offline from cache works
- [ ] Capture + print offline works
- [ ] Reconnect drains the queue
- [ ] CRM shows device offline after 3 missed heartbeats

### 10.7 Issue and support flows

- [ ] Issue modal pauses the countdown
- [ ] Ticket appears in CRM with session context
- [ ] Platform support accept/deny/resolve/reopen all work

### 10.8 Security

- [ ] Security checklist §8 completed
- [ ] `npm audit --omit=dev` has no unfixed critical
- [ ] No secrets in the diff

### 10.9 Documentation and release mechanics

- [ ] Release notes drafted (highlights, fixes, compatibility, known issues)
- [ ] Version numbers bumped consistently
- [ ] New env vars documented and set in the hosting project
- [ ] Rollback target identified (previous deployment URL or commit)
- [ ] Artefact checksums generated
- [ ] Support team briefed on user-visible changes

### 10.10 Post-deploy

- [ ] Health endpoints 200
- [ ] CRM login as each role
- [ ] One real booth session in production (test event)
- [ ] Gallery + QR verified in production
- [ ] Error rate and latency within thresholds for 2 hours

---

## 11. Sign-off

| Role | Responsibility | Name | Date | Signature |
|---|---|---|---|---|
| Engineering Lead | Builds, migrations, code quality | | | |
| QA / Test lead | Manual suites, hardware runs | | | |
| Product Owner | Scope, UX acceptance | | | |
| Security Officer | Security checklist, data handling | | | |
| Operations Lead | Hardware readiness, field training | | | |
| Founder | Final go/no-go | | | |

**Release decision:** ☐ Approved ☐ Approved with conditions (listed below) ☐ Blocked

Conditions / open items:

```
1.
2.
3.
```

---

*Next: [`DEPLOYMENT_RELEASE.md`](DEPLOYMENT_RELEASE.md) for the deploy mechanics this checklist
gates, or [`OPERATIONS.md`](OPERATIONS.md) for what happens after go-live.*
