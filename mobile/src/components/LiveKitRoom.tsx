import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  LiveKitRoom as LKRoom,
  VideoTrack,
  useParticipants,
  useRoomContext,
  useTracks,
  isTrackReference,
} from "@livekit/react-native";
import { Track } from "livekit-client";

interface LiveKitRoomProps {
  token: string;
  url: string;
  isHost: boolean;
  isCameraEnabled?: boolean;
  isMicrophoneEnabled?: boolean;
  cameraFacingMode?: "user" | "environment";
  onConnectionChange?: (connected: boolean) => void;
  onParticipantCountChange?: (count: number) => void;
  isFullscreen?: boolean;
  isMini?: boolean;
}

export default function LiveKitRoomWrapper({
  token,
  url,
  isHost,
  isCameraEnabled = true,
  isMicrophoneEnabled = true,
  cameraFacingMode = "user",
  onConnectionChange,
  onParticipantCountChange,
  isFullscreen = false,
  isMini = false,
}: LiveKitRoomProps) {
  const [error, setError] = useState<string | null>(null);

  const containerStyle = [
    styles.container,
    isFullscreen && styles.containerFullscreen,
    isMini && styles.containerMini,
  ];

  if (error) {
    return (
      <View style={containerStyle}>
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>Connection Error</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => setError(null)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <LKRoom
        serverUrl={url}
        token={token}
        connect={true}
        audio={isHost ? isMicrophoneEnabled : false}
        video={isHost && isCameraEnabled ? { facingMode: cameraFacingMode } : false}
        options={{
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: isHost
            ? {
                simulcast: true,
                videoCodec: "h264",
              }
            : undefined,
        }}
        onError={(err) => setError(err?.message || "Connection failed")}
        onConnected={() => onConnectionChange?.(true)}
        onDisconnected={() => onConnectionChange?.(false)}
      >
        <HostMediaController
          isHost={isHost}
          isCameraEnabled={isCameraEnabled}
          isMicrophoneEnabled={isMicrophoneEnabled}
          cameraFacingMode={cameraFacingMode}
          onControlError={setError}
        />
        <RoomContent
          isHost={isHost}
          onParticipantCountChange={onParticipantCountChange}
        />
      </LKRoom>
    </View>
  );
}

function HostMediaController({
  isHost,
  isCameraEnabled,
  isMicrophoneEnabled,
  cameraFacingMode,
  onControlError,
}: {
  isHost: boolean;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  cameraFacingMode: "user" | "environment";
  onControlError: (message: string | null) => void;
}) {
  const room = useRoomContext();
  const lastFacingModeRef = useRef(cameraFacingMode);
  const syncChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!isHost) return;

    syncChainRef.current = syncChainRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await room.localParticipant.setMicrophoneEnabled(isMicrophoneEnabled);

          const cameraPublication = room.localParticipant.getTrackPublication(
            Track.Source.Camera
          );

          if (!isCameraEnabled) {
            await room.localParticipant.setCameraEnabled(false);
            lastFacingModeRef.current = cameraFacingMode;
            return;
          }

          if (!cameraPublication?.videoTrack) {
            await room.localParticipant.setCameraEnabled(true, {
              facingMode: cameraFacingMode,
            });
            lastFacingModeRef.current = cameraFacingMode;
            return;
          }

          const isCameraMuted = cameraPublication.track?.isMuted ?? false;
          if (isCameraMuted) {
            await room.localParticipant.setCameraEnabled(true, {
              facingMode: cameraFacingMode,
            });
          } else if (lastFacingModeRef.current !== cameraFacingMode) {
            await cameraPublication.videoTrack.restartTrack({
              facingMode: cameraFacingMode,
            });
          }

          lastFacingModeRef.current = cameraFacingMode;
          onControlError(null);
        } catch (error) {
          onControlError(
            error instanceof Error ? error.message : "Failed to update live controls"
          );
        }
      });
  }, [cameraFacingMode, isCameraEnabled, isHost, isMicrophoneEnabled, onControlError, room]);

  return null;
}

function RoomContent({
  isHost,
  onParticipantCountChange,
}: {
  isHost: boolean;
  onParticipantCountChange?: (count: number) => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const trackRefs = useTracks([Track.Source.Camera]);

  useEffect(() => {
    onParticipantCountChange?.(participants.length);
  }, [participants.length]);

  const hostTrack = trackRefs.find(
    (ref) =>
      isTrackReference(ref) &&
      ref.source === Track.Source.Camera &&
      (ref.participant.isLocal
        ? isHost
        : ref.participant.permissions?.canPublish)
  );

  if (!hostTrack || !isTrackReference(hostTrack)) {
    return (
      <View style={styles.waitingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.waitingText}>
          {isHost ? "Starting camera..." : "Waiting for host..."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.videoFill}>
      <VideoTrack
        trackRef={hostTrack}
        style={styles.videoFill}
        mirror={isHost && hostTrack.participant.isLocal}
        objectFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#0a0a1a",
    borderRadius: 12,
    overflow: "hidden",
  },
  containerFullscreen: {
    aspectRatio: undefined,
    borderRadius: 0,
    flex: 1,
  },
  containerMini: {
    aspectRatio: undefined,
    borderRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "transparent",
    flex: 1,
  },
  videoFill: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  waitingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a1a",
  },
  waitingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 12,
  },
  errorOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a1a",
    padding: 20,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "700",
  },
  errorDetail: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
