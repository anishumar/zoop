# Zoop Backend

The robust, production-ready TypeScript backend for the Zoop mobile application. Built with Express, Prisma, and LiveKit, this server handles real-time video streaming, user social features, and media storage.

## 🚀 Features

- **Real-time Streaming**: Full integration with LiveKit for high-fidelity live streaming.
- **Production Hardened**: Integrated with `helmet` for security and `morgan`/`winston` for structured logging.
- **database**: Prisma ORM with PostgreSQL for reliable data management.
- **Storage**: AWS S3/Cloudflare R2 compatible storage for session recordings and user avatars.
- **Scalable**: Built with clean architecture and production-ready middleware.

## 🛠️ Tech Stack

- **Runtime**: Node.js (v20+)
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Prisma
- **Real-time**: Socket.io + LiveKit
- **Logging**: Winston + Morgan

## 📦 Setup & Installation

### 1. Prerequisites
- Node.js v20+
- PostgreSQL instance
- LiveKit Server (Cloud or Self-hosted)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```
Fill in your database credentials, LiveKit keys, and S3/R2 storage details.

### 4. Database Setup
```bash
npx prisma migrate dev
```

### 5. Running the Application
- **Development**: `npm run dev`
- **Production Build**: `npm run build`
- **Production Start**: `npm run start`

## 🚢 Deployment

For detailed instructions on deploying to AWS EC2, see the [Deployment Guide](./ec2_deployment_guide.md).

### Quick Deployment Steps:
1. Ensure `NODE_ENV=production` is set.
2. Provide a comma-separated list of `ALLOWED_ORIGINS`.
3. Use a process manager like **PM2** to ensure the server stays online.

## 🔒 Security

This backend implements best practices for product-ready servers:
- **CORS Restricted**: Only allows requests from specified origins or native mobile apps.
- **Helmet**: Protects from well-known web vulnerabilities.
- **Graceful Shutdown**: Handles `SIGTERM/SIGINT` to close connections safely.

## 📄 License

ISC
