import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Video, ResizeMode } from "expo-av";
import LiveKitRoom from "./LiveKitRoom";

interface VideoPlayerProps {
  streamType: "mock" | "livekit" | "vod";
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

  if (streamType === "vod" && streamUrl) {
    return (
      <VodPlayer 
        streamUrl={streamUrl} 
        isFullscreen={isFullscreen} 
        isMini={isMini} 
      />
    );
  }

  if (streamType === "livekit" && !livekitToken) {
    return <ConnectingPlayer isFullscreen={isFullscreen} />;
  }

  return <MockVideoPlayer isFullscreen={isFullscreen} />;
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function VodPlayer({ streamUrl, isFullscreen, isMini }: { streamUrl: string, isFullscreen?: boolean, isMini?: boolean }) {
  const [isBuffering, setIsBuffering] = React.useState(true);
  const [position, setPosition] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  const formatTime = (millis: number) => {
    if (!millis || isNaN(millis)) return "00:00";
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={[
      styles.wrapper,
      isFullscreen && styles.wrapperFullscreen,
      isMini && styles.wrapperMini
    ]}>
      <Video
        source={{ uri: streamUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={true}
        isLooping={false}
        useNativeControls={!isMini} // Native controls are enabled, but we also overlay our own
        onLoad={(status) => {
          if (status.isLoaded) {
            setDuration(status.durationMillis || 0);
            setIsBuffering(false);
          }
        }}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis);
            setDuration(status.durationMillis || 0);
            setIsBuffering(status.isBuffering);
          } else if ("error" in status && status.error) {
            console.error("[VideoPlayer] VOD playback error:", status.error);
            setIsBuffering(false);
          }
        }}
      />
      
      {/* Loading indicator that ONLY shows when actually buffering */}
      {isBuffering && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center" }]} pointerEvents="none">
          <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
        </View>
      )}

      {/* Progress Bar & Timing Overlay (Hidden in mini-player) */}
      {!isMini && duration > 0 && (
        <View style={styles.progressOverlay} pointerEvents="none">
          <View style={styles.timeContainer}>
            <Text style={styles.timeText} allowFontScaling={false}>{formatTime(position)}</Text>
            <Text style={styles.timeText} allowFontScaling={false}>{formatTime(duration)}</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      )}
    </View>
  );
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
  progressOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24, // Extra padding for safe area / native controls clearance
    backgroundColor: "rgba(0,0,0,0.4)", // Slight gradient/darkening behind text
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"], // Keeps time characters monospaced
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6", // Zoop blue
  },
});
