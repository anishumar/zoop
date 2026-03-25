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
  
  if (!activeSession || isCurrentScreenHost || isCurrentScreenViewer) return null;

  // GlobalPlayer now only serves the minimized mini-player mode.
  // Both host and viewer screens render their own fullscreen VideoPlayer.
  if (keyboardVisible) return null;

  const handleExpand = () => {
    if (!activeSession) return;
    const route = isHost ? `/host/${activeSession.id}` : `/viewer/${activeSession.id}`;
    router.push(route as any);
  };

  const streamType = (activeSession.streamType as "mock" | "livekit") || "livekit";

  const containerStyle = {
    bottom: 64,
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
        isMini={true}
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
