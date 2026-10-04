# HappyPix Ecosystem Architecture & Electron Integration Plan

This document outlines the current state of the HappyPix ecosystem (CRM, Backend, Electron) and details the roadmap for building the Electron app's backend and connecting it to the CRM.

---

## 1. Current State: What is in the CRM? (`/crm`)

The CRM is a React-based web dashboard that serves two primary types of users:
1.  **Platform Owner (Superadmin):**
    *   Has access to the **Platform Dashboard** to view system-wide health.
    *   Can see all organizations, total revenue, active events, and connected devices across all clients.
    *   Can Suspend, Ban, or Restore organizations.
    *   Manages global Subscription Plans, Templates, and Support Tickets.
2.  **Organization Admin (Tenant):**
    *   Has access to the **Organization Dashboard** to manage their specific photo booth business.
    *   Can create and manage Events (dates, templates, overlays).
    *   Can generate **Pairing Codes** to connect physical devices (Android/Electron) to their account.
    *   Views their specific event gallery and print revenue.

---

## 2. Current State: What is in the Backend? (`/backend`)

The backend is a robust Node.js/Express application connected to MongoDB. It acts as the central source of truth.
*   **Multi-Tenancy:** Every piece of data (Events, Devices, Payments) is strictly scoped to an `OrganizationId`. The `auth.js` middleware ensures data isolation between clients.
*   **Role-Based Access Control (RBAC):** Strict validation using `requireOwner`, `requireOrgAdmin`, and `requirePlatformRole`.
*   **Device Authentication:** Devices (Android/Electron) authenticate via `deviceRoutes.js`. They send a hardware MAC address and a short Pairing Code (generated in the CRM) to receive an `x-device-token`. All subsequent device requests use this token.
*   **Dynamic Data:** Endpoints like `/api/platform/dashboard` and `/api/platform/revenue` dynamically aggregate real-time data from MongoDB (using the `Payment` collection for revenue).

---

## 3. Current State: What is in the Electron App? (`/electron`)

Currently, the Electron app is a fresh scaffold using **Vite + React + TypeScript**.
*   It has the basic folder structure:
    *   `src/electron/` ➔ The Main Process (Node.js backend for the local PC).
    *   `src/ui/` ➔ The Renderer Process (React frontend for the booth screen).
*   *It does not yet contain HappyPix business logic, camera integration, or cloud authentication.*

---

## 4. How the Electron App's Backend Will Be Written

The Electron app requires its own "Local Backend" (running in `src/electron/main.ts`) because a standard web browser cannot directly access USB Printers or DSLR cameras.

### A. Local Hardware Modules
1.  **Camera Module:** We will write a Node.js script using `child_process` to execute camera tethering libraries (like `gphoto2` for Mac/Linux or `digiCamControl` for Windows). This will capture RAW/JPG files directly to the local hard drive.
2.  **Printer Module:** We will integrate a local print spooler library (e.g., `pdf-to-printer` or `unix-print`) to send customized photo strips directly to connected dye-sublimation printers (e.g., DNP RX1).
3.  **Local File System:** All photos and heavy assets (overlays/templates) will be cached locally using Node's `fs` module to ensure the booth operates smoothly even if the internet disconnects.

### B. IPC Bridge (Inter-Process Communication)
The React UI (`src/ui`) will not touch hardware directly. Instead, it will send messages to the local backend via a secure bridge:
*   UI clicks "Take Photo" ➔ `window.electronAPI.triggerCamera()`
*   Electron Main Process hears this, triggers the USB camera, saves the file locally, and sends the image path back to the UI to display on screen.

---

## 5. How the Electron App Will Connect to the CRM

The Electron app will act exactly like an Android Tablet. It will **not** require any massive changes to the CRM.

1.  **Pairing Process:** 
    *   The user opens the Electron app and sees a "Pairing Screen".
    *   The user logs into the web CRM, goes to "Devices", and generates a 6-digit Pairing Code.
    *   The user enters this code into the Electron app. The Electron app hits the Cloud Backend `POST /api/devices/pair`, receives its `x-device-token`, and stores it locally (`electron-store`).
2.  **Fetching Events (Syncing):**
    *   The Electron app polls `GET /api/devices/current-event` using its token.
    *   If the CRM user updates the template or overlay, the Electron app detects the change and downloads the new images locally.
3.  **Uploading Photos (Queue):**
    *   When a photo is taken, it is saved locally first.
    *   A background process in the Electron app uploads the photo to the Cloud Backend (`POST /api/events/upload`).
    *   If the internet is down, the photo stays in a local SQLite queue and uploads automatically when the connection is restored.
4.  **Telemetry (Health Monitoring):**
    *   The Electron Main process checks PC battery, camera battery, and printer paper status.
    *   It sends a heartbeat to the Cloud Backend (`POST /api/devices/health`). 
    *   The CRM fetches this from the Cloud Backend and displays a warning to the owner if the printer is out of paper.

This architecture ensures the Cloud Backend remains the source of truth, the CRM remains the control panel, and the Electron app functions as a powerful, offline-capable hardware client.
