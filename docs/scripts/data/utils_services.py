"""Utility and service reference."""


def util(name, file, purpose, exports, *, notes=None):
    return {"name": name, "file": file, "purpose": purpose, "exports": exports, "notes": notes or []}


UTILS = [
    util("s3", "utils/s3.js",
         "One place that knows how to talk to the bucket: upload, delete, sign, presign and parse keys. Every other "
         "module imports this instead of building its own S3 client.",
         [("s3", "A shared S3Client built from AWS_REGION + credentials, reused across warm invocations."),
          ("uploadToS3({buffer, mimetype, folder, originalname})", "Multipart upload; returns {url, key}."),
          ("deleteFromS3(key)", "Best-effort delete; logs and continues so a missing object never fails a request."),
          ("s3KeyFromUrl(url)", "Turns an S3 URL back into a key, tolerating both path styles and URL-encoded keys."),
          ("upload", "A configured multer instance: memoryStorage, 10 MB limit, image MIME + extension allowlist."),
          ("signedPhotoUrl(rawUrl, {expiresInSec, downloadName})", "Signs a private object for 1 hour by default; "
                                                                    "passes data: URLs and local /uploads paths through untouched."),
          ("getPresignedUploadUrl({key, contentType, expiresInSec})", "Presigned PUT for a booth, 900 s by default.")],
         notes=["If S3 is not configured the helpers degrade to local /uploads paths, which is why the booth can run "
                "fully offline against a laptop."]),

    util("crypto", "utils/crypto.js",
         "Secrets at rest and booth-token hashing.",
         [("encryptSecret(plainText)", "AES-256-GCM. Output format: enc:v1:<iv>:<tag>:<ciphertext> (base64url parts)."),
          ("decryptSecret(cipherText)", "Accepts a plaintext value too, so rolling out encryption never breaks old rows."),
          ("hashDeviceToken(token)", "SHA-256 hex. Only the hash ever reaches the database.")],
         notes=["The key is derived with scrypt from ENCRYPTION_KEY (or a JWT_SECRET fallback) — losing that env "
                "variable makes every stored gateway secret undecryptable.",
                "Used as a Mongoose setter/getter on Event and OrganizationDefaults gateway fields, so encryption is "
                "invisible to the route code."]),

    util("auditLogger", "utils/auditLogger.js",
         "Append-only operator history with denormalised actor identity.",
         [("actorFromRequest(req)", "Extracts {actorId, actorName, actorRole, ip} from a request."),
          ("writeAudit(entry)", "Inserts one AuditLog row."),
          ("auditAsync(entry)", "Fire-and-forget wrapper so auditing never blocks or fails a response."),
          ("auditView(doc)", "Shapes a row for the CRM: relative time, tone, entity label."),
          ("logAudit(req, action, targetId, targetModel, details)", "Legacy signature kept for old call sites."),
          ("byAtDesc(a, b)", "Sort helper.")],
         notes=["Name and role are copied at write time; deleting a user never blanks history.",
                "Org routes use orgAudit() (a thin wrapper) so organizationId is always set."]),

    util("httpError", "utils/httpError.js",
         "Typed errors that survive to the response with a stable code.",
         [("badRequest / unauthorized / forbidden / notFound / conflict", "Convenience constructors for 400/401/403/404/409."),
          ("sendError(res, error, fallbackMessage)", "Serialises an HttpError with status + code; masks anything else."),
          ("asyncRoute(handler)", "Wraps an async handler so a rejected promise reaches Express instead of hanging.")]),

    util("printHelper", "utils/printHelper.js",
         "Hands a file to the local Windows print stack for organisations that print from the server machine.",
         [("printLocalImage(filePath, printCount, printerName)", "PowerShell + System.Drawing.Printing; copies clamped 1–50."),
          ("printImage(imageUrl, printCount, printerName)", "Downloads the image to a temp file, then prints it and "
                                                            "cleans up.")],
         notes=["Windows only. On macOS the printer is driven by the booth app, not this helper.",
                "A failure here is logged and swallowed: a paid session must never fail because a printer jammed."]),
]

