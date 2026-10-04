# HappyPix Electron Booth

## Phase 1 — Product & Requirements Specification

**Status:** Draft for validation
**Purpose:** Establish exactly what the HappyPix Electron Booth must do before architecture and implementation begin.

---

# 1. Purpose of the Electron Booth

HappyPix Electron Booth is the **desktop/PC version of the existing HappyPix Booth application**.

The Electron application is not intended to introduce a separate booth business flow.

The existing HappyPix Booth already defines:

* the event/session lifecycle
* the booth screens
* the API interaction
* event configuration
* template/filter behavior
* payment flow
* photo capture flow
* printing
* digital sharing

The Electron application should reproduce this existing booth experience on Windows/macOS while replacing mobile-specific platform and hardware integrations with desktop equivalents.

### Core principle

> **Same HappyPix booth logic, same backend/API contract, same event/session flow and same user experience — with desktop-specific platform and hardware providers.**

This is the central assumption for all later phases.

---

# 2. Product Boundary

HappyPix consists conceptually of three major systems.

```text
                    HAPPYPIX
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
      CRM           Backend         Booth
        │              │              │
   Configuration     APIs/DB       Customer UI
                                  + Hardware
```

## 2.1 CRM / Admin

The CRM is responsible for configuring and managing the business/event side.

It provides event-related information that determines how the booth behaves.

Examples identified from the existing system include:

* events
* event assignment
* event status
* passkeys
* pricing
* selected screens
* templates
* filters
* branding
* sharing configuration
* printing configuration
* payment configuration
* timeout settings

---

# 3. Electron Booth Responsibility

The Electron application is responsible for executing the booth experience.

It must:

* start the booth
* determine the active event
* synchronize with the backend
* load event configuration
* display the appropriate screens
* allow the guest to start a session
* allow the guest to select the available layout/options
* capture photographs
* allow photo selection where configured
* apply filters/customization
* generate the final composition
* process payment when required
* print when required
* upload photos
* generate/share digital copies when configured
* show completion
* reset for the next guest

The booth should use backend/CRM configuration rather than independently deciding event-specific business rules.

---

# 4. What Controls the Booth

The most important object identified in the existing application is the active event.

Conceptually:

```text
CRM
 ↓
Event configuration
 ↓
Backend API
 ↓
Electron Booth
 ↓
Booth behavior
```

The Electron application should therefore be understood as a **configuration-driven booth**.

The same Electron application can behave differently for different events depending on the configuration returned by the backend.

---

# 5. Event Configuration

The following event fields have been identified as affecting booth behavior.

| Event data              | Booth responsibility                                         |
| ----------------------- | ------------------------------------------------------------ |
| `_id`                   | Event identity used by settings, payment, upload and sharing |
| `name`                  | Event name shown in relevant booth contexts                  |
| `location`              | Event/location information                                   |
| `status`                | Event availability/filtering                                 |
| `passkey`               | Event joining/security                                       |
| `selectedScreens`       | Determines which booth stages are enabled                    |
| `branding.logoUrl`      | Event/client branding                                        |
| `branding.primaryColor` | Booth theme                                                  |
| `branding.overlayUrl`   | Branding overlay                                             |
| `logos`                 | Logos available during customization                         |
| `allowedTemplates`      | Templates available to the booth                             |
| `assignedTemplateIds`   | CRM-assigned visual templates                                |
| `allowedFilters`        | Filters available to the guest                               |
| `printingEnabled`       | Whether printing is available                                |
| `printPrice`            | Event-level print price                                      |
| `gridPrices`            | Price based on selected grid/cut configuration               |
| `formatPrices`          | Price based on output format                                 |
| `templatePrices`        | Per-template pricing overrides                               |
| `sharingConfig`         | Digital sharing capabilities                                 |
| `boothTimeout`          | Timeout/reset behavior                                       |
| `countdownDuration`     | Intended capture countdown configuration                     |
| `razorpayKeyId`         | Payment configuration                                        |

These fields are based on the current research and existing booth implementation.

---

# 6. Public Settings

In addition to the event object, the booth obtains public settings.

The currently identified settings include:

* `printPrice`
* `taxRate`
* `boothTimeout`
* `upiId`
* `upiName`
* `upiQrImageUrl`
* `razorpayKeyId`
* `defaultPaperSize`
* `enableHardwarePrinting`
* `enableMobilePrinting`

These are provided through the public settings API and may influence payment, timeout and printing behavior.

