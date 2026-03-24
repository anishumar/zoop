import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import LiveKitRoom from "./LiveKitRoom";

interface VideoPlayerProps {
  streamType: "mock" | "livekit";
  streamUrl?: string | null;
  livekitToken?: string | null;
  livekitUrl?: string | null;
  isHost?: boolean;
  isCameraEnabled?: boolean;
  isMicrophoneEnabled?: boolean;
  cameraFacingMode?: "user" | "environment";
  onConnectionChange?: (connected: boolean) => void;
  onParticipantCountChange?: (count: number) => void;
  isFullscreen?: boolean;
  isMini?: boolean;
}

export default function VideoPlayer({
  streamType,
  streamUrl,
  livekitToken,
  livekitUrl,
  isHost = false,
  isCameraEnabled = true,
  isMicrophoneEnabled = true,
  cameraFacingMode = "user",
  onConnectionChange,
  onParticipantCountChange,
  isFullscreen,
  isMini,
}: VideoPlayerProps) {
  if (streamType === "livekit" && livekitToken && livekitUrl) {
    return (
      <View style={[
      styles.wrapper, 
      isFullscreen && styles.wrapperFullscreen,
      isMini && styles.wrapperMini
    ]}>
        <LiveKitRoom
          token={livekitToken}
          url={livekitUrl}
          isHost={isHost}
          isCameraEnabled={isCameraEnabled}
          isMicrophoneEnabled={isMicrophoneEnabled}
          cameraFacingMode={cameraFacingMode}
          onConnectionChange={onConnectionChange}
          onParticipantCountChange={onParticipantCountChange}
          isFullscreen={isFullscreen}
          isMini={isMini}
        />
      </View>
    );
  }

  if (streamType === "livekit" && !livekitToken) {
    return <ConnectingPlayer isFullscreen={isFullscreen} />;
  }

  return <MockVideoPlayer isFullscreen={isFullscreen} />;
}



function ConnectingPlayer({ isFullscreen }: { isFullscreen?: boolean }) {
  return (
    <View style={[styles.container, isFullscreen && styles.wrapperFullscreen]}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.connectingText}>Connecting to stream...</Text>
    </View>
  );
}

function MockVideoPlayer({ isFullscreen }: { isFullscreen?: boolean }) {
  return (
    <View style={[styles.container, isFullscreen && styles.wrapperFullscreen]}>
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
  wrapperMini: {
    aspectRatio: undefined,
    borderRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "transparent",
    flex: 1,
  },
  wrapperFullscreen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
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
