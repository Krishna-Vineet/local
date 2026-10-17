# API ROUTES REFERENCE

This document maps every single endpoint, its required inputs, and database interactions.

## Router: `auditRoutes.js`

### `GET` `/`
- **Expected Inputs:** `req.query.page, req.query.limit, req.query.action, req.query.targetModel`
- **Database Operations:** `AuditLog.find()`

## Router: `authRoutes.js`

### `POST` `/register`
- **Expected Inputs:** `req.body.name, req.body.email, req.body.password, req.body.role`
- **Database Operations:** `User.findOne()`

### `POST` `/login`
- **Expected Inputs:** `req.body.email, req.body.password`
- **Database Operations:** `User.findOne(), RoleConfig.findOne()`

### `GET` `/me`
- **Middlewares:** `authenticate`

### `PUT` `/profile`
- **Middlewares:** `authenticate`
- **Expected Inputs:** `req.body.name, req.body.phoneNumber, req.body.profilePhotoUrl`
- **Database Operations:** `User.findByIdAndUpdate()`

### `POST` `/logout`

### `POST` `/users`
- **Middlewares:** `authenticate, authorize([])`
- **Expected Inputs:** `req.body.name, req.body.email, req.body.password, req.body.role, req.body.organizationId`
- **Database Operations:** `User.findOne()`

### `GET` `/users`
- **Middlewares:** `authenticate, authorize([])`
- **Expected Inputs:** `req.query.orgId`
- **Database Operations:** `User.find()`

### `DELETE` `/users/:id`
- **Middlewares:** `authenticate, authorize([])`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `User.findById()`

### `POST` `/forgot-password`
- **Expected Inputs:** `req.body.email`
- **Database Operations:** `User.findOne()`

### `POST` `/reset-password`
- **Expected Inputs:** `req.body.token, req.body.password`
- **Database Operations:** `User.findOne()`

## Router: `couponRoutes.js`

### `POST` `/public/validate`
- **Middlewares:** `optionalDeviceAuth`
- **Expected Inputs:** `req.body.code, req.body.eventId`
- **Database Operations:** `Coupon.findOne()`

### `GET` `/`
- **Expected Inputs:** `req.query.status, req.query.search, req.query.page, req.query.limit`
- **Database Operations:** `Coupon.find()`

### `GET` `/stats`

### `POST` `/`
- **Middlewares:** `custom_middleware`
- **Expected Inputs:** `req.body.applicableTo, req.body.code, req.body.organizationId, req.body.eventId`
- **Database Operations:** `Coupon.findOne()`

### `PUT` `/:id`
- **Middlewares:** `custom_middleware`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `Coupon.findOne()`

### `PATCH` `/:id/status`
- **Middlewares:** `custom_middleware`
- **Expected Inputs:** `req.body.isActive, req.params.id`

### `DELETE` `/:id`
- **Middlewares:** `custom_middleware`
- **Expected Inputs:** `req.params.id`

## Router: `deviceRoutes.js`

### `POST` `/booth-login`
- **Expected Inputs:** `req.body.orgId, req.body.password, req.body.deviceName, req.body.location`
- **Database Operations:** `User.findOne(), Organization.findById()`

### `POST` `/ping`
- **Middlewares:** `authenticateDevice`

### `GET` `/current-event`
- **Middlewares:** `authenticateDevice`
- **Database Operations:** `Event.findById()`

### `GET` `/`
- **Expected Inputs:** `req.query.status`
- **Database Operations:** `Event.find(), Device.find()`

### `POST` `/`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.body.deviceName, req.body.location, req.body.organizationId`
- **Database Operations:** `Organization.findById()`

### `GET` `/:id`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `Event.find(), Device.findOne()`

### `PUT` `/:id`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.body.deviceName, req.body.location, req.body.printerName, req.body.paperSize, req.body.enableHardwarePrinting, req.params.id`

### `PATCH` `/:id/assign-event`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.body.eventId, req.body.eventName, req.params.id`

### `PATCH` `/:id/status`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.body.status, req.params.id`

### `POST` `/:id/acknowledge-maintenance`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.params.id`

### `POST` `/:id/regenerate-token`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.params.id`

### `DELETE` `/:id`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.params.id`

