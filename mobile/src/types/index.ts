export interface User {
  id: string;
  name: string;
  email: string;
  bio?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  quantity: number;
  sizes: string[];
  ownerId: string;
  imageKey?: string | null;
  imageUrl?: string | null;
  imageMimeType?: string | null;
  imageSize?: number | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

export interface LiveSession {
  id: string;
  title: string;
  description?: string | null;
  isLive: boolean;

  startedAt: string | null;
  endedAt: string | null;
  streamUrl: string | null;
  recordingUrl?: string | null;
  egressId?: string | null;
  streamType: "mock" | "livekit" | "vod";
  roomName: string | null;
  viewerCount: number;
  peakViewers: number;
  thumbnailUrl: string | null;
  hostId: string;
  host: { id: string; name: string; avatarUrl?: string | null };
  sessionProducts?: { product: Product }[];
  messages?: Message[];
}

export interface Message {
  id: string;
  type: "reaction" | "question" | "host_reply" | "comment";
  content: string;

  createdAt: string;
  sessionId: string;
  user: { id: string; name: string; avatarUrl?: string | null };

}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}
