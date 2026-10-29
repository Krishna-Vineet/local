"""End-to-end flows, lifecycle state machines, environment contract and error catalogue."""

# ── Narrative flows: numbered steps, each (actor, action, system result) ─────
FLOWS = [
    {
        "id": "f0",
        "title": "The total HappyPix flow — one session, end to end",
        "summary": "From a guest walking up to a booth to the money landing in an organisation's account. Every other "
                   "flow in this document is a detail of one of these steps.",
        "steps": [
            ("Organisation", "Buys a plan on the website → POST /api/platform/plans subscription via Razorpay → "
                             "Subscription row, org limits and expiry are set.",
             "Organization.allowedDevices / allowedEvents / planExpiresAt are written; every booth of the tenant gets a "
             "new snapshot revision."),
            ("Organisation", "Creates an event in the CRM → POST /api/org/events with dates, templates, prices, branding.",
             "Event(status=live), price table resolved, plan-active-event slot consumed."),
            ("Booth", "Pairs itself → POST /api/booth/login with org credentials + deviceUuid.",
             "Device row (token hash only), first snapshot returned, revision issued."),
            ("Booth", "Runs for hours: GET /api/booth/revision, POST /api/booth/heartbeat every few minutes.",
             "Hardware telemetry merged; snapshot resent only when the revision changed."),
            ("Guest", "Chooses a layout and print count on the kiosk.",
             "Booth UI only — no network yet."),
            ("Booth", "Takes the photos, composites the strip locally, posts POST /api/booth/checkout/quote.",
             "Authoritative price returned with a 5-minute expiry, coupon applied, settlement resolved."),
            ("Guest", "Scans the UPI QR or the payment link.",
             "POST /api/booth/payments creates Payment(pending) + gateway order + QR."),
            ("Booth", "Polls GET /api/booth/payments/:id every ~3 s.",
             "The gateway is queried directly; on success the row becomes paid and the coupon is counted once."),
            ("Booth", "Prints locally, then asks for upload targets: POST /api/booth/sessions/upload-urls.",
             "Up to 30 presigned PUT URLs — the heavy bytes never touch the API."),
            ("Booth", "PUTs frames + composite straight to S3, then POST /api/booth/sessions/complete.",
             "One Photo row per file, composite attached to every row, guest consent recorded, GuestDownload created "
             "(24 h) and a shareUrl returned."),
            ("Guest", "Success screen shows the QR → /download/<id>.",
             "GET /api/downloads/:id signs S3 URLs; the page streams the composite and frames."),
            ("Guest", "Optionally sends it to WhatsApp / email / SMS.",
             "POST /api/share/deliver → DeliveryService → provider, one DeliveryRecord."),
            ("Guest", "Raises an issue after a successful session.",
             "POST /api/booth/support → SupportTicket with holdPhotos=true, visible to the organisation instantly."),
            ("Organisation", "Sees the session in the gallery and the money in revenue.",
             "GET /api/org/gallery (signed URLs), GET /api/org/revenue (matrix + transactions)."),
            ("Organisation", "Withdraws the wallet balance.",
             "POST /api/org/wallet/withdraw → Withdrawal(processing), settled manually by HappyPix."),
            ("HappyPix", "Hourly cron expires plans and purges stale uploads.",
             "POST /api/cron/check-expirations with CRON_SECRET → expired orgs, cleaned local files."),
        ],
        "diagram": """flowchart LR
  subgraph guest [Guest]
    G1[Walk up] --> G2[Pick layout + prints]
    G2 --> G3[Pose]
    G3 --> G4[Pay by UPI]
    G4 --> G5[Take print]
    G5 --> G6[Scan QR for digital copy]
  end
  subgraph booth [Booth app]
    B1[Quote] --> B2[Payment order]
    B2 --> B3[Poll status]
    B3 --> B4[Upload frames + composite]
    B4 --> B5[Session complete]
  end
  subgraph api [HappyPix API]
    A1[/api/booth/checkout/quote/] --> A2[/api/booth/payments/]
    A2 --> A3[/api/booth/payments/:id/]
    A3 --> A4[/api/booth/sessions/upload-urls/]
    A4 --> A5[/api/booth/sessions/complete/]
    A5 --> A6[/api/downloads/:id/]
  end
  G2 --> B1
  G4 --> B2
  B2 --> A2
  B3 --> A3
  B4 --> A4
  B5 --> A5
  G6 --> A6
  A3 --> PG[(Razorpay / Cashfree)]
  A4 --> S3[(S3 bucket)]
  A5 --> DB[(MongoDB Atlas)]
  A1 --> DB""",
    },
    {
        "id": "f1",
        "title": "Booth pairing and configuration sync",
        "summary": "How a kiosk becomes a trusted device, and how configuration changes reach it without a socket.",
        "steps": [
            ("Booth", "POST /api/booth/login {email, password, deviceUuid, platform, appVersion}",
             "Organisation credentials checked; banned/suspended refused; device limit enforced with "
             "planService.assertDeviceLimit."),
            ("API", "Creates or updates the Device, generates hp_dev_… token, stores only its SHA-256.",
             "The raw token is returned exactly once in the response."),
            ("API", "buildBoothSnapshot() → branding, event, templates with prices, timeouts, gallery policy.",
             "Snapshot + revision returned with serverTime for clock-skew correction."),
            ("Booth", "Persists the snapshot locally and runs entirely from it.",
             "No network needed for capture, filtering or composition."),
            ("Booth", "Every N minutes: POST /api/booth/heartbeat {knownRevision, hardwarePatch}.",
             "Server compares revisions; unchanged → snapshot null (a few hundred bytes)."),
            ("Organisation", "Edits an event, prices, defaults or the platform changes the gallery policy.",
             "Writes bump the tenant's revision counter, so the next heartbeat returns changed:true."),
            ("Booth", "Applies the new snapshot between sessions — never mid-session.",
             "Session data is always consistent with the snapshot it started under."),
        ],
        "diagram": """sequenceDiagram
  autonumber
  participant B as Booth app
  participant A as /api/booth
  participant D as MongoDB
  B->>A: POST /login (email, password, deviceUuid)
  A->>D: find User + Organization + Device
  A->>D: upsert Device (sha256 token)
  A->>D: build snapshot (event, templates, prices, policy)
  A-->>B: installation{token} + snapshot{revision}
  B->>B: cache snapshot, operate offline
  loop every few minutes
    B->>A: POST /heartbeat (knownRevision, hardware)
    alt revision unchanged
      A-->>B: changed=false, snapshot=null
    else revision changed
      A-->>B: changed=true, full snapshot
      B->>B: apply between sessions
    end
  end
  Note over A,B: blocked / deleted / suspended returns a state code,<br/>never a silent success""",
    },
    {
        "id": "f2",
        "title": "Guest payment — quote, order, poll, money",
        "summary": "Two gateways, two settlement modes, one idempotent paid transition.",
        "steps": [
            ("Booth", "POST /api/booth/checkout/quote {prints, templateId, couponCode}",
             "resolveTemplateUnitPrice() walks event → organisation defaults → platform. Coupon applied. 5-minute quote."),
            ("Booth", "POST /api/booth/payments {quote}",
             "Payment(pending) created; gateway chosen by event override → org defaults → gatewayPriority."),
            ("API", "Razorpay: order + fixed-amount UPI QR. Cashfree: order + QR payload.",
             "qrPayload and/or qrImageUrl returned; payee from event.upiId → defaults.upiId → PLATFORM_FALLBACK_UPI."),
            ("Guest", "Pays in any UPI app.",
             "Money moves directly to the organisation's VPA when settlement=upi; otherwise it lands in HappyPix's "
             "account and counts as wallet."),
            ("Booth", "GET /api/booth/payments/:id in a loop.",
             "Server asks the gateway (QR payments, link status, captured payments on the order)."),
            ("API", "First observation of success → status=paid, paidAt, coupon counted once.",
             "A later poll or a webhook finds status already paid and changes nothing."),
            ("Booth", "Proceeds to print and to the session upload.",
             "A failure path (payment failed) returns the booth to the payment screen with the gateway error."),
        ],
        "diagram": """flowchart TD
  Q[Quote: authoritative price] --> P{finalAmount}
  P -->|0| F[free-complete:<br/>Payment paid, settlement wallet]
  P -->|&gt;0| G{Gateway priority}
  G -->|razorpay| R1[Create order + fixed UPI QR]
  G -->|cashfree| C1[Create order + QR payload]
  R1 --> W[Guest pays]
  C1 --> W
  R1 -->|gateway error| FB[Cashfree fallback]
  FB --> C1
  C1 -->|gateway error| L[Payment link fallback]
  L --> W
  W --> POLL[Poll /payments/:id]
  POLL -->|gateway says paid| PAID[status=paid<br/>coupon counted once]
  POLL -->|still pending| WAIT[retry after 3 s]
  WAIT --> POLL
  POLL -->|failed| FAIL[status=failed<br/>booth returns to payment]
  W -->|cash or offline UPI| UTR[POST /payments/:id/confirm with 12-digit UTR]
  UTR --> PAID
  PAID --> SESS[Session upload]""",
    },
    {
        "id": "f3",
        "title": "Session finalisation — the composite guarantee",
        "summary": "The rule established for this codebase: the final composited frame is stored with the individual "
                   "frames, and the guest link never depends on a single upload succeeding.",
        "steps": [
            ("Booth", "Composites the strip locally before asking for upload targets.",
             "The composite is a real file, not a URL to be built later."),
            ("Booth", "POST /api/booth/sessions/upload-urls {sessionId, files[{type:'frame'|'composite', index}]}",
             "Presigned PUTs (900 s) with deterministic keys: "
             "photos/<orgId>/<eventId>/<sessionId>-<type>[-index]-<ts>-<rand>.<ext>."),
            ("Booth", "PUTs every file to S3 in parallel.",
             "No API bandwidth used; a 30 MB session costs one API call."),
            ("Booth", "POST /api/booth/sessions/complete {sessionId, photos[], composite, guestConsent, digitalCopy}",
             "Each input is normalised: object {key,url}, plain URL, S3 key or data URL (persisted to S3 when possible)."),
            ("API", "Writes one Photo per file, copying compositeUrl onto every row.",
             "Any single row can therefore serve the gallery and the download."),
            ("API", "Applies the global gallery policy and consent.",
             "galleryPhotoIds lists what is published; the rest is stored but private."),
            ("API", "Creates a GuestDownload (24 h) and returns shareUrl.",
             "downloadUrl is returned even if the download row fails — the success screen always has a QR."),
            ("Guest", "Opens /download/<id>.",
             "GET /api/downloads/:id → signed S3 URLs; /:id/file/composite streams the print."),
        ],
        "diagram": """sequenceDiagram
  autonumber
  participant B as Booth
  participant A as API
  participant S as S3
  participant D as MongoDB
  B->>A: POST /sessions/upload-urls
  A-->>B: presigned PUTs (frame[], composite)
  B->>S: PUT each frame
  B->>S: PUT composite
  B->>A: POST /sessions/complete
  A->>D: Photo rows (one per file)
  A->>D: compositeUrl copied to every row
  A->>D: gallery policy + consent applied
  A->>D: GuestDownload (24 h)
  A-->>B: shareUrl + downloadId + galleryPhotoIds
  Note over A,S: if S3 is unset, data URLs are stored inline (25 MB cap)<br/>and signed URL helpers pass them through unchanged""",
    },
    {
        "id": "f4",
        "title": "Gallery, download and sharing — who may see what",
        "summary": "Three surfaces, three policies, one predicate (photoVisibleInGallery).",
        "steps": [
            ("Organisation", "GET /api/org/gallery → rows grouped by session, composite preferred.",
             "photoUrlService returns BOTH a signed S3 URL (1 h) and an asset-proxy URL, because a page can outlive "
             "the signature."),
            ("Organisation", "GET /api/org/gallery/photo/:id/view?kind=composite",
             "Streams bytes with server credentials, or redirects to a signed URL."),
            ("Guest", "GET /api/downloads/:id (24 h, 300 req / 15 min)",
             "TTL row + explicit expiry check; viewCount increments."),
            ("Guest", "POST /api/share/generate → token → /share/<token> (default 7 days)",
             "PhotoShare tokenHash, event branding, sharingConfig honoured."),
            ("Guest", "POST /api/share/deliver {method, destination}",
             "DeliveryService sends and writes a DeliveryRecord with the destination masked."),
            ("Platform", "PUT /api/platform/gallery-settings {galleryEnabled, requireGuestConsent}",
             "Global Setting row; 15-second cache; every booth gets the new revision."),
        ],
        "diagram": """flowchart TD
  P[(Photo row)] --> POL{Global gallery policy}
  POL -->|galleryEnabled=false| HIDDEN[Stored, never published]
  POL -->|requireGuestConsent=true| C{guestConsent}
  C -->|false| HIDDEN
  C -->|true| VIS[Visible in gallery]
  POL -->|no consent needed| VIS
  VIS --> GAL[/api/org/gallery<br/>signed URL + proxy/]
  VIS --> DL[/api/downloads/:id<br/>24 hours/]
  VIS --> SH[/api/share/:token<br/>7 days default/]
  DL --> FILES[/api/downloads/:id/file/:kind/]
  SH --> DEL[/api/share/deliver/] --> REC[(DeliveryRecord)]
  HIDDEN --> NONE[Not reachable from any public link]""",
    },
    {
        "id": "f5",
        "title": "Issue raised after a successful session",
        "summary": "The booth-side escalation that closes the loop on a bad print, a missing photo or a payment "
                   "dispute — and protects the photos while it is open.",
        "steps": [
            ("Guest", "Taps 'Report an issue' on the success screen.",
             "The booth still holds sessionId and payment reference from the session it just completed."),
            ("Booth", "POST /api/booth/support {sessionId, category, message, paymentReference}",
             "SupportTicket(ticketType=end_user) written with organisation, event and device context, "
             "holdPhotos=true."),
            ("Organisation", "GET /api/org/tickets → sees it immediately.",
             "Counts, priority and full context (event, booth, session, payment)."),
            ("Organisation", "POST /api/org/tickets/:id/reply, then /resolve.",
             "Thread is internal-facing; the guest is contacted out of band unless the platform replies."),
            ("Platform", "GET /api/platform/support → triage, reply (sends email), resolve or delete.",
             "A platform reply on a guest ticket pushes the photo hold another 24 hours."),
            ("Guest", "Reopens if unresolved within 30 days.",
             "POST /api/org/tickets/:id/reopen / platform equivalent."),
        ],
        "diagram": """stateDiagram-v2
  [*] --> open: booth or website creates ticket
  open --> in_progress: reply on the thread
  in_progress --> resolved: resolve with note
  resolved --> open: reopen
  resolved --> closed: 30-day auto close
  closed --> open: reopen
  note right of open
    holdPhotos=true keeps the
    guest's photos past the 24 h link
  end note""",
    },
    {
        "id": "f6",
        "title": "Escalation to HappyPix (organisation → platform)",
        "summary": "A separate document and a separate lifecycle from guest tickets: accept-and-number, or "
                   "deny-with-a-reason that can be re-applied.",
        "steps": [
            ("Organisation", "POST /api/org/platform-support {subject, category, priority, message, images}",
             "PlatformSupportRequest(status=new), ticketNo null."),
            ("Platform", "POST /api/platform/support/:id/accept",
             "ticketNo minted, status open, acceptedAt set."),
            ("Platform", "POST /api/platform/support/:id/deny {reason}",
             "status denied with the decision text; the organisation may re-apply."),
            ("Organisation", "POST /api/org/platform-support/:id/reapply",
             "reapplyCount+1, ticketNo cleared, decision cleared, message kept, status new."),
            ("Both", "reply / resolve on the shared thread until resolved.",
             "Messages keep authorName/authorRole/side so the thread renders correctly on both sides."),
        ],
        "diagram": """stateDiagram-v2
  [*] --> new: organisation raises request
  new --> open: platform accepts (ticket number minted)
  new --> denied: platform denies with reason
  denied --> new: organisation re-applies
  open --> in_progress: either side replies
  in_progress --> resolved: platform resolves
  resolved --> in_progress: reopened""",
    },
    {
        "id": "f7",
        "title": "Sign-in, session revocation and tenant lock",
        "summary": "The three things that must be true at once: a valid token, a live user, a healthy tenant.",
        "steps": [
            ("User", "POST /api/auth/login {email, password}",
             "bcrypt check, lastLoginAt, JWT {id, role, organizationId, ver} 12 h, HttpOnly cookie."),
            ("User", "GET /api/auth/me on every page load",
             "Recomputed permissions, live plan, readOnly flag and suspension notice."),
            ("Platform", "Bans or suspends a tenant (or an admin signs out / changes a password)",
             "bumpSessionVersion → every token's ver no longer matches → 401 SESSION_REVOKED."),
            ("API", "authenticate() on the next request",
             "Banned → 403 ORG_BANNED and the bump is repeated; suspended → read-only, writes get 403 ORG_SUSPENDED."),
        ],
        "diagram": """flowchart TD
  R[Request] --> T{Token?}
  T -->|cookie / bearer / query| V[Verify HS256]
  T -->|none| E401[401 UNAUTHENTICATED]
  V -->|expired| E401b[401 TOKEN_EXPIRED]
  V -->|bad signature| E401c[401 BAD_TOKEN]
  V -->|valid| U[Load user]
  U --> S{ver == sessionVersion?}
  S -->|no| E401d[401 SESSION_REVOKED]
  S -->|yes| ST{user.status active?}
  ST -->|no| E403a[403 ACCOUNT_DEACTIVATED]
  ST -->|yes| O{organizationId?}
  O -->|null| OK[Platform staff context]
  O -->|set| L[Load organisation]
  L -->|missing| E403b[403 ORG_MISSING]
  L -->|banned| E403c[403 ORG_BANNED + bump]
  L -->|suspended| RO[Read-only context]
  L -->|active| OK2[Tenant context]
  RO --> P{Route writes?}
  P -->|yes| E403d[403 ORG_SUSPENDED]
  P -->|no| OK2""",
    },
    {
        "id": "f8",
        "title": "Plan lifecycle, expiry and the hourly sweep",
        "summary": "How a tenant moves from trial to paid to expired, and what breaks at each step.",
        "steps": [
            ("Website", "Trial signup → trial plan: 1 booth, 1 event, 10 AI credits.",
             "planStatus=trial, trialEndsAt set."),
            ("Website", "Checkout → Razorpay → Subscription + org limits.",
             "allowedDevices / allowedEvents / planExpiresAt updated; booths get a new revision."),
            ("Cron", "Every hour: POST /api/cron/check-expirations with CRON_SECRET.",
             "CronService marks lapsed trials and plans expired and closes subscriptions."),
            ("API", "Booth calls after expiry → 402 PLAN_EXPIRED.",
             "The kiosk stops taking money but keeps showing the renewal screen."),
            ("Platform", "PUT /api/platform/organizations/:id → extend dates or change plan.",
             "Limits propagate immediately; support can grant a trial extension."),
        ],
        "diagram": """stateDiagram-v2
  [*] --> trial: self-serve signup
  trial --> active: subscription paid
  trial --> expired: trialEndsAt passed (cron)
  active --> expired: planExpiresAt passed (cron)
  active --> suspended: platform suspends
  suspended --> active: restored
  active --> banned: platform bans
  banned --> active: restored
  expired --> active: renewal
  note right of expired
    Booths answer 402 PLAN_EXPIRED.
    CRM becomes read-only for writes.
  end note""",
    },
    {
        "id": "f9",
        "title": "Revenue, settlement and payout",
        "summary": "Two settlement modes, one revenue ledger, a manual payout step.",
        "steps": [
            ("Guest", "Pays a booth.",
             "Payment.settlement is 'upi' when the money went to the organisation's VPA, 'wallet' when HappyPix holds it."),
            ("Organisation", "GET /api/org/revenue?from&to&eventId&deviceId",
             "Totals, month split, event×booth matrix, by-event, by-booth, by-status, 200 latest transactions."),
            ("Organisation", "POST /api/org/wallet/withdraw {amount}",
             "Minimum ₹500, payoutMode must be upi with a valid VPA; Withdrawal(processing)."),
            ("HappyPix", "Settles manually and marks the withdrawal paid with a bank reference.",
             "Wallet balance reflects reserved + withdrawn amounts."),
            ("Platform", "GET /api/platform/revenue",
             "Same shape widened across tenants, plus org breakdown and gateway split."),
        ],
        "diagram": """flowchart LR
  G[Guest payment] --> S{settlement}
  S -->|upi| ORG[Organisation VPA<br/>money never touches HappyPix]
  S -->|wallet| HP[HappyPix account]
  ORG --> REV[/api/org/revenue/]
  HP --> WAL[Wallet balance]
  WAL --> WD[/api/org/wallet/withdraw/]
  WD --> WDR[(Withdrawal processing)]
  WDR --> MANUAL[Manual bank transfer]
  MANUAL --> PAID[Withdrawal paid]
  REV --> MATRIX[Event × booth matrix]
  PAID --> MATRIX""",
    },
    {
        "id": "f10",
        "title": "AI template generation and background removal",
        "summary": "Five credits per design, one per cutout, debited only after the provider succeeds.",
        "steps": [
            ("Organisation", "POST /api/org/ai-generate {prompt, layout, currentDesign?} (20 req / 15 min).",
             "PromptClassifier picks generate vs patch; TemplateGenerationService calls Groq and the image provider."),
            ("API", "On success: debit 5 AI credits from Organization.aiCredits.",
             "403 INSUFFICIENT_AI_CREDITS with balance + required before any provider call."),
            ("Organisation", "POST /api/org/ai-templates {layout, design, price}",
             "OrgAiTemplate saved and price mirrored into OrganizationDefaults.templatePrices; booth revision bumped."),
            ("Organisation", "POST /api/org/remove-bg {image}",
             "1 credit after success; the cutout is stored and returned for use in a design."),
        ],
        "diagram": """flowchart LR
  P[Prompt] --> C[PromptClassifier]
  C -->|generate| T[TemplateGenerationService]
  C -->|patch| T
  T --> L[Groq LLM]
  T --> I[Image provider<br/>Together / xAI]
  L --> D[Design tree]
  I --> A[Assets]
  D --> CR{credits ≥ 5?}
  A --> CR
  CR -->|no| E[403 INSUFFICIENT_AI_CREDITS]
  CR -->|yes| DEB[Debit 5, return design]
  DEB --> SAVE[/api/org/ai-templates/]
  SAVE --> SNAP[Booth snapshot revision++]""",
    },
]

