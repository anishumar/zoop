import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  Room,
  RoomEvent,
  Track,
  type LocalTrack,
  type RemoteTrack,
} from "livekit-client";

interface LiveKitRoomProps {
  token: string;
  url: string;
  isHost: boolean;
  isCameraEnabled?: boolean;
  isMicrophoneEnabled?: boolean;
  cameraFacingMode?: "user" | "environment";
  onConnectionChange?: (connected: boolean) => void;
  onParticipantCountChange?: (count: number) => void;
}

export default function LiveKitRoomWeb({
  token,
  url,
  isHost,
  isCameraEnabled = true,
  isMicrophoneEnabled = true,
  cameraFacingMode = "user",
  onConnectionChange,
  onParticipantCountChange,
}: LiveKitRoomProps) {
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [connecting, setConnecting] = useState(true);

  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeTrackRef = useRef<RemoteTrack | LocalTrack | null>(null);
  const lastFacingModeRef = useRef(cameraFacingMode);
  const syncChainRef = useRef<Promise<void>>(Promise.resolve());

  const setVideoEl = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    const t = activeTrackRef.current;
    if (t && el) {
      t.attach(el);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    setConnecting(true);
    setError(null);

    const bindTrack = (track: RemoteTrack | LocalTrack) => {
      activeTrackRef.current = track;
      const el = videoRef.current;
      if (el) {
        track.attach(el);
      }
    };

    const updateParticipantCount = () => {
      onParticipantCountChange?.(1 + room.remoteParticipants.size);
    };

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind !== Track.Kind.Video || participant.isLocal) return;
      bindTrack(track);
    });

    room.on(RoomEvent.LocalTrackPublished, (pub) => {
      if (pub.track?.kind === Track.Kind.Video) {
        bindTrack(pub.track);
      }
    });

    room.on(RoomEvent.ParticipantConnected, updateParticipantCount);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipantCount);

    (async () => {
      try {
        await room.connect(url, token);
        if (cancelled) return;
        onConnectionChange?.(true);

        if (isHost) {
          await room.localParticipant.setMicrophoneEnabled(isMicrophoneEnabled);
          if (isCameraEnabled) {
            await room.localParticipant.setCameraEnabled(true, {
              facingMode: cameraFacingMode,
            });
          }
          if (cancelled) return;
          const pub = room.localParticipant.getTrackPublication(
            Track.Source.Camera
          );
          if (pub?.track) {
            bindTrack(pub.track);
          }
        } else {
          room.remoteParticipants.forEach((p) => {
            p.trackPublications.forEach((publication) => {
              if (publication.track?.kind === Track.Kind.Video) {
                bindTrack(publication.track);
              }
            });
          });
        }

        updateParticipantCount();
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Connection failed";
          setError(msg);
          onConnectionChange?.(false);
        }
      } finally {
        if (!cancelled) {
          setConnecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        activeTrackRef.current?.detach();
      } catch {
        /* noop */
      }
      activeTrackRef.current = null;
      room.disconnect();
      roomRef.current = null;
      onConnectionChange?.(false);
    };
  }, [isHost, onConnectionChange, onParticipantCountChange, retryKey, token, url]);

  useEffect(() => {
    if (!isHost) return;

    syncChainRef.current = syncChainRef.current
      .catch(() => undefined)
      .then(async () => {
        const room = roomRef.current;
        if (!room) return;

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
          setError(null);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to update live controls";
          setError(message);
        }
      });
  }, [cameraFacingMode, isCameraEnabled, isHost, isMicrophoneEnabled]);

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>Connection Error</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setRetryKey((k) => k + 1);
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <video
        ref={setVideoEl}
        autoPlay
        playsInline
        muted={isHost}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          backgroundColor: "#0a0a1a",
        }}
      />
      {connecting && (
        <View style={styles.waitingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.waitingText}>
            {isHost ? "Starting camera…" : "Connecting…"}
          </Text>
        </View>
      )}
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
    position: "relative",
  },
  waitingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(10, 10, 26, 0.85)",
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
