# HappyPix CRM — Client, User, and Owner Guide

## 1. Who should use this guide?

This guide covers every CRM role:

- **Owner:** the HappyPix platform owner.
- **Platform Admin:** an internal platform administrator.
- **Support Manager:** an internal HappyPix support user.
- **Organization Admin:** the administrator for a client organization.
- **Organization Manager:** an operational user for a client organization.

A booth operator does not need a CRM account. Booths are paired devices, and an organization can store an operator name and phone on the device record.

## 2. Signing in and account management

1. Open the CRM sign-in page.
2. Enter your account email and password.
3. Select **Sign in**.
4. The CRM opens the correct workspace for your role.

Use **Forgot password** when you cannot sign in. Enter the verification code sent to your account contact, then choose a new password.

Open the user menu in the top-right corner to:

- Open **Profile**.
- Switch between light and dark mode.
- Sign out.
- Reset seeded data when using demo mode.

On **Profile**, you can update supported personal details, request an email change, and change your password. Other administrators cannot edit your name or email from Team & Roles.

---

# Part I — Client organization guide

## 3. Organization Dashboard

The Dashboard is the starting point for Organization Admins and Managers. Review:

- Current plan and account status
- Plan usage and limits
- Active and upcoming events
- Connected booths
- Operational warnings
- Support activity

Organization Admins may also see financial and payout information. If the organization is suspended, banned, or its plan is expired, follow the warning shown in the CRM and contact HappyPix Support when necessary.

## 4. Creating an event

Organization Admins and Managers can create events.

1. Open **Events & Devices**.
2. Select **Create event**.
3. Enter the event name, client, venue, start time, and end time.
4. Choose the available print templates.
5. Choose the photo filters guests may use.
6. Decide whether guests can receive a digital copy.
7. Review inherited print-layout prices and add event-only overrides if needed.
8. Add branding logos or a footer tagline.
9. Review the form and create the event.

Important behavior:

- The end must be later than the start.
- Only active templates can be selected.
- The event receives a full copy of current organization prices. Changing defaults later does not reprice this event.
- Active-event limits depend on the organization's plan.
- Paused events can be resumed. An active event may need to be paused before deletion.

## 5. Managing booths and devices

Open **Events & Devices** and switch to the device area.

For each booth you can:

- Review online/offline state and last-seen time.
- Check camera, printer, and kiosk-screen connectivity.
- Review battery and usage telemetry.
- Rename the device.
- Record the on-site operator's name and phone.
- Assign the booth to an event.
- Unassign it when the assignment changes.
- Remove it when it is no longer paired.

An event must belong to your organization, and a finished event cannot be newly assigned. Device limits are controlled by the subscription plan.

## 6. Viewing the Gallery

The Gallery is available to Organization Admins and Managers when HappyPix enables it.

1. Open **Gallery**.
2. Use **Select event** to show one event or all events.
3. Use **Select booth** to show one booth or all booths.
4. Select an image to open the full final print.

The gallery contains the final composed image prepared for printing. It does not show raw camera captures.

Visibility follows the platform policy:

- If the gallery is disabled, no organization images are shown.
- If guest publishing permission is required, only photos where the guest explicitly selected **“Allow my photo to post on social media”** are shown.
- If permission is not required, every final generated image for your organization can appear.

An organization can never use the Gallery to view another organization's images.

## 7. Organization Defaults — Admin

Open **Organization Defaults** to maintain the baseline used by future events and booths.

You can configure:

- Organization display name and logo
- Booth idle timeout
- UPI payment address
- Payout mode
- Guest price for each print-layout iteration

Organization Managers can view these values but cannot change them. Existing events keep their saved price snapshots when defaults change.

## 8. Revenue, wallet, and withdrawals — Admin

Open **Organization Revenue** to review:

- Paid, pending, and failed transactions
- Revenue grouped by event
- Revenue grouped by booth
- Event-by-booth reporting
- Monthly totals
- UPI and HappyPix-wallet settlement values

When funds were collected into the HappyPix wallet:

1. Confirm the UPI address in **Organization Defaults**.
2. Open **Organization Revenue**.
3. Review available wallet balance.
4. Enter a valid withdrawal amount.
5. Submit the withdrawal request.

The amount must meet the minimum and cannot exceed the available balance. Processing withdrawals are included in balance calculations.

## 9. Coupons — Admin

1. Open **Coupons**.
2. Select **Create coupon**.
3. Enter an uppercase code.
4. Choose percentage or fixed discount.
5. Set the value, quantity, and expiry.
6. Apply it to all events or selected events.
7. Save the coupon.

You can pause, reactivate, or delete a coupon. Usage, expiry, quantity, and event eligibility must be validated by the backend when a booth redeems it.

## 10. Organization team management — Admin

1. Open **Team & Roles**.
2. Select **Add member**.
3. Enter the member's name and email.
4. Choose **Organization Admin** or **Organization Manager**.
5. Set an initial password and create the account.
6. Share the password securely and ask the member to change it.

For an existing member, you can only:

- **Deactivate** the account to block sign-in.
- **Re-activate** the account to restore sign-in.

You cannot edit an existing member's name, email, or role. The member manages supported identity fields through Profile. You cannot deactivate yourself, and the last active Organization Admin cannot be deactivated.

## 11. Guest Support

Use **Guest Support** for problems raised from booth sessions, such as printing, payment, photo, event, or device issues.

1. Filter the list by status or priority.
2. Open a ticket.
3. Review guest contact, event, booth, payment, and session information.
4. Send a reply.
5. Resolve the ticket with a useful note after the issue is fixed.
6. Reopen it if more work is needed.

## 12. Contacting HappyPix Support

Use **HappyPix Support** when your organization needs platform help.

