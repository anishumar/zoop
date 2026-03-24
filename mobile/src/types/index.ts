export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Product {
  id: string;
  title: string;
  price: number;
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
  isLive: boolean;
  startedAt: string | null;
  endedAt: string | null;
  streamUrl: string | null;
  streamType: "mock" | "agora" | "livekit";
  hostId: string;
  host: { id: string; name: string };
  sessionProducts?: { product: Product }[];
}

export interface Message {
  id: string;
  type: "reaction" | "question";
  content: string;
  createdAt: string;
  sessionId: string;
  user: { id: string; name: string };
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
