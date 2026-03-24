import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL, API_ORIGIN } from "./config";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("token");
}

export async function apiClient<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "Unknown network error";
    throw new Error(
      `Network request failed (${reason}). API origin: ${API_ORIGIN}. ` +
        "If using Android over USB, run: adb reverse tcp:3000 tcp:3000"
    );
  }

  const responseText = await response.text();
  let data: any = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      (responseText ? `HTTP ${response.status}: ${responseText}` : `HTTP ${response.status}`);
    throw new Error(message);
  }

  return data as T;
}
