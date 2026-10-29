# HappyPix Backend API

The backend REST API for the HappyPix photo booth platform. Built with Node.js, Express, and MongoDB.

## Live Environment

- **Production API URL**: `https://happypix-v2-backend.vercel.app`
- **Frontend CRM URL**: `https://happypixfrontend.vercel.app`

## Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)

### Installation

1. Navigate to the `backend` folder:
```bash
cd backend
npm install
```

2. Environment setup:
Create a `.env` file based on `.env.example` and set your MongoDB URI and other secrets.

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/happypix
JWT_SECRET=your_secret_key
FRONTEND_URL=https://happypixfrontend.vercel.app
```

### Running the server

Start the development server:

```bash
npm run dev
```
Start in production mode:
```bash
npm start
```

## Health check

```bash
curl -s http://localhost:5000/api/health
```

Answers with the running build and the state of the device-token schema in one
line of JSON — use it first when a device write fails:

```json
{"status":"ok","serverFile":"/…/backend/server.js","workingDirectory":"/…/backend",
 "uptimeSeconds":42,
 "deviceToken":{"loaded":true,"plaintextPath":"absent","hashedPath":true,
                "guards":[{"model":"Device","path":"absent","action":"none"}]}}
```

* `serverFile` — the file this process actually booted; if it is not the checkout
  you are editing, you are looking at a stale server.
* `deviceToken.plaintextPath` — must be `absent`. A `required` plaintext path made
  every device write fail with `Device validation failed: deviceToken: Path
  \`deviceToken\` is required.` and surface as HTTP 500 `code: "INTERNAL"`.
* `deviceToken.guards` — the schema guards applied at boot (see
  `services/schemaGuards.js`). `action: "none"` means the model has no plaintext
  path and needs no virtual setter.

`GET /api/health/schema` gives the same device report plus every path on the
`Device` model, for when the above is not enough.

## Seeding the Database

You can run seed scripts to populate initial data:
```bash
node seed_admin.js
node seed_superadmin.js
node seed_templates.js
```

## Structure
- `/routes` - API endpoints
- `/models` - Mongoose schemas
- `/middleware` - Express middleware (Auth, etc.)
- `/services` - Business logic
- `/utils` - Helpers and utilities
