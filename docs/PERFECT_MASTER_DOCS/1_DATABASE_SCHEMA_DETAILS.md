# DATABASE MODELS REFERENCE

This document provides an exhaustive, field-by-field breakdown of every MongoDB collection.

## Model: `AuditLog`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **action** | `String` | required |  |
| **performedBy** | `ObjectId` | ref=User |  |
| **organizationId** | `ObjectId` | ref=Organization, index |  |
| **targetId** | `ObjectId` |  |  |
| **targetModel** | `String` |  |  |
| **details** | `ObjectId` |  |  |
| **ipAddress** | `String` |  |  |

## Model: `Coupon`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **organizationId** | `ObjectId` | ref=Organization, index | ─── Multi-tenant: which org this coupon belongs to ─── |
| **code** | `String` | required, unique, uppercase, trim |  |
| **discountType** | `String` | enum=[...], required | ─── Discount ───────────────────────────────────────────── |
| **value** | `Number` | required |  |
| **type** | `String` | enum=[...], default=event_wide | ─── Coupon Type ────────────────────────────────────────── |
| **maxUses** | `Number` |  | ─── Usage Limits ───────────────────────────────────────── |
| **usedCount** | `Number` | default=0 | null = unlimited (used for event_wide) |
| **eventId** | `ObjectId` | ref=Event | ─── Scope ──────────────────────────────────────────────── If eventId is set → only valid for that specific event |
| **expiryDate** | `Date` |  | ─── Validity ───────────────────────────────────────────── |
| **isActive** | `Boolean` | default |  |
| **createdBy** | `ObjectId` | ref=User |  |
| **createdAt** | `Date` |  |  |

## Model: `DeliveryRecord`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **photoShareId** | `ObjectId` | ref=PhotoShare, required, index |  |
| **eventId** | `ObjectId` | ref=Event, required, index |  |
| **organizationId** | `ObjectId` | ref=Organization, required, index |  |
| **method** | `String` | enum=[...], required |  |
| **destinationMasked** | `String` |  |  |
| **status** | `String` | enum=[...], default=pending |  |
| **provider** | `String` |  |  |
| **providerMessageId** | `String` |  |  |
| **errorCode** | `String` |  |  |
| **sentAt** | `Date` |  |  |
| **failedAt** | `Date` |  |  |
| **createdAt** | `Date` |  |  |

## Model: `Device`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **organizationId** | `ObjectId` | ref=Organization, required, index | ─── Ownership ──────────────────────────────────────────── |
| **deviceName** | `String` | required, trim | ─── Identity ───────────────────────────────────────────── |
| **location** | `String` | trim, default= | "Booth-01" |
| **deviceToken** | `String` | required, unique, index | "Crown Ballroom" |
| **currentEventId** | `ObjectId` | ref=Event | ─── Current Event Assignment ───────────────────────────── null = "No Event Assigned" screen shown on booth Device polls /api/devices/current-event every 30s to detect changes |
| **currentEventName** | `String` |  |  |
| **lastSeenAt** | `Date` |  | ─── Real-time Tracking (updated on every heartbeat) ───── |
| **ipAddress** | `String` |  |  |
| **userAgent** | `String` |  |  |
| **totalSessions** | `Number` | default=0 | ─── Lifetime Stats ─────────────────────────────────────── |
| **totalPhotos** | `Number` | default=0 | incremented on each session start |
| **totalPrints** | `Number` | default=0 | incremented on each photo upload |
| **totalRevenue** | `Number` | default=0 | incremented on each print command |
| **printsSinceLastMaintenance** | `Number` | default=0 | incremented on each paid order (local currency) ─── Maintenance Tracking ───────────────────────────────── printsSinceLastMaintenance: resets when client acknowledges maintenance When this >= maintenanceAlertThreshold → show ⚠️ badge on device card |
| **lastMaintenanceAt** | `Date` |  |  |
| **maintenanceAlertThreshold** | `Number` | default=500 |  |
| **printerName** | `String` | default= | every 500 prints ─── Device-level Settings ──────────────────────────────── These are hardware-specific settings, configured once per device |
| **paperSize** | `String` | default=4x6 | e.g. "Canon SELPHY CP1500" |
| **enableHardwarePrinting** | `Boolean` | default | "4x6" | "5x7" | "A4" |
| **status** | `String` | enum=[...], default=active | ─── Status ─────────────────────────────────────────────── |

## Model: `DigitalToken`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **token** | `String` | required, unique, index |  |
| **paymentId** | `ObjectId` | ref=Payment |  |
| **photoUrls** | `Unknown` | required |  |
| **compositeUrl** | `String` |  |  |
| **expiresAt** | `Date` | required |  |
| **downloadCount** | `Number` | default=0 |  |
| **createdAt** | `Date` |  |  |