---

# 7. Booth User Flow

The current HappyPix Booth flow is:

```text
BOOT
  ↓
LOGIN / EVENT ASSIGNMENT
  ↓
CLIENT EVENTS
  ↓
EVENT SELECTION / JOIN
  ↓
START
  ↓
LAYOUT SELECTION
  ↓
SLOT SELECTION
  ↓
PRINT COUNT
  ↓
PAYMENT
  ↓
CAPTURE
  ↓
PHOTO SELECTION
  ↓
CUSTOMIZE
  ↓
PRINT / UPLOAD / SHARE
  ↓
ORDER SUCCESS
  ↓
RESET
```

Not every stage necessarily appears for every event.

Event configuration can enable/disable portions of the flow.

---

# 8. Screen Requirements

## 8.1 Boot

### Purpose

Initial application startup.

### Responsibilities

* Start the booth application.
* Perform initial camera/printer diagnostics.
* Begin the process of determining the active event/authentication state.

### Backend dependency

No direct CRM UI data is currently identified.

---

# 8.2 Login

### Purpose

Authenticate a client/admin when required.

### Current backend dependency

`POST /api/auth/login`

### Result

The application stores the authentication information locally and proceeds toward event selection.

---

# 8.3 Client Events

### Purpose

Display available CRM events for the authenticated client.

### Current backend dependency

`GET /api/events`

### User action

The user selects an event and provides its passkey.

### Event joining

`POST /api/events/public/join`

---

# 8.4 Start

### Purpose

Main guest-facing HappyPix welcome/start screen.

### Behavior controlled by

* `activeEvent.selectedScreens`
* event settings
* timeout
* event branding/theme

The guest starts a new booth session from here.

---

# 8.5 Layout Selection

### Purpose

Allow the guest to choose the applicable output/layout orientation.

### Current behavior

The research identifies vertical/horizontal selection.

### Event dependency

`boothTimeout` is currently referenced here.

### TBD

The exact relationship between layout architecture and CRM-assigned templates must be formally defined in Phase 2/3.

---

# 8.6 Slot Selection

### Purpose

Select the capture layout/slot architecture.

### Current behavior

The research found that this currently uses local/default architecture templates rather than directly using the CRM visual templates.

### Important distinction

There appear to be two concepts:

```text
Slot / capture architecture
        vs
Visual template / final design
```

This distinction must remain explicit until validated.

---

# 8.7 Print Count

### Purpose

Allow the guest to select printing/digital-copy requirements.

### Controlled by

* `sharingConfig`
* template pricing
* `selectedScreens.payment`
* event pricing configuration

---

# 8.8 Payment

### Purpose

Collect payment when the configured event requires payment and the calculated amount is greater than zero.

### Current backend operations

* Create payment order
* Check payment status
* Complete free/zero-price order
* Payment verification API also exists

### Payment provider

Current implementation uses Razorpay-related backend functionality.

---

# 8.9 Capture

### Purpose

Capture the photographs required by the selected booth configuration.

### Dependencies

* camera
* selected template/slot requirements
* capture configuration
* preview configuration

### Important current behavior

The configuration contains `countdownDuration`, but the current capture implementation reportedly uses a hardcoded 3-second countdown.

This must be resolved before final implementation.

---

# 8.10 Photo Selection

### Purpose

Allow the guest to select the appropriate captured photographs for the template slots.

### Appears when

Preview/photo-selection functionality is enabled.

### Uses

* captured photographs
* selected template slot information
* event tagline

---

# 8.11 Customize

### Purpose

Create the final photo output.

The current research identifies customization functionality including:

* template selection
* frame colors
* filters
* shapes
* stickers
* logo
* other customization
* final print/upload/share preparation

### Controlled by

* `allowedTemplates`
* `assignedTemplateIds`
* `allowedFilters`
* `logos`
* `sharingConfig`
* `selectedScreens.print`
* event tagline

---

# 8.12 Order Success

### Purpose

Complete the current customer session.

Responsibilities include:

* displaying print status
* displaying digital/share options
* QR/share delivery where enabled
* completing the session
* automatically resetting the booth

The next guest should begin with a clean session.

---

# 9. Background Booth Behavior

The booth is not only a sequence of screens.

It also has background synchronization behavior.

Current behavior:

```text
BOOT
 ↓
Check device assignment
 ↓
Load assigned event if available
 ↓
Use saved authentication when applicable
 ↓
Heartbeat every ~30 seconds
 ↓
Refresh assigned event approximately every 2 minutes
```

