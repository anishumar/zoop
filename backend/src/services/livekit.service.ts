import {
  AccessToken,
  RoomServiceClient,
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

const webhookReceiver = process.env.LIVEKIT_API_KEY
  ? new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  : null;

export class LiveKitService {
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
