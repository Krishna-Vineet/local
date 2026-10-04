# Old Admin CRM (`admin`) - API Routes & Connections Document

This document outlines all the backend connections, API routes, and endpoints that were utilized by the old Admin CRM (located in the `admin` folder).

## Base Configuration
- **Base URL (Production)**: Read from `VITE_API_URL` (e.g., `https://happypixbackend.vercel.app/api`)
- **Base URL (Local)**: `/api` (proxied to Express on port 5000)
- **Axios Configuration**: Configured with `withCredentials: true` to send HttpOnly cookies automatically.

## API Endpoint Categories

### 1. Authentication & Profile (`authAPI`)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current authenticated user profile
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `PUT /api/auth/profile` - Update user profile
- `POST /api/upload/profile-photo` - Upload profile picture (Multipart form data)

### 2. User Manager (`managerAPI` - Client Admin)
- `GET /api/auth/users` - Get all users under the organization
- `POST /api/auth/users` - Create a new user/manager
- `DELETE /api/auth/users/:id` - Delete a user/manager

### 3. Events (`eventAPI`)
- `GET /api/events` - Get all events
- `GET /api/events/:id` - Get a specific event by ID
- `GET /api/events/stats` - Get event statistics
- `GET /api/events/:id/photos` - Get all photos for a specific event
- `GET /api/events/org/users` - Get users scoped to an organization (Manager dropdown)
- `POST /api/events` - Create a new event
- `PUT /api/events/:id` - Update an existing event
- `PATCH /api/events/:id/status` - Update the status of an event
- `DELETE /api/events/:id` - Delete an event

### 4. Coupons (`couponAPI`)
- `GET /api/coupons` - Get all coupons
- `GET /api/coupons/stats` - Get coupon statistics
- `POST /api/coupons` - Create a new coupon
- `PUT /api/coupons/:id` - Update a coupon
- `PATCH /api/coupons/:id/status` - Toggle coupon active status
- `DELETE /api/coupons/:id` - Delete a coupon

### 5. Payments (`paymentAPI`)
- `GET /api/payments` - Get all payment records
- `GET /api/payments/stats` - Get payment statistics (can be scoped by event ID)

### 6. Support (`supportAPI`)
- `GET /api/support` - Get all support tickets
- `GET /api/support/:id` - Get specific support ticket details
- `GET /api/support/stats` - Get support ticket statistics
- `POST /api/support` - Create a new support ticket
- `PATCH /api/support/:id/status` - Update ticket status
- `PATCH /api/support/:id/priority` - Update ticket priority
- `POST /api/support/:id/notes` - Add a note to a support ticket
- `DELETE /api/support/:id` - Delete a support ticket

### 7. Organizations & Multi-tenant (`organizationAPI`)
- `GET /api/organizations` - Get all organizations (Super Admin)
- `GET /api/organizations/:id` - Get organization details
- `GET /api/organizations/:id/stats` - Get organization stats
- `POST /api/organizations` - Create an organization
- `PUT /api/organizations/:id` - Update organization details
- `PATCH /api/organizations/:id/status` - Update organization status
- `PATCH /api/organizations/:id/reset-password` - Reset org password
- `DELETE /api/organizations/:id` - Delete an organization
- `GET /api/organizations/my/logos` - Get org's logos
- `POST /api/organizations/my/logos` - Add an org logo
- `DELETE /api/organizations/my/logos` - Delete an org logo
- `GET /api/organizations/my/frames` - Get org's photo frames
- `POST /api/organizations/my/frames` - Add a photo frame
- `PATCH /api/organizations/my/frames/:id` - Update a photo frame
- `DELETE /api/organizations/my/frames` - Delete a photo frame
- `GET /api/organizations/my/templates` - Get org's templates
- `POST /api/organizations/my/templates` - Add a new template
- `PUT /api/organizations/my/templates/:id` - Update a template
- `DELETE /api/organizations/my/templates/:id` - Delete a template

### 8. Templates (`templateAPI`)
- `GET /api/templates` - Get all templates
- `GET /api/templates/:id` - Get specific template details
- `POST /api/templates/upload` - Upload template (Multipart form data)
- `POST /api/templates/ai/generate` - Generate AI templates
- `PUT /api/templates/:id` - Update a template
- `DELETE /api/templates/:id` - Delete a template

### 9. Devices (`deviceAPI`)
- `GET /api/devices` - Get all devices
- `GET /api/devices/:id` - Get specific device details
- `POST /api/devices` - Register/create a new device
- `PUT /api/devices/:id` - Update a device
- `PATCH /api/devices/:id/status` - Update device status
- `PATCH /api/devices/:id/assign-event` - Assign an event to a device
- `POST /api/devices/:id/regenerate-token` - Regenerate device token
- `DELETE /api/devices/:id` - Delete a device

### 10. Superadmin (`superadminAPI`)
- `GET /api/superadmin/stats` - Get platform-wide statistics
- `GET /api/superadmin/client/:orgId` - Get detailed statistics for a specific client organization

### 11. Subscriptions (`subscriptionAPI`)
- `GET /api/subscriptions` - Get all platform subscriptions
- `GET /api/subscriptions/stats` - Get subscription statistics
- `GET /api/subscriptions/org/:orgId` - Get subscriptions for a specific org
- `POST /api/subscriptions` - Create a subscription
- `PATCH /api/subscriptions/:id/status` - Update subscription status

### 12. Audit Logs (`auditAPI`)
- `GET /api/audit-logs` - Get platform audit logs (Super Admin)
