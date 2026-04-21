---
description: "Use when working on this project to understand the overall architecture, file structure, monorepo layout, and tech stack conventions. Covers frontend/backend separation, shared types, environment setup, and project-wide patterns."
---

# Project Architecture

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui components, Radix UI primitives, lucide-react icons
- **Backend**: Node.js + Express, TypeScript, MongoDB (native driver), Socket.io, JWT auth, bcrypt
- **Infra**: Docker + docker-compose, nginx reverse proxy, GitHub Actions for CI/CD
- **Domain**: `linkedin.tuetran.dev`

## Monorepo Layout

```
/                     # Frontend (Vite + React)
  src/                # React app source
  index.html
  vite.config.ts

server/               # Backend (Express + MongoDB)
  src/
    index.ts          # Express app entry, mounts all routes at /api/*
    db/mongodb.ts     # MongoDB connection, index creation, default admin seed
    routes/*.mongo.ts # Active route handlers (MongoDB-backed)
    middleware/auth.mongo.ts
    socket/           # Socket.io auth + handlers
```

**Note**: Files with `.mongo.ts` suffix are the active implementations. Legacy SQLite-backed files (`auth.ts`, `auth.mongo.ts`) exist alongside but `.mongo.ts` variants are authoritative.

## Environment Variables

Backend reads from `.env` (not committed):

- `JWT_SECRET` — required in production
- `MONGODB_URI` — defaults to `mongodb://localhost:27017/linkedin-msg`
- `PORT` — defaults to `3001` (dev) / `3000` (prod container)

## Port Conventions

- Frontend dev: `5173` (Vite default, also uses `5174–5176` as fallbacks)
- Backend dev: `3001`
- Frontend prod container: `3002` (mapped from nginx on `80`)
- Backend prod container: `3000`
