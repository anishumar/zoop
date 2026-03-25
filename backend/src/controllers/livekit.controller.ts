import { Request, Response } from "express";
import { LiveKitService } from "../services/livekit.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { StorageService } from "../services/storage.service";
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
  if (session.streamType === "livekit" && !session.roomName) {
    throw new ApiError(503, "Live room is not ready yet");
  }

  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) throw new ApiError(404, "User not found");

  const isHost = session.hostId === userId;
  const roomName = session.roomName || `session-${sessionId}`;

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
      url: session.streamUrl || process.env.LIVEKIT_URL || "ws://localhost:7880",
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
  const body = (req as any).rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body)) || "";

  console.log(`[Webhook] Received event: ${body.substring(0, 100)}${body.length > 100 ? "..." : ""}`);
  const event = await LiveKitService.validateWebhook(body, authHeader);
  if (!event) {
    console.warn("[Webhook] Validation failed for request from LiveKit");
    res.status(200).json({ received: true });
    return;
  }
  console.log(`[Webhook] Validated event: ${event.event} for room: ${event.room?.name}`);

  const roomName = event.room?.name;
  const sessionId = roomName?.startsWith("session-") ? roomName.replace("session-", "") : null;

  switch (event.event) {
    case "room_finished": {
      if (sessionId) {
        await prisma.liveSession.updateMany({
          where: { id: sessionId, isLive: true },
          data: { isLive: false, endedAt: new Date() },
        });
      }
      break;
    }
    case "egress_ended": {
      const egressInfo = event.egressInfo;
      console.log(`[Webhook] Egress ended: ${egressInfo?.egressId}, status: ${egressInfo?.status}`);
      
      if (egressInfo) {
        const file = (egressInfo.fileResults && egressInfo.fileResults.length > 0) 
          ? egressInfo.fileResults[0] 
          : (egressInfo as any).file;
          
        if (file) {
          const publicUrl = StorageService.buildPublicUrl(file.filename);
          console.log(`[Webhook] Recording found at: ${publicUrl}`);
          
          let targetSessionId = sessionId;
          if (!targetSessionId && file.filename.startsWith("recordings/")) {
            targetSessionId = file.filename.split("/").pop()?.replace(".mp4", "") || "";
          }

          if (targetSessionId || egressInfo.egressId) {
            const result = await prisma.liveSession.updateMany({
              where: {
                OR: [
                  { egressId: egressInfo.egressId },
                  ...(targetSessionId ? [{ id: targetSessionId }] : [])
                ]
              },
              data: { recordingUrl: publicUrl },
            });
            console.log(`[Webhook] Updated ${result.count} sessions with recording URL.`);
          }
        }
      }
      break;
    }
    case "participant_joined": {
      if (!roomName || !sessionId) break;
      const count = await LiveKitService.getParticipantCount(roomName);
      await prisma.liveSession.update({
        where: { id: sessionId },
        data: { viewerCount: Math.max(0, count - 1) },
      });
      break;
    }
    case "track_published": {
      if (!roomName || !sessionId) break;
      const participantIdentity = event.participant?.identity;
      const session = await prisma.liveSession.findUnique({
        where: { id: sessionId },
        select: { hostId: true, egressId: true }
      });

      // If the host published a track and we haven't started recording yet
      if (session && participantIdentity === session.hostId && !session.egressId) {
        console.log(`[Webhook] Host started publishing in session ${sessionId}, starting recording...`);
        // Ensure the room exists before starting recording (idempotent)
        await LiveKitService.createRoom(roomName, {
          emptyTimeout: 300,
          maxParticipants: 10000,
        });
        const egressId = await LiveKitService.startRoomRecording(roomName, sessionId, session.hostId);
        if (egressId) {
          console.log(`[Webhook] Egress started successfully: ${egressId}`);
          await prisma.liveSession.update({
            where: { id: sessionId },
            data: { egressId }
          });
        }
      }
      break;
    }
    case "participant_left": {
      if (!roomName || !sessionId) break;
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
