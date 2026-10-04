# HappyPix Backend API

The backend REST API for the HappyPix photo booth platform. Built with Node.js, Express, and MongoDB.

## Live Environment

- **Production API URL**: `https://happypixbackend.vercel.app`
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