# ── Request lifecycle diagram (middleware chain) ─────────────────────────────
REQUEST_LIFECYCLE = """flowchart TD
  REQ([Incoming request]) --> H[Security headers]
  H --> RL[globalLimiter<br/>1200 / 15 min / IP]
  RL --> COR[CORS allowlist]
  COR --> ORGCHK{Origin allowed?}
  ORGCHK -->|no| F403[403 CORS_FORBIDDEN]
  ORGCHK -->|yes| BODY[express.json 50 MB<br/>+ rawBody capture]
  BODY --> CK[cookieParser]
  CK --> STATIC["/uploads static"]
  STATIC --> LOG[request logger]
  LOG --> MONGO{Mongo connected?}
  MONGO -->|no| E503[503 Database unavailable]
  MONGO -->|yes| ROUTE{Route match}
  ROUTE -->|/api/auth login| PUB[public handler]
  ROUTE -->|/api/booth| DEV[device auth<br/>strict / soft / optional]
  ROUTE -->|/api/org, /api/platform| JWT[authenticate → authorize → requirePerm → requireWritableOrg]
  ROUTE -->|/api/downloads, /api/share| PUBRL[public + per-IP limiter]
  JWT --> H2[handler]
  DEV --> H2
  PUB --> H2
  PUBRL --> H2
  H2 --> SVC[service layer]
  SVC --> MOD[(Mongoose models)]
  SVC --> EXT[external: S3, gateways, mail, SMS, AI]
  H2 --> ERR{threw?}
  ERR -->|HttpError| OUT[status + code + message]
  ERR -->|other| E500[500 masked message, real error logged]
  MOD --> OUT
  EXT --> OUT"""

