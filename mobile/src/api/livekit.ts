import { apiClient } from "./client";
import { ApiResponse } from "../types";

export interface LiveKitTokenResponse {
  token: string;
  url: string;
  roomName: string;
  isHost: boolean;
}

export async function getLiveKitToken(
  sessionId: string
): Promise<LiveKitTokenResponse> {
  const res = await apiClient<ApiResponse<LiveKitTokenResponse>>(
    "/livekit/token",
    {
      method: "POST",
      body: { sessionId },
    }
  );
  return res.data;
}
