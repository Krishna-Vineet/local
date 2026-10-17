# Booth App (Client) Migration Plan

This document outlines the analysis of how the HappyPix Booth App (`client`) was connected to the old CRM, and what changes are required in the new CRM architecture to support it.

## 1. Analysis of the Old Connection Architecture

In the old CRM model, the booth app operated mostly standalone and joined events via passkeys:
- **Event Discovery:** The booth called `/api/events/public/list` to see public events.
- **Joining an Event:** The operator manually entered a `passkey` and called `/api/events/public/join` to get the event data.
- **Settings:** It called `/api/settings/public` to retrieve global or event-specific payment and booth timeout settings.
- **Device Registration:** Devices were loosely tracked. They pinged `/api/devices/ping` but didn't have strong tenant isolation or robust hardware telemetry.
- **Payments & Coupons:** The booth handled Razorpay orders via `/api/payments/*` and `/api/coupons/public/validate`.

## 2. The New CRM Architecture Paradigm

The new CRM is strictly multi-tenant. Events no longer have passkeys, and booths are treated as dedicated hardware bound to an Organization.

### Key Changes:
1. **Device Pairing over Passkeys:** Booths no longer "join" events. Instead, the booth is **registered** to an Organization. The CRM Admin then **assigns** an event to the booth remotely from the CRM Dashboard.
2. **Persistent Device Tokens:** The booth stores an `x-device-token` in `localStorage` which it sends with every API request. This identifies the Organization, the Device, and its current Event.
3. **Telemetry & Hardware Health:** The booth must report its battery percentage, camera connection, and printer connection during its heartbeat (`ping`).
4. **Tenant Isolation:** Every operation (uploading photos, creating support tickets, processing payments) is automatically scoped to the Organization via the `x-device-token`.

## 3. Required Updates to the Booth App (`client` folder)

To make the existing booth app work with the new backend, we need to update its API calls and UI flow.

### Phase 1: Authentication & Pairing Flow
- **Remove** the `JoinEvent` screen that asks for a Passkey.
- **Add** a `BoothLogin` screen. The operator will enter the Organization Admin's email and password to call `POST /api/devices/booth-login`.
- The response will contain a `deviceToken`. The app will save this and send it in the `x-device-token` header for all future requests.

### Phase 2: Remote Event Assignment
- **Add** a "Waiting for Assignment" screen.
- The booth app will poll `GET /api/devices/current-event` every 30 seconds.
- When the CRM Admin assigns an event to this booth, the API will return the event details (templates, branding, prices), and the booth will automatically start the photo capture flow.

### Phase 3: Telemetry & Ping Updates
- Update the `POST /api/devices/ping` payload. The booth app needs to send hardware status:
  ```json
  {
    "telemetry": { "prints": 150, "shutters": 200, "batteryPct": 85 },
    "connections": { "camera": true, "printer": true, "kioskScreen": false }
  }
  ```

### Phase 4: Support & Payments
- Update `POST /api/support` to include the `sessionId` and `guestName`/`guestPhone` rather than just a generic message.
- Ensure the payment endpoints (`/api/payments/*`) use the new `OrganizationDefaults` instead of the legacy `Setting` model.

## 4. Required Backend Updates (`server.js` & `deviceRoutes.js`)

To support the updated client app, the backend routes need minor adjustments:
1. **`deviceRoutes.js`:** Ensure `/booth-login` checks against the new `User` model with `role: 'ORG_ADMIN'`.
2. **`deviceRoutes.js`:** Ensure `/ping` updates the new telemetry fields in the `Device` model.
3. **`deviceRoutes.js`:** Ensure `/current-event` correctly populates the event details when the `Device.assignedEventId` is set.
4. **`supportRoutes.js`:** Update to map to the new `SupportTicket` schema.

---

*This plan acts as the blueprint for refactoring the client folder and updating the client-facing APIs.*