## Router: `eventRoutes.js`

### `GET` `/public/live`
- **Database Operations:** `Event.findOne()`

### `GET` `/public/list`
- **Middlewares:** `optionalDeviceAuth`
- **Database Operations:** `Event.find()`

### `POST` `/public/join`
- **Expected Inputs:** `req.body.eventId, req.body.passkey`
- **Database Operations:** `Event.findById()`

### `GET` `/`
- **Expected Inputs:** `req.query.status, req.query.search, req.query.startDate, req.query.endDate, req.query.page, req.query.limit`
- **Database Operations:** `Event.find()`

### `GET` `/stats`
- **Database Operations:** `Event.find()`

### `GET` `/:id/photos`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `Event.findOne(), Photo.find(), Payment.find()`

### `GET` `/org/users`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.query.orgId`
- **Database Operations:** `User.find()`

### `GET` `/:id`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `Event.findOne()`

### `POST` `/`
- **Middlewares:** `custom_middleware`
- **Expected Inputs:** `req.body.startDate, req.body.assignedDeviceIds, req.body.shortCode, req.body.passkey, req.body.assignedManagerId`
- **Database Operations:** `Organization.findById()`

### `PUT` `/:id`
- **Middlewares:** `custom_middleware`
- **Expected Inputs:** `req.params.id, req.body.assignedDeviceIds`
- **Database Operations:** `Event.findOne(), Organization.findById(), Event.findByIdAndUpdate()`

### `PATCH` `/:id/status`
- **Middlewares:** `custom_middleware`
- **Expected Inputs:** `req.body.status, req.params.id`

### `DELETE` `/:id`
- **Middlewares:** `custom_middleware`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `Event.findOne()`

## Router: `organizationRoutes.js`

### `GET` `/my/logos`
- **Middlewares:** `authenticate`
- **Database Operations:** `Organization.findById()`

### `POST` `/my/logos`
- **Middlewares:** `authenticate`
- **Expected Inputs:** `req.body.url`
- **Database Operations:** `Organization.findByIdAndUpdate()`

### `DELETE` `/my/logos`
- **Middlewares:** `authenticate`
- **Expected Inputs:** `req.body.url`
- **Database Operations:** `Organization.findByIdAndUpdate()`

### `GET` `/my/templates`
- **Database Operations:** `Organization.findById()`

### `POST` `/my/templates`
- **Expected Inputs:** `req.body.id, req.body.label, req.body.frames, req.body.orientation, req.body.overlayUrl, req.body.price, req.body.description`
- **Database Operations:** `Organization.findByIdAndUpdate()`

### `PUT` `/my/templates/:templateId`
- **Expected Inputs:** `req.body.label, req.body.frames, req.body.orientation, req.body.overlayUrl, req.body.price, req.body.description, req.params.templateId`

### `DELETE` `/my/templates/:templateId`
- **Expected Inputs:** `req.params.templateId`
- **Database Operations:** `Organization.findByIdAndUpdate()`

### `GET` `/my/frames`
- **Middlewares:** `authenticate`
- **Database Operations:** `Organization.findById()`

### `POST` `/my/frames`
- **Middlewares:** `authenticate`
- **Expected Inputs:** `req.body.url, req.body.name, req.body.tags`
- **Database Operations:** `Organization.findByIdAndUpdate()`

### `PATCH` `/my/frames/:frameId`
- **Expected Inputs:** `req.body.name, req.body.tags, req.params.frameId`

### `DELETE` `/my/frames`
- **Middlewares:** `authenticate`
- **Expected Inputs:** `req.body.url`
- **Database Operations:** `Organization.findByIdAndUpdate()`

### `GET` `/`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.query.status, req.query.plan, req.query.search, req.query.page, req.query.limit`
- **Database Operations:** `Organization.find()`

### `POST` `/`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.body.name, req.body.ownerName, req.body.email, req.body.phone, req.body.plan, req.body.currency, req.body.billingCycle, req.body.trialDays, req.body.internalNotes`
- **Database Operations:** `Organization.findOne(), User.findOne()`

### `GET` `/:id`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `Organization.findById(), Device.find(), Event.find()`

### `PUT` `/:id`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `Organization.findByIdAndUpdate()`

