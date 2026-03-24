import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_ORIGIN } from "./config";

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  const token = await AsyncStorage.getItem("token");

  if (!socket) {
    socket = io(API_ORIGIN, {
      auth: { token },
      transports: ["polling", "websocket"],
      timeout: 10000,
      reconnection: true,
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connect_error:", error.message);
    });
  } else {
    socket.auth = { token };

    if (!socket.connected && !socket.active) {
      socket.connect();
    }
  }

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