# ── Route → service → model dependency map ───────────────────────────────────
DEPENDENCY_MAP = """flowchart LR
  subgraph routers [Routers]
    R1[crm/auth.js]
    R2[crm/org.js]
    R3[crm/platform.js]
    R4[boothRoutes.js]
    R5[paymentRoutes.js]
    R6[downloadRoutes.js]
    R7[photoShareRoutes.js]
    R8[eventRoutes.js]
  end
  subgraph services [Services]
    S1[boothSnapshot]
    S2[eventService]
    S3[couponService]
    S4[gallerySettings]
    S5[guestDownload]
    S6[photoUrl]
    S7[planService]
    S8[DeliveryService]
    S9[TemplateGeneration]
    S10[CronService]
  end
  subgraph utils [Utils]
    U1[s3]
    U2[crypto]
    U3[auditLogger]
    U4[printHelper]
  end
  subgraph data [Models]
    M1[(Organization)]
    M2[(User)]
    M3[(Event)]
    M4[(Device)]
    M5[(Photo)]
    M6[(Payment)]
    M7[(Coupon)]
    M8[(Setting)]
  end
  R1 --> M2
  R1 --> U3
  R2 --> S2
  R2 --> S3
  R2 --> S4
  R2 --> S6
  R2 --> S7
  R2 --> S9
  R2 --> U1
  R3 --> S7
  R3 --> S4
  R3 --> U3
  R4 --> S1
  R4 --> S3
  R4 --> S4
  R4 --> S5
  R4 --> U1
  R4 --> U2
  R5 --> M6
  R5 --> U2
  R5 --> U4
  R6 --> S5
  R6 --> S6
  R7 --> S8
  R8 --> S2
  S1 --> M3
  S1 --> M4
  S1 --> M8
  S2 --> M3
  S5 --> M5
  S7 --> M1
  S10 --> M1
  U1 --> EXT[(S3)]
  S8 --> EXT2[(Twilio / SendGrid / WhatsApp)]
  S9 --> EXT3[(Groq / Together / xAI)]"""

