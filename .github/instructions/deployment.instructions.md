---
description: "Use when writing or modifying Dockerfiles, docker-compose files, nginx configs, or GitHub Actions workflows. Covers production deployment to VPS via SSH, container naming, service wiring, nginx reverse proxy, and secrets management."
applyTo: "docker-compose*.yml,Dockerfile,server/Dockerfile,nginx/**,nginx.conf,.github/workflows/**"
---

# Deployment & CI/CD Patterns

## Docker Services

Two services: `frontend` (nginx serving built Vite app) and `backend` (Node.js Express).

| Service  | Container name          | Prod port mapping |
| -------- | ----------------------- | ----------------- |
| frontend | `linkedin-msg-frontend` | `3002:80`         |
| backend  | `linkedin-msg-backend`  | internal only     |

- Both services on `linkedin-msg-network` (bridge)
- Persistent data volume: `linkedin-msg-data` mounted at `/app/data` in backend
- `restart: unless-stopped` on all services

## docker-compose Files

- `docker-compose.yml` — local development
- `docker-compose.prod.yml` — production (always reference with `-f docker-compose.prod.yml`)

## Environment Variables in Containers

Backend requires these env vars (injected via `.env` on VPS, never committed):

- `MONGODB_URI` — full MongoDB connection string
- `JWT_SECRET` — strong random secret
- `NODE_ENV=production`
- `PORT=3000`

## GitHub Actions: Deploy Workflow

Triggered on push to `main` or `workflow_dispatch`. Two jobs:

1. **`deploy`** — always runs: SSH into VPS, `git reset --hard origin/main`, rebuild and restart containers
2. **`setup`** — only on `workflow_dispatch`: first-time VPS setup (installs Docker, clones repo)

### Required GitHub Secrets

| Secret         | Description                 |
| -------------- | --------------------------- |
| `VPS_HOST`     | VPS IP or hostname          |
| `VPS_USERNAME` | SSH user                    |
| `VPS_SSH_KEY`  | Private SSH key (PEM)       |
| `VPS_PORT`     | SSH port (defaults to `22`) |
| `JWT_SECRET`   | App JWT secret              |
| `MONGODB_URI`  | MongoDB connection string   |

### Deploy Script Pattern

```bash
cd /opt/linkedin-msg
git fetch origin main
git reset --hard origin/main
# Recreate .env only if missing
if [ ! -f .env ]; then
  echo "JWT_SECRET=..." > .env
  echo "MONGODB_URI=..." >> .env
fi
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
```

## nginx Config

- Config file: `nginx/linkedin.tuetran.dev.conf`
- Deployed to VPS at `/etc/nginx/sites-available/linkedin.tuetran.dev`
- Symlinked to `/etc/nginx/sites-enabled/`
- Always test before reload: `sudo nginx -t && sudo systemctl reload nginx`
- Frontend proxied from nginx on port `3002`; nginx handles SSL termination

## VPS Deploy Path

`/opt/linkedin-msg` — canonical deployment directory on VPS.
