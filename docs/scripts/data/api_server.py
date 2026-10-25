"""Route data — endpoints declared directly in server.js (not in a router file)."""

from _common import ep

SERVER_ROUTES = [
    ep("GET", "/",
       "Liveness string for uptime monitors and for a human who opens the API root.",
       auth="public",
       res=[("text/plain", "string", "'🚀 HappyPix Server is running!'")]),

    ep("POST", "/api/leads",
       "The website's contact / demo / hardware / support form. Writes a WebsiteLead row.",
       auth="public", rl="60 requests / 15 min / IP",
       body=[("name", "string", "required"), ("email", "string", "required, regex validated"),
             ("phone", "string", "optional"), ("company", "string", "optional"),
             ("message", "string", "optional, truncated to 4000 chars"),
             ("type", "string", "demo, hardware, support; anything else becomes contact")],
       res=[("received", "boolean", "true"), ("id", "string", "lead id"),
            ("message", "string", "thank-you copy shown by the site")],
       errors=[("400 BAD_REQUEST", "name missing or email invalid"), ("500 INTERNAL", "database failure")],
       uses=["WebsiteLead"],
       side="Deliberately duplicated in website-backend so the site keeps working whichever backend it points at."),

    ep("ALL", "/api/cron/check-expirations",
       "The hourly expiry sweep. Expires trials and plans, then purges stale local uploads. Fails closed: if "
       "CRON_SECRET is unset every call is rejected, so an open endpoint can never trigger writes.",
       auth="shared secret — x-cron-secret header or Authorization: Bearer · CRON_SECRET",
       res=[("ok", "boolean", "true"), ("expiredOrganizations", "number", "orgs moved to expired"),
            ("expiredPlans", "number", "subscriptions closed"), ("removedFiles", "number", "local files purged"),
            ("timestamp", "string", "ISO")],
       errors=[("401 UNAUTHORIZED", "secret missing, wrong, or CRON_SECRET not configured")],
       uses=["CronService.runExpirySweep", "Organization", "Subscription", "fs"],
       side="Scheduled by backend/vercel.json ('0 * * * *'). In a long-lived process CronService also starts an "
            "interval, guarded by global._cronStarted so a warm serverless container never double-starts it."),

    ep("GET", "/api/proxy/logo",
       "Stream a private S3 logo or photo with server credentials, for browsers that cannot read the bucket. "
       "Restricted to HappyPix's own bucket host and key.",
       auth="jwt",
       query=[("url", "string", "required: https://<bucket>.s3.<region>.amazonaws.com/<key>"),
              ("download", "string", "'true' forces a download filename")],
       res=[("image/*", "binary", "bytes with Cache-Control: public, max-age=86400")],
       errors=[("400 BAD_REQUEST", "url missing, not an S3 URL, wrong bucket, or key has no filename"),
               ("401 UNAUTHENTICATED", "no session"),
               ("404 NOT_FOUND", "object missing or access denied")],
       uses=["utils/s3", "S3.GetObject"]),

    ep("POST", "/api/upload/logo",
       "Upload an organisation logo or event asset to S3. The path is derived from the caller's organisation — "
       "a client-supplied orgId is never trusted.",
       auth="jwt",
       body=[("logo", "file", "multipart, ≤ 10 MB, JPEG/PNG/WebP only")],
       query=[("folder", "string", "optional, default 'logos'")],
       res=[("url", "string", "https://<bucket>.s3.<region>.amazonaws.com/happypix/<orgId>/<folder>/<ts>-<folder>.<ext>")],
       errors=[("400 BAD_REQUEST", "no file"), ("400 BAD_REQUEST", "invalid mime type or extension"),
               ("500 INTERNAL", "S3 failure")],
       uses=["multer", "utils/s3", "S3 multipart Upload"]),

    ep("POST", "/api/upload/profile-photo",
       "Upload the signed-in user's avatar.",
       auth="jwt",
       body=[("photo", "file", "multipart, ≤ 10 MB, image only")],
       res=[("url", "string", "happypix/profiles/<userId>/<ts>-profile.<ext>")],
       errors=[("400 BAD_REQUEST", "no file or bad type"), ("500 INTERNAL", "S3 failure")],
       uses=["multer", "utils/s3"]),

    ep("POST", "/api/upload",
       "Generic photo upload for booths that cannot use presigned URLs. Accepts multipart or a base64 body field.",
       auth="device token OR jwt (requireUserOrDevice)",
       body=[("photo", "file", "multipart image"), ("photoBase64", "string", "data:image/…;base64,… alternative"),
             ("organizationId / eventId / sessionId", "string", "optional path components")],
       res=[("url", "string", "stored URL"), ("key", "string", "S3 key")],
       errors=[("400 BAD_REQUEST", "no file and no valid base64"), ("401 UNAUTHENTICATED", "no device or user credentials"),
               ("500 INTERNAL", "S3 failure")],
       uses=["multer", "utils/s3", "middleware/deviceAuth.authenticateDevice"]),

    ep("GET", "/uploads/*",
       "Static file server for local uploads (the fallback when S3 is not configured, plus AI-generated cutouts).",
       auth="public",
       res=[("binary", "file", "the file, or 404")],
       uses=["express.static"]),
]
