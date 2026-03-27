# Zoop

Live commerce app — hosts can stream video, viewers can watch and react in real time.

<p align="center">
  <img src="assets/Simulator Screenshot - iPhone 16e - 2026-03-27 at 21.54.59.png" width="30%" />
  <img src="assets/Simulator Screenshot - iPhone 16e - 2026-03-27 at 21.55.31.png" width="30%" />
  <img src="assets/Simulator Screenshot - iPhone 16e - 2026-03-27 at 21.55.36.png" width="30%" />
</p>

The repo has two parts:
- `backend` — Node.js + Express + TypeScript + Prisma + Socket.io + LiveKit
- `mobile` — React Native + Expo Router + LiveKit WebRTC

## How it works

Hosts publish a video stream via WebRTC to a LiveKit SFU. Viewers subscribe to that stream, also via WebRTC. The backend handles everything else — auth, session management, chat, reactions, and viewer counts over Socket.io.

LiveKit takes care of simulcast and adaptive bitrate, so stream quality adjusts automatically based on each viewer's connection. The backend is stateless and can scale horizontally; Socket.io just needs a Redis adapter wired up for multi-instance deployments.

## Tech stack

**Infrastructure**

The backend runs on EC2. Cloudflare sits in front of it for DDoS protection, caching, and routing. Static assets and recorded media are stored in Cloudflare R2 — it's S3-compatible so the AWS SDK works against it without any changes, and egress is free which matters when you're serving video thumbnails and clips at scale.

**LiveKit**

LiveKit is a WebRTC SFU (Selective Forwarding Unit). Instead of every viewer connecting directly to the host (which would kill the host's upload), everyone connects to LiveKit and it handles distribution. The backend generates short-lived JWT tokens that grant publish or subscribe access to a room. LiveKit also sends webhook events back to the backend when rooms open/close, which is how session state stays in sync.

**Socket.io**

Used for everything that needs to be pushed in real time but isn't video — chat messages, reactions, and live viewer counts. It runs on the same Express server over a shared HTTP instance. For multi-server deployments, dropping in `@socket.io/redis-adapter` is enough to make it work across instances.

**FFmpeg**

Used server-side via `fluent-ffmpeg` for post-processing recorded streams — things like transcoding egress recordings from LiveKit into web-friendly formats or extracting thumbnails. FFmpeg needs to be installed on the host machine separately.

**Gemini**

Gemini AI is wired in for any generative features — things like auto-generating stream descriptions or moderating chat. Uses the `gemini-2.5-flash` model by default, configurable via env.

**Nodemailer / SMTP**

Handles transactional email (auth flows, notifications). Works with any SMTP provider — just point it at your host and credentials.

**Database**

PostgreSQL via Prisma. Prisma handles schema migrations and generates a fully-typed client, so there's no raw SQL anywhere in the codebase.

**Mobile**

React Native with Expo Router for file-based navigation. LiveKit's React Native SDK wraps the native WebRTC libraries for publishing and subscribing to streams. Socket.io client connects to the backend for real-time events.

## Prerequisites

- Node.js 18+
- PostgreSQL
- LiveKit server (local Docker or LiveKit Cloud)

## LiveKit Setup

**Local (Docker):**

```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server
```

**LiveKit Cloud:**

Create a project at https://cloud.livekit.io, grab your API key, secret, and WebSocket URL, then drop them into `backend/.env`.

## Environment setup

**Backend** — copy the example and fill in your values:

```bash
cd backend
cp .env.example .env
```

```env
# Server
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS="*"
LOG_LEVEL=info

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zoop_live?schema=public"

# Auth
JWT_SECRET="your-secret-key-here"

# Cloudflare R2 (S3-compatible)
R2_BUCKET="zoop-assets"
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY="your-r2-access-key"
R2_SECRET_KEY="your-r2-secret-key"
R2_PUBLIC_URL="https://pub-xxxx.r2.dev"

# LiveKit
LIVEKIT_API_KEY="devkey"
LIVEKIT_API_SECRET="secret"
LIVEKIT_URL="ws://localhost:7880"
LIVEKIT_WEBHOOK_KEY=""

# Gemini AI
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-flash"

# SMTP (email)
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-smtp-username"
SMTP_PASS="your-smtp-password"
SMTP_FROM="noreply@example.com"
```

**Mobile:**

```bash
cd mobile
cp .env.example .env
```

```env
EXPO_PUBLIC_API_ORIGIN=http://<your-backend-host>:<port>
EXPO_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

`EXPO_PUBLIC_API_ORIGIN` is the only thing you need to change when your backend moves — everything else derives from it.

## Running locally

Start LiveKit first, then the backend, then the mobile app.

```bash
# LiveKit
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server

# Backend
cd backend && npm install && npx prisma generate && npx prisma db push && npm run dev

# Mobile
cd mobile && npm install && npm run start
```

## API

**Auth / health**
- `GET /health`
- `POST /api/auth/signup`

**LiveKit**
- `POST /api/livekit/token` — get an access token for a session (requires auth)
- `POST /api/livekit/webhook` — receives room events from LiveKit server

**Sessions**
- `GET /api/sessions/live` — list active sessions
- `GET /api/sessions/:id` — session details
- `POST /api/sessions` — create a session (requires auth)
- `PATCH /api/sessions/:id/end` — end a session (host only)

## Misc

- Never commit `.env` files — only `.env.example` goes in git.
- For production, run LiveKit Cloud or a self-hosted cluster behind a load balancer.
- To scale Socket.io across multiple backend instances, add `@socket.io/redis-adapter`.
