const API_ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:3000").replace(/\/$/, "");

const API_BASE_URL = `${API_ORIGIN}/api`;

export { API_ORIGIN, API_BASE_URL };
