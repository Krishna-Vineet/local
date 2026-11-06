# HappyPix — Hosting, Cost & Scaling Playbook

> **Scope:** where every part of HappyPix runs today, what each part actually costs, where it should move as
> volume grows, and which situations would force a design change.
> **Audience:** founder, whoever holds the cloud bill, and the engineer on call.
> **Companion documents:** [`DEPLOYMENT_RELEASE.md`](DEPLOYMENT_RELEASE.md) (how a commit ships),
> [`../business/SCALABILITY_PLAN.md`](../business/SCALABILITY_PLAN.md) (strategy and team plan),
> [`ARCHITECTURE.md`](ARCHITECTURE.md) (components), [`DIAGRAMS.md`](DIAGRAMS.md) (topology pictures,
> `d4-1` and `d5-1`/`d5-2` are this document's visual form),
> [`BACKEND_REFERENCE.html`](BACKEND_REFERENCE.html) (endpoint-level detail). If this document and a diagram
> disagree, this document is right and the diagram gets fixed.

---

## Table of contents

1. [How to read the numbers](#1-how-to-read-the-numbers)
2. [Where everything runs today](#2-where-everything-runs-today)
3. [Unit prices this playbook uses](#3-unit-prices-this-playbook-uses)
4. [What the platform costs right now](#4-what-the-platform-costs-right-now)
5. [The real cost driver: bytes served per session](#5-the-real-cost-driver-bytes-served-per-session)
6. [Where to host what — decision table](#6-where-to-host-what--decision-table)
7. [Growth playbook, stage by stage](#7-growth-playbook-stage-by-stage)
8. [The order to do things in](#8-the-order-to-do-things-in)
9. [What could force the system to change](#9-what-could-force-the-system-to-change)
10. [Decision rules and anti-patterns](#10-decision-rules-and-anti-patterns)
11. [Cost governance](#11-cost-governance)
12. [Verify-before-you-budget list](#12-verify-before-you-budget-list)

---

## 1. How to read the numbers

Three honesty rules apply to everything below.

**Rule 1 — prices are list prices, checked October 2026.** Cloud vendors change them quarterly. Every figure
here is reproducible from a published rate card; none is a quote. Convert at **₹86 = $1** throughout.

**Rule 2 — the baseline traffic assumption is stated, not assumed away.** Where a total depends on volume, the
volume is written next to it:

| Baseline used in this document | Value | Why this value |
|---|---|---|
| Organisations | 25 | Pre-scale customer count ⟨verify against CRM → Organizations⟩ |
| Paired booths | 60 | ~2.4 booths per organisation |
| Booth sessions / month | 6,000 | 240 sessions per organisation per month |
| Bytes stored per session | 32 MB (8 frames × 3.5 MB + 4 MB composite) | What the booth actually uploads |
| Bytes served per session | 60 MB | Gallery view + guest download of originals, today |
| Objects stored | ~1.1 TB | Six months of retention at the current rate |

**Rule 3 — ⟨verify⟩ marks a number that is an assumption about *our* account, not a published rate.** Grep for
`⟨verify` before signing anything. Section 12 lists them all in one place.

> **One structural warning up front.** The code currently serves **original images everywhere** — the gallery,
> the guest download and the file endpoint all hand out the full-resolution file (see
> `services/photoUrlService.js` and `routes/downloadRoutes.js`). No thumbnails, no resizing. That single fact is
> why egress, not compute or storage, is the largest controllable line on the bill. Section 5 quantifies it.

---

## 2. Where everything runs today

Nine things run in production. Six of them are managed services, one is a set of customer machines, and two
are build artefacts that are not "hosted" at all.

| # | Component | What it is | Runs on | Region | Billing unit |
|---|---|---|---|---|---|
| 1 | Website (`website/`) | React + Vite SPA, 8 routes incl. guest download page | Vercel (static, CDN) | Global edge | Per seat + transfer |
| 2 | CRM console (`crm/`) | React + Vite SPA, org + platform workspaces | Vercel (static, CDN) | Global edge | Same Vercel team |
| 3 | Main API (`backend/`) | Express 5, 12 routers, ~130 endpoints, exports app for serverless | Vercel Functions (Node 20) | `bom1` ⟨verify⟩ | Invocations + CPU-hours + GB-hours |
| 4 | Website API (`website-backend/`) | Express 5: plan catalogue, subscription checkout, guest downloads, leads | Vercel Functions | `bom1` ⟨verify⟩ | Same Vercel team |
| 5 | Database | MongoDB Atlas, 23 collections, single replica set | Atlas Dedicated M10 ⟨verify⟩ | `ap-south-1` ⟨verify⟩ | Per hour + storage + backups |
| 6 | Photo storage | Private S3 bucket: `photos/…`, `happypix/<org>/logos/…`, template artwork | AWS S3 | `ap-south-1` ⟨verify⟩ | Per GB-month + requests + egress |
| 7 | Hourly expiry sweep | `GET/POST /api/cron/check-expirations`, secret-gated by `CRON_SECRET` | Vercel Cron (`backend/vercel.json`, `0 * * * *`) | Same as API | Included in function usage |
| 8 | Booth apps | Electron (Windows/macOS) and Android (`client-app/`) | **Customer hardware** | On site | Zero cloud cost |
| 9 | Print bridge | `electron/src/electron/printServer.ts`, CUPS `lp` / PowerShell `PrintDocument` | **Customer hardware** | On site | Zero cloud cost |

Everything else is a third-party API called at request time: Razorpay and Cashfree (money), SendGrid and
Twilio/WhatsApp (messages), Groq + Together/xAI + remove.bg (AI), GitHub Releases (installers).

### 2.1 Why this shape, and which parts are load-bearing

| Decision | Reason it was right | What it costs us |
|---|---|---|
| Serverless APIs instead of long-running containers | Booth traffic is spiky — idle all day, 200 sessions in two hours. Paying for idle capacity would dominate the bill at 25 customers | Cold starts of 300–800 ms on the first request after idle; no reliable in-process timers; a 10 s connection ceiling per invocation |
| One database shared by both APIs | Guest download pages and the booth must read the same `GuestDownload` row; a second store would need sync | Website traffic and booth traffic contend for the same Atlas cluster |
| Private bucket + signed URLs | Photographs of guests are personal data; public objects would be a permanent leak | Every image view is an API call plus a signature, and every byte is billed as egress |
| Business logic in the mobile/desktop client (compositing, filtering) | Server-side image work would need GPU or heavy CPU per session | Booth PCs must be reasonably capable; nothing composited survives on the server if the booth dies |

### 2.2 Failure domains

| If this fails | Customer-visible effect | Recovery |
|---|---|---|
| Atlas (database) | **Everything stops.** Every request awaits `connectDB` and returns `503 Database unavailable` | Atlas auto-failover to a secondary; restore from backup is the last resort |
| S3 | Capture still works; uploads, gallery and downloads fail (`persistSessionPhoto` falls back to local disk, which is ephemeral on serverless) | Retry; booths keep local copies and can re-upload |
| Razorpay **and** Cashfree | Checkout blocks. Free sessions and printing still work | Operator switches to manual UPI + 12-digit UTR via `free-complete` |
| Vercel | Nothing serves. Booths continue from cached snapshots and queue uploads locally | Redeploy or roll back; static apps may still serve from CDN cache |
| SendGrid | Password resets and OTP email stop; nobody can recover a password | Manual reset by platform admin |
| `CRON_SECRET` missing from env | The expiry endpoint returns 401 every hour, silently. Plans **appear** active until a request recomputes status | Set the variable; verify one manual call |

> **Check this today:** the sweep only runs if `CRON_SECRET` exists in the Vercel project *and* the cron job is
> enabled for the plan tier. `computePlanStatus()` still gates booths per request, so enforcement is not
> dependent on the sweep — but the stored `Organization.status` will drift. One `curl` with the header proves it.

---

## 3. Unit prices this playbook uses

Rates below are the published list rates that the cost model multiplies. Anything marked ⟨verify⟩ depends on
our own account, region or negotiated contract.

### 3.1 Compute and data

| Service | Meter | List price (Oct 2026) | Notes |
|---|---|---|---|
| Vercel Pro | Platform fee | $20 / month, includes 1 deploying seat and $20 usage credit | Extra seats $20 each; viewers free |
| Vercel | Fast data transfer | 1 TB included, then **$0.15/GB** | |
| Vercel | Function invocations | 1 M included, then **$0.60/M** | |
| Vercel | Active CPU | **$0.128 / CPU-hour** | Fluid compute |
| Vercel | Provisioned memory | **$0.0106 / GB-hour** | |
| Atlas | M10 cluster | **$56.94 / month** | 2 GB RAM, 10 GB default storage, 3-node replica set |
| Atlas | M20 / M30 / M40 | ~$144 / ~$389 / **$746.79** per month | Doubling RAM roughly doubles the rate |
| Atlas | Extra storage / backup | Per GB-month above default; continuous backup above the free window | ⟨verify⟩ current cluster size |
| AWS S3 | Standard storage | **$0.025/GB-month** in `ap-south-1` ($0.023 in `us-east-1`) | |
| AWS S3 | Standard-IA storage | **$0.0125/GB-month** | 50 % cheaper; retrieval fee after 30 days minimum |
| AWS S3 | PUT / GET | $0.005 per 1,000 / $0.0004 per 1,000 | Negligible at our volume |
| AWS S3 | Egress to internet | **$0.09/GB** for the first 10 TB after a 100 GB free allowance; $0.085 → $0.07 → $0.05 at higher tiers | **The line that matters** |
| CloudFront | Egress, India edge | ~**$0.17/GB** for the first 10 TB ⟨verify⟩ | *More* expensive per GB than S3 direct egress |
| Cloudflare R2 | Storage / egress | **$0.015/GB-month, $0 egress** | The cheapest lever above ~20 TB/month of delivery |
| Upstash Redis | Commands | ~$0.20 per 100 K commands, pay-as-you-go | Serverless-friendly |

### 3.2 Money, messaging and AI

| Service | Meter | List price | Notes |
|---|---|---|---|
| Razorpay | Card transactions | ~2 % + 18 % GST | UPI is typically 0 % (contract-dependent ⟨verify⟩) |
| Razorpay / Cashfree | Payouts | Per-transfer fee ⟨verify⟩ | Wallet withdrawals are manual today |
| SendGrid | Essentials | **$19.95 / month**, 50 K emails | Free tier: 100/day |
| Twilio | SMS to India | ~**$0.008** per message + carrier fee | ⟨verify⟩ DLT template registration is mandatory in India |
| WhatsApp Cloud API | Service conversations | 1,000 free / month, then per-conversation | ⟨verify⟩ current Meta rate card |
| Groq | Tokens | Cents per generation | Prompt parsing only |
| Together (FLUX) | Image | ~**$0.003** per image | Background artwork generation |
| xAI | Image | ~**$0.07** per image | Higher quality, used rarely |
| remove.bg | Image | ~**$0.20** per image pay-as-you-go | 1 AI credit charged to the org per call |
| Sentry | Team | **$26 / month** | Not yet wired ⟨verify⟩ |
| GitHub | Team | **$4 / user / month** | Releases host the installers |
| Apple Developer Program | Annual | **$99 / year** (~₹715/month) | Required to sign and TestFlight an iPad build; per organisation, not per device |

---

## 4. What the platform costs right now

### 4.1 Monthly bill at the baseline (25 orgs · 60 booths · 6,000 sessions)

| Line item | Calculation | USD | INR |
|---|---|---|---|
| Vercel Pro (3 seats) + usage | 3 × $20 + ~$20 usage | 80 | ₹6,880 |
| MongoDB Atlas M10 | $56.94 + ~25 GB storage + backup window | 72 | ₹6,190 |
| S3 storage | 1,100 GB × $0.025 | 27.50 | ₹2,365 |
| S3 egress | (400 GB − 100 GB free) × $0.09 | 27.00 | ₹2,322 |
| S3 requests | ~500 K GET + 200 K PUT | 2.20 | ₹190 |
| SendGrid Essentials | flat | 19.95 | ₹1,716 |
| Twilio SMS | 1,800 messages × $0.008 | 14.40 | ₹1,238 |
| AI (Groq + Together) | 200 generations | 12.00 | ₹1,032 |
| AI (remove.bg) | 100 removals × $0.20 | 20.00 | ₹1,720 |
| Sentry (once enabled) | flat | 26.00 | ₹2,236 |
| Domain, TLS, misc | 3 domains | 3.00 | ₹258 |
| **Total** | | **≈ $304** | **≈ ₹26,150** |

Not in the total above: the **Apple Developer Program, $99/year** (about ₹715/month), which becomes
a real line item the moment the iPad build is distributed through TestFlight and the App Store. It is
a fixed published cost that does not scale with booths, so it is not modelled per session.

Add the pass-through that is *not* infrastructure: **Razorpay fees on GMV**. At 6,000 sessions × ₹120 average
ticket ≈ ₹7.2 L GMV, card-heavy traffic costs ~₹14,400 in fees; UPI-heavy traffic costs near zero. That number
scales with revenue, not with traffic, and belongs in the gross-margin model — not here.

### 4.2 What that means

| Metric | Value | Interpretation |
|---|---|---|
| Flat floor (Vercel + Atlas + tooling) | **≈ ₹19,000 / month** | Paid whether one guest or one thousand appears |
| Variable per session | **≈ ₹0.52** | Almost entirely S3 egress (see §5) |
| Cost per session (fully allocated at 6,000) | ≈ ₹4.36 | 88 % of it is fixed cost being spread thin |
| Infra as % of revenue at 25 orgs × ₹1,239 | **≈ 84 %** | The stack is not the problem — the customer count is |
| Infra as % of revenue at 592 orgs (M12 target) | ≈ 13 % | Crossing ~500 organisations is the point where infra stops being the story |
| Infra as % of revenue at 5,000 orgs | ≈ 3 % | Matches the "2–3.4 %" band in the financial model |

**Read this as a strategy statement:** at today's size, optimising the bill is worth thousands of rupees per
month; signing twenty more organisations is worth lakhs. Optimise the *shape* of the cost (bytes per session,
lifecycle rules) now so that it stays cheap at scale, and do not spend founder time shaving a ₹26 K bill.

---

## 5. The real cost driver: bytes served per session

Every session writes 32 MB and subsequently serves about 60 MB: the guest opens the gallery, views the
composite, then downloads the composite plus eight frames — each at full resolution.

### 5.1 Per-session cost, itemised

| Component | Bytes | Unit price | Cost (USD) | Cost (INR) |
|---|---|---|---|---|
| Storage added (first month) | 32 MB | $0.025/GB-month | $0.00078 | ₹0.07 |
| Storage, cumulative by month 12 | 384 MB | $0.025/GB-month | $0.0094 | ₹0.81 |
| Egress: gallery + download | 60 MB | $0.09/GB | $0.0054 | ₹0.46 |
| Requests (≈20 GET, 9 PUT) | — | per 1,000 | $0.00001 | ₹0.001 |
| **Marginal total** | | | **≈ $0.015** | **≈ ₹1.29** |

> The cumulative-storage line is the one that surprises people: because **no S3 lifecycle rule exists**, every
> byte ever uploaded is still billed at Standard rates. A photo from a wedding two years ago costs the same per
> month as one uploaded an hour ago. See `OPERATIONS.md` for the bucket audit and the recommended rules.

### 5.2 The two changes that move this number most

| Change | Effect on egress | Effect on storage | Effort | Risk |
|---|---|---|---|---|
| **Serve a web-size variant** (long edge 1,600 px, ~350 KB) for gallery and preview; keep the original for download | 60 MB → ~8 MB per session (**−87 %**) | +15 % objects | 1 week: a variant job plus a `variants` field, fall back to original when missing | Guests who screenshot the gallery get a smaller image; downloads stay full-size, so this is acceptable |
| **S3 lifecycle**: Standard → Standard-IA at 30 days → Glacier Instant Retrieval at 180 days → expire at 24 months (configurable per plan) | unchanged | −40 % to −60 % of storage cost once steady state is reached | 1 day (bucket policy) | A guest holding a 24-hour link never notices; older links are already expired by TTL |
| **Cloudflare R2** instead of S3 for `photos/` | $0.09/GB → **$0** egress; storage $0.025 → $0.015 | −40 % | 2–3 weeks (migration, signing change, dual-read) | Loses S3-only features; keep S3 for logos and artwork |
| **CloudFront in front of S3** | Unit price changes from $0.09 to ~$0.17/GB in India | — | 1 week | **Worse per GB in India.** Only justified for latency or request offload, never for cost, until volume pushes into cheaper tiers ⟨verify⟩ |

**Order of work:** variants first (biggest and safest), lifecycle second (cheapest), then decide between R2 and
CloudFront at the point where delivery passes ~20 TB/month.

---

## 6. Where to host what — decision table

Each row answers three questions: where it runs **today**, the **observable trigger** that says "move it", and
**where it goes**. A trigger is a measurement, not a feeling.

| Component | Today | Move when (trigger) | Move to | Why that target |
|---|---|---|---|---|
| Website SPA | Vercel CDN | Never | Stay | Static files at the edge are the correct architecture at every scale |
| CRM SPA | Vercel CDN | Never | Stay | Same |
| **Main API** | Vercel Functions | p95 > 800 ms with warm instances, **or** > 5 M invocations/month, **or** any endpoint needs > 60 s (bulk export, media job) | **Cloud Run (Mumbai) or ECS Fargate** behind a load balancer; keep the same Express app | Serverless pricing is per-invocation; a chatty booth polling at 3 s spends money on invocations rather than on work. Containers allow long jobs, in-process caches, and real timers |
| Website API | Vercel Functions | Immediately, as a *merge* rather than a move | Fold into the main API as a `/api/website/*` namespace, or keep but share one library | Two deployments with two copies of pricing logic is the current duplication risk. One API, two mounts, is cheaper and safer |
| Static assets under 5 MB | Vercel CDN | Never | Stay | |
| Database | Atlas M10 | CPU > 60 % for 15 min sustained, or working set > 60 % of RAM, or p95 query > 100 ms | M20 → M30 → M40; then **shard on `organizationId`** at stage 3 | Vertical first (one config change), sharding only when a single primary is the bottleneck |
| Hot reads (plans, gallery policy, snapshots) | In-process caches (15 s, 30 s) | Cache hit rate < 70 % or Atlas read ops dominating cost | **Upstash Redis** (serverless, pay-per-command) then ElastiCache | Restores cross-instance cache sharing that serverless cold starts destroy |
| Photo objects | S3 Standard, private | > 20 TB delivered/month **or** egress > 25 % of bill | **Cloudflare R2** (zero egress) or S3 + CloudFront if latency is the complaint | Egress is the dominant variable cost; R2 removes it entirely |
| Guest download links | Designed and built in `backend/` | Now | **Certify and deploy this** | The capability exists (`downloadId` + `DOWNLOAD_TTL_MS`) and is documented in the app guide |
| Session image post-processing | None (client-side) | When variants are approved | **S3 event → Lambda/worker** writing variants | Keeps the request path thin; retries live outside the user's session |
| Notifications (email/SMS/WhatsApp) | Synchronous calls from the request path | First timeout during peak, or a paid session blocked by a slow provider | **Queue (SQS) + worker** | A guest should not wait on SendGrid to print a photo |
| AI generation | Synchronous inside the request | p95 > 3 s or provider errors surfacing to the CRM | **Queue + job status endpoint** | Generation already costs 5 credits; make it asynchronous and idempotent |
| Hourly expiry + cleanup | Vercel Cron + in-process `setInterval` | The `setInterval` copy is already a no-op on serverless | Keep Vercel Cron as the only scheduler; delete the timer | Two schedulers means two truths about who expired what |
| Print bridge | Customer PC | Never | Stay on the customer PC | Printing cannot be cloud-hosted: the paper is local |
| Installers / APKs | GitHub Releases | > 500 downloads/month or private distribution needed | S3 + CloudFront signed URLs | Release artefacts are not source code |
| Monitoring | Console logs | Before the first paid customer | **Sentry + structured JSON logs + uptime checks** | You cannot debug a booth at 9 pm from `console.log` in a serverless log stream |
| Secrets | Vercel env vars | Before SOC 2 or the first enterprise deal | **AWS Secrets Manager + KMS**, or Vercel Sensitive env + rotation runbook | `ENCRYPTION_KEY` rotation currently has no procedure |
| Backups | Atlas automated | Monthly | **Restore drill monthly, documented RTO** | An untested backup is a hope, not a backup |
| CI/CD | Manual `vercel --prod` | Before the second engineer | **GitHub Actions**: typecheck, lint, backend tests, preview deploy | The repo already has 5 backend test suites and an Electron typecheck |

---

## 7. Growth playbook, stage by stage

The stages below are keyed to **organisations**, because that is what drives revenue and support load. The
infrastructure totals are the ones used in [`../business/SCALABILITY_PLAN.md`](../business/SCALABILITY_PLAN.md)
so the two documents cannot drift.

### 7.1 Summary

| Stage | Organisations | Booths | Sessions / month | Delivery / month | Infra / month | Infra as % of revenue |
|---|---|---|---|---|---|---|
| Today | 25 | 60 | 6,000 | 0.4 TB | **≈ ₹26 K** | ≈ 84 % |
| Stage 1 | 10,000 | 24,000 | 2.4 M | 168 TB | **≈ ₹1.85 L** | ≈ 2.5 % |
| Stage 2 | 100,000 | 240,000 | 24 M | 1.7 PB | **≈ ₹18.9 L** | ≈ 2.4 % |
| Stage 3 | 1,000,000 | 2.4 M | 240 M | 17 PB | **≈ ₹1.44 Cr** | ≈ 2.3 % |
| Stage 4 | 10,000,000 | 24 M | 2.4 B | 170 PB | **≈ ₹11.5 Cr** | ≈ 2 % |

The percentages are stable because the architecture is linear in bytes and requests. Nothing here becomes
super-linear until shared state (one Mongo primary, one bucket, one region) is hit — which is exactly what the
stage changes are about.

### 7.2 Stage 1 — 10,000 organisations (₹1.85 L/month)

| What breaks first | Why | Change | Effort |
|---|---|---|---|
| S3 egress bill | 168 TB × $0.09 ≈ $15 K/month if served from S3 | Variants + R2 **before** this stage, not during it | 3 weeks |
| Atlas M10 saturated | 2 GB RAM, single primary; gallery aggregation reads whole collections | M40 + indexes on `photos(organizationId, sessionId)`, `payments(organizationId, createdAt)`, `auditlogs(organizationId, at)` | 1 week |
| Support cannot see what happened | Logs are ephemeral | Sentry + structured logs + alerting on error rate and payment failures | 1 week |
| Deploys are risky | No staging environment, no CI gate | Staging project + separate bucket + GitHub Actions | 1–2 weeks |
| Gallery p95 | 500-row read per page load, each image a separate signed URL | Session-index collection, pagination, variant URLs | 2 weeks |

New homes at this stage: Redis (Upstash), SQS or BullMQ for notifications, Cloudflare/R2 in front of media,
Sentry, a staging environment. **Not yet:** sharding, multi-region, containers.

### 7.3 Stage 2 — 100,000 organisations (₹18.9 L/month)

| What breaks first | Why | Change | Effort |
|---|---|---|---|
| Heartbeats | 240 K booths × 120 writes/hour = 28.8 M writes/day against one primary | Coalesce telemetry server-side (write at most once per 60 s per device); batch audit writes | 1 week |
| Gallery reads | Every org dashboard scans `photos` and `payments` | Materialised `sessions` collection (one row per session) + Redis for page 1 | 2–3 weeks |
| Request path length | Notifications, variants and AI are all inline today | Move all three behind the queue | 2 weeks |
| Regions | Non-India customers pay 150–250 ms per round trip | Second Atlas cluster per region, region-pinned orgs, or multi-region sharded | 3–4 weeks |
| Cost visibility | One whale org can hide inside the aggregate bill | Per-org attribution: storage, egress, AI credits, prints | 2 weeks |
| Gateway limits | A single Razorpay account rate-limits at peak | Route by gateway and by org (org-owned keys already supported) | 1 week |

New homes: containers for the API, Redis, SQS, warehouse (ClickHouse/BigQuery), CDN, regional clusters.

### 7.4 Stage 3 — 1,000,000 organisations (₹1.44 Cr/month)

At this size the platform is a data company with a photo booth attached. The request path must be stateless
containers with per-endpoint autoscaling; MongoDB shards on `organizationId`; media never touches the API;
reporting reads from a warehouse, never from the operational cluster; payment settlement needs a ledger, not a
status column; and cost attribution becomes a product feature (per-org invoices).

**The migration that hurts most** is the shard key choice. `organizationId` is hashed and present on every
tenant-scoped document, which is why the current schema is already shard-ready — but any query without it will
become a scatter-gather. Audit for those before sharding, not after.

### 7.5 Stage 4 — 10,000,000 organisations (₹11.5 Cr/month)

Multi-region active-active with data residency, an event-sourced payment ledger, a dedicated GPU media
pipeline, self-serve onboarding and billing automation, SOC 2 / ISO 27001. This is a different company with a
platform team of 40+. **Honest verdict:** for a small team, stage 3 is the natural ceiling; beyond that, growth
should come from depth per organisation (more booths, more events, add-ons) rather than from organisation count.

---

## 8. The order to do things in

Twelve steps, cheapest-first, each independently shippable. Do not reorder without a measurement that forces it.

| # | Action | Cost delta | Effort | Blocks |
|---|---|---|---|---|
| 1 | Set `CRON_SECRET`; verify `/api/cron/check-expirations` returns 200 | ₹0 | 15 min | Plan expiry drift |
| 2 | Attach an S3 lifecycle policy (IA 30 d, Glacier IR 180 d, expire 730 d) | **−₹1 K/month now, −40 % storage later** | 1 hour | Runaway storage bill |
| 3 | Add budget alerts on AWS, Vercel and Atlas | ₹0 | 1 hour | Silent bill growth |
| 4 | Turn on Sentry + structured JSON logs + one uptime check per app | +₹2.2 K/month | 1 day | Every subsequent diagnosis |
| 5 | Merge `website-backend` into the main API behind `/api/website/*` | −₹0 (one less deploy) | 3 days | Pricing drift between two copies |
| 6 | Image variants + `thumbnailUrl` field | **−60 % egress** | 1 week | Stage 1 egress cost |
| 7 | Staging environment with its own bucket and database | +₹6 K/month | 2 days | Safe releases |
| 8 | GitHub Actions: typecheck, lint, 5 backend suites, diagram validation + doc regeneration, preview deploy | ₹0 | 2 days | Regressions reaching production |
| 9 | Queue for notifications (SQS or BullMQ) | +₹1 K/month | 1 week | Payment latency under load |
| 10 | Redis for plans, gallery policy and hot snapshots | +₹1.5 K/month | 1 week | Atlas read saturation |
| 11 | Session-index collection + paginated gallery | ₹0 | 2 weeks | Gallery p95 at 10× today |
| 12 | Per-org cost attribution (storage, egress, AI, prints) | ₹0 | 2 weeks | Margin protection per customer |

Everything from step 6 onward is also a prerequisite for the 10,000-organisation stage. Steps 1–4 cost less
than two days of work and remove the three most likely unforced errors.

### 8.1 What step 8 should actually run

The repository already contains three generated artefacts. The CI job must regenerate them and fail on drift, or
they silently rot the first time someone renames a route:

```bash
# 1 · diagrams (29 Mermaid sources → docs/DIAGRAMS.md + the interactive viewer)
npm install --no-save mermaid@11 jsdom
node docs/scripts/validate_diagrams.mjs        # parses every diagram, exits 1 on any syntax error
python3 docs/scripts/build_diagrams.py         # rewrites DIAGRAMS.md and diagrams/index.html

# 2 · the backend reference (single self-contained HTML, ~3.9 MB with Mermaid inlined)
python3 docs/scripts/build_backend_doc.py

# 3 · drift check: the generated files must match what is committed
git diff --exit-code docs/DIAGRAMS.md docs/diagrams/index.html docs/BACKEND_REFERENCE.html
```

Keep `docs/scripts/data/*.py` honest when a route changes — the backend reference is a transcription of the
Express code, so a new endpoint that is not added there will simply be missing from the HTML. Treat a failing
`git diff --exit-code` as "you changed the API, so the documents must change too".

---

## 9. What could force the system to change

A situation forces a design change when it breaks an assumption the code makes. Each row names the assumption,
the signal, the change, and what it costs. **Thirty situations** are listed; the first ten are the ones most
likely to arrive within a year.

### A · Volume and traffic

| # | Situation | Signal | Why the current design breaks | Change required | Effort |
|---|---|---|---|---|---|
| A1 | One large customer runs 200 booths at a single wedding | One org > 30 % of heartbeat traffic; Atlas CPU spikes every 30 s | Every booth writes `lastSeenAt`, `telemetry`, `connections` on a 30 s cadence — 200 booths = 6.7 writes/s from one key range | Coalesce telemetry (write at most 1/60 s), batch, and move fleet status to Redis with periodic flush | 1 week |
| A2 | A viral event drives 50 K gallery views in an hour | Vercel function invocations 10× baseline; 429s | Gallery is an authenticated, per-photo-signed read — it cannot be cached at the edge | Public, opaque, cacheable gallery tokens; CDN-cacheable variant URLs | 2 weeks |
| A3 | Booth count passes 2,000 | Global limiter (`1200 / 15 min / IP`) starts returning 429 for booths behind one NAT | Rate limit is per IP, and a venue or a customer LAN shares one IP | Per-device token buckets instead of per-IP; raise the global ceiling; allowlist device traffic | 2–3 days |
| A4 | Serverless cold starts become visible at the booth | First capture of the day waits 800 ms+ | Each invocation may be a cold start; Mongo connect is cached per instance only | Move the API to containers (min 2 warm), or accept it and keep the booth's optimistic UI | 3–4 weeks |
| A5 | Sessions grow past ~2 M/month | Atlas write IOPS and `photos` collection growth | Gallery reads scan `photos` sorted by `generatedAt` | Session-index collection + pagination + archival of finished events | 2 weeks |

### B · Money and settlement

| # | Situation | Signal | Why the current design breaks | Change required | Effort |
|---|---|---|---|---|---|
| B1 | A gateway has an outage during peak wedding season | `/api/booth/payments` 5xx rate > 5 % | Fallback exists (Razorpay → Cashfree) but only across *one* account each | Multi-account routing with health scores; pre-authorized "pay at desk" flow | 1–2 weeks |
| B2 | Refunds are requested | Support asks "how do we refund a session?" | There is no refund field, no refund route, no reconciliation job. `Payment.status` has no `refunded` state | Add `refunded`/`partially_refunded`, a refund route with gateway API calls, and an audit record | 2 weeks |
| B3 | Money must reconcile to the bank | Finance cannot tie payouts to sessions | Org-owned gateway keys mean HappyPix never sees the settlement; only `settlement` and `utr` fields exist | Settlement import job per gateway, per org; a ledger table | 3–4 weeks |
| B4 | GST / e-invoicing requirement widens | A customer demands a GSTIN-compliant invoice with HSN | `Subscription.invoiceNo` exists but no invoice document, no GSTIN, no HSN | Invoice generator + numbering series + storage | 2 weeks |
| B5 | Organisations want subscriptions paid by card internationally | AUD/Stripe path selected | `Organization.paymentGateway` supports `stripe` but there is no Stripe integration | Implement Stripe checkout, or disable the option honestly | 1–2 weeks |
| B6 | UPI mandate or gateway pricing changes | Razorpay rate card change | Unit economics assume near-zero UPI fees | Re-price or re-route; model per-gateway take rate | 2 days |

### C · Data, storage and privacy

| # | Situation | Signal | Why the current design breaks | Change required | Effort |
|---|---|---|---|---|---|
| C1 | Storage bill crosses 30 % of revenue | AWS bill trend | No lifecycle rules; originals kept forever | Lifecycle + per-plan retention policy | 1 day + policy work |
| C2 | A guest exercises the right to erasure | A written request | Photos are permanent by design (a TTL index on `photos` is actively *dropped* at boot); no delete route | Erasure workflow: locate by `sessionId`/`downloadId`, delete objects and rows, record the deletion in `AuditLog` | 2 weeks |
| C3 | 24-hour download links are judged too short | Support tickets asking for "my photos" the next day | `GUEST_DOWNLOAD_TTL_MS` is 24 h; the TTL index deletes the row | Per-plan retention (48 h / 30 days), re-issue links from `Photo.sessionId`, and a lookup by phone/email | 1 week |
| C4 | One org uploads 10× more than anyone else | Storage per org skews | No per-org quota; 10 MB per file and 50 MB JSON bodies are the only limits | Per-org storage quota + alert, enforced at presign time | 1 week |
| C5 | Photos must stay in-country | Enterprise security questionnaire | Single bucket, single region ⟨verify⟩ | Region-pinned buckets per tenant; `organizationId → region` map | 3 weeks |

### D · Compliance and legal

| # | Situation | Signal | Why the current design breaks | Change required | Effort |
|---|---|---|---|---|---|
| D1 | India's DPDP Act obligations are enforced | Counsel review, or a customer asks for a DPA | Consent is captured (`guestConsent`) but there is no notice text versioning, no withdrawal path, no retention schedule published | Consent record with policy version and timestamp; withdrawal endpoint; published retention schedule | 2–3 weeks |
| D2 | A customer demands SOC 2 / ISO 27001 | Enterprise deal blocked | No formal access review, no change management trail beyond `AuditLog`, no key rotation | Compliance programme (months), starting with key rotation and access reviews | 3–6 months |
| D3 | PCI scope is questioned | Bank questionnaire | Card data never touches us (all hosted checkout) but the *scope statement* is undocumented | Written SAQ-A justification; ensure no card fields ever post to our API | 1 week |
| D4 | Data-residency contract for AU/EU | First international contract | One region today | Regional deployment (see C5), or a contractual cap on regions | 3–4 weeks |

### E · Product and market

| # | Situation | Signal | Why the current design breaks | Change required | Effort |
|---|---|---|---|---|---|
| E1 | Video / GIF sessions are sold | A customer buys the add-on | The add-on exists in `planService.ADDON_CATALOG` but **neither booth implements video capture** — it is sellable and unbuilt | Either implement capture + transcode pipeline, or remove it from the catalogue | 4–6 weeks |
| E2 | Organisations want their own webhooks | Integration request | No outbound webhook system, no retry, no signing | Webhook subscriptions + signed delivery + replay | 3 weeks |
| E3 | A public API is requested | Partner enquiry | Auth is cookie/JWT for humans and device tokens for booths; no API keys | API keys with scopes, rate limits, usage metering | 3 weeks |
| E4 | Real-time dashboards are expected | "Why is this page stale?" | Everything is poll-on-load; only booths poll | SSE or WebSocket channel; or accept 30 s polling and say so | 2 weeks |
| E5 | iPad booths go into the field | A customer wants iPads, or an operator prefers them to Android tablets | The RN iOS target **exists** and runs the session, but printing needs a PC-side Print Bridge, kiosk lockdown is Guided Access/MDM, and nothing is signed or distributed | Native AirPrint bridge (removes the PC), Swift idle-timer + kiosk banner, icon set, Fastlane → TestFlight | 2–3 weeks to pilot, 4–6 to drop the PC |
| E6 | White-label / custom domain per org | Agency enquiry | One domain set, CORS allowlist is static | Tenant domains + per-domain certificate automation | 2–3 weeks |

### F · Reliability and operations

| # | Situation | Signal | Why the current design breaks | Change required | Effort |
|---|---|---|---|---|---|
| F1 | A regional outage takes the platform down | Vercel or Atlas status page | Single region, single cluster | Multi-region read path, then active-active; documented RTO/RPO | 1–2 months |
| F2 | An incident happens and nobody can reconstruct it | Post-mortem gap | Logs are ephemeral; Sentry not enabled | Centralised logs (30-day retention), tracing, incident template | 1 week |
| F3 | A data-corrupting bug ships | A wrong price reaches production | No staging, no CI gate, no migration framework | Staging + CI + documented rollback and restore drill | 2 weeks |
| F4 | The founder is unavailable for a week | Bus factor | Single-person operations, secrets in one dashboard | Runbooks, break-glass access, second operator | 1 week |

### G · Security

| # | Situation | Signal | Why the current design breaks | Change required | Effort |
|---|---|---|---|---|---|
| G1 | A device token leaks from a booth PC | Unusual device traffic or a support report | Tokens never expire and only rotate on re-pairing | Token expiry + rotation endpoint + per-device anomaly alerts | 1 week |
| G2 | Upload abuse | Storage grows with no matching payments | Presigned PUTs are issued per session with no size cap per session | Enforce per-session object count and byte budget at presign time | 3 days |
| G3 | An admin session is stolen | Impossible logins or a suspicious audit trail | JWT lives 12 h; revocation is manual (`sessionVersion`) | Shorter TTL + refresh, device binding, step-up auth for destructive actions | 2 weeks |
| G4 | Secret rotation is required | Offboarding or a leak | `ENCRYPTION_KEY` rotation would orphan every `enc:v1:` secret | Versioned encryption keys with dual-read, then re-encrypt | 1 week |

### H · Team and organisation

| # | Situation | Signal | Why the current design breaks | Change required | Effort |
|---|---|---|---|---|---|
| H1 | Second engineer joins | Onboarding takes weeks | No CI, no staging, no local seed documented end-to-end | The 12 steps in §8 | 2 weeks |
| H2 | Support team grows | Support cannot see booth state | Support role can read organisations but not device telemetry detail | Read-only device diagnostics view + safe impersonation with audit | 1 week |
| H3 | On-call begins | A 3 am page with no runbook | No alert routing or severity model | Alerts with routing, severity definitions, and a one-page runbook per alert | 1 week |

---

## 10. Decision rules and anti-patterns

**Rules that have held so far**

1. **Buy the database, the storage and the payments.** Never self-host MongoDB or build a payment integration in-house.
2. **Keep the request path thin.** Anything that can happen after the guest walks away belongs in a queue.
3. **Never put the print path in the cloud.** The printer is physically local; the queue is local too.
4. **Optimise bytes before instances.** Egress is 80–90 % of variable cost; compute is noise at this scale.
5. **One source of truth per rule.** Pricing lives in `planService`/`config/layouts.js`, permissions in `config/permissions.js`, gallery policy in `gallerySettingsService`. A second copy is a future bug.
6. **A trigger must be a number.** "Feels slow" is not a trigger; "p95 > 800 ms on warm instances for 3 days" is.
7. **Migrate one thing at a time and keep the API contract.** Booths in the field cannot be upgraded overnight — every hosting move must remain backward compatible with the currently shipped booth version.

**Anti-patterns to refuse**

| Anti-pattern | Why it looks attractive | Why it fails here |
|---|---|---|
| Move to Kubernetes now | "We will need it later" | One engineer, spiky traffic, 25 customers. Serverless is cheaper *and* safer until the invocation bill or cold starts actually hurt |
| Self-host MongoDB to save $57 | Visible line item | Replica sets, backups, upgrades and paging become your job; one bad incident costs more than a year of Atlas |
| CloudFront for cost reduction | "CDN is cheaper" | In India the CloudFront edge rate is roughly double S3 direct egress. It buys latency, not savings |
| Shard the database early | "Be ready" | Sharding locks in a key and breaks scatter-gather queries. Index and right-size first; the schema is already shard-ready |
| Cache everything in Redis before measuring | "Standard advice" | Two in-process caches already serve the hottest reads; add Redis when hit rate proves it, not before |
| One giant "v2" migration | "Do it properly" | The booth fleet upgrades over months. Incremental, contract-preserving changes are the only ones that survive |

---

## 11. Cost governance

**Monthly ritual (30 minutes, first working day)**

1. Pull three bills: Vercel, AWS, Atlas. Compare each to the previous month and to revenue.
2. Check the four ratios: **egress GB per session**, **storage GB added per session**, **AI credits consumed vs charged**, **infra as % of revenue**.
3. Look for a single line that grew more than 20 % without a matching customer growth.
4. Confirm the lifecycle policy is still attached to the bucket (one `aws s3api get-bucket-lifecycle-configuration`).
5. Confirm `CRON_SECRET` still returns 200, and the plan catalogue is in sync (`ensurePlanCatalog` logs on boot).

**What to instrument, not guess**

| Metric | Where it comes from | Target |
|---|---|---|
| Egress GB / session | S3 `BytesDownloaded` ÷ sessions | < 10 MB after variants |
| Storage GB / session | S3 `BucketSizeBytes` ÷ cumulative sessions | < 40 MB steady state |
| Function invocations / session | Vercel usage ÷ sessions | < 25 (booth polling included) |
| Gateway failure rate | `Payment.status = failed` ÷ attempts | < 2 % |
| Infra % of revenue | (Vercel + AWS + Atlas) ÷ MRR | < 5 % from 500 orgs |

**Tagging and attribution.** Tag S3 objects and (where supported) usage by `orgId`; keep the prefix convention
`photos/<orgId>/<eventId>/…` intact — it is the only tenant-level cost signal available today. Once per-org
attribution exists, a customer consuming 40 % of egress becomes a pricing conversation instead of a surprise.

---

## 12. Verify-before-you-budget list

Every assumption in this document that depends on our own account rather than a published rate:

| # | Assumption | How to verify |
|---|---|---|
| 1 | Atlas tier is M10 and region is `ap-south-1` | Atlas → Cluster → Configuration |
| 2 | S3 bucket region is `ap-south-1` | `aws s3api get-bucket-location --bucket <name>` |
| 3 | Vercel functions run in `bom1` | Vercel project → Settings → Functions → Region |
| 4 | Number of paid Vercel seats | Vercel → Team → Members |
| 5 | `CRON_SECRET` is set and the cron returns 200 | `curl -H "x-cron-secret: …" https://api.happypix.in/api/cron/check-expirations` |
| 6 | S3 lifecycle policy exists | `aws s3api get-bucket-lifecycle-configuration --bucket <name>` |
| 7 | Guest download TTL is 24 h in production | `GUEST_DOWNLOAD_TTL_MS` in `backend/models/GuestDownload.js` |
| 8 | Razorpay merchant rate (card and UPI) | Razorpay dashboard → Pricing, or the signed agreement |
| 9 | DLT registration status for Indian SMS | Twilio / operator console |
| 10 | WhatsApp conversation pricing tier | Meta business dashboard |
| 11 | remove.bg plan vs pay-as-you-go cost | remove.bg dashboard → Billing |
| 12 | Sentry is or is not enabled | Vercel env vars; `SENTRY_DSN` presence |
| 13 | CloudFront India rate | AWS pricing page, Asia Pacific (India) edge |
| 14 | Backup retention window and whether a restore has ever been tested | Atlas → Backup → Restore history |
| 15 | Current org / booth / session counts used in §4 | CRM → Organizations; `payments` count for last 30 days |

---

*Last verified: 2026-10-25 against branch `main`. List prices checked the same week; re-verify
before any budget or investor document cites them.*
