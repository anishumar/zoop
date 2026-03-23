import prisma from "../prisma/client";

export class MessageService {
  static async create(sessionId: string, userId: string, type: string, content: string) {
    return prisma.message.create({
      data: { sessionId, userId, type, content },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  static async listBySession(sessionId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { sessionId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.message.count({ where: { sessionId } }),
    ]);
    return { messages, total, page, totalPages: Math.ceil(total / limit) };
  }
}
