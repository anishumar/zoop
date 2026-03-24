import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { AuthPayload } from "../middlewares/auth";
import { MessageService } from "../services/message.service";
import prisma from "../prisma/client";

/**
 * In-memory viewer tracking per session.
 * For horizontal scaling, swap this with Redis adapter:
 *   import { createAdapter } from "@socket.io/redis-adapter";
 *   io.adapter(createAdapter(pubClient, subClient));
 */
const sessionViewerSockets = new Map<string, Set<string>>();
const socketSessions = new Map<string, Set<string>>();

const REACTION_THROTTLE_MS = 1000;
const QUESTION_THROTTLE_MS = 3000;
const reactionTimestamps = new Map<string, number>();
const questionTimestamps = new Map<string, number>();
const viewerCountSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const latestViewerCounts = new Map<string, number>();
const VIEWER_COUNT_SYNC_DEBOUNCE_MS = 1000;
const ALLOWED_REACTIONS = new Set(["❤️", "🔥", "👏", "😍", "🎉", "💰"]);

export function initializeSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 10000,
    pingTimeout: 5000,
    maxHttpBufferSize: 1e6,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      (socket as Socket & { user: AuthPayload }).user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as Socket & { user: AuthPayload }).user;

    socket.on("join_live", (sessionId: string) => {
      if (!isValidSessionId(sessionId)) return;

      socket.join(sessionId);
      addSocketToSession(sessionId, socket.id);
      emitViewerCount(io, sessionId);
    });

    socket.on("leave_live", (sessionId: string) => {
      if (!isValidSessionId(sessionId)) return;

      socket.leave(sessionId);
      removeSocketFromSession(sessionId, socket.id);
      reactionTimestamps.delete(`${user.userId}:${sessionId}`);
      questionTimestamps.delete(`${user.userId}:${sessionId}`);
      emitViewerCount(io, sessionId);
    });

    socket.on("send_reaction", async (data: { sessionId: string; content: string }) => {
      if (!isValidSessionId(data.sessionId) || !isSocketInSession(data.sessionId, socket.id)) return;
      if (!ALLOWED_REACTIONS.has(data.content)) return;

      const key = `${user.userId}:${data.sessionId}`;
      const now = Date.now();
      const last = reactionTimestamps.get(key) || 0;
      if (now - last < REACTION_THROTTLE_MS) return;
      reactionTimestamps.set(key, now);

      try {
        const message = await MessageService.create(data.sessionId, user.userId, "reaction", data.content);
        io.to(data.sessionId).emit("new_reaction", message);
      } catch {
        socket.emit("error", { message: "Failed to send reaction" });
      }
    });

    socket.on("send_question", async (data: { sessionId: string; content: string }) => {
      if (!isValidSessionId(data.sessionId) || !isSocketInSession(data.sessionId, socket.id)) return;
      if (!data.content?.trim() || data.content.length > 500) return;

      const key = `${user.userId}:${data.sessionId}`;
      const now = Date.now();
      const last = questionTimestamps.get(key) || 0;
      if (now - last < QUESTION_THROTTLE_MS) return;
      questionTimestamps.set(key, now);

      try {
        const message = await MessageService.create(data.sessionId, user.userId, "question", data.content.trim());
        io.to(data.sessionId).emit("new_question", message);
      } catch {
        socket.emit("error", { message: "Failed to send question" });
      }
    });

    socket.on("send_host_reply", async (data: { sessionId: string; content: string }) => {
      if (!isValidSessionId(data.sessionId) || !isSocketInSession(data.sessionId, socket.id)) return;
      if (!data.content?.trim() || data.content.length > 500) return;
      if (!(await isHostForSession(data.sessionId, user.userId))) return;

      try {
        const message = await MessageService.create(
          data.sessionId,
          user.userId,
          "host_reply",
          data.content.trim()
        );
        io.to(data.sessionId).emit("new_host_reply", message);
      } catch {
        socket.emit("error", { message: "Failed to send host reply" });
      }
    });

    socket.on("host_stream_started", async (data: { sessionId: string }) => {
      if (!isValidSessionId(data.sessionId)) return;
      if (!(await isHostForSession(data.sessionId, user.userId))) return;

      io.to(data.sessionId).emit("stream_started", { sessionId: data.sessionId });
    });

    socket.on("host_stream_ended", async (data: { sessionId: string }) => {
      if (!isValidSessionId(data.sessionId)) return;
      if (!(await isHostForSession(data.sessionId, user.userId))) return;

      io.to(data.sessionId).emit("stream_ended", { sessionId: data.sessionId });
    });

    socket.on("product_highlighted", async (data: { sessionId: string; productId: string }) => {
      if (!isValidSessionId(data.sessionId) || !data.productId) return;
      if (!(await isHostForSession(data.sessionId, user.userId))) return;

      io.to(data.sessionId).emit("product_highlight", {
        sessionId: data.sessionId,
        productId: data.productId,
      });
    });

    socket.on("session_products_sync", async (data: { sessionId: string }) => {
      if (!isValidSessionId(data.sessionId)) return;
      if (!(await isHostForSession(data.sessionId, user.userId))) return;

      const session = await prisma.liveSession.findUnique({
        where: { id: data.sessionId },
        select: {
          sessionProducts: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!session) return;

      io.to(data.sessionId).emit("session_products_updated", {
        sessionId: data.sessionId,
        sessionProducts: session.sessionProducts,
      });
    });

    socket.on("disconnect", () => {
      const joinedSessions = Array.from(socketSessions.get(socket.id) || []);
      for (const sessionId of joinedSessions) {
        removeSocketFromSession(sessionId, socket.id);
        reactionTimestamps.delete(`${user.userId}:${sessionId}`);
        questionTimestamps.delete(`${user.userId}:${sessionId}`);
        emitViewerCount(io, sessionId);
      }
      socketSessions.delete(socket.id);
    });
  });

  return io;
}

