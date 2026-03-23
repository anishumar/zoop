import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface VideoPlayerProps {
  streamType: "mock" | "agora" | "livekit";
  streamUrl?: string | null;
}

/**
 * Pluggable video player component.
 * Currently renders a mock placeholder.
 * Replace the inner implementation with a real SDK (Agora, LiveKit)
 * without changing the component interface.
 */
export default function VideoPlayer({ streamType, streamUrl }: VideoPlayerProps) {
  if (streamType === "mock" || !streamUrl) {
    return <MockVideoPlayer />;
  }

  // Future: switch on streamType to render Agora/LiveKit player
  // case "agora": return <AgoraPlayer streamUrl={streamUrl} />;
  // case "livekit": return <LiveKitPlayer streamUrl={streamUrl} />;

  return <MockVideoPlayer />;
}

function MockVideoPlayer() {
  return (
    <View style={styles.container}>
      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>
      <Text style={styles.mockText}>Live Stream</Text>
      <Text style={styles.subText}>Video streaming is mocked</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  liveIndicator: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    marginRight: 6,
  },
  liveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  mockText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  subText: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 4,
  },
});