SERVICES = [
    {"name": "boothSnapshotService", "file": "services/boothSnapshotService.js",
     "purpose": "Builds the one object a booth needs to run: branding, event, templates with resolved prices, "
                "timeouts, payment configuration and gallery policy — plus a revision hash so a fleet of booths costs "
                "almost nothing to keep in sync.",
     "exports": [("buildBoothSnapshot({device, organization, event})", "The full payload."),
                 ("computeRevision(payload)", "Stable hash over the parts that matter."),
                 ("buildSettings({organization, defaults, event, gallery})", "The settings slice, shared with /api/settings/public."),
                 ("buildBranding(organization, event)", "Org + event logos, deduped and absolute."),
                 ("dedupeLogos(list)", "Order-preserving unique, tolerant of null entries."),
                 ("mapTemplates(templates)", "Template → booth shape with resolved price and layout metadata."),
                 ("mergeHardware(device, patch)", "Merges telemetry/connections patches and stamps updatedAt."),
                 ("BOOTH_STATES / boothStateFor / boothCanOperate", "The state machine the booth must obey.")],
     "depends": "Event, OrganizationDefaults, Setting, gallerySettingsService, config/layouts, planService",
     "notes": ["The revision is what makes heartbeat cheap: unchanged → snapshot null, changed → full payload.",
               "Everything expensive (price resolution, logo dedupe) happens here, not in the booth."]},

    {"name": "eventService", "file": "services/eventService.js",
     "purpose": "Event lifecycle and shaping: derived status, edit whitelist, and the view the CRM renders.",
     "exports": [("computeEventStatus(event)", "upcoming / live / finished from dates + paused."),
                 ("isActiveEvent(event)", "Live and not paused."),
                 ("eventView(event, {devices, organization, gallerySettings})", "CRM shape with resolved prices and booth counts."),
                 ("eventPatch(body, {organization, existing, defaults})", "The only function allowed to build an event update — "
                                                                          "whitelists fields and validates ranges."),
                 ("normalizeEventBranding(branding, organization)", "Merges event branding over tenant defaults."),
                 ("priceKeyForLayout(layoutId)", "Maps a layout id to its price-table key."),
                 ("isDeviceOnline(device, windowMs)", "90-second window by default (stricter than the 5-minute model virtual)."),
                 ("loadEventForOrg({organizationId, eventId})", "Tenant-safe lookup."),
                 ("eventPublicShape(event)", "Strips payment secrets before anything public.")],
     "depends": "Event, Device, config/layouts, planService",
     "notes": ["Event documents decrypt gateway secrets through getters, so eventPublicShape() is mandatory on any "
               "public response."]},

    {"name": "couponService", "file": "services/couponService.js",
     "purpose": "Coupon rules in one place: validation, create/edit validation, the safe view and idempotent redemption.",
     "exports": [("applyCoupon(coupon, {gross, eventId})", "Returns {ok, discount, message} — the single source of discount maths."),
                 ("findCouponForOrg(organizationId, code)", "Case-insensitive lookup scoped to a tenant."),
                 ("validateCouponCreate(patch)", "Shape and range validation."),
                 ("couponPatch(body, existing)", "Locks code/type/value/usedCount after creation."),
                 ("couponView(coupon, {events})", "Serialisable view with computed status."),
                 ("recordCouponRedemption(payment)", "Increments usedCount exactly once per payment via couponCounted.")],
     "depends": "Coupon, Payment",
     "notes": ["Redemption is counted on paid status only, and guarded by the couponCounted flag so a webhook and a "
               "poll cannot double count."]},

    {"name": "gallerySettingsService", "file": "services/gallerySettingsService.js",
     "purpose": "The platform-wide gallery policy (published or not, consent required or not), cached for 15 seconds.",
     "exports": [("getGallerySettings({fresh})", "Reads the global Setting row; defaults {galleryEnabled:true, requireGuestConsent:false}."),
                 ("saveGallerySettings(patch, actor)", "Validates, saves and busts the cache."),
                 ("photoVisibleInGallery(photo, settings)", "The single predicate used by gallery, download and share."),
                 ("GALLERY_DEFAULTS", "The frozen default object.")],
     "depends": "Setting",
     "notes": ["The cache is per process: on serverless, a cold start always re-reads.",
               "fresh:true is used by the CRM gallery so an admin never sees a stale policy."]},

    {"name": "guestDownloadService", "file": "services/guestDownloadService.js",
     "purpose": "Creates and validates the 24-hour guest download link.",
     "exports": [("createGuestDownload({...})", "Inserts a GuestDownload with a 144-bit id and expiry."),
                 ("downloadUrlFor(downloadId)", "CLIENT_URL/download/<id>."),
                 ("isDownloadLive(download, now)", "Explicit expiry check that does not rely on the TTL thread."),
                 ("newDownloadId()", "18 random bytes, base64url."),
                 ("DOWNLOAD_TTL_MS", "GUEST_DOWNLOAD_TTL_MS, 24 hours.")],
     "depends": "GuestDownload",
     "notes": ["The id is the credential: no session, no token, no email. 144 bits of entropy is what makes that safe."]},

    {"name": "photoUrlService", "file": "services/photoUrlService.js",
     "purpose": "Turns a stored Photo into something a browser can actually load from a private bucket.",
     "exports": [("signedPhotoUrl(photo, {expiresInSec})", "Prefers compositeUrl, falls back to url, signs S3 keys, "
                                                          "passes through data: and local paths, and always also returns a "
                                                          "/api/org/asset-proxy fallback."),
                 ("signedUrlFor(rawUrl, s3Key, options)", "Lower-level helper for one URL.")],
     "depends": "utils/s3",
     "notes": ["Every gallery image carries both a signed URL and a proxy URL, because a signed URL can expire while "
               "the page is open."]},

    {"name": "planService", "file": "services/planService.js",
     "purpose": "The plan catalogue, pricing ladder, discounts, limits and status — the single authority on what a "
                "tenant is allowed.",
     "exports": [("listPlans({fresh})", "The catalogue with discounts applied."),
                 ("resolvePlan(key)", "One plan by key."),
                 ("planPricing / billingPrices / normalizeDiscount / isDiscountActive / parseDiscountInput", "Price ladder maths."),
                 ("orgLimits(org)", "Effective device and event limits, preferring the org's own denormalised values."),
                 ("computePlanStatus(org, subscription)", "trial / active / expired / grace."),
                 ("planSummary(org, subscription)", "The object the CRM shows."),
                 ("planSync(key) / DEFAULT_PLAN_CATALOG / ADDON_CATALOG", "Seeding.")],
     "depends": "SubscriptionPlan, Organization, Subscription",
     "notes": ["Trial: 1 booth / 1 event / 10 credits. Basic ₹1,099 (2 booths, 2 events, 25 credits), Pro ₹1,299, "
               "Premium ₹1,499; add-ons ₹249. Custom gateways need Premium/Custom.",
               "assertDeviceLimit / assertEventLimit live here and are called by every creation path."]},

    {"name": "DeliveryService", "file": "services/DeliveryService.js",
     "purpose": "Fan a session out over WhatsApp, SMS, email or a plain link, with a provider adapter per channel and "
                "a DeliveryRecord per attempt.",
     "exports": [("processDelivery({method, destination, photoShare, eventId, organizationId})", "The entry point used by /api/share/deliver."),
                 ("WhatsAppTransport.send", "WhatsApp Cloud API, template message with the media URL."),
                 ("SmsTransport.send", "Twilio."),
                 ("EmailTransport.send", "SendGrid."),
                 ("LinkTransport.send", "QR / copy-link / native share — recorded, nothing is sent.")],
     "depends": "DeliveryRecord, PhotoShare, Twilio, SendGrid, WhatsApp Cloud API",
     "notes": ["Destinations are masked before storage; the full number exists only in the provider call.",
               "Downloads and copy-links count as shares, not messages, which keeps the cost report honest."]},

    {"name": "CronService", "file": "services/CronService.js",
     "purpose": "The hourly housekeeping job: expire trials and plans, then purge stale local uploads.",
     "exports": [("checkExpirations()", "Moves lapsed trials and plans to expired and closes their subscriptions."),
                 ("cleanupLocalUploads(maxAgeDays)", "Deletes local files older than 7 days whose names start with "
                                                     "test-, demo or temp-. Anything else is left alone.")],
     "depends": "Organization, Subscription, fs",
     "notes": ["Started only when the cron endpoint is called (or once per process in a long-lived deployment, guarded "
               "by global._cronStarted).",
               "The endpoint is fail-closed: no CRON_SECRET means every call is a 401."]},

    {"name": "backgroundRemovalService", "file": "services/backgroundRemovalService.js",
     "purpose": "AI cutout for templates — remove the background from an uploaded subject.",
     "exports": [("removeBackgroundBuffer(buffer, options)", "Talks to remove.bg and returns the cutout buffer."),
                 ("removeBackground(imageInput, options)", "Accepts a data URL or buffer, validates size and type, and "
                                                           "returns the result plus metadata.")],
     "depends": "remove.bg API",
     "notes": ["Costs 1 AI credit, debited after success so a provider outage never burns a tenant's balance."]},

    {"name": "TemplateGenerationService", "file": "services/ai/TemplateGenerationService.js",
     "purpose": "Generate or patch a booth design from a natural-language prompt, returning a design tree plus the "
                "artwork it needs.",
     "exports": [("generate(prompt, context)", "Classify intent → generate or patch."),
                 ("generateFullDesign(prompt, layout)", "A complete design for a layout blueprint."),
                 ("patchDesign(prompt, currentDesign, intent, layout)", "Surgical edit of an existing design."),
                 ("callGroq(systemPrompt, userPrompt)", "The LLM call (Groq, with Together/xAI image providers alongside).")],
     "depends": "PromptClassifier, ImageProvider, TogetherImageProvider, XAIImageProvider, Groq",
     "notes": ["Costs 5 AI credits, debited only after a successful generation.",
               "Also imported by the platform console, where it does not touch a tenant balance."]},
]
