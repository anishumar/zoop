import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

interface HostControlsProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  isFrontCamera: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onFlipCamera: () => void;
}

export default function HostControls({
  isCameraOn,
  isMicOn,
  isFrontCamera,
  onToggleCamera,
  onToggleMic,
  onFlipCamera,
}: HostControlsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.controlButton, !isMicOn && styles.controlOff]}
        onPress={onToggleMic}
      >
        <Text style={styles.controlIcon}>{isMicOn ? "🎙️" : "🔇"}</Text>
        <Text style={styles.controlLabel}>{isMicOn ? "Mute" : "Unmute"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.controlButton, !isCameraOn && styles.controlOff]}
        onPress={onToggleCamera}
      >
        <Text style={styles.controlIcon}>{isCameraOn ? "📹" : "📷"}</Text>
        <Text style={styles.controlLabel}>
          {isCameraOn ? "Cam Off" : "Cam On"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.controlButton} onPress={onFlipCamera}>
        <Text style={styles.controlIcon}>🔄</Text>
        <Text style={styles.controlLabel}>
          {isFrontCamera ? "Back" : "Front"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  controlButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 72,
  },
  controlOff: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  controlIcon: {
    fontSize: 22,
  },
  controlLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