# ── Authentication matrix diagram ────────────────────────────────────────────
AUTH_MATRIX = """flowchart LR
  subgraph human [Human authentication]
    L[POST /api/auth/login] --> J[JWT HS256 12 h]
    J --> C[HttpOnly cookie hp_admin_token]
    J --> B[Authorization: Bearer]
    J --> Q[?token= for file links]
  end
  subgraph machine [Booth authentication]
    P[POST /api/booth/login] --> T[hp_dev_… token<br/>shown once]
    T --> H1[x-device-token header]
    T --> H2[Authorization: Device …]
    U[x-device-uuid] --> H1
    U --> H2
  end
  C --> G1[authenticate]
  B --> G1
  Q --> G1
  H1 --> G2[authenticateDevice / soft / optional]
  H2 --> G2
  G1 --> P1[req.user, req.permissions,<br/>req.organization, req.orgReadOnly]
  G2 --> P2[req.device, req.organization,<br/>req.deviceAuth.state]
  P1 --> RLS[Tenant isolation via organizationId]
  P2 --> RLS
  RLS --> FAIL["getOrgFilter fails closed:<br/>organizationId:null, never an empty filter"]"""

# ── Environment contract ─────────────────────────────────────────────────────
ENV_VARS = [
    ("MONGODB_URI", "required", "Atlas connection string. Boot refuses to start without it."),
    ("JWT_SECRET", "required", "HS256 signing key. No fallback anywhere — a missing secret throws at sign and verify."),
    ("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET", "required", "Platform-level Razorpay credentials; also used for subscriptions."),
    ("RAZORPAY_WEBHOOK_SECRET", "required for webhooks", "HMAC over the raw body. Unset means every webhook is a 500."),
    ("CASHFREE_APP_ID / CASHFREE_SECRET_KEY / CASHFREE_ENV", "optional", "Cashfree fallback gateway."),
    ("CASHFREE_WEBHOOK_URL", "optional", "Sent to Cashfree when creating an order."),
    ("PLATFORM_FALLBACK_UPI", "optional", "Last-resort payee VPA (default payments@happypix.in) when neither the event nor the org has one."),
    ("ENCRYPTION_KEY", "recommended", "AES-256-GCM key for stored gateway secrets; falls back to JWT_SECRET. Losing it makes stored secrets unreadable."),
    ("AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / S3_BUCKET_NAME", "recommended", "Without them uploads go to local /uploads and presigned URLs are unavailable."),
    ("SENDGRID_API_KEY / EMAIL_FROM_ADDRESS", "recommended", "OTP, ticket replies, delivery emails."),
    ("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_SENDER_ID", "optional", "SMS delivery."),
    ("WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_API_TOKEN", "optional", "WhatsApp Cloud API delivery."),
    ("REMOVE_BG_API_KEY", "optional", "Background removal; without it /remove-bg fails and still refunds nothing (credits debit only on success)."),
    ("GROQ_API_KEY / TOGETHER_API_KEY / XAI_API_KEY / XAI_IMAGE_MODEL", "optional", "AI design generation."),
    ("CRON_SECRET", "required for cron", "Fail-closed cron endpoint. Unset → 401 on every call."),
    ("SESSION_TTL_MIN", "optional", "Cookie/session minutes, default 480, floored at 5."),
    ("JWT_TTL", "optional", "Token lifetime, default 12h."),
    ("ALLOWED_ORIGINS", "optional", "Extra CORS origins, comma separated."),
    ("CLIENT_URL / WEBSITE_URL / WEBSITE_PUBLIC_URL / BACKEND_URL", "optional", "Absolute links in emails and download URLs."),
    ("WEBSITE_INTERNAL_SECRET", "optional", "Shared secret for POST /api/downloads/internal."),
    ("SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD", "optional", "First-boot seed account."),
    ("ENABLE_DNS_OVERRIDE", "optional", "Forces the DNS workaround at boot (always on for win32)."),
    ("NODE_ENV / PORT / VERCEL", "platform", "Set by the runtime; VERCEL=1 disables app.listen()."),
]

