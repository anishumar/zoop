import {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  WebhookReceiver,
  type VideoGrant,
  type WebhookEvent,
} from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "secret";
const LIVEKIT_URL = (process.env.LIVEKIT_URL || "ws://localhost:7880").replace(
  /^ws/,
  "http"
);

const roomService = new RoomServiceClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

const egressClient = new EgressClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

const webhookReceiver = process.env.LIVEKIT_API_KEY
  ? new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  : null;

export class LiveKitService {
  /**
   * Start recording a host's streams directly to Cloudflare R2 (Participant Egress).
   * This is much faster than RoomCompositeEgress because it doesn't spin up a headless browser.
   */
  static async startRoomRecording(roomName: string, sessionId: string, hostIdentity: string) {
    const bucket = process.env.R2_BUCKET;
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKey = process.env.R2_ACCESS_KEY;
    const secret = process.env.R2_SECRET_KEY;

    if (!bucket || !accountId || !accessKey || !secret) {
      console.warn("Egress ignored: R2 storage not fully configured.", {
        hasBucket: !!bucket,
        hasAccountId: !!accountId,
        hasAccessKey: !!accessKey,
        hasSecret: !!secret,
      });
      return null;
    }

    try {
      const output = {
        file: {
          filepath: `recordings/${sessionId}.mp4`,
          fileType: 1, // MP4 = 1
          output: {
            case: "s3" as const,
            value: {
              bucket,
              accessKey,
              secret,
              endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
              region: "auto",
              forcePathStyle: true,
            },
          },
        }
      };

      console.log(`[Egress] Starting participant egress for room ${roomName}, host: ${hostIdentity}`);

      // Use ParticipantEgress to directly record the host's tracks
      const info = await egressClient.startParticipantEgress(
        roomName,
        hostIdentity,
        output as any,
        {
          screenShare: false, 
          encodingOptions: {
            width: 720,
            height: 1280,
            videoBitrate: 1500, // Optimize bitrate for mobile
          } as any
        }
      );
      return info.egressId;
    } catch (err: any) {
      console.error("Failed to start LiveKit Participant Egress:", {
        message: err.message,
        roomName,
        sessionId,
      });
      return null;
    }
  }

  static async stopRecording(egressId: string) {
    try {
      await egressClient.stopEgress(egressId);
    } catch (err) {
      // It might have already stopped
    }
  }

  /**
   * Generate an access token for a participant.
   * Hosts get publish + subscribe grants; viewers get subscribe-only.
   */
  static async createToken(
    roomName: string,
    participantIdentity: string,
    participantName: string,
    isHost: boolean
  ): Promise<string> {
    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: isHost,
      canPublishData: true,
      canSubscribe: true,
    };

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      ttl: "6h",
    });
    token.addGrant(grant);

    return await token.toJwt();
  }

  /**
   * Create a LiveKit room with production-grade settings:
   * - Simulcast for adaptive quality (like Twitch/YouTube)
   * - Empty room timeout for resource cleanup
   * - Max participants limit for safety
   */
  static async createRoom(
    roomName: string,
    options?: {
      emptyTimeout?: number;
      maxParticipants?: number;
    }
  ) {
    return roomService.createRoom({
      name: roomName,
      emptyTimeout: options?.emptyTimeout ?? 300,
      maxParticipants: options?.maxParticipants ?? 10000,
    });
  }

  static async deleteRoom(roomName: string) {
    try {
      await roomService.deleteRoom(roomName);
    } catch {
      // Room may already be gone
    }
  }

  static async listParticipants(roomName: string) {
    try {
      return await roomService.listParticipants(roomName);
    } catch {
      return [];
    }
  }

  static async getParticipantCount(roomName: string): Promise<number> {
    try {
      const participants = await roomService.listParticipants(roomName);
      return participants.length;
    } catch {
      return 0;
    }
  }

  static async removeParticipant(roomName: string, identity: string) {
    try {
      await roomService.removeParticipant(roomName, identity);
    } catch {
      // Participant may already be gone
    }
  }

  /**
   * Mute/unmute a participant's track (moderation).
   */
  static async muteParticipant(
    roomName: string,
    identity: string,
    trackSid: string,
    muted: boolean
  ) {
    await roomService.mutePublishedTrack(roomName, identity, trackSid, muted);
  }

  static async validateWebhook(
    body: string,
    authHeader: string
  ): Promise<WebhookEvent | null> {
    if (!webhookReceiver) return null;
    try {
      return await webhookReceiver.receive(body, authHeader);
    } catch {
      return null;
    }
  }
}
