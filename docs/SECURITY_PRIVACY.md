# HappyPix — Security, Privacy & Data Protection

> **Status:** engineering policy. Sections marked ⚖️ require review by qualified counsel before being
> relied upon externally. This document is **not** legal advice and is not a substitute for the
> published Privacy Policy and Terms of Service.
> **Last verified:** 2026-10-23, branch `arena/097e52ae-local`.

---

## Table of contents

1. [Security model](#1-security-model)
2. [Secrets management](#2-secrets-management)
3. [Access control and least privilege](#3-access-control-and-least-privilege)
4. [Data inventory](#4-data-inventory)
5. [Data subject requests](#5-data-subject-requests)
6. [Photo privacy, consent and deletion](#6-photo-privacy-consent-and-deletion)
7. [Encryption and secure uploads](#7-encryption-and-secure-uploads)
8. [Logging and monitoring](#8-logging-and-monitoring)
9. [Vulnerability management](#9-vulnerability-management)
10. [Incident response](#10-incident-response)
11. [Account access and revocation](#11-account-access-and-revocation)
12. [Legal and compliance](#12-legal-and-compliance)
13. [Policies, terms and contact](#13-policies-terms-and-contact)

---

## 1. Security model

### 1.1 Assets, in order of sensitivity

| Rank | Asset | Why it matters |
|---|---|---|
| 1 | Guest photographs (faces, sometimes children) | Highest harm if leaked; irreversible |
| 2 | Payment credentials and gateway keys | Direct financial loss |
| 3 | Customer (tenant) business data: clients, events, pricing | Commercial harm, contract breach |
| 4 | User accounts and session tokens | Account takeover → everything above |
| 5 | Device tokens | Can create sessions and uploads against a tenant |
| 6 | Infrastructure secrets (DB URI, JWT, S3 keys) | Total compromise if leaked |
| 7 | Telemetry and logs | Reconnaissance value |

### 1.2 Threat model (realistic, not theatrical)

| Threat | Likelihood | Impact | Primary control |
|---|---|---|---|
| Scraped/stolen photo download link shared publicly | High | High | 144-bit unguessable id + 24 h TTL + rate limits |
| Ex-employee retains CRM access | High | High | Deactivation + 8 h token expiry + audit |
| Leaked `.env` in a repo or chat | Medium | Critical | Fail-closed boot, secret scanning, rotation runbook |
| Booth tablet stolen at an event | Medium | Medium | Device revocable; no user password stored on device |
| Malicious tenant reads another tenant's data | Medium | Critical | Mandatory `organizationId` on every query + parity tests |
| Payment tampering (client sets price) | Medium | High | Server-authoritative quotes + signature verification |
| Webhook forgery | Low | Critical | HMAC over the raw body |
| Inside abuse by a platform admin | Low | High | Every mutation audited; Owner-only destructive actions |
| DDoS / scraping | Medium | Low-Med | Rate limits, CDN, separate website API |
| XSS in CRM | Low | High | No `dangerouslySetInnerHTML` with user data; CSP |
| Supply-chain compromise | Low | High | Lockfiles, minimal dependencies, no UI library |

### 1.3 Non-goals / accepted risks

| Accepted risk | Rationale | Compensating control |
|---|---|---|
| Print bridge `:9123` is unauthenticated on LAN | A venue LAN with no internet; adding auth would break tablet pairing on legacy devices | Documented, never exposed publicly; firewall recommendation in the rig guide |
| Booth device token has no expiry | A kiosk must work for months without re-pairing | Revocable per device; rotating on re-pair; admin can block |
| Guests can access their download without login | Product decision: no friction at a party | Unguessable id + 24 h expiry + rate limit |
| No MFA for org users (today) | Not yet implemented | Strong passwords, lockout, audit; MFA is on the roadmap |

---

## 2. Secrets management

### 2.1 Inventory

| Secret | Where used | Rotation | Blast radius |
|---|---|---|---|
| `JWT_SECRET` | backend | 90 days or on suspicion | All user sessions invalidated |
| `MONGODB_URI` | backend, website-backend | On credential rotation | Full data access |
| `AWS_ACCESS_KEY_ID` / `SECRET` | backend, website-backend | 90 days | Bucket read/write |
| `RAZORPAY_KEY_ID` / `SECRET` | backend, website-backend | On suspicion | Payment operations |
| `RAZORPAY_WEBHOOK_SECRET` | backend | On suspicion | Webhook forgery |
| `CASHFREE_APP_ID` / `SECRET` | backend | On suspicion | Payment operations |
| `GROQ_API_KEY`, `TOGETHER_API_KEY`, `XAI_API_KEY` | backend | 90 days | Spend, not data |
| `SENDGRID_API_KEY` | backend | 90 days | Email sending |
| `TWILIO_AUTH_TOKEN` | backend | 90 days | SMS sending |
| `WEBSITE_INTERNAL_SECRET` | backend + website-backend | 90 days | Internal download creation |
| Org Razorpay keys (per tenant) | database (encrypted) | Tenant-controlled | That tenant's payments |
| Device tokens | database (hashed) | On re-pair | One booth |
| Android keystore | offline vault | Never (identity) | App update identity |
| Code-signing certificate | vault / CI secret | On expiry | Installer trust |

### 2.2 Rules

1. **Never commit** a secret. `.env` is git-ignored in every app; `.env.example` contains
   placeholders only.
2. **Never log** a secret, token, presigned URL or full card/UPI reference. Log identifiers, not
   credentials.
3. **Never send** a server secret to a browser. `VITE_*` values are public by definition.
4. **Per-tenant gateway keys** are encrypted at rest (AES via `utils/crypto.js`) and never returned
   in API responses (mask on read).
5. **Least-privilege IAM**: the S3 user may only touch the application bucket, not account-wide.
6. **Separate secrets per environment** — a leaked staging key must not open production.
7. **Two-person rule** for production key replacement during an incident (where staffing allows).

### 2.3 Rotation runbook

```
1. Create the new credential at the provider (do not delete the old one yet).
2. Add it to Vercel as a new variable (or replace if the provider supports only one).
3. Redeploy the affected project.
4. Verify: health check + one authenticated request + (for payments) one test transaction.
5. Revoke the old credential at the provider.
6. Update the handover register with the rotation date and operator.
7. If rotating JWT_SECRET: expect all users to be signed out; announce it.
```

### 2.4 Reporting a suspected leak

1. Do **not** paste the secret into chat or a ticket.
2. Rotate immediately using the runbook above.
3. Open an incident (§10) with severity based on blast radius.
4. Search logs for use of the old credential.
5. If customer data may have been exposed, follow the breach-notification path in §12.5.

---

## 3. Access control and least privilege

### 3.1 Human access tiers

| Tier | Who | Access | Controls |
|---|---|---|---|
| Platform Owner | Founder(s) | CRM Owner + provider dashboards | MFA on provider accounts |
| Engineering | Engineers | GitHub, Vercel, Atlas, S3 (read/write in staging, break-glass in prod) | Least privilege, audit trail |
| Support | Support staff | CRM Support Manager, no infrastructure | Read-only, no data export |
| Finance | Finance | Razorpay dashboard, reporting exports | No photo access |
| Contractors | Per engagement | Time-boxed scoped access | Removed at contract end; verified in offboarding checklist |

**Break-glass rule:** production database access is granted for a specific incident, logged, and
revoked within 24 hours.

### 3.2 Application roles (recap)

| Role | Scope | Notable limits |
|---|---|---|
| Owner | Platform | Only role that can suspend/ban orgs |
| Platform Admin | Platform | No revenue, no plan editing, no user management |
| Support Manager | Platform | Read-only orgs, support tickets only |
| Org Admin | One tenant | No platform routes, no other tenant |
| Org Manager | One tenant | No revenue, coupons, defaults editing or team |

Enforced three times: navigation, router, API (`requirePerm`). Denials are audited.

### 3.3 Tenant isolation

* Every tenant document carries `organizationId`.
* Every query filters by it; handlers that accept an id always combine `_id` + `organizationId`.
* Platform roles bypass tenant scoping only on `/api/platform/*`.
* `backend/tests/permissions.parity.test.js` asserts that the CRM matrix and backend guards agree.

**Known residual risk:** a new route written without a tenant filter. Mitigation: code review rule
(any `findById` in an org route is rejected), plus a lint-review checklist item.

### 3.4 Device access

* Device tokens are 32-byte random, stored only as SHA-256 hashes.
* A device can only act within its own organization and assigned event.
* Blocking/deleting a device takes effect on the next request (`403` / `410`).
* Telemetry is write-only from the device's perspective — a device cannot read other devices.

### 3.5 Database-level controls

* Atlas users: one application user (read/write to the app database), one human admin user (MFA).
* Network: IP allowlist (Vercel egress ranges + office IPs) where feasible; otherwise strong
  credentials + TLS required.
* No direct shell access from application servers to the database console.

---

## 4. Data inventory

### 4.1 What we collect

| Category | Fields | Source | Purpose | Lawful basis ⚖️ |
|---|---|---|---|---|
| Account | name, email, phone, role, org | Signup / invite | Authentication, service delivery | Contract |
| Organization | business name, address, GST/tax id, logo | Signup | Invoicing, branding | Contract |
| Event | client name, venue, dates, pricing | Operator | Service delivery | Contract |
| Booth/device | UUID, name, location, platform, telemetry | Device | Operations, support | Legitimate interest |
| Guest photo | image, composite, session id | Guest at booth | The product | **Consent** |
| Guest contact (optional) | phone/email | Guest, if opted in | Delivery, support | Consent |
| Payment | amount, status, provider ref, masked instrument | Gateway | Transaction, tax, disputes | Contract / legal obligation |
| Support | messages, ticket history | User/guest | Resolve issues | Legitimate interest |
| Audit | actor, action, IP, timestamp | System | Security, forensics | Legitimate interest / legal |
| Marketing | lead name/email, campaign source | Website form | Sales follow-up | Consent |

### 4.2 What we deliberately do **not** collect

* No guest account, no guest password.
* No full card numbers — the gateway holds them; we store references only.
* No government ID, no biometric templates, no facial recognition.
* No precise device location; venue is operator-entered text.
* No advertising or cross-site trackers in the booth apps.

### 4.3 Sub-processors

| Sub-processor | Data shared | Location | Purpose |
|---|---|---|---|
| MongoDB Atlas | All application data | Region configured (prefer India) | Database |
| AWS S3 | Photos, composites, assets | Bucket region | Storage |
| Razorpay | Name, email, phone, amount | India | Payments |
| Cashfree | Name, phone, amount | India | Payments (alternate) |
| SendGrid | Email address, name | US/EU | Transactional email |
| Twilio | Phone number | US/EU | SMS |
| Groq | Prompt text (no photos) | US | Template generation |
| Together AI | Prompt text (no photos) | US | Background images |
| Vercel | Request metadata, logs | Global edge | Hosting |
| GitHub | Source code | US | Development |

**Rule:** no guest photographs are sent to any AI provider. Prompts contain design language only.

### 4.4 Retention schedule

| Data | Retention | Mechanism |
|---|---|---|
| Guest download record + link | 24 hours | MongoDB TTL index (`expiresAt`) |
| Individual photos / composites | Until tenant deletion or contract end; gallery visibility governed by settings | Manual / policy-driven |
| Payment records | 7 years | Immutable records (tax requirement) ⚖️ |
| Audit logs | 24 months | Scheduled archive/delete |
| Support tickets | 24 months after resolution | Scheduled |
| Leads | 12 months after last contact | Scheduled |
| Device telemetry | Latest snapshot only | Overwritten per heartbeat |
| Application logs | 30 days | Host log drain retention |
| Backups | 35 days (PITR window + snapshots) | Atlas policy |

### 4.5 Data location

Primary region is chosen for latency (India for Indian customers). Cross-border transfers occur when
sub-processors store data outside the customer's country. This must be disclosed in the privacy
policy and covered by the appropriate contractual clauses. ⚖️

---

## 5. Data subject requests

### 5.1 Who can ask

Guests (data subjects), tenant staff, and tenant admins acting on their organization's behalf.

### 5.2 Access / portability

| Request | Route | SLA |
|---|---|---|
| Guest wants their photos | Scan the QR again within 24 h, or contact the operator | Immediate (link) / 72 h via operator |
| Guest wants confirmation of processing | `privacy@happypix.in` | 30 days ⚖️ |
| Tenant wants an export of org data | Support request; export produced by engineering | 30 days |
| Staff wants their account data | `/api/auth/me` + support request | 30 days |

### 5.3 Deletion

| Request | Process | SLA |
|---|---|---|
| Guest photo deletion | Operator deletes the session in the CRM gallery, or support deletes by `sessionId`/`downloadId`; S3 objects removed | 7 days |
| Account deletion | Owner/Admin deactivates, then support performs hard delete after the retention check | 30 days |
| Organization deletion | Contract-end process: export → delete photos → delete tenant records (payments retained per law) | 30 days |

**Deletion is not instantaneous across backups.** Backups roll off in ≤ 35 days; a deletion request
is honoured in primary storage immediately and in backups by expiry. This must be stated in the
privacy policy. ⚖️

### 5.4 Correction

Profile fields are self-service (`PUT /api/auth/profile`). Business records (event names, prices)
are editable by the tenant. Audit logs and payment records are immutable by design — corrections are
recorded as new entries, not silent edits.

### 5.5 Objection / restriction

A guest may ask the operator not to publish their photo. The operator can delete the session;
`guestConsent` is stored per photo and gallery settings can require consent before visibility.

### 5.6 Request log

Every request is logged with: date received, requester, type, verification method, action taken,
date completed. Retain for 24 months as proof of compliance.

---

## 6. Photo privacy, consent and deletion

### 6.1 Consent at the booth

| Control | Behaviour |
|---|---|
| `requireGuestConsent` (platform gallery setting) | When on, a session's photos are only gallery-visible if the guest agreed |
| Consent capture | Booth success/details screen records `guestConsent: true` |
| Withdrawal | Guest tells the operator; the session is deleted |
| Children | Events with minors require the host's consent process; operators should display a notice |

### 6.2 Visibility rules

```
photoVisibleInGallery(photo, settings):
  if settings.requireGuestConsent and not photo.guestConsent → hidden
  if session marked deleted → hidden
  else → visible to the owning tenant (never public)
```

Photos are **never** public. Every read goes through a presigned URL with a short lifetime.

### 6.3 Public exposure surface (the only one)

The guest download page. Controls:

* 144-bit random `downloadId` (not sequential, not guessable);
* 24-hour TTL enforced in the database **and** checked in the handler;
* rate limiting per IP;
* no directory listing, no search, no indexable URLs (`noindex` on the download page);
* view/download counters to detect abnormal access.

### 6.4 Watermarking and screenshots

Optional watermarking is supported for previews. Downloads deliver the full-resolution composite.
We do not attempt DRM — a guest who can see a photo can screenshot it, and pretending otherwise
would be dishonest.

### 6.5 Deletion mechanics

```
CRM delete session
  → Photo documents removed (or flagged deleted)
  → S3 objects removed for url + compositeUrl + s3Key
  → GuestDownload record expires (TTL) or is removed
  → AuditLog entry written
```

Bulk deletion is restricted and audited. A "hold" flag on a support ticket prevents deletion while
an issue is open (`holdPhotos: true`).

---

## 7. Encryption and secure uploads

### 7.1 In transit

| Path | Control |
|---|---|
| Browser ↔ Vercel | TLS 1.2+ (HSTS) |
| Booth ↔ API | TLS 1.2+ |
| API ↔ Atlas | TLS required by the connection string |
| API ↔ S3 | HTTPS (SDK default) |
| Tablet ↔ print bridge (`:9123`) | **Plain HTTP on LAN** — accepted risk, documented |

### 7.2 At rest

| Store | Control |
|---|---|
| Atlas | Encryption at rest (provider-managed) |
| S3 | SSE-S3 (or SSE-KMS with a customer-managed key for enterprise) |
| Booth local cache | OS disk encryption recommended on kiosk PCs (BitLocker/FileVault) |
| Per-tenant gateway secrets | Application-level AES encryption before storage |
| Device tokens | SHA-256 hash only |
| User passwords | bcrypt (cost 10–12) |
| Backups | Provider-encrypted |

### 7.3 Uploads

| Path | Validation |
|---|---|
| Presigned PUT | Content-type restricted; size limited (15 MB); key namespaced by tenant |
| Direct data URL | Body limit 10 MB; decoded and re-encoded server-side where applicable |
| Template assets | Image type check; no SVG with scripts; no executable content |
| Support attachments (if enabled) | Type/size allowlist; stored private |

**Never** trust a client-provided URL for storage. Session completion validates that the object key
belongs to the tenant/session before recording it.

### 7.4 The S3 bucket

* Block Public Access: **ON**.
* Bucket policy: only the application IAM user, only this bucket.
* CORS restricted to the known origins.
* Versioning: optional (cost vs recoverability) — recommended on for templates.
* Lifecycle rules per the data-retention schedule.

---

## 8. Logging and monitoring

### 8.1 What is logged

| Event | Fields | Retention |
|---|---|---|
| HTTP request | method, path, status, duration, IP (truncated), user/device id | 30 days |
| Auth success/failure | email (hashed where possible), IP, user agent | 90 days |
| Authorization denial | actor, role, attempted route | 24 months (audit) |
| Business mutation | actor, entity, before/after summary | 24 months (audit) |
| Payment event | provider id, amount, status | 7 years (payments) |
| Device heartbeat | status, telemetry summary | latest only |
| Error | stack (server-side only), correlation id | 30 days |

### 8.2 What is never logged

* Passwords, tokens, secrets.
* Full presigned URLs (they grant access).
* Full card numbers or UPI VPAs of guests.
* Photo contents or base64 payloads.
* Guest phone/email in request-path logs.

### 8.3 Access to logs

Engineering and Support Lead only. Log access is itself audited through the hosting provider's
audit log.

### 8.4 Alerting

| Signal | Threshold | Channel |
|---|---|---|
| 5xx rate | > 2 % for 5 min | Chat + on-call |
| Auth failures | > 50/min from one IP | Chat |
| Payment failures | > 5 in 10 min | Chat + finance |
| S3 errors | > 1 % | Chat |
| Device offline | > 20 % of fleet | Chat |
| DB connection saturation | > 80 % | Chat + on-call |

---

## 9. Vulnerability management

### 9.1 Dependency hygiene

```bash
npm audit --omit=dev            # every app, weekly
npm outdated                    # review before any upgrade
```

Policy:

| Severity | Action | Deadline |
|---|---|---|
| Critical | Patch or mitigate immediately | 24 h |
| High | Patch | 7 days |
| Medium | Next release | 30 days |
| Low | Backlog | 90 days |

Exceptions must be documented with a compensating control and an expiry date.

### 9.2 Application security checklist (per release)

- [ ] No new endpoint without auth + permission + tenant scoping
- [ ] All user input validated and length-clamped
- [ ] No secrets in the diff (`git diff | grep -Ei 'secret|token|password|AKIA'`)
- [ ] No new `dangerouslySetInnerHTML` with user data
- [ ] Rate limit added for any new public or expensive endpoint
- [ ] Upload validation unchanged or strengthened
- [ ] Webhook signature verification intact

### 9.3 Testing

| Test | Frequency |
|---|---|
| Tenant isolation attempts (org A reading org B) | Every release (manual + planned automated) |
| Role matrix parity | CI |
| Webhook signature rejection | CI / manual |
| Correlation: expired download returns 410 | CI |
| Payment tampering (client-sent amount ignored) | Manual, each payment change |

### 9.4 Responsible disclosure

```
security@happypix.in  (PGP key on request)
```

We acknowledge within 48 h, provide a remediation timeline, and will not pursue legal action against
good-faith researchers who avoid privacy violations, data destruction and service disruption.

### 9.5 Known gaps (tracked, not hidden)

| Gap | Impact | Plan |
|---|---|---|
| No MFA for org users | Credential-stuffing risk | Phase 2 |
| No automated tenant-isolation test suite | Regression risk | Add to CI |
| Print bridge unauthenticated | LAN exposure | Optional shared-secret mode |
| No WAF | Volumetric attacks | Vercel/Cloudflare rules |
| No formal pen test | Unknown unknowns | Before enterprise sales |

---

## 10. Incident response

### 10.1 Severity

| Sev | Definition | Examples | Response |
|---|---|---|---|
| **S1** | Data breach, payment compromise, total outage | Photo bucket public, DB leaked, all payments failing | Immediate, all hands, notify within 24 h |
| **S2** | Major feature down, tenant blocked | Booth pairing failing, downloads broken for all | 30 min |
| **S3** | Degraded or single-tenant issue | One org cannot print, slow dashboard | 4 h business hours |
| **S4** | Minor / cosmetic | Misaligned footer on one template | Next release |

### 10.2 Process

```
Detect → Triage (severity) → Contain → Eradicate → Recover → Review
```

**Detect:** alert, customer report, or internal observation.
**Triage:** assign severity; name an incident lead; open a private channel.
**Contain:** revoke credentials, disable a route, roll back a deployment, block an IP, suspend a
tenant. Containment beats root-cause analysis.
**Eradicate:** fix the cause, not just the symptom.
**Recover:** restore service, verify with the post-release checks.
**Review:** blameless post-mortem within 5 business days for S1/S2.

### 10.3 First 30 minutes (S1)

- [ ] Incident lead named; channel opened
- [ ] Affected systems identified
- [ ] Credentials rotated if exposure is suspected
- [ ] Public surface contained (bucket policy, route disabled, deployment rolled back)
- [ ] Extent estimated: which tenants, which data, how many records
- [ ] Legal/owner informed
- [ ] Evidence preserved (logs, snapshots) before cleanup

### 10.4 Notification

| Audience | When | Who |
|---|---|---|
| Affected tenants | Within 24 h of confirmation | Owner/Support |
| Data protection authority | Per applicable law (e.g. 72 h under GDPR) ⚖️ | Owner + counsel |
| Payment provider | Immediately if payment data is involved | Engineering |
| Regulator / cyber authority | As required by local law ⚖️ | Owner |

Notification content: what happened, when, what data, what we did, what the customer should do
(password reset, watch for phishing), and a contact.

### 10.5 Post-mortem template

```markdown
## Incident <id> — <title>
- Severity / duration / tenants affected
- Timeline (UTC, every significant action)
- Root cause
- Detection: how did we find out? (alert vs customer)
- What went well / what went badly
- Action items with owner + due date (each must be tracked)
- Customer communication sent (copy)
```

---

## 11. Account access and revocation

### 11.1 Offboarding checklist

| Step | Where | Timing |
|---|---|---|
| Deactivate CRM user | CRM → Team | Same day, before end of last working day |
| Revoke GitHub access | GitHub org | Same day |
| Revoke Vercel access | Vercel team | Same day |
| Revoke Atlas access | Atlas org | Same day |
| Rotate shared secrets the person had access to | Vercel + providers | Within 24 h |
| Remove from AWS IAM (if applicable) | AWS | Same day |
| Recover hardware (laptop, phone, YubiKey) | — | Last day |
| Confirm device tokens the person knew are not reused | — | If applicable |

**Note:** deactivating a user sets `status: inactive`, which the auth middleware checks on every
request. Existing JWTs are not force-revoked but expire within 8 hours. For immediate revocation,
rotate `JWT_SECRET` (signs everyone out) or add the user's `sub` to a denylist if implemented.

### 11.2 Device revocation

| Situation | Action | Effect |
|---|---|---|
| Booth sold/transferred | Delete device in CRM | `410 DEVICE_DELETED`; app wipes |
| Booth compromised | Block device | `403 DEVICE_BLOCKED` |
| Booth replaced | Delete old, pair new | Old device cannot upload |
| Tablet stolen | Block + delete | No further sessions; existing photos stay with the tenant |

Deleted device tokens cannot be re-used because the hash no longer matches any record. The app
generates a new `deviceUuid` after a wipe, producing a new pairing.

### 11.3 Tenant suspension vs deletion

| Action | Data | Reversible |
|---|---|---|
| Suspend | Retained, reads allowed, writes blocked | Yes |
| Ban | Retained, login refused | Yes (Owner) |
| Delete | Photos and tenant records removed; payments retained | No |

---

## 12. Legal and compliance

> ⚖️ Everything in this section is an engineering summary. The published legal documents govern.

### 12.1 India — Digital Personal Data Protection Act, 2023

| Obligation | How HappyPix addresses it |
|---|---|
| Notice and consent | Booth consent capture; privacy notice linked on the website and booth entry |
| Purpose limitation | Photos used only for the guest's session and delivery |
| Data minimisation | No guest account, no ID, no tracking |
| Retention limitation | 24 h download TTL; documented gallery retention |
| Data principal rights | Access, correction, erasure, grievance redressal (§5) |
| Security safeguards | Encryption, RBAC, audit, incident response |
| Breach notification | Incident process (§10) with authority notification |
| Consent manager / children's data | Requires counsel review for events with minors ⚖️ |

### 12.2 EU/UK — GDPR (if serving those markets)

| Requirement | Status |
|---|---|
| Lawful basis documented | Consent for photos; contract for accounts |
| Data Processing Agreement with tenants | Required template — ⟨to be drafted with counsel⟩ |
| Records of processing | This document + data inventory (§4) |
| DPO appointment | Assess whether required by scale ⚖️ |
| International transfer mechanism | SCCs with sub-processors ⚖️ |
| 72-hour breach notification | Covered by §10.4 |
| Right to erasure | §5.3 (with backup caveat) |

### 12.3 Payment compliance

| Item | Position |
|---|---|
| Card data | Never touches HappyPix servers; Razorpay/Cashfree hosted checkout or UPI intent |
| PCI DSS | Scope minimised by using tokenised gateways; no SAQ-D obligation expected, but a self-assessment is required ⚖️ |
| Refunds | Processed through the gateway by Finance; recorded in `payments` |
| GST | 18 % applied to subscriptions; invoices generated from subscription records |
| Chargebacks | Evidence pack: session id, payment reference, timestamp, device |

### 12.4 App-store requirements

| Store | Requirement | Status |
|---|---|---|
| Google Play | Privacy policy URL, data safety form, permission justification (camera, storage) | ⟨prepare before submission⟩ |
| Google Play | Kiosk apps may use managed configurations; device-owner provisioning is not a store feature | Documented for managed deployment |
| Apple App Store | iOS app does not exist yet; would need camera/photo usage descriptions and a privacy manifest | Future work |

### 12.5 Breach notification summary

| Regime | Deadline | To whom |
|---|---|---|
| India DPDP | "Without delay" to the Data Protection Board and affected principals ⚖️ | Board + individuals |
| GDPR | 72 hours after awareness | Supervisory authority; individuals if high risk |
| Contractual | Per customer agreement (often 24–48 h) | Tenant |
| Payment provider | Immediately | Razorpay/Cashfree |

---

## 13. Policies, terms and contact

### 13.1 Published documents (required before public launch)

| Document | URL (intended) | Status |
|---|---|---|
| Privacy Policy | `https://happypix.in/privacy` | ⟨draft with counsel⟩ |
| Terms of Service | `https://happypix.in/terms` | ⟨draft with counsel⟩ |
| Refund & Cancellation Policy | `https://happypix.in/refunds` | ⟨draft with counsel⟩ |
| Data Processing Agreement (B2B) | provided on request | ⟨draft with counsel⟩ |
| Security page | `https://happypix.in/security` | ⟨optional⟩ |
| Cookie notice | `https://happypix.in/cookies` | ⟨if analytics/cookies are added⟩ |

The website currently ships marketing and pricing pages; these legal routes must exist before taking
public payments at scale.

### 13.2 Internal policies recommended

| Policy | Owner | Cadence |
|---|---|---|
| Access control policy | Security Officer | Annual review |
| Incident response plan | Security Officer | After every S1/S2 |
| Backup & recovery policy | Engineering Lead | Annual + after DR drill |
| Vendor risk review | Founder | On new vendor + annual |
| Secure development standard | Engineering Lead | Annual |
| Retention & deletion schedule | Security Officer | Annual |

### 13.3 Contacts

| Purpose | Address |
|---|---|
| Security reports | `security@happypix.in` |
| Privacy / data requests | `privacy@happypix.in` |
| Support | `support@happypix.in` |
| Grievance officer (India) ⚖️ | ⟨name + address to be published⟩ |

### 13.4 Sign-off

| Area | Accountable | Date |
|---|---|---|
| Engineering controls | ⟨Engineering Lead⟩ | |
| Data protection | ⟨Security Officer⟩ | |
| Legal review | ⟨Counsel⟩ | |

---

*Next: [`OPERATIONS.md`](OPERATIONS.md) for the operational side of incidents, or
[`HANDOVER_REGISTER.xlsx`](../business/HANDOVER_REGISTER.xlsx) for credentials and vendor ownership.*
