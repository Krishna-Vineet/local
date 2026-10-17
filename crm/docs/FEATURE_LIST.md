# HappyPix CRM — Feature List

This document inventories the user-facing and operational capabilities of the HappyPix CRM.

## 1. Shared features

- Secure email/password sign-in
- Session refresh and sign-out
- Failed-login throttling in demo contract
- Forgotten-password code flow
- Self-service password change
- Verified email-change flow
- Name and profile-photo management
- Light and dark themes
- Role-aware sidebar navigation
- Protected routes and API permissions
- Responsive cards, tables, filters, dialogs, empty states, and status indicators
- In-app success and error notifications
- Demo-data reset in mock mode

## 2. Platform workspace

### Platform Dashboard

- Organization totals and lifecycle summary
- Active and trial organization counts
- Device online/offline and operational health
- Active, upcoming, and finished event counts
- Expiring plan and trial alerts
- Organizations approaching plan limits
- Recent organization sign-ups
- Owner-only revenue summary and shortcut

### Platform Revenue — Owner

- Net, financial-year, and monthly subscription revenue
- Month and quarter summaries
- Organization-level revenue table
- Plan status and expiry context
- Year selection and reporting views

### Organizations

- Search, status, and plan filters
- Paginated organization directory
- Owner, contact, plan, device, event, and activity details
- Full organization detail view
- Subscription and invoice details
- Device and event context
- Revenue context
- Owner-only suspend, ban, and restore actions
- Mandatory suspension and ban reasons
- Audit records for lifecycle actions

### Organization Support

- Review pending support requests from organizations
- Accept requests into numbered tickets
- Deny requests with a visible reason
- Shared conversation between organization and platform staff
- Image attachments
- Resolve and reopen tickets
- Search and status filtering

### Subscription Plans — Owner

- View plan catalogue
- Add plans
- Edit price, duration, device limits, and event limits
- Activate or hide plans
- Prevent unsafe mutation of stable plan keys
- Enforce changed limits in organization operations

### Template Library — Owner and Platform Admin

- Browse global print templates
- Direct-upload and design-playground workflows
- AI-assisted draft generation
- Preview before saving
- Publish, unpublish, edit, and delete where allowed
- Universal and layout-specific design scopes
- Slot-count and orientation selection
- Layout-aware template rendering
- Protection for built-in and in-use templates
- Organization event integration

### Internal Team & Roles

- Owner creates Platform Admin and Support Manager accounts
- View the fixed five-role model
- Owner deactivates or reactivates internal users
- Existing names and emails remain self-managed
- Platform Admin receives read-only internal-team visibility
- Owner self-deactivation protection

### Gallery Settings — Owner and Platform Admin

- Enable or disable organization galleries platform-wide
- Enable or disable the guest publishing-permission requirement
- Immediate policy summary
- Audit logging for policy changes
- Consent-aware gallery behavior across all organizations

### Platform Audit & Logs

- Privileged activity history
- Actor, action, entity, severity, organization, and time context
- Search and filtering controls
- Platform-level authorization

## 3. Organization workspace

### Organization Dashboard

- Organization identity and plan status
- Plan usage and warnings
- Event summary
- Booth connectivity overview
- Support summary
- Organization Admin revenue and payout context
- Operational shortcuts

### Organization Revenue — Organization Admin

- Paid, pending, and failed payment summaries
- Revenue by event
- Revenue by booth/device
- Event-by-booth matrix
- Monthly breakdowns
- UPI versus HappyPix-wallet settlement context
- Wallet credited, withdrawn, processing, and available values
- Withdrawal requests with minimum and balance validation
- Payout destination from Organization Defaults

### Events & Devices — Organization Admin and Manager

#### Events

- Search and status filtering
- Create and edit events
- Client, venue, start, and end details
- Pause and resume
- Safe deletion rules
- Active-event plan limit enforcement
- Template multi-selection
- Photo-filter selection
- Digital-copy availability
- Event-specific print-price overrides
- Branding logos and tagline
- Automatic effective-price snapshot

#### Devices

- Booth/device list
- Online and offline state
- Camera, printer, and kiosk-screen connection health
- Print, shutter, battery, and last-seen telemetry
- Device naming
- Operator name and phone
- Assign and unassign an event
- Remove a paired device
- Device-limit enforcement

### Gallery — Organization Admin and Manager

- Final print-ready image grid
- Event dropdown filter
- Booth dropdown filter
- Organization-only image access
- Full-image opening
- Event, booth, and generated-time metadata
- Platform-disabled state
- Explicit-consent filtering when required
- All-final-image mode when consent is not required

### HappyPix Support — Organization Admin and Manager

- Raise a platform review request
- Select issue context and add details
- Attach images
- See acceptance or denial decisions
- Reapply after denial with new information
- Continue ticket conversation after acceptance
- View resolution state

### Guest Support — Organization Admin and Manager

- View tickets raised from booth sessions
- Filter by status and priority
- Inspect guest, event, booth, payment, and session context
- Read message history
- Reply to a ticket
- Resolve or reopen an issue

### Organization Defaults

- Organization name and logo baseline
- Booth idle timeout in seconds
- UPI address
- UPI or HappyPix-wallet payout mode
- Price for every supported print-layout iteration
- Organization Admin editing
- Organization Manager read-only access
- Input and pricing validation

### Coupons — Organization Admin

- Create percentage or fixed-discount coupons
- Quantity limits and usage counts
- Expiry dates
- All-event or selected-event scope
- Pause and reactivate
- Delete
- Exhausted and expired indicators
- Server-side redemption rules in the backend contract

### Organization Team & Roles

- View organization members
- Organization Admin creates Admin or Manager accounts
- Organization Manager has read-only visibility
- Existing name, email, and role editing is blocked
- Organization Admin deactivates or reactivates another member
- Self-deactivation protection
- Last-active-admin protection
- Fixed-role explanations
- Self-service credentials and profile identity

## 4. Data integrity and safety rules

- Fixed role matrix with no caller-defined roles
- Fail-closed organization tenancy
- Computed subscription status
- Event and device plan limits
- Immutable event price snapshots
- Valid date-range enforcement
- Active-template validation
- Media URL scheme validation
- Mandatory lifecycle reasons
- Session revocation for deactivated users
- Atomic coupon-redemption requirement in production
- Organization-scoped gallery queries
- Explicit guest consent when the permission policy is enabled
- Audit logging for privileged mutations

## 5. Development and quality features

- Full in-browser demo API
- Deterministic seeded data
- Mock and real API switching
- Typed endpoint catalogue
- API contract smoke tests
- Role-by-screen render tests
- Production build verification
- Offline-friendly application assets
- Centralized design tokens and UI components
- Documented backend changes and security requirements
