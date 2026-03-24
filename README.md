# Zoop

Monorepo for a live commerce app with real-time video streaming:
- `backend` (Node.js + Express + TypeScript + Prisma + Socket.io + LiveKit)
- `mobile` (React Native + Expo Router + LiveKit WebRTC)

## Architecture

```
┌─────────────┐     WebRTC/Simulcast     ┌──────────────┐
│  Host App   │ ◄──────────────────────► │  LiveKit SFU │
│ (Publisher) │                          │   Server     │
└─────────────┘                          └──────┬───────┘
                                                │ WebRTC
┌─────────────┐     WebRTC (subscribe)   ┌──────┴───────┐
│ Viewer App  │ ◄──────────────────────► │  Adaptive    │
│(Subscriber) │                          │  Bitrate     │
└──────┬──────┘                          └──────────────┘
       │ Socket.io
┌──────┴──────┐
│   Backend   │  REST API + Socket.io (chat, reactions, viewer counts)
│  (Express)  │  LiveKit token generation + room management
└─────────────┘
```

**Scalability features:**
- **Simulcast**: Host publishes multiple quality layers; viewers auto-select based on bandwidth
- **Adaptive bitrate**: LiveKit SFU dynamically adjusts stream quality per viewer
- **Dynacast**: Only encodes video layers that have active subscribers
- **WebRTC SFU**: Scales to thousands of viewers per room (not peer-to-peer)
- **Socket.io**: Ready for Redis adapter for horizontal scaling of chat/reactions

## Prerequisites

- Node.js 18+
- PostgreSQL (local or remote)
- LiveKit Server (self-hosted or LiveKit Cloud)

## LiveKit Setup

### Option A: Local development (Docker)

```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server
```

### Option B: LiveKit Cloud

1. Create a project at https://cloud.livekit.io
2. Copy your API key, secret, and WebSocket URL
3. Set them in `backend/.env`

## Environment setup

### Backend

```bash
cd backend
cp .env.example .env
```

Required variables in `backend/.env`:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<db>?schema=public
JWT_SECRET=<strong-random-secret>
PORT=3000
NODE_ENV=development

# LiveKit
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

### Mobile

```bash
cd mobile
cp .env.example .env
```

Required variables in `mobile/.env`:

```env
EXPO_PUBLIC_API_ORIGIN=http://<your-backend-host>:<port>
EXPO_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

> The mobile app reads `EXPO_PUBLIC_API_ORIGIN` and builds API/socket URLs from it. No API origin is hardcoded in code.

## Install and run

### 1) LiveKit Server

```bash
# Docker (recommended for local dev)
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server
```

### 2) Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### 3) Mobile

```bash
cd mobile
npm install
npm run start
```

## Quick verify

- Backend health: `GET <EXPO_PUBLIC_API_ORIGIN>/health`
- Signup endpoint: `POST <EXPO_PUBLIC_API_ORIGIN>/api/auth/signup`

## API Endpoints

### LiveKit
- `POST /api/livekit/token` — Generate LiveKit access token for a session (authenticated)
- `POST /api/livekit/webhook` — LiveKit server webhook for room events

### Sessions
- `GET /api/sessions/live` — List active live sessions
- `GET /api/sessions/:id` — Get session details
- `POST /api/sessions` — Create a new live session (authenticated)
- `PATCH /api/sessions/:id/end` — End a live session (host only)

## Notes

- Keep `.env` files local; commit only `.env.example`.
- Update `EXPO_PUBLIC_API_ORIGIN` when backend host/port changes.
- For production, use LiveKit Cloud or a self-hosted cluster behind a load balancer.
- To scale Socket.io horizontally, add `@socket.io/redis-adapter`.