### `PATCH` `/:id/status`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.body.status, req.params.id`
- **Database Operations:** `Organization.findByIdAndUpdate()`

### `GET` `/:id/stats`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.params.id`

### `PATCH` `/:id/reset-password`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.body.password, req.params.id`
- **Database Operations:** `User.findOne()`

### `DELETE` `/:id`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `User.deleteMany(), Device.deleteMany()`

## Router: `paymentRoutes.js`

### `POST` `/create-order`
- **Middlewares:** `optionalDeviceAuth`
- **Expected Inputs:** `req.body.amount, req.body.printCount, req.body.digitalCopy, req.body.photoUrls, req.body.compositeUrl, req.body.couponCode, req.body.discountApplied, req.body.eventId, req.body.eventName`
- **Database Operations:** `Event.findById(), Coupon.findOne()`

### `GET` `/status/:paymentId`
- **Middlewares:** `optionalDeviceAuth`
- **Expected Inputs:** `req.params.paymentId`
- **Database Operations:** `Payment.findById()`

### `POST` `/verify`
- **Middlewares:** `optionalDeviceAuth`
- **Expected Inputs:** `req.body.razorpay_order_id, req.body.razorpay_payment_id, req.body.razorpay_signature, req.body.compositeUrl, req.body.photoUrls`
- **Database Operations:** `Payment.findOne()`

### `POST` `/free-complete`
- **Middlewares:** `optionalDeviceAuth`
- **Expected Inputs:** `req.body.amount, req.body.printCount, req.body.digitalCopy, req.body.photoUrls, req.body.compositeUrl, req.body.couponCode, req.body.discountApplied, req.body.eventId, req.body.eventName, req.body.utr`
- **Database Operations:** `Payment.findOne(), Event.findById(), Coupon.findOne()`

### `POST` `/complete-prepaid`
- **Middlewares:** `optionalDeviceAuth`
- **Expected Inputs:** `req.body.paymentId, req.body.photoUrls, req.body.compositeUrl`
- **Database Operations:** `Payment.findById()`

### `GET` `/download/:token`
- **Expected Inputs:** `req.params.token`
- **Database Operations:** `DigitalToken.findOne()`

### `GET` `/stats`
- **Middlewares:** `authenticate, requirePaymentAccess`
- **Expected Inputs:** `req.query.eventId`

### `GET` `/`
- **Middlewares:** `authenticate, requirePaymentAccess`
- **Expected Inputs:** `req.query.page, req.query.limit, req.query.status, req.query.eventId, req.query.eventName, req.query.search, req.query.startDate, req.query.endDate`
- **Database Operations:** `Payment.find()`

## Router: `photoShareRoutes.js`

### `POST` `/generate`
- **Middlewares:** `optionalDeviceAuth`
- **Expected Inputs:** `req.body.eventId, req.body.photoUrls, req.body.compositeUrl, req.body.organizationId`
- **Database Operations:** `Event.findById()`

### `PUT` `/:token`
- **Middlewares:** `optionalDeviceAuth`
- **Expected Inputs:** `req.params.token, req.body.photoUrls, req.body.compositeUrl`
- **Database Operations:** `PhotoShare.findOne()`

### `GET` `/view/:token`
- **Middlewares:** `publicRateLimiter`
- **Expected Inputs:** `req.params.token`
- **Database Operations:** `PhotoShare.findOne()`

### `POST` `/deliver/:token`
- **Middlewares:** `deliveryRateLimiter`
- **Expected Inputs:** `req.params.token, req.body.method, req.body.destination`
- **Database Operations:** `PhotoShare.findOne()`

## Router: `settingRoutes.js`

### `GET` `/public`
- **Middlewares:** `optionalDeviceAuth`
- **Expected Inputs:** `req.query.eventId`
- **Database Operations:** `Event.findById()`

### `GET` `/`
- **Middlewares:** `authorize([])`

### `PUT` `/`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.body.field`
- **Database Operations:** `Setting.findOne()`

## Router: `subscriptionRoutes.js`

### `GET` `/stats`
- **Middlewares:** `authorize([])`

### `GET` `/`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.query.orgId, req.query.status, req.query.plan, req.query.page, req.query.limit`
- **Database Operations:** `Subscription.find()`

