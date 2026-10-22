# HappyPix — User & Admin Guide

> **For:** booth operators, organization admins, platform staff.
> **Assumes no technical background** beyond using a browser and a touchscreen.
> **Print this.** The first three pages are the ones you want in the booth bag.
> **Last updated:** 2026-10-23.

---

## Table of contents

1. [Getting started (customer onboarding)](#1-getting-started-customer-onboarding)
2. [Your first event in 15 minutes](#2-your-first-event-in-15-minutes)
3. [Building your brand defaults](#3-building-your-brand-defaults)
4. [Templates and pricing](#4-templates-and-pricing)
5. [Pairing a booth](#5-pairing-a-booth)
6. [Running an event (operator card)](#6-running-an-event-operator-card)
7. [Guest experience step by step](#7-guest-experience-step-by-step)
8. [Printing, media and quality](#8-printing-media-and-quality)
9. [Sharing and digital delivery](#9-sharing-and-digital-delivery)
10. [Gallery and photo management](#10-gallery-and-photo-management)
11. [Coupons, payments and revenue](#11-coupons-payments-and-revenue)
12. [Team, roles and permissions](#12-team-roles-and-permissions)
13. [Platform administration](#13-platform-administration)
14. [Troubleshooting](#14-troubleshooting)
15. [Support](#15-support)

---

## 1. Getting started (customer onboarding)

### 1.1 Create your account

1. Go to **happypix.in** → **Pricing**.
2. Choose a plan and a billing period (monthly, quarterly, 6-monthly or annual — longer is cheaper
   per month).
3. Enter your business name, your name, email and phone.
4. Pay via card or UPI on the secure Razorpay page.
5. Check your email — you'll receive a CRM invitation link.

A 14-day free trial is available with 1 booth and 1 event, including printing and QR downloads.

### 1.2 First login

1. Open **crm.happypix.in** (or the link in your email).
2. Sign in with the email you used at checkout and the password you set.
3. You land on the **Organization Dashboard**.

If you cannot sign in: use **Forgot password** (a one-time code is emailed). After five wrong
attempts the account locks for 15 minutes — this is deliberate.

### 1.3 What's in the sidebar

| Menu | What it's for |
|---|---|
| **Dashboard** | Your business at a glance: events, sessions, prints, revenue |
| **Events & Devices** | Create events, pair and monitor booths |
| **Gallery** | Every guest session, grouped, downloadable |
| **Templates** | Choose designs, create your own |
| **Coupons** | Discount codes |
| **Revenue** | Money in, per event and per layout |
| **Defaults** | Your baseline branding, prices, payment settings |
| **Team** | Invite staff |
| **Guest Support** | Guest issue tickets from booths |
| **HappyPix Support** | Raise issues to the HappyPix team |

Menu items you cannot see are ones your role does not permit. That is expected.

### 1.4 Before your first paid event

- [ ] Business details and logo uploaded
- [ ] Prices set for the layouts you will offer
- [ ] Payment method chosen (UPI direct or platform wallet)
- [ ] Templates selected and previewed
- [ ] Booth hardware tested end-to-end once
- [ ] Staff invited and roles assigned
- [ ] One full test session printed and the QR scanned

---

## 2. Your first event in 15 minutes

### Step 1 — Open Events & Devices

**Events & Devices → + New Event**.

### Step 2 — Fill in the event

| Field | What to enter | Tip |
|---|---|---|
| Event name | "Kapoor × Mehta Reception" | Keep under 40 characters — it shows on the booth |
| Client name | The family or company | Internal only |
| Venue | "Crown Ballroom, Gurugram" | Helps staff find the booth |
| Start / end | Actual event hours | The event auto-marks live/finished |
| Templates | Pick 1–6 designs | Only these appear at this event |
| Filters | Which editing styles guests may use | Fewer = faster guest decisions |
| Digital copy | On for QR delivery | Turn off only if the client forbids it |
| Prices | Pre-filled from your defaults | Change per event if the client negotiated |
| Branding | Event logo + sponsor logos | Sponsors appear in the footer band |

### Step 3 — Save and note two things

* **Pairing code** — 6 digits, used once to connect the booth.
* **Event status** — starts as *upcoming*; it becomes *live* at the start time.

### Step 4 — Pair the booth

On the booth screen: enter the pairing code → the booth downloads the event and shows
**Online** in the CRM within a minute.

### Step 5 — Run a test session

Do one complete guest run before the doors open: capture, print, scan the QR. If all three work,
you are ready.

---

## 3. Building your brand defaults

**Defaults** apply to **new events only**. Changing them never alters an event already created — this
protects quotes you have given to clients.

### 3.1 Branding

| Field | Guidance |
|---|---|
| Organization name | Shown on the booth entry screen |
| Logo | PNG, transparent background, at least 600 px wide |
| Tagline | Short line ("Making memories since 2019") |
| Sponsor logos | Up to 15, shown in the footer band |

### 3.2 Prices

Prices are per **layout + number of photos**. Examples:

| Layout | 2 photos | 3 photos | 4 photos |
|---|---|---|---|
| 4×6 Postcard | ₹200 | ₹250 | ₹300 |
| 5×7 Portrait | ₹250 | ₹300 | ₹350 |
| 8×10 Guestbook | — | ₹600 | ₹700 |

Leave a price at zero to make that combination free. The booth shows the price before capture, so
guests are never surprised.

### 3.3 Payment settings

| Setting | Options | Notes |
|---|---|---|
| Payout mode | **UPI direct** or **Wallet** | UPI direct sends money straight to your UPI id; wallet collects on the platform and you withdraw |
| UPI id | e.g. `sunsetweddings@okhdfcbank` | Used to build the guest QR |
| Display name | What guests see on the payment screen | Usually the business name |
| Gateway | Razorpay keys (optional) | Only needed if you want card payments |

### 3.4 Booth behaviour

| Setting | Default | Meaning |
|---|---|---|
| Idle timeout | 60 s | How long a guest screen waits before resetting |
| QR timeout | 5 min | How long the success QR stays before returning to idle |

Set the idle timeout to 45–60 s for busy events; 90 s for relaxed ones.

---

## 4. Templates and pricing

### 4.1 Choosing templates

Open **Templates** to see what is available to you:

* **Global templates** — published by HappyPix, available to every organization.
* **Your templates** — designs you created (including AI-generated ones).

Each template shows its print size, photo count (slots) and orientation.

### 4.2 Create a template with AI

1. **Templates → Create with AI**.
2. Describe the look: *"Elegant mehendi night, gold and emerald, 3 photo strip, subtle florals"*.
3. Wait ~20–40 seconds.
4. Review the preview. Regenerate if needed.
5. **Save** — it is uploaded to your library and can be added to events.

Notes:

* AI changes **style**, not **geometry**. Photo sizes and positions are fixed by the layout so
  prints always come out correct.
* Brand names and characters (Marvel, Disney, etc.) are automatically rephrased — this keeps you safe
  from copyright claims.
* Each generation uses AI credits from your plan.

### 4.3 Print sizes available

| Size | Best for |
|---|---|
| 2×6 strip | Photo strips, favours |
| 4×6 | Classic postcard — fastest and cheapest |
| 5×7 | Framed keepsake |
| 6×8 | Gala / luxury events |
| 8×10, 8×12 | Guestbook and statement pieces |

Larger sheets cost more in media and take longer to print. Price accordingly.

---

## 5. Pairing a booth

### 5.1 What you need

* A booth device with the HappyPix Booth app installed (Android tablet, Windows PC or Mac).
* The 6-digit pairing code from the event.
* Your organization admin email and password (the first time only).

### 5.2 Steps

1. Power on the booth. It shows a pairing screen.
2. Enter the 6-digit code (or your email and password if prompted).
3. The booth downloads the event: templates, prices, branding.
4. The CRM shows the booth as **Online** with a green indicator.

### 5.3 What the booth remembers

* Its own identity — you do not re-pair every day.
* The event configuration — so it works without internet.
* Its print/shutter counters.

### 5.4 Moving a booth to a different event

1. In the CRM, open the device → **Unassign**.
2. Assign it to the new event.
3. The booth picks up the change at its next check-in (within 2 minutes).

For a different client entirely, create the event first, then assign.

### 5.5 Removing a booth

Deleting a device in the CRM makes that booth wipe itself and return to pairing the next time it
connects. Photos already uploaded stay in your gallery — they belong to your organization, not the
device.

---

## 6. Running an event (operator card)

**Print this page. Keep it at the booth.**

### Before doors open (30 minutes)

- [ ] Booth powered on and at the entry screen
- [ ] Event shows **Live** in the CRM
- [ ] Printer: new media roll loaded, lid closed
- [ ] Spare media roll within arm's reach
- [ ] Camera: battery ≥ 80 % or AC adapter connected
- [ ] Internet available (or accept offline mode knowingly)
- [ ] One test session: capture → print → QR scan
- [ ] Gallery shows the test session with the **final composite** as its cover
- [ ] Business cards / QR stand for guests

### During the event

| Situation | Do this |
|---|---|
| Guest doesn't know what to do | Tap **Start**, show them the flow once |
| Guest wants a retake | Use **Retake** on the photo-selection screen before print |
| Print looks wrong | Check the preview; if the sheet is blank, raise an issue from the success screen |
| Paper runs out | Replace the roll, clear the queue, print one test sheet |
| Payment fails | Ask the guest to retry; if it persists, switch the event to free mode or collect cash and note it |
| Queue is long | Reduce copies offered; the booth handles one session at a time |
| Guest wants digital only | They can still complete and scan the QR without printing (turn print count to the minimum) |

### After the event

- [ ] Close the event in the CRM (or let the end time pass)
- [ ] Confirm pending uploads have synced (device shows no queue)
- [ ] Reconcile print count with media used
- [ ] Check Guest Support for open tickets
- [ ] Note any issues for the next event

### The three rules

1. **Never tell a guest it printed unless you are holding the sheet.**
2. **If something breaks, use the success-screen "Report an issue" button** — it attaches the
   session, so support can find it instantly.
3. **Never power off the booth mid-session** — wait for the idle screen.

---

## 7. Guest experience step by step

| Step | Screen | What the guest sees |
|---|---|---|
| 1 | Entry | Event name, your logo, sponsor logos, event type. **Tap to start** |
| 2 | Orientation | Vertical or horizontal (if both are offered) |
| 3 | Template | Design thumbnails with prices |
| 4 | Copies | 1, 2 or 3 prints |
| 5 | Payment | UPI QR or card (skipped when free) |
| 6 | Capture | Countdown 3-2-1, flash, one photo per slot |
| 7 | Photo selection | Choose which shot fills each position |
| 8 | Customise | Filters, stickers, ornaments — live preview |
| 9 | Print | "Print it" — the sheet comes out in about 10 seconds |
| 10 | Success | QR code + "Report an issue" |
| 11 | Reset | Returns to the entry screen after the idle timeout |

**Guest coaching tip:** the two moments guests hesitate are template choice and payment. A single
sentence — *"Pick a design, then scan if it shows a price"* — keeps the line moving.

---

## 8. Printing, media and quality

### 8.1 Choosing a printer

Use a **dye-sublimation** printer (DNP, Citizen, HiTi). They print dry, instantly handleable sheets in
about 8 seconds. Office inkjet printers smear, jam and cost more per sheet.

### 8.2 Media planning

```
sheets = guests × sessions per guest × copies per session
rolls  = round up (sheets × 1.15 ÷ prints per roll)
```

Example: 200 guests, 1.2 sessions each, 2 copies → 480 sheets → 1 roll plus a spare.

**Always bring a spare roll.** Running out mid-event with 50 guests waiting is the most common
avoidable failure.

### 8.3 Print quality checklist

| Check | What good looks like |
|---|---|
| Colour | Skin tones natural; no green/orange cast |
| Sharpness | Eyes crisp at arm's length |
| Framing | No faces cut at slot edges |
| Footer | Sponsor logos fully visible, not clipped |
| Paper | Full sheet, no white bands at the edges |
| Handling | Dry after ~10 seconds; do not stack hot prints |

### 8.4 If a print is bad

1. Do not hand it to the guest.
2. Reprint from the success screen if available.
3. If the same defect repeats, stop and raise an issue — it is usually a template or driver problem,
   not the printer.

---

## 9. Sharing and digital delivery

### 9.1 How guests get digital copies

1. Session completes.
2. The booth uploads the individual photos **and** the final composite.
3. A QR code appears on the success screen.
4. The guest scans it and opens a page with the composite and each individual frame.
5. The link works for **24 hours**, then expires automatically.

No app, no account, no email required.

### 9.2 What the guest downloads

* The **final composited sheet** — the same design they saw printed, at full resolution.
* Each **individual photo**.
* Nothing else — no watermarks on paid sessions (unless you enable them).

### 9.3 If a guest says the link is broken

| Cause | Fix |
|---|---|
| More than 24 hours have passed | The link has expired. Re-send from the gallery, or explain the policy |
| Only part of the link was copied | Re-open from the gallery and share again |
| The session did not finish uploading | The booth must be online; check the device queue |
| The gallery shows one frame only | The booth app is out of date (composite upload). Update it; support can repair the session |

### 9.4 Sponsor and host logos

Sponsor logos are placed in the reserved footer band on every print and digital copy. Upload them in
the event branding section (up to 15). Use transparent PNGs and check one print — the footer is the
most common place a logo gets clipped.

---

## 10. Gallery and photo management

### 10.1 What you see

The gallery shows **one card per guest session** with the final composite as its cover. Click a card
to see all the individual frames from that session.

### 10.2 Finding a session

Filter by event and date. Search by session id if a guest shows you their QR link.

### 10.3 Downloading

Click a photo → download → you receive the full-resolution file. Downloads are secure links that
expire; do not paste them into public channels.

### 10.4 Deleting

Deleting a session removes the photos from the gallery and from storage. This cannot be undone.
Use it when:

* a guest asks to be removed;
* a session is a test;
* a photo is clearly unusable.

### 10.5 Consent and privacy

If your organization requires guest consent for gallery visibility, set it in the platform gallery
settings. Photos are never public — only your organization can see them, and every download link is
temporary.

---

## 11. Coupons, payments and revenue

### 11.1 Creating a coupon

**Coupons → + New**. Fields:

| Field | Example |
|---|---|
| Code | `MEHENDI10` |
| Type | 10 % off, or ₹50 off |
| Minimum spend | ₹200 |
| Max discount | ₹100 (caps a percentage coupon) |
| Quantity | 100 |
| Valid until | The event date |

The booth validates the code server-side, so a paused or expired code cannot be used even if a guest
remembers it.

### 11.2 How guests pay

| Mode | Experience |
|---|---|
| **UPI direct** | Guest scans a QR; money goes to your UPI id; the booth confirms automatically |
| **Card / gateway** | Guest pays on the Razorpay page; the booth confirms automatically |
| **Wallet** | Money is collected by HappyPix and added to your wallet; withdraw from **Revenue** |
| **Free** | No payment screen |

### 11.3 Revenue screen

* Revenue by day and by event.
* Split by layout (which designs earn best).
* Free vs paid session counts.
* Wallet balance and withdrawal requests.

### 11.4 Refunds

Refunds are processed through the payment gateway. Confirm the payment in the gateway dashboard and
in the CRM before refunding, and record the reason on the guest's support ticket.

---

## 12. Team, roles and permissions

### 12.1 Inviting someone

**Team → + Invite member** → name, email, role. They receive an email invitation.

### 12.2 The two organization roles

| Can do | Organization Admin | Organization Manager |
|---|---|---|
| See dashboard | ✅ | ✅ |
| See revenue | ✅ | ❌ |
| Create/edit events | ✅ | ✅ |
| Pair and manage devices | ✅ | ✅ |
| View gallery | ✅ | ✅ |
| Handle guest tickets | ✅ | ✅ |
| Edit defaults and prices | ✅ | ❌ (read-only) |
| Manage coupons | ✅ | ❌ |
| Manage team | ✅ | ❌ |
| View audit log | ✅ | ❌ |

### 12.3 Removing someone

**Team → select member → Deactivate.** Access stops immediately on their next action. Deactivation is
preferred over deletion so history and audit entries stay intact.

### 12.4 Platform staff roles (for reference)

| Role | Sees |
|---|---|
| Owner | Everything, including revenue, plans and organization suspension |
| Platform Admin | Platform health, organizations (read), templates, support |
| Support Manager | Support queues and read-only organization context |

Your organization's data is never visible to another organization. Platform staff see it only to
provide support.

---

## 13. Platform administration

For HappyPix internal staff.

### 13.1 Organization lifecycle

| State | How it happens | Tenant experience |
|---|---|---|
| Trial | New signup | Full access, limited devices/events |
| Active | Paid | Full access |
| Expiring soon | ≤ 7 days to expiry | Warning banners |
| Expired | Past expiry | Read-only; booths locked |
| Suspended | Manual (billing dispute) | Locked; reason shown; reads allowed |
| Banned | Manual (fraud) | Login refused; booths locked |

Suspend/ban/restore require a **reason**, which the tenant can see. Every action appears in the audit
log with your name.

### 13.2 Subscription plans

* Edit prices for four billing periods, device/event/credit limits.
* Create discounts (percentage or flat) with a start/end window and optional redemption cap.
* Plans referenced by a subscription cannot be deleted — archive them instead.

Changes appear on the website immediately; both systems read the same catalogue.

### 13.3 Global templates

* Create and edit designs in the designer.
* Publish (`active`) to make them available to all tenants.
* Unpublish instead of deleting when an event may still reference the template.

### 13.4 Support queue

**Platform Support** lists requests from organizations. Accept, deny (with reason), reply, resolve,
reopen. Denials and reopenings are visible to the tenant, so write reasons you would be comfortable
reading.

### 13.5 Audit and leads

* **Audit & Logs**: every mutation, filterable by actor, action, organization and date. This is the
  first place to look during any forensic question.
* **Website Leads**: contact-form submissions with a simple pipeline (new → contacted → qualified →
  won/lost).

---

## 14. Troubleshooting

### 14.1 Booth problems

| Symptom | Try this |
|---|---|
| Booth won't pair | Check the 6-digit code, then the org's plan limits (device cap). Ensure the account is active |
| Booth shows **Suspended** | The subscription expired or the platform suspended the org. Check **Revenue/plan** or contact support |
| Booth shows offline in CRM | Check internet on the device; then check the event is live |
| Prices differ from the CRM | The booth has not refreshed. Wait 2 minutes; if it persists, unassign/reassign the device |
| Wrong templates on the booth | Confirm the templates were added to **this** event, not just the library |
| Camera not detected | Reconnect Wi-Fi/USB; verify the camera app mode; restart the booth app |
| "Waiting for camera discovery" | The camera is unreachable — check its IP and that CCAPI is enabled |

### 14.2 Print problems

| Symptom | Try this |
|---|---|
| Nothing prints | Check printer power, cable, and the OS queue; confirm the correct printer is selected |
| Blank sheet | Report an issue immediately — this is an app bug, not a printer fault |
| Stuck queue | Clear the queue in the OS, then print a test sheet |
| Wrong orientation | Check the template's orientation; reprint |
| Colours off | Use the vendor ICC profile; do not stack colour corrections |
| Paper end / ribbon end | Replace the roll, clear the queue, test print |

### 14.3 Payment problems

| Symptom | Try this |
|---|---|
| QR does not scan | Increase screen brightness; refresh the payment screen |
| Paid but not confirmed | Wait 30 seconds for auto-confirmation; then check the provider dashboard |
| Guest charged twice | Note both references; Finance refunds the duplicate |
| Coupon rejected | Check status (paused/expired), minimum spend and remaining quantity |

### 14.4 Account problems

| Symptom | Try this |
|---|---|
| Can't log in | Use **Forgot password**. After 5 failed attempts, wait 15 minutes |
| Menu items missing | Your role does not include them. Ask an Organization Admin |
| "Organization not writable" | Your subscription expired or is suspended. Renew to restore writes |
| Invitation email missing | Check spam; ask an admin to resend |

### 14.5 Digital delivery problems

| Symptom | Try this |
|---|---|
| QR page shows expired | More than 24 hours passed — re-send from the gallery |
| Gallery shows one frame | Booth app is outdated (composite upload); update it |
| Download fails | Try a different browser/network; then re-open from the gallery |

---

## 15. Support

### 15.1 Where to get help

| Channel | Best for | Response |
|---|---|---|
| **Booth success screen → Report an issue** | Anything that happened during a session | Attaches the session automatically |
| **CRM → HappyPix Support** | Account, billing, templates, platform questions | 4 business hours |
| `support@happypix.in` | Anything else | 4 business hours |
| Emergency phone/WhatsApp (contracted) | Live event blocked | 1 hour |

### 15.2 What to include

```
1. Event name and date
2. Booth name (as shown in Events & Devices)
3. Guest's session id or QR link (if available)
4. What the guest/operator saw (exact wording helps)
5. Whether a sheet printed
6. Time of the issue
7. Your contact number
```

Screenshots are welcome, but never send a photo of a guest without their consent.

### 15.3 What happens next

1. Support triages by impact (live event > everything else).
2. You may be asked to run a quick check (device online, printer queue).
3. If it is a platform issue, you receive updates until it is resolved.
4. If it was a bug, it is logged and fixed in a later release — you can ask for the reference.

---

*Internal companions: [`HARDWARE_PRINTING.md`](HARDWARE_PRINTING.md) for device detail and
[`OPERATIONS.md`](OPERATIONS.md) for incident procedures.*
