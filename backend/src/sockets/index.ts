import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { AuthPayload } from "../middlewares/auth";
import { MessageService } from "../services/message.service";

// Track viewer counts per session in-memory (swap with Redis for horizontal scaling)
const sessionViewers = new Map<string, Set<string>>();

export function initializeSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // Auth middleware for socket connections
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
    console.log(`User connected: ${user.userId}`);

    socket.on("join_live", (sessionId: string) => {
      socket.join(sessionId);

      if (!sessionViewers.has(sessionId)) {
        sessionViewers.set(sessionId, new Set());
      }
      sessionViewers.get(sessionId)!.add(user.userId);

      io.to(sessionId).emit("viewer_count_update", {
        sessionId,
        count: sessionViewers.get(sessionId)!.size,
      });

      console.log(`User ${user.userId} joined session ${sessionId}`);
    });

    socket.on("leave_live", (sessionId: string) => {
      socket.leave(sessionId);
      removeViewer(sessionId, user.userId);

      io.to(sessionId).emit("viewer_count_update", {
        sessionId,
        count: sessionViewers.get(sessionId)?.size || 0,
      });

      console.log(`User ${user.userId} left session ${sessionId}`);
    });

    socket.on("send_reaction", async (data: { sessionId: string; content: string }) => {
      try {
        const message = await MessageService.create(data.sessionId, user.userId, "reaction", data.content);
        io.to(data.sessionId).emit("new_reaction", message);
      } catch (err) {
        socket.emit("error", { message: "Failed to send reaction" });
      }
    });

    socket.on("send_question", async (data: { sessionId: string; content: string }) => {
      try {
        const message = await MessageService.create(data.sessionId, user.userId, "question", data.content);
        io.to(data.sessionId).emit("new_question", message);
      } catch (err) {
        socket.emit("error", { message: "Failed to send question" });
      }
    });

    socket.on("disconnect", () => {
      // Clean up viewer from all sessions
      for (const [sessionId, viewers] of sessionViewers.entries()) {
        if (viewers.has(user.userId)) {
          removeViewer(sessionId, user.userId);
          io.to(sessionId).emit("viewer_count_update", {
            sessionId,
            count: viewers.size,
          });
        }
      }
      console.log(`User disconnected: ${user.userId}`);
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