## Model: `Event`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **id** | `String` | required |  |
| **label** | `String` | required | slug: "vertical-4", "grid-2x2" |
| **description** | `String` | default= | "Vertical Strip" |
| **frames** | `Number` | required | "4 Slots" |
| **orientation** | `String` | enum=[...], default=vertical | number of photo slots: 1, 2, 4, 6 |
| **overlayUrl** | `String` | default= |  |
| **price** | `Number` |  | S3 URL for frame PNG overlay |
| **isDefault** | `Boolean` |  | null = use event's default printPrice |

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **organizationId** | `ObjectId` | ref=Organization, index | ─── Multi-tenant: which client owns this event ────────── |
| **name** | `String` | required | ─── Basic Info ─────────────────────────────────────────── |
| **location** | `String` | required |  |
| **clientName** | `String` |  |  |
| **startDate** | `Date` | required | guest-facing client name (optional) |
| **endDate** | `Date` | required |  |
| **status** | `String` | enum=[...], default=upcoming |  |
| **branding** | `Unknown` |  | ─── Branding & Media ───────────────────────────────────── |
| **logos** | `Array` |  | logos: client selects from their org logoLibrary + any event-specific uploads Guest will choose one logo to apply to their photo composite |
| **overlayUrl** | `String` | default= | array of S3 URLs Single overlay URL for the frame (if not using per-template overlays) |
| **allowedTemplates** | `Array` |  | ─── Allowed Templates ──────────────────────────────────── Empty = booth shows 3 global built-in defaults Non-empty = booth shows ONLY these templates |
| **assignedTemplateIds** | `Array` |  | New Template system references |
| **allowedFilters** | `Array` |  | ─── Allowed Filters & Effects ─────────────────────────── Client defines which filters guest can apply during capture e.g. ['none', 'vintage', 'blackwhite', 'warm', 'cool', 'vivid'] |
| **printOptions** | `Unknown` | default=[...] | ─── Print Options ──────────────────────────────────────── How many prints the guest can choose from e.g. [1, 2] → guest picks 1 or 2 copies |
| **printPrice** | `Number` |  | ─── Event-level Pricing & Settings ────────────────────── |
| **downloadEnabled** | `Boolean` | default | null = use global default (legacy) |
| **printingEnabled** | `Boolean` | default |  |
| **boothTimeout** | `Number` | default=30 |  |
| **razorpayKeyId** | `String` | default= | seconds until auto-reset on idle |
| **razorpayKeySecret** | `String` | default= |  |
| **upiId** | `String` | default= |  |
| **qrCodeUrl** | `String` | default= |  |
| **gridPrices** | `Unknown` |  | ─── Per-Grid Pricing ───────────────────────────────────── Prices for each of the 5 fixed grid/cut types. null = use platform default (no per-grid override). |
| **formatPrices** | `Unknown` |  | ─── Format/Media Size Pricing ───────────────────────────── |
| **templatePrices** | `Map` |  | ─── Per-Template Price Overrides ────────────────────────── { templateId (string) -> price (number) } Takes priority over formatPrices for the specific template. |
| **selectedScreens** | `Unknown` | default=[...] | ─── Event Flow ────────────────────────────────────────── Array of screen IDs to show in the booth. Defines which screens are active for this event. |
| **sharingConfig** | `Unknown` |  | ─── Digital Photo Sharing Settings ────────────────────── |
| **selectedFrameUrls** | `Array` |  | ─── Selected Frames ───────────────────────────────────── Frame border/overlay images selected from org's frameLibrary |
| **enabledLayouts** | `Unknown` | default=[...] | ─── Enabled Layouts ────────────────────────────────────── Which booth architecture layouts are active. Empty means all are active. |
| **organizerName** | `String` | default= |  |
| **allowPrint** | `Boolean` | default |  |
| **assignedManagerId** | `ObjectId` | ref=User | ─── Assignment Fields ──────────────────────────────────── |
| **assignedDeviceIds** | `Array` |  |  |
| **shortCode** | `String` |  | ─── Backward Compat ───────────────────────────────────── shortCode & passkey kept optional for legacy join flow Will be removed once device credential-based auth is fully rolled out |
| **passkey** | `String` |  | unique sparse index defined below via schema.index() |
| **createdBy** | `ObjectId` | ref=User |  |
| **createdAt** | `Date` |  |  |

