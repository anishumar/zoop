import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme";

interface HostControlsProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  isFrontCamera: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onFlipCamera: () => void;
  onAiInsights?: () => void;
  aiLoading?: boolean;
  layout?: "row" | "column";
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
  layout = "row",
}: HostControlsProps) {
  const theme = useAppTheme();
  const isDark = theme.mode === "dark";
  
  // In column layout (immersive), we always use the dark/glass style regardless of system theme
  const isImmersive = layout === "column";
  
  const buttonBg = isImmersive 
    ? "rgba(255,255,255,0.1)" 
    : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)");
    
  const textColor = isImmersive 
    ? "#fff" 
    : (isDark ? "#fff" : theme.text);

  const iconColor = isImmersive 
    ? "#fff" 
    : (isDark ? "#fff" : theme.text);
  return (
    <View style={[styles.container, layout === "column" && styles.containerVertical]}>
      <TouchableOpacity
        style={[styles.controlButton, layout === "column" && styles.controlButtonVertical, !isMicOn && styles.controlOff, { backgroundColor: buttonBg }]}
        onPress={onToggleMic}
      >
        <Ionicons
          name={isMicOn ? "mic" : "mic-off"}
          size={22}
          color={iconColor}
          style={styles.controlIcon}
        />
        <Text style={[styles.controlLabel, { color: textColor }]}>{isMicOn ? "Mute" : "Unmute"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.controlButton, layout === "column" && styles.controlButtonVertical, !isCameraOn && styles.controlOff, { backgroundColor: buttonBg }]}
        onPress={onToggleCamera}
      >
        <Ionicons
          name={isCameraOn ? "videocam" : "videocam-off"}
          size={22}
          color={iconColor}
          style={styles.controlIcon}
        />
        <Text style={[styles.controlLabel, { color: textColor }]}>
          {isCameraOn ? "Cam Off" : "Cam On"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.controlButton, layout === "column" && styles.controlButtonVertical, { backgroundColor: buttonBg }]} onPress={onFlipCamera}>
        <Ionicons
          name="camera-reverse"
          size={22}
          color={iconColor}
          style={styles.controlIcon}
        />
        <Text style={[styles.controlLabel, { color: textColor }]}>
          Reverse
        </Text>
      </TouchableOpacity>

      {onAiInsights && (
        <TouchableOpacity 
          style={[styles.controlButton, layout === "column" && styles.controlButtonVertical, aiLoading && styles.aiLoading, { backgroundColor: buttonBg }]} 
          onPress={onAiInsights}
          disabled={aiLoading}
        >
          <Ionicons
            name="sparkles"
            size={22}
            color="#ec4899"
            style={styles.controlIcon}
          />
          <Text style={[styles.controlLabel, { color: textColor }]}>
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
  containerVertical: {
    flexDirection: "column",
    paddingHorizontal: 0,
    gap: 12,
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
  controlButtonVertical: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 60,
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