function addSocketToSession(sessionId: string, socketId: string) {
  if (!sessionViewerSockets.has(sessionId)) {
    sessionViewerSockets.set(sessionId, new Set());
  }
  sessionViewerSockets.get(sessionId)!.add(socketId);

  if (!socketSessions.has(socketId)) {
    socketSessions.set(socketId, new Set());
  }
  socketSessions.get(socketId)!.add(sessionId);
}

function removeSocketFromSession(sessionId: string, socketId: string) {
  const viewerSockets = sessionViewerSockets.get(sessionId);
  if (viewerSockets) {
    viewerSockets.delete(socketId);
    if (viewerSockets.size === 0) {
      sessionViewerSockets.delete(sessionId);
    }
  }

  const sessions = socketSessions.get(socketId);
  if (sessions) {
    sessions.delete(sessionId);
    if (sessions.size === 0) {
      socketSessions.delete(socketId);
    }
  }
}

function isSocketInSession(sessionId: string, socketId: string) {
  return socketSessions.get(socketId)?.has(sessionId) || false;
}

function getViewerCount(sessionId: string) {
  return sessionViewerSockets.get(sessionId)?.size || 0;
}

function emitViewerCount(io: Server, sessionId: string) {
  const count = getViewerCount(sessionId);
  io.to(sessionId).emit("viewer_count_update", { sessionId, count });
  scheduleViewerCountSync(sessionId, count);
}

function scheduleViewerCountSync(sessionId: string, count: number) {
  latestViewerCounts.set(sessionId, count);
  if (viewerCountSyncTimers.has(sessionId)) return;

  viewerCountSyncTimers.set(
    sessionId,
    setTimeout(async () => {
      viewerCountSyncTimers.delete(sessionId);
      const currentCount = latestViewerCounts.get(sessionId) || 0;
      latestViewerCounts.delete(sessionId);

      try {
        await prisma.$transaction([
          prisma.liveSession.updateMany({
            where: { id: sessionId, isLive: true },
            data: { viewerCount: currentCount },
          }),
          prisma.liveSession.updateMany({
            where: { id: sessionId, peakViewers: { lt: currentCount } },
            data: { peakViewers: currentCount },
          }),
        ]);
      } catch {
        // Ignore transient DB sync failures; live viewer counts are still broadcast from memory.
      }
    }, VIEWER_COUNT_SYNC_DEBOUNCE_MS)
  );
}

function isValidSessionId(sessionId: string) {
  return typeof sessionId === "string" && sessionId.trim().length > 0;
}

async function isHostForSession(sessionId: string, userId: string) {
  try {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { hostId: true, isLive: true },
    });
    return Boolean(session?.isLive && session.hostId === userId);
  } catch {
    return false;
  }
}