## Model: `Organization`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **name** | `String` | required, trim | ─── Basic Info ─────────────────────────────────────────── |
| **ownerName** | `String` | required, trim |  |
| **email** | `String` | required, unique, trim, lowercase |  |
| **phone** | `String` | trim, default= |  |
| **country** | `String` | default=IN |  |
| **plan** | `String` | enum=[...], default=starter | ISO country code: IN, AU, etc. ─── Plan & Billing ─────────────────────────────────────── |
| **currency** | `String` | enum=[...], default=INR |  |
| **billingCycle** | `String` | enum=[...], default=monthly |  |
| **planStartedAt** | `Date` |  |  |
| **planExpiresAt** | `Date` |  |  |
| **nextBillingDate** | `Date` |  |  |
| **paymentGateway** | `String` | enum=[...], default=razorpay | ─── Payment Gateway ───────────────────────────────────── Auto-selected based on currency: INR → razorpay, AUD → stripe |
| **status** | `String` | enum=[...], default=trial | ─── Status ─────────────────────────────────────────────── |
| **trialEndsAt** | `Date` |  |  |
| **allowedDevices** | `Number` | default=1 | ─── Device Limits ──────────────────────────────────────── |
| **logoLibrary** | `Array` |  | synced from plan on create/update ─── Logo Library ───────────────────────────────────────── Client uploads logos here; events pick from this library S3 paths: happypix/<orgId>/logos/<filename> |
| **frameLibrary** | `Array` |  | ─── Frame Library ──────────────────────────────────────── Client uploads decorative border/overlay frame images here Events select from this library for photo overlays S3 paths: happypix/<orgId>/frames/<filename> |
| **templates** | `Array` |  | Template library (client-defined templates) |
| **internalNotes** | `String` | default= | ─── Super Admin Notes ──────────────────────────────────── |
| **createdBy** | `ObjectId` | ref=User | ─── Metadata ───────────────────────────────────────────── |

## Model: `Payment`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **organizationId** | `ObjectId` | ref=Organization, index | ─── Multi-tenant: which client this payment belongs to ─── |
| **razorpayOrderId** | `String` | required, unique |  |
| **paymentLinkId** | `String` |  |  |
| **paymentLinkUrl** | `String` |  |  |
| **razorpayPaymentId** | `String` |  |  |
| **razorpaySignature** | `String` |  |  |
| **eventId** | `ObjectId` | ref=Event |  |
| **eventName** | `String` |  |  |
| **amount** | `Number` | required |  |
| **currency** | `String` | default=INR | in rupees (e.g. 200) |
| **printCount** | `Number` | required |  |
| **digitalCopy** | `Boolean` |  |  |
| **photoUrls** | `Unknown` | default=[...] |  |
| **compositeUrl** | `String` |  | Selected S3 photo URLs for digital copy |
| **couponCode** | `String` |  | URL of the finalized photo strip composite |
| **discountApplied** | `Number` | default=0 |  |
| **status** | `String` | enum=[...], default=created | discount in rupees |
| **utr** | `String` | index |  |
| **createdAt** | `Date` |  |  |
| **paidAt** | `Date` |  |  |

## Model: `Photo`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **organizationId** | `ObjectId` | ref=Organization, index | ─── Multi-tenant ───────────────────────────────── |
| **s3Key** | `String` | required |  |
| **url** | `String` | required |  |
| **eventId** | `ObjectId` | ref=Event |  |
| **createdAt** | `Date` | expires=86400 |  |

## Model: `PhotoShare`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **eventId** | `ObjectId` | ref=Event, required, index |  |
| **organizationId** | `ObjectId` | ref=Organization, index |  |
| **tokenHash** | `String` | required, unique, index |  |
| **photoUrls** | `Unknown` | default=[...] | We store the actual S3 URLs or references |
| **compositeUrl** | `String` |  |  |
| **photoIds** | `Array` |  | References to the Photo collection |
| **expiresAt** | `Date` | required |  |
| **status** | `String` | enum=[...], default=active |  |
| **viewCount** | `Number` | default=0 |  |
| **downloadCount** | `Number` | default=0 |  |
| **shareCount** | `Number` | default=0 |  |
| **createdAt** | `Date` |  |  |

## Model: `RoleConfig`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **role** | `String` | enum=[...], required, unique |  |
| **permissions** | `Array` |  |  |
| **updatedAt** | `Date` |  |  |

## Model: `Setting`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **organizationId** | `ObjectId` | ref=Organization | ─── Multi-tenant: which org these settings belong to ──────── null = legacy global singleton (fallback only) |
| **enableMobilePrinting** | `Boolean` | default | ─── Mobile Printing ────────────────────────────────────────── |
| **razorpayKeyId** | `String` | default= | ─── Payment Settings ───────────────────────────────────────── |
| **razorpayKeySecret** | `String` | default= |  |
| **upiId** | `String` | default= |  |
| **upiName** | `String` | default= |  |
| **upiQrImageUrl** | `String` | default= |  |
| **updatedAt** | `Date` |  |  |