Specifically, the current implementation uses:

* `/api/devices/current-event`
* `/api/devices/ping`

This allows CRM-side changes to the booth's assigned event to be detected.

---

# 10. Device Assignment

The current system supports a device-token concept.

The booth can request:

`GET /api/devices/current-event`

using a device token.

If CRM has assigned an event to that device, the booth can load that event.

The booth also periodically sends:

`POST /api/devices/ping`

to maintain/check device status.

### Important unresolved product decision

The current Boot screen still routes to Login even though the underlying booth provider supports device-token event assignment.

For Electron, we need to decide whether the production booth should primarily operate through:

```text
Device Token → Automatically assigned event
```

or:

```text
Login → Client Events → Passkey → Event
```

or support both.

**Phase 1 status: TBD.**

---

# 11. Printing Requirement

Printing is an optional/configurable part of the booth experience.

The booth must be able to determine:

```text
Is printing enabled?
        ↓
What output is selected?
        ↓
How many prints?
        ↓
What is the price?
        ↓
Generate final composition
        ↓
Send print job
        ↓
Report result
```

The exact desktop printer implementation is intentionally **not part of Phase 1**.

Phase 1 only establishes that printing is a booth responsibility.

---

# 12. Digital Sharing Requirement

The booth can support digital delivery depending on `sharingConfig`.

The currently identified capabilities include:

* QR
* download
* WhatsApp
* email
* SMS
* copy
* native sharing

The booth uses backend APIs to generate and update share tokens and to deliver sharing links.

---

# 13. Photo/Data Upload Requirement

The booth must be capable of uploading:

* final composite/print output
* raw photographs

through the existing upload API.

Current API:

`POST /api/upload`

The backend stores the uploaded content in S3 according to the existing implementation.

The Electron application should therefore treat upload as part of the session-completion lifecycle.

---

# 14. Branding Requirement

The booth must be capable of reflecting event-specific branding.

Currently identified branding inputs include:

* logo
* primary color
* overlay
* selectable logos
* event name/tagline where applicable

The Electron UI should therefore not assume that every event uses the same branding.

---

# 15. Payment Requirement

Payment is **event/configuration dependent**.

The booth should not assume every session requires payment.

Conceptually:

```text
Event configuration
       ↓
Payment enabled?
       │
   ┌───┴───┐
   NO      YES
   │        │
   ↓        ↓
Continue   Calculate amount
            ↓
          Payment
            ↓
          Verify
            ↓
          Continue
```

The current system supports Razorpay order creation/status polling and free/zero-price completion.

---

# 16. Session Requirement

A booth session represents one customer's complete interaction.

Conceptually:

```text
Event
 │
 ├── Session 1
 │    ├── captures
 │    ├── selected photos
 │    ├── customization
 │    ├── final output
 │    ├── payment
 │    ├── print
 │    └── sharing
 │
 ├── Session 2
 │
 └── Session 3
```

The Electron application must keep the session lifecycle isolated so that when a session finishes, the next guest starts with a clean state.

The exact persistence model will be designed in a later phase.

---

# 17. Platform Boundary

The Electron application should share as much booth logic as possible with the existing React Native application.

### Shared concepts

* API contract
* types
* event/session models
* booth state machine
* business flow
* UI behavior
* payment flow
* event joining
* template logic
* filtering
* preview
* print-request generation

### Desktop-specific concepts

* camera provider
* printer provider
* filesystem/local storage
* kiosk behavior
* Windows/macOS native integration
* desktop hardware access

This follows the existing research architecture.

---

# 18. Electron Is NOT Responsible For

Unless we later explicitly decide otherwise, Electron should not become responsible for:

* CRM administration
* client management
* event creation
* event configuration management
* backend database management
* server-side business logic
* replacing the existing backend
* replacing the CRM

The booth consumes the backend/CRM's configuration and executes it.

---

# 19. Core Product Principle

The complete relationship should be:

```text
                 CRM
                  │
        "How should this event
             behave?"
                  │
                  ↓
               Backend
                  │
            API / Data
                  │
                  ↓
          Electron Booth
                  │
       "Execute this locally."
                  │
        ┌─────────┼─────────┐
        ↓         ↓         ↓
      Camera   Rendering  Printer
        │         │         │
        └─────────┼─────────┘
                  ↓
             Final Output
                  │
          ┌───────┴───────┐
          ↓               ↓
        Print           Digital
```

