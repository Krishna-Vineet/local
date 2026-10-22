# HappyPix — Deployment, Builds & Release Guide

> **Scope:** how every artefact gets from a commit to a customer, and how to get it back out again.
> **Audience:** release engineer, on-call engineer, founder doing a hotfix at 11 pm.
> **Last verified:** 2026-10-23, branch `arena/097e52ae-local`.

---

## Table of contents

1. [Hosting topology](#1-hosting-topology)
2. [Domains, DNS and SSL](#2-domains-dns-and-ssl)
3. [Environments](#3-environments)
4. [Configuration and secrets](#4-configuration-and-secrets)
5. [CI/CD pipeline](#5-cicd-pipeline)
6. [Signing and distribution](#6-signing-and-distribution)
7. [Release procedure](#7-release-procedure)
8. [Versioning, notes and checksums](#8-versioning-notes-and-checksums)
9. [Rollback](#9-rollback)
10. [Database migration recovery](#10-database-migration-recovery)
11. [Emergency release](#11-emergency-release)
12. [Post-release verification](#12-post-release-verification)

---

## 1. Hosting topology

```
                          Cloudflare / registrar DNS
                                     │
        ┌────────────────────────────┼─────────────────────────────┐
        │                            │                             │
   happypix.in                 crm.happypix.in              api.happypix.in
        │                            │                             │
   ┌────▼──────────────┐   ┌─────────▼─────────┐        ┌──────────▼──────────┐
   │ Vercel: website   │   │ Vercel: crm       │        │ Vercel: backend     │
   │ static SPA        │   │ static SPA        │        │ Express serverless  │
   └────┬──────────────┘   └───────────────────┘        └──────────┬──────────┘
        │ /api                                                      │
   ┌────▼──────────────────┐                          ┌─────────────▼──────────┐
   │ Vercel: website-backend│                         │ MongoDB Atlas (M10+)   │
   │ Express serverless     │◄──── same database ────►│ S3 bucket (private)    │
   └────────────────────────┘                         └────────────────────────┘

   ┌────────────────────────┐   ┌─────────────────────────┐   ┌──────────────────┐
   │ Booth APK (side-load / │   │ Booth installer (NSIS / │   │ GitHub Releases  │
   │ Play Store internal)   │   │ DMG) delivered by link  │   │ artefacts+hashes │
   └────────────────────────┘   └─────────────────────────┘   └──────────────────┘
```

### 1.1 Service inventory

| Component | Host | Runtime | Scaling model |
|---|---|---|---|
| Website | Vercel | Static | CDN edge |
| CRM | Vercel | Static | CDN edge |
| Main API | Vercel serverless (Node 20) | Express 5 | Per-request, auto |
| Website API | Vercel serverless (Node 20) | Express 5 | Per-request, auto |
| Database | MongoDB Atlas | Replica set | Vertical + read preference |
| Object storage | AWS S3 | Managed | Effectively unlimited |
| Print bridge | Customer booth PC | Node/Electron | One per booth |
| Booth apps | Customer hardware | — | — |

### 1.2 Why serverless for the APIs

Booth traffic is spiky (an event is idle all day, then 200 sessions in two hours). Serverless absorbs
that without paying for idle capacity. Costs: cold starts (~300–800 ms) and execution time limits,
which is why long jobs (image composition, bulk AI) stay on the client or are broken into small
requests.

### 1.3 Region choices

| Resource | Region | Reason |
|---|---|---|
| Vercel functions | `bom1` (Mumbai) preferred | Majority of customers are in India |
| MongoDB Atlas | `ap-south-1` / nearest to Vercel | Latency |
| S3 | `ap-south-1` or `ap-southeast-2` | Data locality + existing bucket |

If the Vercel region and the Atlas region differ, every query pays a round-trip. Verify with a
`/api/org/dashboard` timing check after any region change.

---

## 2. Domains, DNS and SSL

### 2.1 Current hostnames

| Hostname | Points to | Purpose | Status |
|---|---|---|---|
| `happypix.in` | Vercel (website project) | Marketing + guest downloads | ⟨verify DNS⟩ |
| `www.happypix.in` | Vercel (redirect to apex) | — | ⟨verify DNS⟩ |
| `crm.happypix.in` | Vercel (crm project) | Admin console | ⟨verify DNS⟩ |
| `api.happypix.in` | Vercel (backend project) | Main API | ⟨verify DNS⟩ |
| `happypix.vercel.app` | Vercel | Preview/legacy | ✅ live |
| `happypixcrm.vercel.app` | Vercel | Preview/legacy | ✅ live |
| `happypix-v2-backend.vercel.app` | Vercel | Preview/legacy | ✅ live |

### 2.2 DNS records

```
; Apex → Vercel
@        A      76.76.21.21
www      CNAME  cname.vercel-dns.com.

; Application subdomains
crm      CNAME  cname.vercel-dns.com.
api      CNAME  cname.vercel-dns.com.

; Verification / mail
_dmarc   TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@happypix.in"
@        TXT    "v=spf1 include:sendgrid.net include:_spf.google.com ~all"
sg       CNAME  ...
```

Use the exact values Vercel shows in **Project → Settings → Domains**. Do not guess A records for
subdomains — Vercel may require a CNAME or an A record at `76.76.21.21`.

### 2.3 SSL/TLS

* Vercel issues and renews Let's Encrypt certificates automatically **once DNS resolves**.
* Force HTTPS (Vercel default) and HSTS (`max-age=31536000; includeSubDomains`).
* Do not add a Cloudflare proxy in front of Vercel without enabling "Full (strict)" — otherwise you
  create a redirect loop or break certificate validation.

### 2.4 CORS must be updated for any new origin

Every front-end origin must appear in `backend/server.js` → `staticAllowedOrigins` **and**
`website-backend` → `ALLOWED_ORIGINS`. A missing origin presents as a confusing browser failure
while the API returns 200 to `curl`.

---

## 3. Environments

| Environment | Purpose | API | CRM | Website | Data |
|---|---|---|---|---|---|
| **Local** | Development | `localhost:5000` | `localhost:5173` | `localhost:5174` | Local Mongo / dev Atlas |
| **Preview** | PR review | Vercel preview | Vercel preview | Vercel preview | **Dev Atlas** (never production) |
| **Staging** | Pre-release validation | `staging-api` ⟨TBC⟩ | `staging-crm` ⟨TBC⟩ | `staging` ⟨TBC⟩ | Staging Atlas + separate S3 bucket |
| **Production** | Customers | `api.happypix.in` | `crm.happypix.in` | `happypix.in` | Production Atlas + production bucket |

### 3.1 Hard rules

1. **Previews never touch production data.** Preview deployments must use a separate database and
   bucket. A preview that writes into production can send real emails, charge real cards and pollute
   analytics.
2. **Staging mirrors production config**, differing only in credentials and URLs.
3. **No environment shares a JWT secret** with another.
4. **Payment keys differ by environment** — `rzp_test_*` outside production; production boots log
   `🟢 LIVE` so a mistake is visible in the first line of the deploy log.

### 3.2 If staging does not exist yet

Minimum viable path (acceptable for a small team, documented honestly):

* use Vercel **preview** deployments with a dev database;
* run the release checklist against a local stack + one real booth before promoting;
* create staging before the first enterprise customer — the risk of an untested migration on
  production data is not worth the saved hour.

---

## 4. Configuration and secrets

### 4.1 Where secrets live

| Environment | Store |
|---|---|
| Local | `.env` files (git-ignored) |
| Vercel | Project → Settings → Environment Variables (encrypted) |
| Booth PCs | Never stored; the device token lives in the OS keychain/`booth-state.json` |
| CI | GitHub Actions secrets (only what a build needs — signing keys) |

**Never** commit a real `.env`, keystore, service-account JSON or private key. See
[`SECURITY_PRIVACY.md`](SECURITY_PRIVACY.md#2-secrets-management).

### 4.2 Setting variables in Vercel

```bash
# CLI path (repeatable, scriptable)
vercel env add MONGODB_URI production
vercel env add JWT_SECRET production
vercel env add RAZORPAY_KEY_ID production
vercel env add RAZORPAY_KEY_SECRET production
vercel env add S3_BUCKET_NAME production
vercel env add AWS_ACCESS_KEY_ID production
vercel env add AWS_SECRET_ACCESS_KEY production
vercel env add WEBSITE_URL production
vercel env add CLIENT_URL production
```

Rules:

* Variables are injected at **build** time for `VITE_*` and at **runtime** for server variables.
  Changing a `VITE_*` value requires a redeploy.
* Set each variable for the correct environment scope (`production` vs `preview`).
* Rotate after any staff departure or suspected leak — see the rotation runbook.

### 4.3 Startup validation (fail-closed)

The main API refuses to boot without `MONGODB_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`. This is deliberate: a server that boots with a fallback secret signs tokens
anyone can forge. A failed deploy is better than a silently insecure one.

### 4.4 Configuration drift check (before every release)

| Check | Command / place |
|---|---|
| Backend env parity | Compare Vercel vars to `backend/.env.example` |
| CORS origins | `grep staticAllowedOrigins backend/server.js` |
| Website API base | `website/.env` → `VITE_API_URL` |
| CRM API base | CRM project env → `VITE_API_URL`, `VITE_MOCK=false` |
| S3 bucket + region | Match `S3_BUCKET_NAME` and `AWS_REGION` |
| Plan catalogue | Compare `planService.js` to `website-backend/src/pricing.js` |

---

## 5. CI/CD pipeline

### 5.1 Current state

Deployments are **Vercel Git integrations**: pushing to `main` deploys production; pushing any other
branch creates a preview. GitHub Actions is used for verification, not (yet) for deployment.

### 5.2 Recommended pipeline (target state)

```yaml
# .github/workflows/ci.yml (recommended)
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: backend/package-lock.json }
      - run: npm ci
        working-directory: backend
      - run: npm test
        working-directory: backend

  crm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: crm/package-lock.json }
      - run: npm ci && npm run build
        working-directory: crm
      - run: node scripts/api-smoke.mjs && node scripts/render-test.mjs
        working-directory: crm

  electron:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: electron/package-lock.json }
      - run: npm ci && npm run verify
        working-directory: electron

  website:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: website/package-lock.json }
      - run: npm ci && npm run build
        working-directory: website
```

### 5.3 Required checks before merge

| Check | Blocks merge? |
|---|---|
| `backend npm test` | Yes |
| `crm npm run build` + contract tests | Yes |
| `electron npm run verify` | Yes |
| `website npm run build` | Yes |
| Manual booth smoke (one session) | Yes for release branches |

### 5.4 Deployment triggers

| Branch | Effect |
|---|---|
| `main` | Production deploy of all four Vercel projects |
| `arena/097e52ae-local` | Preview deploy (safe) |
| `feat/*`, `fix/*` | Preview deploy |
| Tag `v*` | Release artefacts (installers) + release notes |

### 5.5 Deploy order for a full-stack change

```
1. Backend (additive, backwards compatible)
2. Website backend
3. Website
4. CRM
5. Booth apps (last — they are hardest to push to hardware)
```

Never deploy a booth app that requires a field the backend does not yet return.

---

## 6. Signing and distribution

### 6.1 Windows (Electron)

| Step | Detail |
|---|---|
| Certificate | OV/EV code-signing certificate (required for SmartScreen reputation) |
| Tool | `electron-builder` + `signtool` |
| Config | `electron/electron-builder.json` → `win.signingHashAlgorithms`, `certificateFile` / `certificateSubjectName` |
| CI secret | Base64 `.pfx` + password in GitHub Actions secrets |
| Timestamp | Always timestamp (`/tr http://timestamp.digicert.com /td sha256`) so signatures outlive the cert |
| Without signing | SmartScreen shows "Unknown publisher"; acceptable for internal pilots only |

```bash
cd electron
CSC_LINK=/path/cert.pfx CSC_KEY_PASSWORD=… npm run dist:win
# verify
signtool verify /pa /v "release/HappyPix Booth Setup 0.1.0.exe"
```

### 6.2 macOS (Electron)

| Step | Detail |
|---|---|
| Apple Developer Program | Required for distribution outside your own machines |
| Identity | `Developer ID Application: …` |
| Entitlements | Camera, network client; sandbox **off** (kiosk needs file + printer access) |
| Notarisation | `notarytool submit … --wait` then `stapler staple` |
| Hardened runtime | Enable, with `com.apple.security.device.camera` |
| Without signing | Gatekeeper blocks; user must right-click → Open, or `xattr -dr com.apple.quarantine` |

```bash
cd electron
CSC_LINK=/path/DeveloperID.p12 CSC_KEY_PASSWORD=… \
APPLE_ID=… APPLE_APP_SPECIFIC_PASSWORD=… APPLE_TEAM_ID=… \
npm run dist:mac
xcrun notarytool submit "release/HappyPix Booth-0.1.0-arm64.dmg" \
  --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
xcrun stapler staple "release/HappyPix Booth-0.1.0-arm64.dmg"
spctl -a -vv --type open "release/HappyPix Booth-0.1.0-arm64.dmg"
```

### 6.3 Android

| Step | Detail |
|---|---|
| Keystore | Generate once, store offline + password manager. **Losing it means a new app identity** |
| Gradle | `signingConfigs.release` reads from `gradle.properties` or env; never commit |
| Build | `pnpm build:apk:release` |
| Distribution | Play Store (internal testing → closed → production) or side-load on managed devices |
| Kiosk provisioning | Device owner must be set on a factory-reset device |

```bash
keytool -genkeypair -v -keystore happypix-release.keystore \
  -alias happypix -keyalg RSA -keysize 2048 -validity 10000
# store both files in the company vault, NOT in the repo
```

### 6.4 Linux

AppImage or `.deb` via electron-builder. No signing requirement; publish a SHA-256 with the file.

### 6.5 Distribution channels

| Channel | Artefact | Audience |
|---|---|---|
| Direct download link | NSIS `.exe`, `.dmg` | Operators (current) |
| Play Store internal testing | `.aab` / APK | Pilot operators |
| Play Store production | `.aab` | General availability (after review) |
| GitHub Releases | All artefacts + checksums | Internal + audit trail |

---

## 7. Release procedure

### 7.1 Pre-release (T-2 days)

- [ ] All CI checks green on the release commit
- [ ] `CHANGELOG`/release notes drafted
- [ ] Database migrations reviewed (backwards compatible?)
- [ ] New env vars documented and set in Vercel
- [ ] Booth app version bumped; APK built and signed
- [ ] Test session completed on real hardware (print + QR + gallery)
- [ ] Rollback plan written for this specific release

### 7.2 Release (T-0)

```
1. Announce freeze in the team channel
2. Tag: git tag -a v2.4.0 -m "Release 2.4.0"
3. Push tag: git push origin v2.4.0
4. Deploy backend → wait for health check
5. Deploy website-backend → health check
6. Deploy website → smoke the download page
7. Deploy CRM → log in as each role
8. Publish booth artefacts (installers + checksums)
9. Update device fleet (see 7.3)
10. Post-release verification (section 12)
```

### 7.3 Rolling out a booth app update

Booths are physical and unmanaged by an MDM in most deployments. Sequence:

1. **Pilot** — one internal booth, one full event day.
2. **Early** — 10 % of fleet (operators who volunteer), 3–5 days.
3. **Broad** — remaining fleet, with a support notice.
4. Keep the previous installer available for 30 days.

Never force-update a booth the day before a wedding. Version-skew is safer than a broken update.

### 7.4 Communication

| Audience | When | Channel |
|---|---|---|
| Internal team | At freeze | Chat |
| Operators (pilot) | Before update | Email + WhatsApp |
| All customers | After verification | Email, in-app notice for breaking changes |
| Status page | If downtime > 5 min | Status page ⟨TBC⟩ |

---

## 8. Versioning, notes and checksums

### 8.1 Scheme

| Artefact | Scheme | Example |
|---|---|---|
| Backend / CRM / website | `MAJOR.MINOR.PATCH` (semver) | `2.4.0` |
| Electron booth | `MAJOR.MINOR.PATCH` | `0.1.0` |
| Android booth | `versionName` semver + monotonic `versionCode` | `1.2.0` / `10200` |

Bump rules: breaking API contract → MAJOR; new feature → MINOR; fix → PATCH.

### 8.2 Release note template

```markdown
## HappyPix 2.4.0 — 2026-10-23

### Highlights
- Final composited frame now uploads to S3 with individual photos; CRM gallery shows the composite
  as the session cover and the guest QR resolves to the same image.
- Cross-platform printer telemetry: macOS now reports status, queue depth, orientation and quality
  via CUPS (paper/ribbon levels remain unavailable where the driver does not expose them).

### Fixes
- Fixed: three-slot templates showed only one frame in the gallery and on the download page.
- Fixed: photo-selection cards were not tappable when a slot was unassigned.

### Compatibility
- Backend: no breaking change; older booths continue to work.
- Booth app: update recommended (composite upload). Minimum supported: 0.1.0.
- Database: no migration.

### Known issues
- macOS cannot report dye-sub media counters for some drivers (by design, returns null).
- iOS booth app not available.

### Checksums
SHA-256 published in the release notes block below.
```

### 8.3 Checksums

```bash
# Generate for all release artefacts
shasum -a 256 release/* > release/SHA256SUMS.txt
cat release/SHA256SUMS.txt
```

Publish `SHA256SUMS.txt` next to the downloads. Operators installing from a link should verify:

```powershell
Get-FileHash "HappyPix Booth Setup 0.1.0.exe" -Algorithm SHA256
```

```bash
shasum -a 256 "HappyPix Booth-0.1.0-arm64.dmg"
```

### 8.4 Release record

Each release must record: version, commit SHA, tag, date, deployer, artefact hashes, migration(s)
applied, rollback commit. Store it in the handover register and in the GitHub Release body.

---

## 9. Rollback

### 9.1 Web/API (fast path)

Vercel keeps every deployment. Rollback is a promotion, not a rebuild:

```bash
vercel ls happypix-v2-backend          # list deployments
vercel promote <deployment-url>        # promote a previous deployment to production
```

Or in the dashboard: **Deployments → previous → Promote to Production**. Takes ~30 s.

**Git-based alternative:**

```bash
git revert --no-edit <bad-commit>
git push origin main
```

This is slower (build time) but keeps `main` honest. Use the dashboard promotion for acute outages,
then revert `main` so the next deploy does not reintroduce the bug.

### 9.2 Database rollback (the dangerous one)

Code rolls back in seconds; data does not. Decide **before** deploying:

| Migration type | Rollback strategy |
|---|---|
| Additive (new field, new collection) | Leave it. Old code ignores it. No action |
| Backfill (data rewrite) | Keep the inverse script ready; run it only if the new code is reverted |
| Destructive (drop field/index) | **Never in the same release** as the code that stops using it. Two releases minimum |
| Index change | Recreate the previous index; watch for a rebuild window on large collections |

### 9.3 Booth app rollback

Keep the previous installer. For Android, keep the previous APK signed with the same key so it can
be installed over the newer version (downgrade requires `adb install -r -d`).

### 9.4 Rollback decision matrix

| Symptom | Action |
|---|---|
| 5xx rate > 5 % after deploy | Promote previous deployment immediately |
| Payments failing | Roll back API first, then investigate |
| Gallery/download broken | Roll back API; downloads are read-only and safe |
| CRM screen broken but API healthy | Roll back CRM project only |
| Booth printing broken | Roll back booth app on pilot devices; API unaffected |
| Data corruption | Stop writes, restore from PITR, then reconcile (see §10) |

---

## 10. Database migration recovery

### 10.1 Before any migration

```bash
# 1. Confirm continuous backup is on and note the timestamp
mongosh "$MONGODB_URI" --eval 'db.adminCommand({ getCmdLineOpts: 1 })'

# 2. Take a logical snapshot of affected collections
mongodump --uri "$MONGODB_URI" --collection photos --out ./backup-$(date +%F)
mongodump --uri "$MONGODB_URI" --collection guestdownloads --out ./backup-$(date +%F)

# 3. Count documents so you can verify afterwards
mongosh "$MONGODB_URI" --eval 'db.photos.countDocuments({})'
```

### 10.2 Restore options, in order of preference

| Option | RTO | When |
|---|---|---|
| Reverse script | minutes | You wrote one and the change is reversible |
| Atlas PITR to a **new** cluster | 15–60 min | Data corrupted; verify before switching connection strings |
| `mongorestore` from logical dump | 30–120 min | Collection-level restore (smaller blast radius) |
| Atlas snapshot restore | 30–60 min | Whole-cluster loss |

**Always restore to a new cluster first.** Point a staging app at it, verify counts and a few
documents, then switch the production connection string.

### 10.3 The photo TTL trap (documented incident class)

An early deployment had a TTL index on `photos.createdAt` that deleted galleries after a period.
The fix is a script, not a migration:

```bash
node backend/scripts/drop-photo-ttl-index.js
mongosh "$MONGODB_URI" --eval 'db.photos.getIndexes()'   # must show no expireAfterSeconds
```

Add this check to every post-deploy verification.

### 10.4 Migration checklist

- [ ] Additive only, or two-release deprecation
- [ ] Backfill script idempotent (safe to re-run)
- [ ] Backup taken and verified (not just requested)
- [ ] Staging run completed with production-shaped data volume
- [ ] Estimated duration measured; schedule off-peak if > 1 min on a large collection
- [ ] Rollback script written and tested
- [ ] Post-migration counts match expectations

---

## 11. Emergency release

Use when production is broken and the fix cannot wait for the normal train.

```
1. Declare: post in the incident channel — "EMERGENCY RELEASE: <summary>"
2. Branch from the current production tag:  git checkout -b hotfix/<slug> v2.3.4
3. Minimal fix only. No refactors, no dependency upgrades, no formatting.
4. Run the narrowest sufficient verification:
     backend  → npm test
     electron → npm run typecheck && npm test
     crm      → npm run build
     plus ONE manual booth session if hardware code changed
5. Deploy the single affected service.
6. Verify with the post-release checks (section 12).
7. Merge back to main immediately (cherry-pick or merge) so the next deploy keeps the fix.
8. Write a short incident note within 24 h: cause, fix, prevention.
```

Hard rules for emergency releases:

* Never bundle a second fix "while we're here".
* Never skip the migration safety rules in §10.
* Never deploy an unsigned installer to customers — ship the fix to the pilot fleet and sign the
  broad build the next morning if the signing pipeline is unavailable.

---

## 12. Post-release verification

Run within 30 minutes of every production deploy.

### 12.1 Automated checks

```bash
# Main API health
curl -sS https://api.happypix.in/api/health | jq

# Website API health
curl -sS https://happypix.in/api/health | jq

# Plans endpoint (proves DB connectivity + pricing logic)
curl -sS https://happypix.in/api/plans | jq '.plans[0].key'

# Public download endpoint returns a clean 404 for an unknown id
curl -s -o /dev/null -w "%{http_code}\n" https://happypix.in/api/downloads/unknown
```

### 12.2 Manual checks

| # | Check | Pass criteria |
|---|---|---|
| 1 | CRM login as Owner | Dashboard loads, no console errors |
| 2 | CRM login as Org Admin | Org screens load, prices visible |
| 3 | Create a test event | Succeeds; pairing code shown |
| 4 | Booth boot | Snapshot downloads; device shows online in CRM |
| 5 | One free session end-to-end | Capture → customise → print → QR |
| 6 | Gallery | Test session shows the **composite** as the cover |
| 7 | Guest download | QR opens; file downloads; expiry shown |
| 8 | Paid session (test key) | Print unlocks only after payment |
| 9 | Raise an issue | Ticket appears in CRM Guest Support |
| 10 | Device telemetry | Printer status/queue visible in device panel |

### 12.3 Post-deploy watch (first 2 hours)

| Signal | Threshold | Action |
|---|---|---|
| API 5xx rate | > 1 % | Roll back |
| API p95 latency | > 1.5 s | Investigate DB/region |
| Payment success rate | < 95 % | Check gateway status, then roll back |
| Heartbeat failures | > 10 % of devices | Check auth/CORS |
| New error codes in logs | any unfamiliar code | Read the trace |
| S3 upload errors | > 1 % | Check bucket policy/quota |

---

*Next: [`OPERATIONS.md`](OPERATIONS.md) for monitoring and incident response, or
[`SECURITY_PRIVACY.md`](SECURITY_PRIVACY.md) for the secrets and data-handling rules referenced above.*