## Model: `Subscription`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **organizationId** | `ObjectId` | ref=Organization, required, index |  |
| **orgName** | `String` | required |  |
| **plan** | `String` | enum=[...], required | Denormalized for fast reporting |
| **billingCycle** | `String` | enum=[...], default=monthly |  |
| **amount** | `Number` | required |  |
| **currency** | `String` | default=INR | e.g. 2499 (INR) or 49 (AUD) |
| **status** | `String` | enum=[...], default=paid | 'INR' or 'AUD' |
| **periodStart** | `Date` | required | Subscription period this payment covers |
| **periodEnd** | `Date` | required |  |
| **recordedBy** | `ObjectId` | ref=User | Who recorded this (always superadmin for now — manual recording) |
| **notes** | `String` | default= | Optional notes — e.g. "Paid via UPI", "Renewal reminder sent" |

## Model: `SupportTicket`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **text** | `String` | required |  |
| **createdAt** | `Date` |  |  |

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **ticketType** | `String` | enum=[...], default=end_user | ─── Routing ────────────────────────────────────────────── |
| **organizationId** | `ObjectId` | ref=Organization, index | ─── Multi-tenant: which org submitted this ticket ─────── For end_user tickets: the org whose device/event was used For client tickets: the org raising the complaint |
| **name** | `String` | required, trim | ─── Submitter Info ─────────────────────────────────────── |
| **email** | `String` | required, trim, lowercase |  |
| **subject** | `String` | required, trim |  |
| **message** | `String` | required, trim |  |
| **eventId** | `ObjectId` | ref=Event | ─── Event Context (end_user tickets only) ──────────────── |
| **eventShortCode** | `String` |  |  |
| **deviceId** | `ObjectId` | ref=Device |  |
| **sessionId** | `String` |  | ─── Session & Payment Context (end_user tickets only) ─── |
| **paymentReference** | `String` |  | unique session identifier |
| **holdPhotos** | `Boolean` |  | Razorpay payment ID holdPhotos: if true → S3 lifecycle deletion is paused until ticket resolves |
| **status** | `String` | enum=[...], default=open | ─── Status & Priority ──────────────────────────────────── |
| **priority** | `String` | enum=[...], default=normal |  |
| **resolvedAt** | `Date` |  | Set when status → "resolved". MongoDB TTL index auto-deletes 24 hrs later. |
| **adminNotes** | `Array` |  | ─── Admin Notes (internal) ─────────────────────────────── |

## Model: `Template`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **name** | `String` | required, trim | ─── Basic Info ─────────────────────────────────────────── |
| **description** | `String` | default= |  |
| **category** | `String` | default=Custom |  |
| **orientation** | `String` | enum=[...], required |  |
| **organizationId** | `ObjectId` | ref=Organization, index | ─── Tenant Isolation ───────────────────────────────────── If organizationId is null, it's a global template. |
| **eventId** | `ObjectId` | ref=Event, index |  |
| **createdBy** | `ObjectId` | ref=User |  |
| **visibility** | `String` | enum=[...], default=organization | ─── State & Source ─────────────────────────────────────── |
| **status** | `String` | enum=[...], default=draft |  |
| **source** | `String` | enum=[...], required |  |
| **canvas** | `Unknown` |  | ─── Template Configuration ─────────────────────────────── |
| **photoSlots** | `Array` |  |  |
| **background** | `Unknown` |  |  |
| **overlays** | `Array` |  | Optional arrays for future expansion (stickers, texts, etc.) |
| **textElements** | `Array` |  |  |
| **thumbnailAssetId** | `String` |  |  |

## Model: `User`

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| **name** | `String` | required, trim |  |
| **email** | `String` | required, unique, trim, lowercase |  |
| **password** | `String` | required |  |
| **phoneNumber** | `String` | trim |  |
| **profilePhotoUrl** | `String` |  |  |
| **role** | `String` | enum=[...], required | ─── Role Hierarchy ──────────────────────────────────────── OWNER, ADMIN, MANAGER: HappyPix internal users CLIENT_ADMIN, CLIENT_MANAGER, BOOTH_OPERATOR: Tenant users |
| **organizationId** | `ObjectId` | ref=Organization, index | ─── Organization Link ───────────────────────────────────── null     → internal roles (OWNER, ADMIN, MANAGER) ObjectId → tenant roles (CLIENT_ADMIN, CLIENT_MANAGER, BOOTH_OPERATOR) |
| **useCustomPermissions** | `Boolean` |  | ─── RBAC: Permissions ───────────────────────────────────── If useCustomPermissions is true, the user's effective permissions are exactly what's in customPermissions. Otherwise, they inherit the default permissions for their role. |
| **customPermissions** | `Array` |  |  |
| **createdAt** | `Date` |  |  |
| **resetPasswordToken** | `String` |  | ─── Password Reset ─────────────────────────────────────── |
| **resetPasswordExpires** | `Date` |  |  |
