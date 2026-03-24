import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface HostControlsProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  isFrontCamera: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onFlipCamera: () => void;
  onAiInsights?: () => void;
  aiLoading?: boolean;
}

export default function HostControls({
  isCameraOn,
  isMicOn,
  isFrontCamera,
  onToggleCamera,
  onToggleMic,
  onFlipCamera,
  onAiInsights,
  aiLoading,
}: HostControlsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.controlButton, !isMicOn && styles.controlOff]}
        onPress={onToggleMic}
      >
        <Ionicons
          name={isMicOn ? "mic" : "mic-off"}
          size={22}
          color="#fff"
          style={styles.controlIcon}
        />
        <Text style={styles.controlLabel}>{isMicOn ? "Mute" : "Unmute"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.controlButton, !isCameraOn && styles.controlOff]}
        onPress={onToggleCamera}
      >
        <Ionicons
          name={isCameraOn ? "videocam" : "videocam-off"}
          size={22}
          color="#fff"
          style={styles.controlIcon}
        />
        <Text style={styles.controlLabel}>
          {isCameraOn ? "Cam Off" : "Cam On"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.controlButton} onPress={onFlipCamera}>
        <Ionicons
          name="camera-reverse"
          size={22}
          color="#fff"
          style={styles.controlIcon}
        />
        <Text style={styles.controlLabel}>
          Reverse
        </Text>
      </TouchableOpacity>

      {onAiInsights && (
        <TouchableOpacity 
          style={[styles.controlButton, aiLoading && styles.aiLoading]} 
          onPress={onAiInsights}
          disabled={aiLoading}
        >
          <Ionicons
            name="sparkles"
            size={22}
            color="#ec4899"
            style={styles.controlIcon}
          />
          <Text style={styles.controlLabel}>
            {aiLoading ? "Thinking" : "AI"}
          </Text>
        </TouchableOpacity>
      )}
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
    marginBottom: 0,
  },
  controlLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  aiLoading: {
    opacity: 0.6,
  },
});
