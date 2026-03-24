const API_ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:3000").replace(/\/$/, "");

const API_BASE_URL = `${API_ORIGIN}/api`;

const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? "ws://localhost:7880";

export { API_ORIGIN, API_BASE_URL, LIVEKIT_URL };
