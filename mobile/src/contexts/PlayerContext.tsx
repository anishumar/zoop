import React, { createContext, useContext, useState, ReactNode } from "react";
import { LiveSession } from "../types";
import { disconnectSocket } from "../api/socket";

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

  const openPlayer = (session: LiveSession, token: string | null, url: string | null, minimized: boolean = false) => {
    console.log("PlayerContext: openPlayer", session.id, "minimized:", minimized);
    setActiveSession(session);
    setLkToken(token);
    setLkUrl(url);
    setIsMinimized(minimized);
  };

  const minimizePlayer = () => {
    console.log("PlayerContext: minimizePlayer");
    if (activeSession) {
      setIsMinimized(true);
    }
  };

  const expandPlayer = () => {
    console.log("PlayerContext: expandPlayer");
    setIsMinimized(false);
  };

  const closePlayer = () => {
    console.log("PlayerContext: closePlayer");
    setActiveSession(null);
    setIsMinimized(false);
    setLkToken(null);
    setLkUrl(null);
    disconnectSocket();
  };

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