1. Select **Raise an issue**.
2. Provide a clear subject and description.
3. Add relevant images if needed.
4. Submit for platform review.

HappyPix may accept the request into a ticket or deny it with a reason. If denied, address the reason and use the reapply option. Once accepted, use the shared conversation until the issue is resolved.

---

# Part II — HappyPix Owner guide

## 13. Monitoring platform health

Open **Platform Dashboard** each day to review:

- Organization lifecycle counts
- Trials and expiring plans
- Device connectivity
- Active and upcoming events
- Organizations close to plan limits
- Recent sign-ups and important alerts

Use this information to identify renewals, disconnected booths, and organizations needing assistance.

## 14. Reviewing platform revenue

The Owner opens **Platform Revenue** to inspect total, financial-year, monthly, quarterly, and organization-level subscription revenue. Use plan status and expiry information to prioritize renewal follow-up.

## 15. Managing organizations

1. Open **Organizations**.
2. Search or filter by plan and status.
3. Open an organization to review its subscription, events, booths, and activity.
4. If access must be restricted, select **Suspend** or **Ban** and enter a clear reason.
5. Use **Restore** when the organization may resume service.

Suspension and banning affect protected operations immediately and are audit logged. Use suspension for temporary restrictions and banning for severe or permanent policy violations.

## 16. Managing subscription plans

1. Open **Subscription Plans**.
2. Add a plan or open an existing plan.
3. Configure price, duration, active-event limit, and device limit.
4. Save and keep the plan active, or hide it from future use.

Plan keys are stable identifiers and should not be changed. Changed limits affect organizations using that plan according to backend rules.

## 17. Managing templates

Open **Template Library** to manage artwork offered during event setup.

You can:

- Create a template using direct design controls or AI-assisted generation.
- Select a universal or specific print layout.
- Preview generated output before saving.
- Publish or unpublish a template.
- Edit template metadata and permitted design fields.
- Delete an unused, removable template.

Built-in designer templates and templates already used by events may be protected from deletion or layout changes.

## 18. Managing the internal platform team

1. Open **Team & Roles**.
2. Select **New internal user**.
3. Create a Platform Admin or Support Manager account.
4. For an existing internal user, use **Deactivate** or **Re-activate**.

Existing user identity is self-managed. The Owner cannot deactivate their own account.

## 19. Setting the gallery policy

Open **Gallery Settings**.

### Enable organization galleries

Turn this on to let Organization Admins and Managers view final print images. Turn it off to make every organization gallery unavailable.

### Ask guests for publishing permission

- **On:** booths must ask **“Allow my photo to post on social media?”** Only explicit approvals appear in the Gallery.
- **Off:** all final generated images can appear in the relevant organization's Gallery.

Policy changes apply platform-wide. Confirm the current-behavior summary before leaving the page.

## 20. Auditing platform actions

Use **Audit & Logs** to investigate privileged changes. Filter by actor, action, severity, or time context. Review lifecycle, user-status, template, plan, support, and gallery-policy changes when troubleshooting or performing compliance checks.

---

# Part III — Internal staff guide

## 21. Platform Admin

Platform Admins can:

- Monitor the Platform Dashboard.
- Search and inspect organizations.
- Handle organization support.
- Manage global templates.
- View the internal team.
- Configure platform gallery policy.
- Review platform audit logs.

They cannot view platform revenue, manage subscription plans, or create/deactivate internal users.

## 22. Support Manager

Support Managers should focus on:

- Platform health context from the Dashboard.
- Read-only organization lookup.
- Reviewing, accepting, denying, replying to, resolving, and reopening organization-support requests.

They do not receive revenue, plan, template, team, gallery-policy, or audit access.

## 23. Organization Manager

Organization Managers handle daily operations:

- Create and manage events.
- Manage and assign booths.
- View permitted final images in Gallery.
- Handle Guest Support.
- Contact HappyPix Support.
- View organization defaults and the organization team.

They cannot manage revenue, withdrawals, coupons, organization defaults, or team membership.

## 24. Recommended operating practices

- Use individual accounts; never share an administrator login.
- Deactivate accounts promptly when access is no longer needed.
- Keep booth operator contact details current before an event.
- Verify device health before guests arrive.
- Review inherited event pricing before publishing an event.
- Request only the guest consent required by the platform policy.
- Do not export or repost gallery images outside the consent policy.
- Include event, booth, and session context in support requests.
- Record clear reasons for suspension, denial, and resolution actions.
- Sign out on shared computers.

## 25. Troubleshooting

| Problem | What to do |
|---|---|
| Cannot sign in | Check email, use Forgot password, or ask an authorized administrator whether the account is inactive. |
| Forbidden page or action | The role does not have permission; use an authorized account rather than trying to bypass it. |
| Cannot create an event or device | Check plan status, organization status, and plan limits. |
| Gallery is unavailable | HappyPix has disabled the platform gallery. |
| A photo is missing from Gallery | Check event/booth filters. If permission is required, the guest must have explicitly allowed publishing. |
| Booth appears offline | Check network, last-seen time, camera, printer, and kiosk-screen indicators. |
| Withdrawal is rejected | Confirm UPI ID, minimum amount, available wallet balance, and Admin role. |
| Coupon is rejected | Check status, expiry, quantity, event scope, and code spelling. |
| Support request was denied | Read the denial reason, add the requested information, and reapply. |
| Demo changes disappeared or look stale | Use Reset demo data; this replaces browser-local demo state with the seed. |

## 26. More information

- [CRM Product and Technical Documentation](./CRM_DOCUMENTATION.md)
- [Feature List](./FEATURE_LIST.md)
- [`crm/SECURITY.md`](../SECURITY.md)
