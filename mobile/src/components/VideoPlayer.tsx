import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import LiveKitRoom from "./LiveKitRoom";

interface VideoPlayerProps {
  streamType: "mock" | "livekit";
  streamUrl?: string | null;
  livekitToken?: string | null;
  livekitUrl?: string | null;
  liveBadgeVariant?: "full" | "dot";
  isHost?: boolean;
  isCameraEnabled?: boolean;
  isMicrophoneEnabled?: boolean;
  cameraFacingMode?: "user" | "environment";
  onConnectionChange?: (connected: boolean) => void;
  onParticipantCountChange?: (count: number) => void;
}

export default function VideoPlayer({
  streamType,
  streamUrl,
  livekitToken,
  livekitUrl,
  liveBadgeVariant = "full",
  isHost = false,
  isCameraEnabled = true,
  isMicrophoneEnabled = true,
  cameraFacingMode = "user",
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
          isCameraEnabled={isCameraEnabled}
          isMicrophoneEnabled={isMicrophoneEnabled}
          cameraFacingMode={cameraFacingMode}
          onConnectionChange={onConnectionChange}
          onParticipantCountChange={onParticipantCountChange}
        />
        <LiveBadge variant={liveBadgeVariant} />
      </View>
    );
  }

  if (streamType === "livekit" && !livekitToken) {
    return <ConnectingPlayer />;
  }

  return <MockVideoPlayer liveBadgeVariant={liveBadgeVariant} />;
}

function LiveBadge({ variant = "full" }: { variant?: "full" | "dot" }) {
  if (variant === "dot") {
    return (
      <View style={styles.liveDotBadge}>
        <View style={styles.liveDotSolo} />
      </View>
    );
  }

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

function MockVideoPlayer({ liveBadgeVariant = "full" }: { liveBadgeVariant?: "full" | "dot" }) {
  return (
    <View style={styles.container}>
      <LiveBadge variant={liveBadgeVariant} />
      <Text style={styles.mockText}>Live Stream</Text>
      <Text style={styles.subText}>Video streaming is mocked</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
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
  liveDotBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  liveDotSolo: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
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