### `GET` `/org/:orgId`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.params.orgId`
- **Database Operations:** `Subscription.find()`

### `POST` `/`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.body.organizationId, req.body.plan, req.body.billingCycle, req.body.amount, req.body.currency, req.body.status, req.body.periodStart, req.body.periodEnd, req.body.notes`
- **Database Operations:** `Organization.findById(), Organization.findByIdAndUpdate()`

### `PATCH` `/:id/status`
- **Middlewares:** `authorize([])`
- **Expected Inputs:** `req.body.status, req.params.id`
- **Database Operations:** `Subscription.findByIdAndUpdate()`

## Router: `superadminRoutes.js`

### `GET` `/stats`
- **Database Operations:** `Organization.find(), Subscription.find()`

### `GET` `/client/:orgId`
- **Expected Inputs:** `req.params.orgId`
- **Database Operations:** `Organization.findById(), Device.find(), Subscription.find(), User.find()`

## Router: `supportRoutes.js`

### `POST` `/`
- **Middlewares:** `optionalDeviceAuth`
- **Expected Inputs:** `req.body.name, req.body.email, req.body.subject, req.body.message, req.body.eventShortCode, req.body.eventId, req.body.deviceId, req.body.sessionId, req.body.paymentReference, req.body.ticketType, req.body.organizationId`

### `GET` `/`
- **Expected Inputs:** `req.query.status, req.query.priority, req.query.search, req.query.ticketType, req.query.page, req.query.limit`
- **Database Operations:** `SupportTicket.find()`

### `GET` `/stats`
- **Expected Inputs:** `req.query.ticketType`

### `GET` `/:id`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `SupportTicket.findOne()`

### `PATCH` `/:id/status`
- **Expected Inputs:** `req.body.status, req.params.id`

### `PATCH` `/:id/priority`
- **Expected Inputs:** `req.body.priority, req.params.id`

### `POST` `/:id/notes`
- **Expected Inputs:** `req.body.text, req.params.id`

### `DELETE` `/:id`
- **Expected Inputs:** `req.params.id`

## Router: `templateRoutes.js`

### `GET` `/`
- **Database Operations:** `Template.find()`

### `POST` `/upload`
- **Middlewares:** `requireTemplateAccess, custom_middleware`
- **Expected Inputs:** `req.body.name, req.body.description, req.body.category, req.body.orientation, req.body.visibility, req.body.eventId, req.body.canvasData, req.body.photoSlotsData, req.body.backgroundColor, req.body.organizationId`

### `POST` `/ai/generate`
- **Middlewares:** `requireTemplateAccess`
- **Expected Inputs:** `req.body.prompt, req.body.photoCount, req.body.orientation, req.body.category, req.body.organizationId`

### `PUT` `/:id`
- **Middlewares:** `requireTemplateAccess`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `Template.findById()`

### `DELETE` `/:id`
- **Middlewares:** `requireTemplateAccess`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `Template.findById()`

## Router: `usageAccessRoutes.js`

### `GET` `/role-defaults`
- **Middlewares:** `authenticate, authorize([])`
- **Database Operations:** `RoleConfig.find()`

### `PUT` `/role-defaults/:role`
- **Middlewares:** `authenticate, authorize([])`
- **Expected Inputs:** `req.params.role, req.body.permissions`
- **Database Operations:** `RoleConfig.findOne()`

### `GET` `/users`
- **Middlewares:** `authenticate, authorize([])`
- **Database Operations:** `User.find()`

### `POST` `/users`
- **Middlewares:** `authenticate, authorize([])`
- **Expected Inputs:** `req.body.name, req.body.email, req.body.password, req.body.role, req.body.useCustomPermissions, req.body.customPermissions, req.body.organizationId`
- **Database Operations:** `User.findOne()`

### `PUT` `/users/:id`
- **Middlewares:** `authenticate, authorize([])`
- **Expected Inputs:** `req.body.useCustomPermissions, req.body.customPermissions, req.body.role, req.body.name, req.body.email, req.body.password, req.params.id`
- **Database Operations:** `User.findById()`

### `DELETE` `/users/:id`
- **Middlewares:** `authenticate, authorize([])`
- **Expected Inputs:** `req.params.id`
- **Database Operations:** `User.findById()`
