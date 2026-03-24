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
    "ngrok-skip-browser-warning": "true",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const reason = isTimeout
      ? "Request timed out after 10s"
      : error instanceof Error
      ? error.message
      : "Unknown network error";
    throw new Error(`Network request failed: ${reason}. Check that API_ORIGIN is reachable: ${API_ORIGIN}`);
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();

  if (!responseText) {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return null as T;
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Non-JSON response from ${url}. If using ngrok, ensure the tunnel is running. Response: ${responseText.slice(0, 120)}`
    );
  }

  if (!response.ok) {
    throw new Error(data?.message || `HTTP ${response.status}`);
  }

  return data as T;
}
