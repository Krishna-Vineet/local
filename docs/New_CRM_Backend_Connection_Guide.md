# New CRM Backend Connection Guide

This document outlines the features and screens of the newly built HappyPix CRM (`/crm`) and maps out exactly what API routes and controllers need to be implemented in the `backend` folder to support them. 

The new CRM is strictly divided into two isolated workspaces: **Platform** (for HappyPix owners/admins) and **Organization** (for individual photobooth businesses). 

All backend routes for the CRM should fall under three main namespaces: `/api/auth`, `/api/platform`, and `/api/org`.

---

## 1. Authentication & Identity (`/api/auth`)

The CRM uses a unified authentication surface. Users manage their own identity (passwords, emails, profiles) rather than having other admins change it for them.

| CRM Feature / Screen | Expected Backend Route | HTTP Method | Action |
| :--- | :--- | :--- | :--- |
| **Login Screen** | `/api/auth/login` | POST | Authenticate and issue JWT. |
| **Session Hydration** | `/api/auth/me` | GET | Fetch current user role, scope, and details. |
| **User Profile / Settings** | `/api/auth/profile` | PUT | Update name, avatar, etc. |
| **Security Settings** | `/api/auth/password` | POST | Change password. |
| **Logout** | `/api/auth/logout` | POST | Revoke token/clear cookie. |
| **Forgot Password** | `/api/auth/forgot-password` | POST | Issue 6-digit OTP to email. |
| **Reset Password** | `/api/auth/reset-password` | POST | Verify OTP and reset password. |
| **Change Email (Step 1)** | `/api/auth/email/change-request`| POST | Verify current password, send OTP to new email. |
| **Change Email (Step 2)** | `/api/auth/email/change-confirm`| POST | Verify OTP, update email. |

---

## 2. Platform Workspace (`/api/platform`)

This workspace is for the **Owner**, **Platform Admin**, and **Support Manager**. It manages the HappyPix business as a whole.

### 2.1 Core & Tenancy
| CRM Feature / Screen | Expected Backend Route | HTTP Method | Action |
| :--- | :--- | :--- | :--- |
| **Platform Dashboard** | `/api/platform/dashboard` | GET | Global metrics, active orgs, recent activity. |
| **Platform Revenue** | `/api/platform/revenue` | GET | Aggregated platform fee revenue. |
| **Organizations List** | `/api/platform/organizations` | GET | List all tenant organizations. |
| **Org Details** | `/api/platform/organizations/:id` | GET | View specific org details. |
| **Org Lifecycle** | `/api/platform/organizations/:id/suspend` | POST | Suspend org (requires reason). |
| **Org Lifecycle** | `/api/platform/organizations/:id/ban` | POST | Ban org (requires reason). |
| **Org Lifecycle** | `/api/platform/organizations/:id/restore` | POST | Restore suspended/banned org. |

### 2.2 Operations & Configuration
| CRM Feature / Screen | Expected Backend Route | HTTP Method | Action |
| :--- | :--- | :--- | :--- |
| **Internal Team** | `/api/platform/users` | GET/POST/PUT | Manage internal platform staff. |
| **Plans & Pricing** | `/api/platform/plans` | GET/POST/PUT | Manage subscription plans/limits. |
| **Template Library** | `/api/platform/templates` | GET/POST/PUT/DEL | CRUD for global print templates. |
| **AI Generator** | `/api/platform/templates/ai-generate`| POST | Trigger AI template generation. |
| **Gallery Policy** | `/api/platform/gallery-settings`| GET/PUT | Set global rules (Off, On, Consent-only). |
| **Platform Audit** | `/api/platform/audit` | GET | Global system audit logs. |

### 2.3 HappyPix Support (Platform side)
| CRM Feature / Screen | Expected Backend Route | HTTP Method | Action |
| :--- | :--- | :--- | :--- |
| **Support Inbox** | `/api/platform/support` | GET | List tickets raised by Organizations. |
| **Ticket Details** | `/api/platform/support/:id` | GET | View ticket details. |
| **Ticket Workflow** | `/api/platform/support/:id/accept` | POST | Accept ticket for review. |
| **Ticket Workflow** | `/api/platform/support/:id/deny` | POST | Deny invalid requests. |
| **Ticket Workflow** | `/api/platform/support/:id/reply` | POST | Reply to the organization. |
| **Ticket Workflow** | `/api/platform/support/:id/resolve`| POST | Mark ticket as resolved. |

---

## 3. Organization Workspace (`/api/org`)

