import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import { useSegments } from "expo-router";
import { usePlayer } from "../contexts/PlayerContext";
import VideoPlayer from "./VideoPlayer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height: screenHeight } = Dimensions.get("window");

export default function GlobalPlayer() {
  const { activeSession, isMinimized, lkToken, lkUrl } = usePlayer();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const isCurrentScreenViewer = segments[0] === "viewer";

  // Mode:
  // 1. Expanded (Full Screen on Viewer Screen)
  // 2. Minimized (Small floating window)
  
  if (!activeSession) return null;

  // We should only show in "Expanded" mode if we are actually on the viewer screen.
  // Otherwise, if we aren't on the viewer screen but it's not minimized, we should probably minimize it.
  const mode = isCurrentScreenViewer && !isMinimized ? "expanded" : "minimized";

  const streamType = (activeSession.streamType as "mock" | "livekit") || "livekit";

  // Calculate position styles
  const containerStyle = mode === "expanded" ? {
    top: insets.top + (Platform.OS === "android" ? 54 : 48), // under the TopBar
    left: 16,
    right: 16,
    height: (width - 32) * 9 / 16,
    borderRadius: 12,
  } : {
    bottom: 64, // Positioned slightly above the navigation bar
    left: 8,
    width: 120,
    height: 76,
    borderRadius: 8,
  };

  return (
    <View style={[styles.container, containerStyle, { pointerEvents: "auto" }]}>
      <VideoPlayer
        streamType={streamType}
        streamUrl={activeSession.streamUrl}
        livekitToken={lkToken}
        livekitUrl={lkUrl}
        liveBadgeVariant={mode === "minimized" ? "dot" : "full"}
        isHost={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "#000",
    zIndex: 10001,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
});
