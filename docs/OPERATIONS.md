# HappyPix — Operations, Monitoring & Recovery

> **Audience:** on-call engineer, support lead, operations manager.
> **Assumes:** you may be reading this at 2 am with a venue full of guests.
> **Last verified:** 2026-10-23, branch `main`.

---

## Table of contents

1. [Service levels and ownership](#1-service-levels-and-ownership)
2. [Monitoring and alerting](#2-monitoring-and-alerting)
3. [Routine operations calendar](#3-routine-operations-calendar)
4. [Backup and disaster recovery](#4-backup-and-disaster-recovery)
5. [Support procedures](#5-support-procedures)
6. [Incident severity and escalation](#6-incident-severity-and-escalation)
7. [Runbooks](#7-runbooks)
8. [Maintenance and dependency management](#8-maintenance-and-dependency-management)
9. [Recovery objectives and drill record](#9-recovery-objectives-and-drill-record)
10. [Vendor and cost operations](#10-vendor-and-cost-operations)

---

## 1. Service levels and ownership

### 1.1 What "up" means

| Service | Up = | Checked by |
|---|---|---|
| Main API | `/api/health` returns 200 and one authenticated request succeeds | Uptime monitor + post-deploy check |
| Website API | `/api/health` returns 200 | Uptime monitor |
| Website | Home + `/download/:id` render | Uptime monitor |
| CRM | Login page loads; login succeeds | Uptime monitor + daily manual |
| Booths | Fleet heartbeat within 6 min | CRM device panel |
| Payments | Test-mode order creation succeeds | Daily synthetic check |
| Printing | Requires a human at the booth | Operator checklist |

### 1.2 Internal targets

| Metric | Target | Notes |
|---|---|---|
| API availability | 99.9 % monthly (≈ 43 min downtime) | Excludes provider-wide outages |
| API p95 latency | < 400 ms (`/api/org/dashboard`) | |
| Payment success rate | > 97 % | Excluding guest abandonment |
| Booth session success | > 98 % of started sessions complete | Measured from telemetry |
| Support first response | < 4 business hours | < 1 h during a live event |
| Incident acknowledgement | < 15 min (S1/S2) | Any hour |

There is no contractual SLA with customers yet. Do not promise one in sales material until the
infrastructure in [`SCALABILITY_PLAN.md`](../business/SCALABILITY_PLAN.md) stage 2 is delivered.

### 1.3 Ownership

| Area | Primary | Backup |
|---|---|---|
| API, database, storage | ⟨Engineering Lead⟩ | ⟨Backend engineer⟩ |
| CRM, website | ⟨Frontend engineer⟩ | ⟨Engineering Lead⟩ |
| Booth apps | ⟨Desktop/Mobile Lead⟩ | ⟨Engineer⟩ |
| Payments and refunds | ⟨Finance⟩ | ⟨Founder⟩ |
| Hardware fleet and events | ⟨Operations Lead⟩ | ⟨Field technician⟩ |
| Customer communication | ⟨Customer Success⟩ | ⟨Founder⟩ |

---

## 2. Monitoring and alerting

### 2.1 Signals and sources

| Signal | Source | Where to look |
|---|---|---|
| Uptime | External monitor (5-min interval) | Monitor dashboard |
| API errors | Vercel function logs | Vercel → Project → Logs |
| API latency | Vercel analytics | Vercel → Observability |
| Database health | Atlas metrics | Atlas → Metrics (connections, ops, disk) |
| Slow queries | Atlas profiler | Atlas → Performance Advisor |
| Storage errors | Application logs (`STORAGE_UNAVAILABLE`) | Vercel logs |
| Payment health | Provider dashboards + `payments` | Razorpay/Cashfree |
| Device fleet | `devices.lastSeenAt` + telemetry | CRM → Events & Devices |
| Audit anomalies | `auditlogs` | CRM → Audit & Logs |
| Cost drift | Provider billing | Monthly review |

### 2.2 Alert thresholds

| Alert | Condition | Severity | First action |
|---|---|---|---|
| API down | 3 consecutive health failures | S1 | Runbook R1 |
| 5xx spike | > 2 % for 5 min | S1/S2 | Check recent deploy first |
| p95 latency | > 1.5 s for 10 min | S2 | Check DB connections + region |
| DB connections | > 80 % of limit | S2 | Check for connection leaks |
| Payment failures | > 5 in 10 min | S1 | Check gateway status |
| S3 errors | > 1 % of uploads | S2 | Check bucket policy/quota |
| Auth failures | > 50/min from one IP | S3 | Consider blocking |
| Devices offline | > 20 % of fleet | S2 | Check API; then field contact |
| Disk (Atlas) | > 80 % | S3 | Plan upgrade |
| Certificate expiry | < 14 days | S3 | Verify host renewal |

### 2.3 Synthetic checks (recommended daily)

```bash
# 1. API health
curl -fsS https://api.happypix.in/api/health

# 2. A real read (proves DB)
curl -fsS https://happypix.in/api/plans | jq -e '.plans | length > 0'

# 3. Download endpoint responds correctly for an unknown id
test "$(curl -s -o /dev/null -w '%{http_code}' https://happypix.in/api/downloads/unknown)" = "404"

# 4. Auth is not accepting garbage
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{}' \
  https://api.happypix.in/api/auth/login   # expect 400/401, never 200
```

### 2.4 Dashboards to keep open during a live event

1. CRM → Events & Devices (device online + printer telemetry)
2. CRM → Guest Support (tickets arriving)
3. Vercel logs filtered to 5xx
4. Provider payment dashboard

---

## 3. Routine operations calendar

### 3.1 Daily

| Task | Owner | Time |
|---|---|---|
| Review overnight errors | On-call | Morning |
| Check device fleet offline count | Support | Morning |
| Review new guest tickets | Support | Twice daily |
| Payment reconciliation (previous day) | Finance | Morning |
| Check nightly job outcomes | Engineering | Morning |

### 3.2 Weekly

| Task | Owner |
|---|---|
| `npm audit` across apps | Engineering |
| Review storage growth and cost | Engineering |
| Backup verification (spot-restore one collection) | Engineering |
| Lead follow-up review | Sales |
| Upcoming event readiness (next 7 days) | Operations |

### 3.3 Monthly

| Task | Owner |
|---|---|
| Full restore drill (to a scratch cluster) | Engineering |
| Access review (who has Vercel/Atlas/GitHub) | Security |
| Cost review and forecast | Founder/Finance |
| Certificate and domain expiry check | Engineering |
| Subscription expiry/renewal sweep review | Finance |
| Patch window for dependencies | Engineering |
| Update this document if procedures changed | Engineering |

### 3.4 Quarterly

| Task | Owner |
|---|---|
| Disaster recovery test with a written report | Engineering |
| Pen-test-lite (isolation, auth, upload) | Engineering |
| Vendor contract and renewal review | Founder |
| Hardware fleet audit (serials, condition) | Operations |
| Pricing and margin review | Finance |

---

## 4. Backup and disaster recovery

### 4.1 What is backed up

| Data | Method | Frequency | Retention | Restore tested |
|---|---|---|---|---|
| MongoDB (all collections) | Atlas continuous backup (PITR) | Continuous | 7 days (target) | Monthly |
| MongoDB (logical) | `mongodump` → encrypted S3 | Daily | 35 days | Monthly |
| S3 photos/composites | Bucket versioning (recommended) + cross-region replication (target) | Continuous | Per retention policy | Quarterly |
| S3 template assets | Versioning | Per change | Indefinite | Quarterly |
| Source code | GitHub | Per push | Indefinite | n/a |
| Secrets | Password manager + provider | Per change | Indefinite | Quarterly audit |
| Booth local cache | Device disk (not a system of record) | — | — | n/a |

### 4.2 Recovery objectives

| Scenario | RPO | RTO | Method |
|---|---|---|---|
| Bad deployment | 0 | 5 min | Promote previous Vercel deployment |
| Accidental document deletion | < 5 min | 1 h | PITR to a new cluster, restore collection |
| Collection corruption | < 5 min | 2 h | PITR / logical dump restore |
| Full database loss | < 5 min | 4 h | Atlas snapshot restore + DNS/connection swap |
| Region outage | < 15 min | 8 h | Restore in a secondary region (target) |
| S3 object deletion | 0 (versioned) | 30 min | Restore object version |
| S3 bucket compromise | < 24 h | 24–72 h | Rehydrate from replication/backup + incident |
| Ransomware on booth PC | n/a | Reimage in 2 h | Reinstall app + re-pair |

### 4.3 Restore procedure (database)

```bash
# 1. Confirm the target time (UTC) — the last known-good moment
# 2. In Atlas: Backup → Restore → Point in Time → to a NEW cluster
# 3. Verify before switching
mongosh "mongodb+srv://<new-cluster>/happypix" --eval '
  print("orgs", db.organizations.countDocuments({}));
  print("events", db.events.countDocuments({}));
  print("photos", db.photos.countDocuments({}));
  print("downloads", db.guestdownloads.countDocuments({}));
  print(db.photos.findOne({}, { url:1, compositeUrl:1, sessionId:1 }));
'
# 4. Point a staging app at the new cluster and smoke it
# 5. Update the production connection string, redeploy
# 6. Rotate the old cluster's credentials; keep it read-only for forensics
```

### 4.4 Restore procedure (a single collection)

```bash
# From a nightly logical dump
aws s3 cp s3://happypix-backups/mongo/2026-10-22/photos.archive.gz .
mongorestore --uri "$MONGODB_URI" --archive=photos.archive.gz --nsInclude='happypix.photos' --drop
```

`--drop` replaces the collection — confirm you are restoring the *right* collection before running it.

### 4.5 Restore procedure (S3 objects)

```bash
# Versioned object restore
aws s3api list-object-versions --bucket happypix-production-assets \
  --prefix "org/…/sessions/sess_x/" --query 'Versions[?IsLatest==`false`]'

aws s3api copy-object --bucket happypix-production-assets \
  --copy-source "happypix-production-assets/<key>?versionId=<vid>" \
  --key "<key>"
```

### 4.6 Disaster recovery drill (quarterly, 3 hours)

| Step | Success criterion |
|---|---|
| 1. Restore yesterday's DB to a scratch cluster | Counts match production within tolerance |
| 2. Point a local app at the scratch cluster | Login + gallery + one download work |
| 3. Restore one deleted S3 object version | Object readable |
| 4. Promote a previous Vercel deployment on a preview project | Rollback path confirmed |
| 5. Time the whole exercise | Recorded, compared to RTO |
| 6. Write a short report with gaps | Filed in the handover register |

---

## 5. Support procedures

### 5.1 Channels and triage

| Channel | Audience | First response | Owner |
|---|---|---|---|
| In-app guest ticket (booth) | Guests | Included in the operator's dashboard | Org staff |
| Org → platform support (CRM) | Tenants | 4 business hours | Support |
| Email `support@happypix.in` | All | 4 business hours | Support |
| Phone/WhatsApp (contracted) | Events in progress | 1 hour | Operations |
| Security | Researchers/customers | 48 hours | Security |

### 5.2 Triage decision tree

```
Is a live event in progress?
├── YES → Is printing blocked or payment failing?
│          ├── YES → P1: engage on-call now, call the operator
│          └── NO  → P2: respond within 1 h, workaround first
└── NO  → Is the tenant fully blocked (cannot log in / cannot create events)?
           ├── YES → P2
           └── NO  → P3: normal queue, 1 business day
```

### 5.3 Standard diagnostics (ask these first)

| Question | What it reveals |
|---|---|
| Event name and booth name? | Device, snapshot, event status |
| Is the device showing online in the CRM? | Connectivity vs local failure |
| What exactly did the guest see? | Which state failed (payment/print/upload) |
| Was a sheet printed? | Printer vs app |
| Session id or time? | Gallery and upload records |
| Any recent deploy? | Change-related failure |

### 5.4 Common tickets and immediate answers

| Ticket | Likely cause | Answer / fix |
|---|---|---|
| "QR shows an error" | Download expired (> 24 h) or link truncated | Verify expiry; re-send from gallery |
| "Photos missing from gallery" | Session never completed (app closed before upload) | Check device queue; retry sync while the booth is online |
| "Only one photo in the gallery" | Older booth app that did not upload the composite | Update the booth app; for existing sessions, re-upload the composite manually via support |
| "Printer not printing" | Wrong printer / offline / media end | Run hardware checklist §13.4 of HARDWARE_PRINTING |
| "Payment taken but no print" | Webhook not processed or booth offline | Check `payments` status; confirm with provider; refund or reprint |
| "Cannot log into CRM" | Lockout or deactivated account | Wait 15 min, or Owner reactivates |
| "Booth says suspended" | Subscription expired or platform suspension | Check org status; renew or contact platform |
| "Prices are wrong on the booth" | Snapshot not refreshed | Check device heartbeat/revision; re-pair if stuck |

### 5.5 Refund policy (operational)

1. Verify the payment in the provider dashboard **and** in `payments`.
2. Confirm the print did not happen (ask the operator, check the ticket).
3. Refund in full through the gateway; record the reason in the ticket.
4. Never refund a guest directly in cash without Finance approval.

---

## 6. Incident severity and escalation

### 6.1 Severity table

| Sev | Definition | Examples | Response | Update cadence |
|---|---|---|---|---|
| S1 | Data breach, payment integrity, or total outage | Bucket public, all payments failing, DB unreachable | Immediate, all hands | Every 30 min |
| S2 | Major function down or many tenants affected | Booth pairing failing, downloads broken, API 5xx | 15 min | Every 1 h |
| S3 | Degraded / single tenant | One org cannot print, dashboard slow | 4 business hours | Daily |
| S4 | Minor | Cosmetic misalignment | Next release | — |

### 6.2 Escalation path

```
Detector
  └─► On-call engineer (15 min ack)
        ├─► Engineering Lead (S1/S2 immediately)
        │     ├─► Security Officer (if data/payments)
        │     └─► Founder (S1, or any tenant-threatening event)
        └─► Customer Success (communication owner)
```

### 6.3 Communication templates

**Internal (S1/S2)**

```
[SEV-2] Booth pairing failing — INVESTIGATING
Impact: all booths unable to pair since 14:02 UTC
Affected: ~12 tenants
Owner: <name>
Next update: 15:30 UTC
Actions: rolled back deployment 14:20; monitoring
```

**Customer (S2)**

```
We're aware that some booths are currently unable to pair and we're actively working on it.
If you have an event in progress, your booth will continue to work from its cached configuration —
capture and printing are unaffected. We'll update you within 60 minutes.
```

**Customer (S1, data)**

```
We are writing to inform you of a security incident affecting [data type]. We detected it at
[time], contained it at [time], and have notified the relevant authorities. [What you should do].
Contact: security@happypix.in
```

Never speculate about cause or blame in customer communications. State impact, action, and next
update time.

### 6.4 Blameless post-mortem (within 5 business days)

Required for every S1 and S2. Contents: timeline, root cause, detection, impact (tenants/records),
what went well, what went badly, action items with owners and dates. Track action items to closure —
an unclosed action item is how the same incident happens twice.

---

## 7. Runbooks

### R1 — API is down

```bash
# 1. Confirm
curl -i https://api.happypix.in/api/health

# 2. Was there a deploy in the last 60 minutes?
vercel ls happypix-v2-backend | head -n 5

# 3. If yes → roll back first, diagnose second
vercel promote <previous-deployment-url>

# 4. Check Vercel build/runtime logs for the error class
#    - "Missing required environment variables" → env var removed/misnamed
#    - MongoServerSelectionError → Atlas down, IP allowlist, or credential rotation
#    - 500 across all routes → recent code deploy

# 5. Verify after rollback
curl -fsS https://api.happypix.in/api/health
```

### R2 — Database unreachable or saturated

```bash
# Atlas → Metrics: connections, ops/sec, disk
# Check the IP allowlist first (a new Vercel egress IP is a classic cause)
# Check for connection leaks: a route that opens a client per request
# If connections are maxed:
#   - restart the offending deployment (breaks the leak)
#   - raise the Atlas tier (temporary)
#   - add an index for the slow query shown in the Performance Advisor
```

### R3 — Payments failing

```
1. Check provider status page (Razorpay/Cashfree).
2. Confirm webhook deliveries in the provider dashboard — are they arriving? 200s?
3. If webhooks 401/400 → webhook secret mismatch (rotated?) → update env and redeploy.
4. If order creation 5xx → check provider keys, then provider status.
5. If booths report failures but the provider is fine → check CORS/timeouts on /api/booth/payments.
6. Communication: tell tenants to switch booths to wallet/free mode until resolved if the outage is
   prolonged.
```

### R4 — Booth cannot pair

```
1. CRM → is the device listed? blocked? is the org suspended/expired?
2. Does the 6-digit code match the event's current code?
3. Device limit reached? (plan cap)
4. Backend logs: 400 BAD_PAIRING / 403 INVALID_CREDENTIALS / 402 DEVICE_LIMIT_REACHED
5. Booth side: correct API URL? clock skewed > 5 min? (breaks TLS/JWT validation)
6. Last resort: delete the device in the CRM and re-pair.
```

### R5 — Printer not printing at a live event

```
1. Hardware checklist: media, ribbon, cover, power, queue.
2. Windows: Get-Printer; Get-PrintJob; clear stuck jobs.
   macOS: lpstat -p; lpstat -o; cancel -a <queue>.
3. Print a test sheet from the booth operator menu.
4. If the queue clears but pages are blank → report immediately (app bug), switch to digital-only
   mode and give every guest the QR.
5. Never tell a guest "it printed" without a sheet in hand.
```

### R6 — Photos missing / gallery shows one frame

```
1. Identify the session id from the QR link or the guest ticket.
2. Check `photos` for that sessionId: how many rows? is compositeUrl set?
3. If only one row → the booth did not upload the composite (older app version).
4. Fix for the future: update the booth app (composite upload is included from 2026-10-23).
5. Fix for this session: recover the composite from the device local cache if available, upload via
   support tooling, set compositeUrl on the session rows.
6. Tell the guest the correct link once the composite is present.
```

### R7 — Suspected credential leak

```
1. Rotate the credential immediately (see SECURITY_PRIVACY §2.3).
2. Open an S1 incident.
3. Search provider logs for use after the leak window.
4. Assess data exposure; if personal data, follow notification (§10.4 there).
5. Post-mortem: how did it leak? add a control.
```

### R8 — Tenant requests urgent data deletion

```
1. Confirm the request in writing and verify the requester's authority.
2. Export nothing unnecessary; confirm the exact session/event scope.
3. Delete in the CRM (session) or via support tooling (event/tenant).
4. Verify S3 objects are gone.
5. Record the request in the data-subject log.
6. Reply with what was deleted and when; state the backup roll-off window.
```

### R9 — Rolling back a booth app in the field

```
Windows: keep the previous .exe; install over it (same publisher).
Android: adb install -r -d <previous.apk>   (same signing key required)
Then: re-pair if the app wipes on downgrade; run one test session.
```

### R10 — Event-day emergency (no internet, no printer, no camera)

```
1. Internet gone → keep going offline; print still works.
2. Printer gone → switch to digital-only: capture, customise, deliver QR (queue uploads).
3. Camera gone → switch to the host camera if available; otherwise pause and call ops.
4. All gone → apologise, collect guest contact details, deliver photos after recovery. Log the
   incident for the client.
```

---

## 8. Maintenance and dependency management

### 8.1 Update cadence

| Component | Cadence | Risk |
|---|---|---|
| Security patches | As released | Low |
| Node/Electron runtime | Quarterly (LTS only) | Medium |
| React/Vite | Quarterly | Medium |
| Express/Mongoose | Only with a migration plan | High |
| RN + Skia + VisionCamera | Together, per RN upgrade | High |
| Printer/camera drivers | Before an event season | Medium |
| OS on booth PCs | Monthly, deferred 30 days | Medium |

### 8.2 Before upgrading a major dependency

1. Read the changelog for breaking changes.
2. Branch, upgrade, run `npm run verify` (or equivalent).
3. Run the manual booth session on real hardware.
4. Deploy to staging, one week of soak.
5. Roll out to the pilot fleet first.

### 8.3 End-of-life tracking

| Component | EOL risk | Action |
|---|---|---|
| Node 20 | Reaches EOL 2026-04 | Plan Node 22 migration |
| Electron 44 | 8-week support window | Track Chromium security releases |
| Express 5 | Stable | Monitor 5.x patches |
| Atlas tier | n/a | Watch storage/connection ceilings |

### 8.4 Documentation debt

| Document | Owner | Review |
|---|---|---|
| This file | Engineering Lead | Quarterly |
| Deployment guide | Engineering Lead | Every infrastructure change |
| Hardware compatibility | Operations | After every new rig |
| Handover register | Founder | Monthly |

---

## 9. Recovery objectives and drill record

### 9.1 Current objectives

| Objective | Target | Confidence |
|---|---|---|
| RPO (data loss window) | ≤ 5 min | High (PITR) |
| RTO (database restore) | ≤ 4 h | Medium — untested at scale |
| RTO (deployment rollback) | ≤ 5 min | High — verified |
| RTO (booth re-provision) | ≤ 2 h | High — documented |
| Backup retention | 35 days | High |
| S3 durability | 99.999999999 % | Provider SLA |

### 9.2 Drill log

| Date | Drill | Result | Gaps found | Action |
|---|---|---|---|---|
| ⟨date⟩ | DB restore to scratch cluster | ⟨pass/fail⟩ | ⟨…⟩ | ⟨…⟩ |
| ⟨date⟩ | Vercel rollback | ⟨pass/fail⟩ | ⟨…⟩ | ⟨…⟩ |
| ⟨date⟩ | S3 object version restore | ⟨pass/fail⟩ | ⟨…⟩ | ⟨…⟩ |
| ⟨date⟩ | Booth re-pair after device delete | ⟨pass/fail⟩ | ⟨…⟩ | ⟨…⟩ |

**A drill that has never been run is not a recovery plan.** Fill this table in before an enterprise
customer asks for it.

---

## 10. Vendor and cost operations

### 10.1 Monthly cost review

| Service | Metric to watch | Action threshold |
|---|---|---|
| MongoDB Atlas | Storage, connections, tier | > 70 % of tier → plan upgrade |
| AWS S3 | Storage GB, GET/PUT requests | Unexpected +30 % → check lifecycle rules |
| Vercel | Function invocations, bandwidth | Nearing plan limit → optimise or upgrade |
| Razorpay/Cashfree | MDR + failures | Failure rate > 3 % → investigate |
| Groq/Together | Tokens/images per org | Org over quota → enforce credits |
| SendGrid/Twilio | Sends | > 80 % of plan → review templates |

### 10.2 Cost guardrails

* S3 lifecycle rules move older session objects to cheaper tiers.
* Guest downloads expire in 24 h, which caps storage growth from delivery copies.
* AI credits are per-plan and enforced server-side (`AI_QUOTA_EXCEEDED`).
* Logs are retained 30 days, not indefinitely.
* No per-request third-party calls on critical paths (caching or precomputation instead).

### 10.3 Vendor risk

| Vendor | If it fails | Mitigation |
|---|---|---|
| MongoDB Atlas | Full outage | PITR + documented restore; secondary region planned |
| Vercel | Site + API down | Code is portable; Cloudflare/Render as fallback |
| AWS S3 | Uploads/downloads fail | Retry queue; photos remain on booth local cache |
| Razorpay | Booth payments fail | Cashfree as alternate rail; wallet mode |
| Groq/Together | AI templates unavailable | Manual designer still works |
| SendGrid | Emails fail | In-app notifications; support can resend |

Renewal dates, contract owners and cancellation steps:
[`../business/HANDOVER_REGISTER.xlsx`](../business/HANDOVER_REGISTER.xlsx).

---

*Next: [`DEPLOYMENT_RELEASE.md`](DEPLOYMENT_RELEASE.md) for deploy mechanics, or
[`SECURITY_PRIVACY.md`](SECURITY_PRIVACY.md) for the incident notification rules referenced above.*
