# Zoop

Monorepo for a live commerce app with:
- `backend` (Node.js + Express + TypeScript + Prisma + Socket.io)
- `mobile` (React Native + Expo Router)

## Prerequisites

- Node.js 18+
- PostgreSQL (local or remote)

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
```

### Mobile

```bash
cd mobile
cp .env.example .env
```

Required variables in `mobile/.env`:

```env
EXPO_PUBLIC_API_ORIGIN=http://<your-backend-host>:<port>
```

> The mobile app reads `EXPO_PUBLIC_API_ORIGIN` and builds API/socket URLs from it. No API origin is hardcoded in code.

## Install and run

### 1) Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### 2) Mobile

```bash
cd mobile
npm install
npm run start
```

## Quick verify

- Backend health: `GET <EXPO_PUBLIC_API_ORIGIN>/health`
- Signup endpoint: `POST <EXPO_PUBLIC_API_ORIGIN>/api/auth/signup`

## GitHub push (one-repo setup)

Run from project root:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/anishumar/zoop.git
git branch -M main
git push -u origin main
```

## Notes

- Keep `.env` files local; commit only `.env.example`.
- Update `EXPO_PUBLIC_API_ORIGIN` when backend host/port changes.
