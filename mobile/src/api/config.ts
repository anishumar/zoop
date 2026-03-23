const API_ORIGIN = process.env.EXPO_PUBLIC_API_ORIGIN;

if (!API_ORIGIN) {
  throw new Error("Missing EXPO_PUBLIC_API_ORIGIN. Add it to mobile/.env");
}

const API_BASE_URL = `${API_ORIGIN.replace(/\/$/, "")}/api`;

export { API_ORIGIN, API_BASE_URL };
