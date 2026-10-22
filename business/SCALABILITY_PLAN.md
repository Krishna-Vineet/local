# HappyPix — Scalability & Infrastructure Roadmap

> **Purpose:** state honestly where the platform stands today, what breaks first at each order of
> magnitude, what it costs to fix, and what the infrastructure bill looks like at 10K → 10M users.
> **Currency:** INR at ₹84 = US$1 (2026 planning rate). Costs exclude GST.
> **Confidence:** sizing ±40 %. These are planning figures, not quotes.
> **Last updated:** 2026-10-23.

---

## Table of contents

1. [Current baseline](#1-current-baseline)
2. [Load model and assumptions](#2-load-model-and-assumptions)
3. [Growth scenarios at a glance](#3-growth-scenarios-at-a-glance)
4. [Stage 1 — 10,000 users](#4-stage-1--10000-users)
5. [Stage 2 — 100,000 users](#5-stage-2--100000-users)
6. [Stage 3 — 1,000,000 users](#6-stage-3--1000000-users)
7. [Stage 4 — 10,000,000 users](#7-stage-4--10000000-users)
8. [Cost model and unit economics of infrastructure](#8-cost-model-and-unit-economics-of-infrastructure)
9. [The storage problem (the real constraint)](#9-the-storage-problem-the-real-constraint)
10. [Upgrade triggers](#10-upgrade-triggers)
11. [Migration plan and sequencing](#11-migration-plan-and-sequencing)
12. [Risks, redundancy and recovery](#12-risks-redundancy-and-recovery)
13. [What we deliberately are not building](#13-what-we-deliberately-are-not-building)

---

## 1. Current baseline

### 1.1 Architecture today

| Layer | Implementation | Scaling unit |
|---|---|---|
| Web (website, CRM) | Vercel static + CDN | Edge, effectively unlimited |
| APIs | Vercel serverless Express (2 services) | Per-request concurrency |
| Database | MongoDB Atlas, single cluster, single region | Tier (vCPU/RAM/IOPS) |
| Object storage | AWS S3, one bucket, lifecycle rules **not yet configured** | Effectively unlimited |
| Background work | In-process `CronService` | One job runner |
| Caching | None (no Redis, no HTTP cache headers on API) | — |
| Queues | None (retries are client-side) | — |
| Search | MongoDB queries + indexes | Index scan |
| Analytics | Provider dashboards + CRM aggregates | Ad-hoc |

### 1.2 Measured / expected baseline

These are the numbers the current architecture is comfortable with. They come from endpoint design
and load-test targets, **not** from production traffic at scale — the platform has not yet operated at
Stage 1 volume.

| Metric | Current comfortable ceiling | Limiting factor |
|---|---|---|
| Registered organizations | ~2,000 | Atlas tier + gallery queries |
| Concurrent booths heartbeating | ~500 | Serverless concurrency + DB writes |
| API requests/sec | ~200 | Function concurrency |
| Sessions/day | ~15,000 | Photo writes + S3 PUT latency |
| Photos stored | ~5 M objects | Storage cost, not capacity |
| Gallery page load (25 sessions) | < 1 s | Index coverage on `photos` |
| Database size | ~500 GB | Tier storage + backup window |

### 1.3 Known bottlenecks (ranked by how soon they bite)

| Rank | Bottleneck | Bites at | Why |
|---|---|---|---|
| 1 | **S3 storage cost** | ~10 TB | Photos are never deleted; cost grows linearly forever |
| 2 | Gallery aggregation | ~1 M photo docs per org | Session grouping without a materialised index |
| 3 | Heartbeat write volume | ~2,000 booths | Every booth writes `devices` every 2 minutes |
| 4 | In-process cron | Any crash during a job | No queue, no retry, no visibility |
| 5 | Single-region database | International customers | Round-trip latency per query |
| 6 | Serverless cold starts | Heavy interactive use | 300–800 ms on first hit |
| 7 | No caching | Dashboard/gallery reads | Every view recomputes aggregates |

---

## 2. Load model and assumptions

### 2.1 Definitions (used consistently in every sheet)

| Term | Definition | Value used |
|---|---|---|
| **Registered user** | A named CRM account (org staff or platform staff) | — |
| **MAU** | Monthly active users | 55 % of registered |
| Users per organization | Average seats per tenant | 2.2 |
| Events per org per month | Bookings actually run | 1.2 |
| Sessions per event | Guest sessions completed | 90 |
| Individual photos per session | Equal to layout slots | 4.5 |
| Composite per session | One final sheet | 1 |
| Average individual photo size | JPEG at 300 DPI, quality 0.9 | 1.1 MB |
| Average composite size | PNG/JPEG sheet | 2.4 MB |
| Storage per session | 4.5 × 1.1 MB + 2.4 MB | 7.35 MB |
| Digital download rate | Sessions where a guest opens the QR | 35 % |
| Download size per redemption | Composite + 1 frame | 3.4 MB |
| Print sessions | Sessions that print | 85 % (physical media, no cloud cost) |

### 2.2 Derived monthly volumes

```
orgs            = registered_users / 2.2
events_per_month = orgs × 1.2
sessions        = events × 90
photos          = sessions × 5.5      (4.5 individuals + 1 composite)
storage_growth  = sessions × 7.35 MB
downloads_GB    = sessions × 0.35 × 3.4 MB
```

At 10,000 users this yields **≈ 491,000 sessions/month** — about 16,000 sessions/day, roughly one
session every 5 seconds around the clock, and far more during Indian wedding season evenings. That is
the number that makes this a real infrastructure problem rather than a toy.

> If your intuition says "10K users is small", check the sessions column. In this product, users are
> businesses whose hardware runs continuously; the ratio of activity to accounts is unusually high.

---

## 3. Growth scenarios at a glance

| Metric | Stage 1 | Stage 2 | Stage 3 | Stage 4 |
|---|---|---|---|---|
| Registered users | 10,000 | 100,000 | 1,000,000 | 10,000,000 |
| MAU | 5,500 | 55,000 | 550,000 | 5,500,000 |
| Organizations | 4,545 | 45,455 | 454,545 | 4,545,455 |
| Events / month | 5,455 | 54,545 | 545,455 | 5,454,545 |
| Sessions / month | 490,909 | 4,909,091 | 49,090,909 | 490,909,091 |
| Sessions / day (avg) | 16,364 | 163,636 | 1,636,364 | 16,363,636 |
| Peak sessions / hour (8× avg) | 5,455 | 54,545 | 545,455 | 5,454,545 |
| Photos / month | 2.70 M | 27.0 M | 270 M | 2.70 B |
| Storage growth / month | 3.61 TB | 36.1 TB | 361 TB | 3.61 PB |
| Downloads / month | 168 TB | 1.68 PB | 16.8 PB | 168 PB |
| Concurrent booths (peak) | 1,200 | 12,000 | 120,000 | 1,200,000 |
| Blended ARPU / org / month | ₹1,150 | ₹1,150 | ₹1,150 | ₹1,150 |
| Monthly platform revenue | ₹5.23 M | ₹52.3 M | ₹523 M | ₹5.23 B |
| Monthly infrastructure | ₹1.85 L ($2,200) | ₹18.9 L ($22,500) | ₹1.44 Cr ($172 K) | ₹11.5 Cr ($1.37 M) |
| Infra as % of revenue | 3.5 % | 3.6 % | 2.8 % | 2.2 % |
| Infrastructure per session | ₹0.38 | ₹0.38 | ₹0.29 | ₹0.23 |

**Reading the table:** infrastructure stays at 2–4 % of revenue across four orders of magnitude. That
is the healthy band for a SaaS+storage business. The absolute numbers get large, but they scale
sub-linearly because per-session cost falls as fixed costs amortise.

**Reading it honestly:** Stage 4 assumes storage engineering that does not exist today. Section 9
explains why, and what must be built before anyone promises that stage.

---

## 4. Stage 1 — 10,000 users

### 4.1 What this stage looks like in the real world

Roughly 4,500 photo-booth businesses, mostly single-city operators running 1–4 booths. Peak load is
concentrated: Friday–Sunday, 6 pm–11 pm, October–February. Averages hide a 6–8× evening peak.

### 4.2 Architecture changes required

| # | Change | Why | Effort |
|---|---|---|---|
| 1 | **Atlas M30 → M40** with dedicated IOPS | Gallery aggregation + write volume | 1 day |
| 2 | **S3 lifecycle rules** (see §9) | First real cost control | 1 day |
| 3 | **Indexes**: `photos(organizationId, sessionId)`, `photos(eventId, createdAt)`, `guestdownloads(sessionId)` | Gallery p95 | 1 day |
| 4 | **HTTP caching** on `GET /api/plans`, template assets | Cut function invocations | 2 days |
| 5 | **Externalise cron** to Vercel Cron or a small worker | A crash must not skip expiry sweeps | 2 days |
| 6 | **Structured logs + alerts** (Sentry or similar) | You cannot debug what you cannot see | 2 days |
| 7 | **Read replica** (Atlas secondary reads) for dashboards | Take analytics off the primary | 1 day |
| 8 | **Uptime + synthetic checks** on 3 endpoints | Detect outages before customers do | 1 day |

### 4.3 Infrastructure cost (monthly)

| Service | Configuration | USD | INR |
|---|---|---|---|
| Vercel | Pro, 5 seats, ~3 M function invocations | 250 | ₹21,000 |
| MongoDB Atlas | M40, 3-node replica set, backups | 450 | ₹37,800 |
| AWS S3 | ~30 TB stored (18-month steady state), lifecycle to IA | 620 | ₹52,100 |
| S3 requests + egress to CDN | ~168 TB/month delivery | 280 | ₹23,500 |
| Monitoring (Sentry/Logtail) | Team plan | 100 | ₹8,400 |
| Email (SendGrid) + SMS (Twilio) | 50 K emails, 20 K SMS | 150 | ₹12,600 |
| AI (Groq + Together FLUX) | ~6,000 generations/month | 250 | ₹21,000 |
| Domains, SSL, misc | 3 domains, certificates | 100 | ₹8,400 |
| **Total** | | **2,200** | **₹1,84,800** |

**Per session:** $0.0045 (₹0.38) — but only ~35 % of that is per-session variable; the rest is fixed
platform cost.

### 4.4 Team at this stage

| Role | Count |
|---|---|
| Backend / platform | 2 |
| Frontend (CRM + website) | 1.5 |
| Booth apps (Android + Electron) | 1.5 |
| QA / release | 0.5 |
| Support / operations | 1.5 |
| Founder / product | 1 |
| **Total** | **8** |

### 4.5 What must be true before leaving this stage

- [ ] No single point of failure in the request path
- [ ] Backups restore-tested monthly, RTO proven < 4 h
- [ ] Alerts fire on error rate, latency, payment failures, device fleet
- [ ] Storage lifecycle enforced and cost per session tracked monthly
- [ ] Gallery p95 < 1 s at 10× current organically observed volume
- [ ] Documented, rehearsed rollback for every service

---

## 5. Stage 2 — 100,000 users

### 5.1 What changes qualitatively

International expansion becomes realistic (GST/currency per tenant already supported). Multi-booth
fleets (10–50 devices per org) appear, which changes the heartbeat profile: fleet dashboards, bulk
device management, and per-org rate expectations.

### 5.2 Architecture changes

| # | Change | Why | Effort |
|---|---|---|---|
| 1 | **Shard by tenant region** (Atlas: one cluster per region, or multi-region sharded) | Latency for non-India customers | 3–4 weeks |
| 2 | **Redis (Upstash/ElastiCache)** for hot reads: plans, gallery page 1, snapshots | Cut DB load 40–60 % | 1 week |
| 3 | **Materialised gallery index** — one `sessions` collection, one row per session | Gallery aggregation becomes a point lookup | 2 weeks |
| 4 | **Queue (SQS/BullMQ)** for photo post-processing, AI jobs, email | Retries and backpressure | 2 weeks |
| 5 | **Heartbeat coalescing** — write telemetry at most once per 60 s per device | 12,000 booths × 30 writes/hour | 1 week |
| 6 | **CDN in front of S3** (CloudFront) for downloads | Egress cost and latency | 1 week |
| 7 | **Read replicas per region** + read-preference routing | Dashboard latency | 1 week |
| 8 | **Image variants** (web-size proxy + original) | Guests download 2 MB instead of 8 MB | 1 week |
| 9 | **Cost attribution** per org (storage, AI, bandwidth) | Prevent one whale from destroying margin | 2 weeks |
| 10 | **Blue/green DB migrations** | Zero-downtime schema changes at volume | 1 week |

### 5.3 Infrastructure cost (monthly)

| Service | Configuration | USD | INR |
|---|---|---|---|
| Vercel | Enterprise-tier usage, ~30 M invocations | 2,500 | ₹2,10,000 |
| MongoDB Atlas | M60 × 2 regions, sharded | 4,500 | ₹3,78,000 |
| AWS S3 | ~300 TB stored, tiered | 5,800 | ₹4,87,200 |
| CloudFront / CDN | ~1.7 PB delivery | 5,200 | ₹4,36,800 |
| Redis | Managed, 25 GB | 600 | ₹50,400 |
| Queues / workers | SQS + small worker fleet | 500 | ₹42,000 |
| Monitoring + logs | Scaled plan | 800 | ₹67,200 |
| Email + SMS | 500 K emails, 200 K SMS | 1,200 | ₹1,00,800 |
| AI | ~50,000 generations | 2,000 | ₹1,68,000 |
| Misc (domains, secrets, backups) | | 500 | ₹42,000 |
| **Total** | | **22,500** | **₹18,90,000** |

**Per session:** $0.0046 — flat versus Stage 1, because storage grows linearly while fixed costs are
spread wider.

### 5.4 Team at this stage

| Role | Count |
|---|---|
| Platform / SRE | 3 |
| Backend | 5 |
| Frontend | 3 |
| Mobile (Android) | 2 |
| Desktop (Electron) | 2 |
| QA | 2 |
| Support / ops | 6 |
| Product / design | 2 |
| Data / analytics | 1 |
| Leadership | 2 |
| **Total** | **28** |

### 5.5 Exit criteria

- [ ] Multi-region reads with measured latency targets met
- [ ] Gallery p95 < 700 ms at 10× Stage 1 volume
- [ ] Queue-backed retries for every async job; no silent data loss
- [ ] Storage cost per session trending **down**, not flat
- [ ] Per-org cost attribution visible to finance
- [ ] Formal SLA (99.9 %) defensible with evidence

---

## 6. Stage 3 — 1,000,000 users

### 6.1 What changes qualitatively

HappyPix becomes infrastructure-heavy: 15+ PB under management, 120,000 concurrent booths at peak,
and a support model that must be self-service for the long tail. Storage and egress dominate the bill
(> 60 %). Every architectural decision from here is a storage decision.

### 6.2 Architecture changes

| # | Change | Why | Effort |
|---|---|---|---|
| 1 | **Multi-region active-active for APIs**, regional data residency | Compliance + latency | 3 months |
| 2 | **Sharded MongoDB** with `organizationId` as the shard key | Write throughput beyond a single primary | 2 months |
| 3 | **Dedicated media service** (separate from the API) | Photo upload/download is its own workload | 2 months |
| 4 | **Tiered storage pipeline**: hot 30 days → IA 12 months → Glacier Deep Archive → delete | The only way storage stays sane | 2 months |
| 5 | **Metadata-only galleries** with signed thumbnail CDN | Load 25-session page without touching originals | 1 month |
| 6 | **Event-driven architecture** (Kafka/SNS-SQS fan-out) for sessions, payments, telemetry | Decouple producers from consumers | 3 months |
| 7 | **Kubernetes or container platform** for workers (serverless limits bite) | Long-running image/video jobs | 2 months |
| 8 | **Data warehouse** (BigQuery/Redshift) + ETL | Stop running analytics on the OLTP DB | 2 months |
| 9 | **Per-tenant rate limits and quotas** at the edge | Noisy neighbours | 1 month |
| 10 | **Object dedupe / perceptual hash** for template assets | Templates repeat across orgs | 1 month |

### 6.3 Infrastructure cost (monthly)

| Service | Configuration | USD | INR |
|---|---|---|---|
| Vercel / edge | ~300 M invocations + 20 TB edge | 18,000 | ₹15,12,000 |
| MongoDB Atlas | Sharded M80+, 3 regions, 5 TB hot | 35,000 | ₹29,40,000 |
| AWS S3 | ~3 PB stored, tiered (60 % deep archive) | 42,000 | ₹35,28,000 |
| CDN / egress | ~16.8 PB delivery | 45,000 | ₹37,80,000 |
| Redis + queues + Kafka | Managed | 8,000 | ₹6,72,000 |
| Workers (containers) | 40 vCPU baseline | 6,000 | ₹5,04,000 |
| Monitoring, logs, tracing | Scaled | 6,000 | ₹5,04,000 |
| Email + SMS | 5 M emails, 2 M SMS | 8,000 | ₹6,72,000 |
| AI | ~500,000 generations | 15,000 | ₹12,60,000 |
| Data warehouse | ~20 TB scanned/month | 3,000 | ₹2,52,000 |
| Misc | | 6,000 | ₹5,04,000 |
| **Total** | | **172,000** | **₹1,44,48,000** |

**Per session:** $0.0035 (₹0.29) — improving because fixed costs dominate and storage is tiered.

### 6.4 Team at this stage

~90–120 people: 25 platform/SRE, 25 backend, 15 frontend, 10 mobile, 10 desktop, 12 QA, 20 support,
6 data, 8 product/design, leadership.

### 6.5 Exit criteria

- [ ] Storage cost per stored GB falls year over year
- [ ] Regional data residency available for at least 2 jurisdictions
- [ ] 99.95 % availability sustained for a quarter
- [ ] Self-service support handles > 70 % of tickets
- [ ] DR proven at region-failure scale, not just collection scale

---

## 7. Stage 4 — 10,000,000 users

### 7.1 Reality check

At 10M registered users, this platform would be storing **3.6 PB of new photos per month** — 43 PB a
year — and delivering **168 PB per month**. That is not a "scale the database" problem; it is a
media-company problem. Two things must be true before this stage is attempted:

1. **Retention is a product feature**, not an afterthought (see §9).
2. **Monetisation per session** is at least double today's, because the marginal cost of storage and
   egress is the dominant term.

Saying this plainly is more useful than pretending linear extrapolation works.

### 7.2 Architecture at this stage

| Layer | Design |
|---|---|
| Edge | Multi-CDN (CloudFront + Fastly) with regional failover |
| APIs | Active-active in ≥ 4 regions; regional read/write affinity by tenant |
| Data | Sharded, region-pinned tenants; global reference data replicated |
| Media | Object storage with per-region buckets, lifecycle automation, dedupe |
| Compute | Kubernetes for workers; serverless only for bursty HTTP |
| Events | Kafka/SNS with schema registry, replayable streams |
| Analytics | Warehouse + lake, per-tenant cost and usage metering |
| Reliability | Chaos testing in staging, regional failover drills quarterly |

### 7.3 Infrastructure cost (monthly)

| Service | USD | INR |
|---|---|---|
| Edge / compute | 120,000 | ₹1,00,80,000 |
| Database (sharded, multi-region) | 250,000 | ₹2,10,00,000 |
| Object storage (tiered, ~30 PB) | 380,000 | ₹3,19,20,000 |
| CDN / egress | 320,000 | ₹2,68,80,000 |
| Queues / streaming / workers | 60,000 | ₹50,40,000 |
| Observability | 40,000 | ₹33,60,000 |
| Comms | 50,000 | ₹42,00,000 |
| AI | 100,000 | ₹84,00,000 |
| Warehouse / lake | 30,000 | ₹25,20,000 |
| Misc | 20,000 | ₹16,80,000 |
| **Total** | **1,370,000** | **₹11,50,80,000** |

**Per session:** $0.0028 (₹0.23). At this point infra is ~2 % of revenue, and the business is
essentially a media logistics company with a SaaS front end.

### 7.4 Honest verdict

Stage 4 is achievable **only** with: aggressive retention tiers, resolution-tiered delivery, dedupe
of template assets, and a pricing model that charges for storage beyond a fair-use allowance. Without
those, the business is viable but margin-thin. That is a product decision, not an engineering one.

---

## 8. Cost model and unit economics of infrastructure

### 8.1 Cost per unit at each stage

| Unit | Stage 1 | Stage 2 | Stage 3 | Stage 4 |
|---|---|---|---|---|
| Per registered user / month | ₹18.48 | ₹18.90 | ₹14.45 | ₹11.51 |
| Per organization / month | ₹40.66 | ₹41.58 | ₹31.79 | ₹25.32 |
| Per event | ₹33.89 | ₹34.65 | ₹26.49 | ₹21.10 |
| Per session | ₹0.377 | ₹0.385 | ₹0.294 | ₹0.235 |
| Per photo stored (monthly amortised) | ₹0.051 | ₹0.049 | ₹0.038 | ₹0.031 |
| Per GB delivered | ₹0.011 | ₹0.011 | ₹0.009 | ₹0.007 |

### 8.2 Fixed vs variable split (Stage 2)

| Type | Share of bill | Examples |
|---|---|---|
| Fixed platform | ~35 % | Vercel seats, Atlas baseline, monitoring, domains |
| Variable per session | ~40 % | S3 writes, DB writes, function invocations |
| Variable per gigabyte | ~25 % | Egress, storage growth |

This split matters for pricing: a customer who runs 10× the sessions of another does not cost 10× the
platform, but does cost ~10× the variable portion. Fair-use storage allowances are the honest way to
recover that.

### 8.3 Sensitivity

| Variable | Change | Effect on bill |
|---|---|---|
| Sessions per event | 90 → 130 | +44 % variable cost |
| Digital download rate | 35 % → 60 % | +71 % egress |
| Average photo size | 1.1 MB → 1.6 MB | +36 % storage |
| Retention | 24 months → 6 months | −60 % storage |
| Deep-archive tiering | Off → on | −45 % storage |
| AI generations per org | 3 → 10 | +230 % AI cost |

**The four levers that matter:** retention, tiering, delivery size, AI quota. Everything else is
noise by comparison.

### 8.4 Revenue versus infrastructure

| Stage | Revenue / month | Infra / month | Infra % | Gross margin after infra |
|---|---|---|---|---|
| 1 | ₹5.23 M | ₹1.85 L | 3.5 % | 96.5 % |
| 2 | ₹52.3 M | ₹18.9 L | 3.6 % | 96.4 % |
| 3 | ₹523 M | ₹1.44 Cr | 2.8 % | 97.2 % |
| 4 | ₹5.23 B | ₹11.51 Cr | 2.2 % | 97.8 % |

Infrastructure is not the margin problem. **Support, sales and hardware are.** (See
[`FINANCIAL_MODEL.xlsx`](FINANCIAL_MODEL.xlsx) for the full picture.)

---

## 9. The storage problem (the real constraint)

### 9.1 Why it matters

Every session creates ~7.35 MB that is, by default, never deleted. At Stage 1 that is 3.6 TB/month;
after five years it is 216 TB — and the platform is still paying to keep it, with essentially no
revenue attached to photos from 2023.

### 9.2 The policy that fixes it

| Age | Storage class | Approx cost | Access |
|---|---|---|---|
| 0–30 days | S3 Standard | $0.023/GB | Instant (guest QR window) |
| 31–365 days | S3 Infrequent Access | $0.0125/GB | Milliseconds |
| 1–2 years | S3 Glacier Instant Retrieval | $0.004/GB | Milliseconds |
| 2–5 years | S3 Glacier Deep Archive | $0.00099/GB | Hours (restore on request) |
| > 5 years | Delete (or explicit client retention contract) | — | — |

At 100:1 cost compression between Standard and Deep Archive, this policy reduces a 3 PB library to
roughly the cost of 300 TB of Standard.

### 9.3 Product implications (be explicit with customers)

| Promise | Reality |
|---|---|
| "Your photos are available for 24 hours to guests" | Always true — Standard storage |
| "Your gallery keeps your photos" | True while the subscription is active; plan tiers define retention |
| "We never delete your photos" | False at 5 years unless a retention contract exists |
| "Download anything, any time" | True, but archival retrieval may take hours |

State retention clearly in the plan comparison and the Terms. Selling "unlimited forever" is the one
promise that will bankrupt the storage line.

### 9.4 Delivery-side savings

| Technique | Saving |
|---|---|
| Serve a web-sized variant (1600 px) instead of the original | 70–85 % egress |
| CDN caching for thumbnails and template assets | 60–80 % origin requests |
| Signed URLs with short TTL | No proxy cost, direct from CDN |
| Dedupe template assets across orgs (hash-based) | 30–50 % of asset storage |
| Composite-only default for gallery covers | ~4× fewer previews fetched |

### 9.5 What to implement now (cheap, high leverage)

- [ ] Lifecycle rules on the bucket (**highest priority, one day of work**)
- [ ] Web-size variant generation for gallery/download previews
- [ ] CDN in front of the bucket
- [ ] Retention documented per plan
- [ ] Monthly storage report by org

---

## 10. Upgrade triggers

Do not scale on a calendar. Scale on these measurements.

| Trigger | Threshold | Action |
|---|---|---|
| DB CPU | > 65 % sustained for 7 days | Increase tier |
| DB connections | > 70 % of max | Add pooling / fix leaks |
| API p95 | > 600 ms for 3 days | Add cache or index |
| Function invocations | > 70 % of plan | Optimise or upgrade |
| S3 storage | > 60 % of the cost budget | Enforce lifecycle now |
| Egress | > 50 % of the cost budget | Introduce variants/CDN |
| Heartbeat writes | > 2,000 devices | Coalesce writes |
| Cron job duration | > 50 % of interval | Externalise to a worker |
| Support tickets | > 0.5 per org per month | Self-service investment |
| Cold starts | > 1 % of requests | Provisioned concurrency or containers |

### 10.1 Stage gates (business, not just technical)

| Move to | Require |
|---|---|
| Stage 1 → 2 | 1,500 paying orgs, > ₹1.5 Cr ARR, infra cost < 5 % revenue |
| Stage 2 → 3 | 12,000 paying orgs, > ₹12 Cr ARR, 2 regions live, DR drill passed |
| Stage 3 → 4 | 100,000 paying orgs, > ₹100 Cr ARR, retention product shipped |

---

## 11. Migration plan and sequencing

### 11.1 Principles

1. **Additive before subtractive.** New path first, old path removed after traffic moves.
2. **Dual-write during transitions.** Never a big-bang cutover on customer data.
3. **Backfill out of band.** Never in a request path.
4. **Reversible every step.** If a step cannot be undone in 10 minutes, split it.
5. **Measure before and after.** A migration without a metric is a rumour.

### 11.2 Sequence from today to Stage 2 (12 months)

| Quarter | Work | Risk |
|---|---|---|
| Q1 | Lifecycle rules, indexes, alerting, externalised cron, read replica | Low |
| Q2 | Redis cache, materialised sessions index, image variants, CDN | Medium |
| Q3 | Queue for async jobs, heartbeat coalescing, per-org cost metering | Medium |
| Q4 | Second region (read replica + regional routing), blue/green migrations | High |

### 11.3 Data migration pattern (example: sessions materialisation)

```
1. Create sessions collection + shard/index plan
2. Dual-write: session completion writes photos AND the session row
3. Backfill: script pages through historical photos, groups by sessionId, upserts rows
   - batched (500 at a time), resumable by checkpoint, idempotent (upsert)
4. Shadow-read: gallery reads from sessions, compares with legacy aggregation; log differences
5. Flip read path when difference rate = 0 for 7 days
6. Stop dual-writing after 30 days of stability
7. Remove the legacy aggregation code
```

### 11.4 Rollback at each step

| Step | Rollback |
|---|---|
| Add index | Drop index (no data change) |
| Dual-write | Disable the secondary write; primary is untouched |
| Backfill | Delete the new collection and re-run |
| Read flip | Feature flag back to legacy path |
| Region move | Connection string revert |

---

## 12. Risks, redundancy and recovery

### 12.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Storage cost outruns revenue | Medium | High | Lifecycle + retention tiers + fair-use pricing (**do this now**) |
| Single-region outage | Medium | High | Second region by Stage 2; documented RTO |
| Atlas tier ceiling hit during wedding season | High (seasonal) | High | Pre-scale before Oct–Feb; alert at 65 % |
| Egress bill spike from a viral event | Low | Medium | CDN, variants, per-org bandwidth caps |
| Vendor lock-in (Vercel) | Medium | Medium | Code is portable Node; container image exists |
| Payment provider outage | Medium | High | Dual gateway (Razorpay + Cashfree) already supported |
| Support cost per org rising | High | High | Self-service, better docs, in-product guidance |
| Data loss from a bad migration | Low | Critical | Reversible steps, PITR, dry runs on staging |
| Key-person dependency | Medium | High | Documentation (this repo), pair reviews, handover register |

### 12.2 Redundancy targets by stage

| Component | Stage 1 | Stage 2 | Stage 3 | Stage 4 |
|---|---|---|---|---|
| API | Multi-instance (serverless) | Multi-region | Active-active | Active-active ×4 |
| Database | 3-node replica set | + cross-region replica | Sharded multi-region | Sharded, region-pinned |
| Storage | S3 (11 nines durability) | + versioning | + cross-region replication | + multi-CDN |
| Backups | PITR 7 days | 14 days | 30 days | 35 days + tape |
| DR test | Monthly | Monthly + quarterly regional | Quarterly regional | Quarterly chaos |

### 12.3 Recovery objectives by stage

| Stage | RPO | RTO |
|---|---|---|
| 1 | 5 min | 4 h |
| 2 | 5 min | 2 h |
| 3 | 1 min | 1 h (region failure) |
| 4 | 1 min | 30 min (region failure) |

These are targets. Only the ones proven in a drill may be published to customers — see
[`../docs/OPERATIONS.md`](../docs/OPERATIONS.md#9-recovery-objectives-and-drill-record).

---

## 13. What we deliberately are not building

Saying no is part of a scaling plan.

| Not building (yet) | Why |
|---|---|
| Microservices per domain | A modular monolith serves us until Stage 3; splitting early multiplies operational cost without benefit |
| Kubernetes for the APIs | Serverless is cheaper and simpler at this scale |
| Custom CDN | CloudFront/Fastly are better than anything we would build |
| Real-time collaboration on templates | Rarely requested; high complexity |
| On-device AI | Cloud models are better and cheaper per use |
| Multi-cloud active-active | Doubles cost for marginal availability gain at our scale |
| Own data centres | Absolutely not |
| Per-tenant database | Operational cost explosion; tenancy is enforced in the application layer |

---

## Appendix A — Charts worth keeping visible

**Sessions per stage (log scale)**

```
10K users    ▏ 0.49 M/month
100K users   ▎ 4.9 M/month
1M users     ▍ 49 M/month
10M users    █ 491 M/month
```

**Infrastructure as % of revenue**

```
Stage 1  ███▍  3.5 %
Stage 2  ███▊  3.6 %
Stage 3  ██▊   2.8 %
Stage 4  ██▏   2.2 %
```

**Storage growth (the line that must bend)**

```
cumulative PB
40 │                                        ╱
30 │                                    ╱
20 │                              ╱
10 │                    ╱
 0 └──────┴──────┴──────┴──────┴──────┴──
       1y     2y     3y     4y     5y
     ── no lifecycle      ── with lifecycle
```

---

## Appendix B — Inputs to the financial model

| Input | Value | Used in |
|---|---|---|
| ₹84 / USD | FX planning rate | All conversions |
| 2.2 users per org | Seat average | Org counts |
| 1.2 events per org month | Booking frequency | Volume |
| 90 sessions per event | Guest throughput | Volume |
| 7.35 MB per session | Storage unit | Storage cost |
| 35 % download rate | Delivery | Egress cost |
| ₹1,150 / org / month | Blended ARPU | Revenue ratio |
| 18 % GST | Not included in these figures | Invoicing |

These feed [`FINANCIAL_MODEL.xlsx`](FINANCIAL_MODEL.xlsx) (Infrastructure sheet) and
[`UNIT_ECONOMICS.xlsx`](UNIT_ECONOMICS.xlsx) (Cost per unit sheet).

---

*Next: [`FINANCIAL_MODEL.xlsx`](FINANCIAL_MODEL.xlsx) for the full cost and runway picture, or
[`../docs/OPERATIONS.md`](../docs/OPERATIONS.md) for the operational readiness this plan assumes.*