---

# 20. Current API Requirements

The Electron booth will need the equivalent of the current booth API contract.

### Authentication

```text
POST /api/auth/login
```

### Events

```text
GET  /api/events
POST /api/events/public/join
GET  /api/events/public/list
GET  /api/events/:eventId
```

### Settings

```text
GET /api/settings/public?eventId=...
```

### Device

```text
GET  /api/devices/current-event
POST /api/devices/ping
```

### Upload

```text
POST /api/upload
```

### Logo

```text
GET /api/proxy/logo?url=...
```

### Sharing

```text
POST /api/share/generate
PUT  /api/share/:token
POST /api/share/deliver/:token
```

### Payments

```text
POST /api/payments/create-order
GET  /api/payments/status/:paymentId
POST /api/payments/free-complete
POST /api/payments/verify
```

### Coupons

The existing research identified a discrepancy:

```text
Frontend:
POST /api/coupons/validate

Backend:
POST /api/coupons/public/validate
```

This should be validated before implementation.

---

# 21. Known Existing-System Gaps

These are recorded as **existing-system observations**, not changes we are making yet.

### 21.1 Coupon endpoint mismatch

Frontend and backend currently appear to use different paths.

**Status:** Validate later.

### 21.2 Payment development bypass

The current payment screen contains visible development bypass functionality.

**Requirement for production Electron:** Do not expose development bypasses.

### 21.3 Device-token vs login flow

The underlying provider supports device assignment, but Boot currently routes through Login.

**Status:** Product decision required.

### 21.4 Countdown

`countdownDuration` exists in configuration, but capture currently uses 3 seconds.

**Status:** Determine intended production behavior.

### 21.5 Slot architecture vs visual templates

SlotSelection currently uses local/default architecture while CRM visual templates appear later in Customize.

**Status:** Understand and formally document before changing.

### 21.6 Payment response/type differences

The research identified some differences between visible API typings/backend responses.

**Status:** Validate against the actual backend before implementation.

---

# 22. Phase 1 Definition of Done

Phase 1 will be considered complete when we can answer all of these questions:

### Product

* What exactly is the Electron booth?
* Who uses it?
* What does a guest do?
* What does the booth do?
* What remains in CRM/backend?

### Event

* What event data reaches the booth?
* Which event fields control which behavior?
* Which settings are global vs event-specific?

### Flow

* What are all booth screens?
* What is the normal session flow?
* Which screens are conditional?
* What starts/ends a session?

### Backend

* Which APIs does the booth require?
* What does each API provide?
* When is each API called?

### Platform

* What is shared with React Native?
* What must be rewritten for Electron?
* Which functionality requires native desktop integration?

### Unresolved behavior

* Device-token onboarding?
* Login/passkey onboarding?
* Slot/template relationship?
* Countdown behavior?
* Coupon behavior?
* Payment behavior?
* Any backend inconsistencies?

If any of these are still unknown, they remain explicitly marked **TBD**, rather than being silently assumed.

---

# 23. Phase 1 Boundary

This document intentionally does **not** define:

* Electron folder structure in final detail
* React component implementation
* IPC implementation
* camera SDK implementation
* printer SDK implementation
* local database choice
* offline synchronization algorithm
* image-rendering implementation
* Windows/macOS packaging
* installer
* auto-update
* hardware SDK selection

Those belong to later phases.

---

# 24. Phase 1 Final Model

The entire product can currently be reduced to this:

```text
                    HAPPYPIX CRM
                         │
                         │
                  Event Configuration
                         │
                         ↓
                  HAPPYPIX BACKEND
                         │
                         │ API
                         ↓
              ┌─────────────────────┐
              │   ELECTRON BOOTH    │
              │                     │
              │ Event Configuration │
              │ Booth Flow          │
              │ Session             │
              │ Payment             │
              │ Capture             │
              │ Customize           │
              │ Upload              │
              │ Sharing             │
              └──────────┬──────────┘
                         │
                 Platform Services
             ┌───────────┼───────────┐
             ↓           ↓           ↓
          Camera      Renderer     Printer
             │           │           │
             └───────────┼───────────┘
                         ↓
                    Final Output
                         │
                  ┌──────┴──────┐
                  ↓             ↓
                Print        Digital
```

### The fundamental rule

> **CRM configures the event. Backend exposes that configuration. Electron executes the booth experience. Hardware services perform the physical operations.**

That is the baseline we should validate before moving to Phase 2.
