import { Request, Response } from "express";
import { LiveKitService } from "../services/livekit.service";
import { SessionService } from "../services/session.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import prisma from "../prisma/client";

/**
 * POST /api/livekit/token
 * Generate a LiveKit access token for joining a session's room.
 * Host gets publish rights, viewers get subscribe-only.
 */
export const getToken = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (!sessionId) throw new ApiError(400, "sessionId is required");

  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: { host: { select: { id: true, name: true } } },
  });
  if (!session) throw new ApiError(404, "Session not found");
  if (!session.isLive) throw new ApiError(400, "Session is not live");

  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) throw new ApiError(404, "User not found");

  const isHost = session.hostId === userId;
  const roomName = `session-${sessionId}`;

  const token = await LiveKitService.createToken(
    roomName,
    userId,
    user.name,
    isHost
  );

  sendSuccess(
    res,
    {
      token,
      url: process.env.LIVEKIT_URL || "ws://localhost:7880",
      roomName,
      isHost,
    },
    "Token generated"
  );
});

/**
 * POST /api/livekit/webhook
 * Handle LiveKit server-side events (room started/finished, participant joined/left).
 * Used for accurate viewer counts and auto-ending stale sessions.
 */
export const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"] as string;
  const body =
    typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  const event = await LiveKitService.validateWebhook(body, authHeader);
  if (!event) {
    res.status(200).json({ received: true });
    return;
  }

  const roomName = event.room?.name;
  if (!roomName?.startsWith("session-")) {
    res.status(200).json({ received: true });
    return;
  }

  const sessionId = roomName.replace("session-", "");

  switch (event.event) {
    case "room_finished": {
      await prisma.liveSession.updateMany({
        where: { id: sessionId, isLive: true },
        data: { isLive: false, endedAt: new Date() },
      });
      break;
    }
    case "participant_joined":
    case "participant_left": {
      const count = await LiveKitService.getParticipantCount(roomName);
      await prisma.liveSession.update({
        where: { id: sessionId },
        data: { viewerCount: Math.max(0, count - 1) },
      });
      break;
    }
  }

  res.status(200).json({ received: true });
});