# ── Error catalogue ──────────────────────────────────────────────────────────
ERRORS = [
    ("400", "BAD_REQUEST", "Generic validation failure; the message names the field."),
    ("400", "BAD_PAIRING", "Booth pairing payload incomplete."),
    ("400", "QUOTE_REQUIRED", "A booth payment was sent without its quote."),
    ("400", "GATEWAY_NOT_CONFIGURED", "No gateway credentials for this org or event."),
    ("400", "GATEWAY_ERROR", "Every configured gateway refused to create a QR."),
    ("400", "PREMIUM_PLAN_REQUIRED", "Custom gateway keys on a non-Premium plan."),
    ("400", "COUPON_INVALID / COUPON_REJECTED", "Expired, exhausted, paused, wrong org or wrong event."),
    ("400", "TEMPLATE_UNAVAILABLE", "Template removed or not attached to the event."),
    ("400", "LAYOUT_MISMATCH", "layoutId does not belong to templateId."),
    ("400", "BAD_PRINT_COUNT / BAD_AMOUNT", "Non-numeric or out of range."),
    ("400", "MIN_WITHDRAWAL", "Below the ₹500 floor."),
    ("400", "IDENTITY_IMMUTABLE", "Attempt to change email or role through the team API (403 in practice)."),
    ("400", "SELF_DEACTIVATE", "A user tried to deactivate themselves."),
    ("401", "UNAUTHENTICATED / UNPAIRED", "No credential presented."),
    ("401", "TOKEN_EXPIRED / BAD_TOKEN / SESSION_REVOKED", "JWT problems, including a version bump."),
    ("401", "INVALID_CREDENTIALS", "Sign-in with a wrong password (403 on the booth pairing path)."),
    ("402", "PLAN_EXPIRED", "Tenant may not transact until renewed."),
    ("403", "FORBIDDEN / FORBIDDEN_PERMISSION", "Role or permission key gate."),
    ("403", "ORG_SUSPENDED / ORG_BANNED / ORG_MISSING", "Tenant lifecycle gates."),
    ("403", "ACCOUNT_DEACTIVATED", "User inactive."),
    ("403", "DEVICE_BLOCKED", "Booth blocked or inactive."),
    ("403", "BANNED / SUSPENDED", "Booth path: tenant lock with a specific state code."),
    ("403", "INSUFFICIENT_AI_CREDITS", "Balance below 5 (generate) or 1 (cutout)."),
    ("403", "GALLERY_DISABLED / CONSENT_REQUIRED", "Gallery policy refuses the image."),
    ("403", "CORS_FORBIDDEN", "Origin not on the allowlist."),
    ("404", "NOT_FOUND / EVENT_NOT_FOUND / DEVICE_NOT_FOUND / PAYMENT_NOT_FOUND", "Missing or out of tenant scope."),
    ("404", "DOWNLOAD_NOT_FOUND / NO_LIVE_EVENT", "Nothing to serve."),
    ("409", "PRICE_MISMATCH", "Client-sent amount is not an acceptable total; the response lists allowedAmounts."),
    ("409", "PLAN_LIMIT_REACHED / DEVICE_EXISTS / EVENT_LIMIT", "Limit or uniqueness conflict."),
    ("409", "PAYMENT_STATE_INVALID", "Confirming a payment that is not pending."),
    ("409", "NO_EVENT / EVENT_NOT_LIVE / EVENT_FINISHED / EVENT_ACTIVE", "Event state conflict."),
    ("409", "COUPON_EXISTS / EMAIL_TAKEN / PLAN_IN_USE / ADDON_IN_USE / CANNOT_DELETE_TRIAL", "Conflict guards."),
    ("409", "LAST_ADMIN / LAST_OWNER", "Would leave nobody able to administer."),
    ("410", "DEVICE_DELETED / DOWNLOAD_EXPIRED / GONE", "Resource intentionally gone; discard cached state."),
    ("413", "PAYLOAD_TOO_LARGE", "Above the 50 MB JSON ceiling."),
    ("415", "UNSUPPORTED_MEDIA_TYPE", "Malformed stored data URL."),
    ("429", "RATE_LIMITED", "Any of the fourteen limiters; the message says how long to wait."),
    ("500", "INTERNAL", "Masked. The real error is logged with the request path."),
    ("503", "DATABASE_UNAVAILABLE", "Mongo unreachable at request time."),
]
