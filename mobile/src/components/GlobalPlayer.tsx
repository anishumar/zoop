import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Platform, Keyboard, TouchableOpacity } from "react-native";
import { useSegments, useRouter } from "expo-router";
import { usePlayer } from "../contexts/PlayerContext";
import VideoPlayer from "./VideoPlayer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function GlobalPlayer() {
  const { activeSession, isMinimized, lkToken, lkUrl, isHost } = usePlayer();
  const segments = useSegments();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const isCurrentScreenViewer = segments[0] === "viewer";
  const isCurrentScreenHost = segments[0] === "host";
  
  if (!activeSession || isCurrentScreenHost) return null;

  // Mode:
  // 1. Expanded (Full Screen on Viewer Screen)
  // 2. Minimized (Small floating window)
  
  // We should only show in "Expanded" mode if we are actually on the viewer screen.
  // Otherwise, if we aren't on the viewer screen but it's not minimized, we should probably minimize it.
  const mode = isCurrentScreenViewer && !isMinimized ? "expanded" : "minimized";

  if (mode === "minimized" && keyboardVisible) return null;

  const handleExpand = () => {
    if (!activeSession) return;
    const route = isHost ? `/host/${activeSession.id}` : `/viewer/${activeSession.id}`;
    router.push(route as any);
  };

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
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.9}
      onPress={handleExpand}
      style={[styles.container, containerStyle, { pointerEvents: "auto" }]}
    >
      <VideoPlayer
        streamType={streamType}
        streamUrl={activeSession.streamUrl}
        livekitToken={lkToken}
        livekitUrl={lkUrl}
        isHost={isHost}
        isMini={mode === "minimized"}
      />
    </TouchableOpacity>
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
