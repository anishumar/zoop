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
const sessionViewers = new Map<string, Set<string>>();

const REACTION_THROTTLE_MS = 500;
const reactionTimestamps = new Map<string, number>();

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

    socket.on("join_live", async (sessionId: string) => {
      socket.join(sessionId);

      if (!sessionViewers.has(sessionId)) {
        sessionViewers.set(sessionId, new Set());
      }
      sessionViewers.get(sessionId)!.add(user.userId);

      const count = sessionViewers.get(sessionId)!.size;
      io.to(sessionId).emit("viewer_count_update", { sessionId, count });

      updatePeakViewers(sessionId, count);
    });

    socket.on("leave_live", (sessionId: string) => {
      socket.leave(sessionId);
      removeViewer(sessionId, user.userId);

      io.to(sessionId).emit("viewer_count_update", {
        sessionId,
        count: sessionViewers.get(sessionId)?.size || 0,
      });
    });

    socket.on("send_reaction", async (data: { sessionId: string; content: string }) => {
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
      if (!data.content?.trim() || data.content.length > 500) return;

      try {
        const message = await MessageService.create(data.sessionId, user.userId, "question", data.content.trim());
        io.to(data.sessionId).emit("new_question", message);
      } catch {
        socket.emit("error", { message: "Failed to send question" });
      }
    });

    socket.on("host_stream_started", (data: { sessionId: string }) => {
      io.to(data.sessionId).emit("stream_started", { sessionId: data.sessionId });
    });

    socket.on("host_stream_ended", (data: { sessionId: string }) => {
      io.to(data.sessionId).emit("stream_ended", { sessionId: data.sessionId });
    });

    socket.on("product_highlighted", (data: { sessionId: string; productId: string }) => {
      io.to(data.sessionId).emit("product_highlight", {
        sessionId: data.sessionId,
        productId: data.productId,
      });
    });

    socket.on("disconnect", () => {
      for (const [sessionId, viewers] of sessionViewers.entries()) {
        if (viewers.has(user.userId)) {
          removeViewer(sessionId, user.userId);
          io.to(sessionId).emit("viewer_count_update", {
            sessionId,
            count: viewers.size,
          });
        }
      }
    });
  });

  return io;
}

function removeViewer(sessionId: string, userId: string) {
  const viewers = sessionViewers.get(sessionId);
  if (viewers) {
    viewers.delete(userId);
    if (viewers.size === 0) sessionViewers.delete(sessionId);
  }
}

async function updatePeakViewers(sessionId: string, currentCount: number) {
  try {
    await prisma.liveSession.updateMany({
      where: { id: sessionId, peakViewers: { lt: currentCount } },
      data: { peakViewers: currentCount, viewerCount: currentCount },
    });
  } catch {}
}