This workspace is for **Organization Admins** and **Organization Managers** (the photobooth businesses).

### 3.1 Business & Operations
| CRM Feature / Screen | Expected Backend Route | HTTP Method | Action |
| :--- | :--- | :--- | :--- |
| **Org Dashboard** | `/api/org/dashboard` | GET | Events, active booths, recent revenue. |
| **Org Revenue** | `/api/org/revenue` | GET | Transaction history and stats. |
| **Wallet/Payouts** | `/api/org/wallet` | GET | View balance. |
| **Wallet/Payouts** | `/api/org/wallet/withdraw` | POST | Request payout (min ₹500) to UPI. |
| **Org Defaults** | `/api/org/defaults` | GET/PUT | Baseline identity, payout settings, base prices. |
| **Coupons** | `/api/org/coupons` | GET/POST/PUT/DEL | Manage promo codes. |
| **Org Team** | `/api/org/team` | GET/POST/PUT | Invite managers, activate/deactivate accounts. |
| **Org Audit** | `/api/org/audit` | GET | Org-scoped audit logs. |

### 3.2 Event & Device Management
| CRM Feature / Screen | Expected Backend Route | HTTP Method | Action |
| :--- | :--- | :--- | :--- |
| **Events List** | `/api/org/events` | GET | List org events. |
| **Event Builder** | `/api/org/events` | POST | Create event (snapshot prices). |
| **Event Edit** | `/api/org/events/:id` | PUT | Edit event details. |
| **Event Lifecycle** | `/api/org/events/:id/pause` | POST | Pause live event. |
| **Event Lifecycle** | `/api/org/events/:id/resume`| POST | Resume paused event. |
| **Devices List** | `/api/org/devices` | GET | List paired booths/kiosks. |
| **Device Config** | `/api/org/devices/:id` | PUT | Update name, printer health. |
| **Device Assign** | `/api/org/devices/:id/assign` | POST | Pair device to an Event. |
| **Device Unassign**| `/api/org/devices/:id/unassign`| POST | Remove device from Event. |

### 3.3 Media & Support
| CRM Feature / Screen | Expected Backend Route | HTTP Method | Action |
| :--- | :--- | :--- | :--- |
| **Gallery** | `/api/org/gallery` | GET | View final flat images (filtered by policy/consent). |
| **Guest Tickets** | `/api/org/tickets` | GET | List support requests from booth guests. |
| **Ticket Workflow**| `/api/org/tickets/:id/reply` | POST | Reply to guest. |
| **Ticket Workflow**| `/api/org/tickets/:id/resolve`| POST | Resolve guest issue. |
| **Platform Help** | `/api/org/platform-support` | GET/POST | Raise tickets to HappyPix internal support. |
| **Platform Help** | `/api/org/platform-support/:id/reapply`| POST | Reapply after ticket denial. |
| **Ticket Workflow**| `/api/org/tickets/:id/reopen` | POST | Reopen resolved guest issue. |

---

## 4. Booth-to-CRM API Contract (`/api/booth`)

The booth application connects to the backend and pushes data that the CRM reads. The CRM does not control the booth directly.

| Booth Action | Expected Backend Route | HTTP Method | Action |
| :--- | :--- | :--- | :--- |
| **Device Login** | `/api/booth/login` | POST | Authenticate, assign UUID, issue `deviceToken`. |
| **Session Restore**| `/api/booth/bootstrap` | GET | Reconnect powered-up booth using `deviceToken`. |
| **Telemetry Push** | `/api/booth/devices/:uuid/telemetry` | POST | Push prints, battery, and hardware health. |
| **Guest Tickets** | `/api/booth/tickets` | POST | Create support ticket with session context. |

---

## Next Steps for Backend Implementation

1. **Routing Setup**: Create `backend/routes/crm/auth.js`, `platform.js`, and `org.js` to handle these specific namespaces.
2. **Middleware**: Implement strictly separated middleware:
   - `requirePlatformRole(['OWNER', 'PLATFORM_ADMIN', 'SUPPORT_MANAGER'])` for `/api/platform/*`
   - `requireOrgRole(['ORG_ADMIN', 'ORG_MANAGER'])` for `/api/org/*`
3. **Database Adjustments**: Ensure models support the new paradigms (e.g., event price snapshots instead of global references, unified user accounts with self-service identity updates).
4. **Integration**: Connect `server.js` to mount `/api/platform` and `/api/org`. The new CRM's Vite proxy can then communicate with the actual backend instead of the mock data.
