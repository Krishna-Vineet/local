# Android Booth App (`client-app`) Migration Plan

This document outlines how the Android Booth app (`client-app` monorepo) was connected to the old CRM, and how it needs to be updated to integrate seamlessly with the new CRM architecture.

## 1. How the Android App Connected to the Old CRM

In the previous system, the Android app operated using a loosely-coupled "Passkey" system:
- **Event Discovery & Joining**: The app used `EventAPI.listPublic()` and `EventAPI.join({ eventId, passkey })` to connect to a specific event. The operator had to manually select an event and enter a passkey.
- **API Client Structure**: The `packages/api/src/index.ts` file acts as the bridge. It maintains an optional `_deviceToken` and `_authToken`.
- **Telemetry**: The app sent periodic `DeviceAPI.ping()` requests to the server, primarily to check if the event was still active or if it was disconnected.
- **Payments & Uploads**: Endpoints like `UploadAPI`, `PaymentAPI`, and `CouponAPI` relied on the event context but lacked strict multi-tenant isolation.

## 2. The New CRM Architecture 

The new backend and CRM have moved to a strict multi-tenant architecture. Events no longer use passkeys. Instead, the hardware (Android tablet) is registered to an Organization.

**The New Flow:**
1. **Device Pairing**: The Android app must login using the Organization Admin's credentials (`orgId`, `password`) via a new `booth-login` endpoint.
2. **Persistent Identity**: The server returns a `deviceToken`. This token identifies the Organization, the Device itself, and any Event assigned to it. The app must store this and send it in the `x-device-token` header for all requests.
3. **Remote Assignment**: The operator no longer manually joins an event. Instead, the app polls `DeviceAPI.getCurrentEvent()`. When the CRM Admin assigns an event to this tablet via the web dashboard, the app automatically transitions to that event.
4. **Hardware Telemetry**: The `ping` payload now requires hardware telemetry (`batteryPct`, `prints`, `camera` connection status) to display on the CRM dashboard.

## 3. Required Changes in `client-app`

To make the Android app work with the new backend, the following updates are required:

### A. Update `packages/api/src/index.ts`
1. **Remove Old Event Join API**: Remove `EventAPI.join` and `EventAPI.listPublic` as they are no longer used.
2. **Add Booth Login API**:
   ```typescript
   export interface BoothLoginPayload {
     orgId: string;
     password: string;
     deviceName?: string;
     location?: string;
   }
   export interface BoothLoginResponse {
     deviceToken: string;
     deviceId: string;
     deviceName: string;
     currentEventId: string | null;
   }
   export const DeviceAPI = {
     // ... existing methods
     login: (payload: BoothLoginPayload): Promise<BoothLoginResponse> => 
       request('POST', '/api/devices/booth-login', payload),
   }
   ```
3. **Update Ping Payload**:
   ```typescript
   export interface PingPayload {
     telemetry?: { prints: number; shutters: number; batteryPct: number };
     connections?: { camera: boolean; printer: boolean; kioskScreen: boolean };
   }
   ```

### B. Update Android UI (`apps/booth`)
1. **Remove Passkey Screens**: Delete the `JoinEventScreen` / `EventListScreen`.
2. **Create Registration Screen**: Add a new initial screen where the operator enters the `Organization ID` and `Password` to call `DeviceAPI.login()`.
3. **Save Token**: Upon successful login, save the `deviceToken` to secure storage (e.g., `AsyncStorage` or `SecureStore`) and call `configureApi(baseUrl, token)`.
4. **Waiting Screen & Polling**: Create a "Waiting for Event" screen that polls `DeviceAPI.ping()` every 30 seconds. If `currentEventId` changes, automatically fetch the event details using `DeviceAPI.getCurrentEvent()` and transition to the photo capture flow.
5. **Support Ticket Routing**: Ensure any support tickets created from the Android app use `ticketType: 'end_user'` (the default) so they are properly routed within the Organization's CRM.

---
*Follow these steps to fully sync the React Native/Android workspace with the new Node.js Express backend and React Web CRM.*
