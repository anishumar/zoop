import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import LiveKitRoom from "./LiveKitRoom";

interface VideoPlayerProps {
  streamType: "mock" | "livekit";
  streamUrl?: string | null;
  livekitToken?: string | null;
  livekitUrl?: string | null;
  isHost?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  onParticipantCountChange?: (count: number) => void;
}

export default function VideoPlayer({
  streamType,
  streamUrl,
  livekitToken,
  livekitUrl,
  isHost = false,
  onConnectionChange,
  onParticipantCountChange,
}: VideoPlayerProps) {
  if (streamType === "livekit" && livekitToken && livekitUrl) {
    return (
      <View style={styles.wrapper}>
        <LiveKitRoom
          token={livekitToken}
          url={livekitUrl}
          isHost={isHost}
          onConnectionChange={onConnectionChange}
          onParticipantCountChange={onParticipantCountChange}
        />
        <LiveBadge />
      </View>
    );
  }

  if (streamType === "livekit" && !livekitToken) {
    return <ConnectingPlayer />;
  }

  return <MockVideoPlayer />;
}

function LiveBadge() {
  return (
    <View style={styles.liveIndicator}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

function ConnectingPlayer() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.connectingText}>Connecting to stream...</Text>
    </View>
  );
}

function MockVideoPlayer() {
  return (
    <View style={styles.container}>
      <LiveBadge />
      <Text style={styles.mockText}>Live Stream</Text>
      <Text style={styles.subText}>Video streaming is mocked</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
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
    zIndex: 10,
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
  connectingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 12,
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
