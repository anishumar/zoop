import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { Alert, Platform } from "react-native";
import { LiveSession } from "../types";
import { disconnectSocket, getSocket } from "../api/socket";

interface PlayerContextType {
  activeSession: LiveSession | null;
  isMinimized: boolean;
  lkToken: string | null;
  lkUrl: string | null;
  openPlayer: (session: LiveSession, token: string | null, url: string | null, minimized?: boolean) => void;
  minimizePlayer: () => void;
  expandPlayer: () => void;
  closePlayer: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string | null>(null);
  const streamEndedCleanupRef = useRef<(() => void) | null>(null);

  const detachStreamEndedListener = useCallback(() => {
    streamEndedCleanupRef.current?.();
    streamEndedCleanupRef.current = null;
  }, []);

  const closePlayer = useCallback(() => {
    console.log("PlayerContext: closePlayer");
    detachStreamEndedListener();
    setActiveSession(null);
    setIsMinimized(false);
    setLkToken(null);
    setLkUrl(null);
    disconnectSocket();
  }, [detachStreamEndedListener]);

  const notifyLiveEnded = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert("This live has ended.");
      return;
    }
    Alert.alert("Live ended", "This live has ended.");
  }, []);

  const attachStreamEndedListener = useCallback(
    (sessionId: string) => {
      detachStreamEndedListener();

      const socket = getSocket();
      if (!socket) return;

      const handleStreamEnded = (data?: { sessionId?: string }) => {
        if (data?.sessionId && data.sessionId !== sessionId) return;
        notifyLiveEnded();
        closePlayer();
      };

      socket.on("stream_ended", handleStreamEnded);
      streamEndedCleanupRef.current = () => {
        socket.off("stream_ended", handleStreamEnded);
      };
    },
    [closePlayer, detachStreamEndedListener, notifyLiveEnded]
  );

  const openPlayer = useCallback((session: LiveSession, token: string | null, url: string | null, minimized: boolean = false) => {
    console.log("PlayerContext: openPlayer", session.id, "minimized:", minimized);
    setActiveSession(session);
    setLkToken(token);
    setLkUrl(url);
    setIsMinimized(minimized);
    attachStreamEndedListener(session.id);
  }, [attachStreamEndedListener]);

  const minimizePlayer = useCallback(() => {
    console.log("PlayerContext: minimizePlayer");
    if (activeSession) {
      setIsMinimized(true);
    }
  }, [activeSession]);

  const expandPlayer = useCallback(() => {
    console.log("PlayerContext: expandPlayer");
    setIsMinimized(false);
  }, []);

  useEffect(() => {
    if (!activeSession) {
      detachStreamEndedListener();
      return;
    }

    attachStreamEndedListener(activeSession.id);
  }, [activeSession, attachStreamEndedListener, detachStreamEndedListener]);

  return (
    <PlayerContext.Provider
      value={{
        activeSession,
        isMinimized,
        lkToken,
        lkUrl,
        openPlayer,
        minimizePlayer,
        expandPlayer,
        closePlayer,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
