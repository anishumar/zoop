import prisma from "../prisma/client";
import { ApiError } from "../utils/ApiError";
import { LiveKitService } from "./livekit.service";

export class SessionService {
  static async create(hostId: string, data: { title?: string; streamType?: string }) {
    const streamType = data.streamType || "livekit";

    const session = await prisma.liveSession.create({
      data: {
        hostId,
        title: data.title || "Live Session",
        streamType,
        isLive: true,
        startedAt: new Date(),
      },
      include: { host: { select: { id: true, name: true, email: true } } },
    });

    if (streamType === "livekit") {
      const roomName = `session-${session.id}`;
      try {
        await LiveKitService.createRoom(roomName, {
          emptyTimeout: 300,
          maxParticipants: 10000,
        });
        await prisma.liveSession.update({
          where: { id: session.id },
          data: {
            roomName,
            streamUrl: process.env.LIVEKIT_URL || "ws://localhost:7880",
          },
        });
      } catch (err) {
        console.error("Failed to create LiveKit room:", err);
      }
    }

    return session;
  }

  static async endSession(sessionId: string, hostId: string) {
    const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new ApiError(404, "Session not found");
    if (session.hostId !== hostId) throw new ApiError(403, "Only the host can end this session");

    if (session.roomName) {
      await LiveKitService.deleteRoom(session.roomName);
    }

    return prisma.liveSession.update({
      where: { id: sessionId },
      data: { isLive: false, endedAt: new Date() },
    });
  }

  static async listLive(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [sessions, total] = await Promise.all([
      prisma.liveSession.findMany({
        where: { isLive: true },
        skip,
        take: limit,
        orderBy: { startedAt: "desc" },
        include: {
          host: { select: { id: true, name: true } },
          sessionProducts: { include: { product: true } },
        },
      }),
      prisma.liveSession.count({ where: { isLive: true } }),
    ]);
    return { sessions, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async getById(id: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, name: true, email: true } },
        sessionProducts: { include: { product: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!session) throw new ApiError(404, "Session not found");
    return session;
  }

  static async addProduct(sessionId: string, productId: string, hostId: string) {
    const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new ApiError(404, "Session not found");
    if (session.hostId !== hostId) throw new ApiError(403, "Only the host can add products");

    return prisma.sessionProduct.create({
      data: { sessionId, productId },
      include: { product: true },
    });
  }

  static async removeProduct(sessionId: string, productId: string, hostId: string) {
    const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new ApiError(404, "Session not found");
    if (session.hostId !== hostId) throw new ApiError(403, "Only the host can remove products");

    return prisma.sessionProduct.deleteMany({
      where: { sessionId, productId },
    });
  }

  static async getAnalytics(sessionId: string) {
    const [messageCount, reactionCount, questionCount] = await Promise.all([
      prisma.message.count({ where: { sessionId } }),
      prisma.message.count({ where: { sessionId, type: "reaction" } }),
      prisma.message.count({ where: { sessionId, type: "question" } }),
    ]);

    return { sessionId, messageCount, reactionCount, questionCount };
  }
}
