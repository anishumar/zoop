import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { usePlayer } from "../contexts/PlayerContext";
// Removed duplicate VideoPlayer
import { useAppTheme, AppTheme } from "../theme";
// Removed Ionicons import for reliability

const { width } = Dimensions.get("window");
const MINI_PLAYER_WIDTH = 160;
const MINI_PLAYER_HEIGHT = (MINI_PLAYER_WIDTH * 9) / 16;

export default function MiniPlayer() {
  const { activeSession, isMinimized, lkToken, lkUrl, expandPlayer, closePlayer } = usePlayer();
  const theme = useAppTheme();
  const router = useRouter();
  const styles = createStyles(theme);

  if (!activeSession || !isMinimized) {
    if (activeSession) console.log("MiniPlayer activeSession exists but isMinimized is false");
    return null;
  }

  console.log("Rendering MiniPlayer for session:", activeSession.id);

  const handleExpand = () => {
    expandPlayer();
    router.push(`/viewer/${activeSession.id}`);
  };

  const streamType = (activeSession.streamType as "mock" | "livekit") || "livekit";

  return (
    <View style={styles.container}>
      <View style={styles.playerPlaceholder}>
        <TouchableOpacity style={styles.overlay} onPress={handleExpand} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {activeSession.title}
        </Text>
        <Text style={styles.host} numberOfLines={1}>
          {activeSession.host?.name}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleExpand} style={styles.iconButton}>
          <Text style={{ fontSize: 20 }}>⤢</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={closePlayer} style={styles.iconButton}>
          <Text style={{ fontSize: 22, color: theme.text }}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 64, // Positioned slightly above the navigation bar
      left: 8,
      right: 8,
      height: 76,
      backgroundColor: theme.mode === "dark" ? "rgba(30, 41, 59, 0.95)" : "rgba(255, 255, 255, 0.95)",
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
        },
        android: {
          elevation: 12,
        },
      }),
      zIndex: 10000,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
    },
    playerPlaceholder: {
      width: 120,
      height: "100%",
      backgroundColor: "transparent",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
    },
    info: {
      flex: 1,
      paddingLeft: 14,
      justifyContent: "center",
    },
    title: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 2,
    },
    host: {
      fontSize: 12,
      color: theme.textMuted,
      fontWeight: "500",
    },
    actions: {
      flexDirection: "row",
      paddingRight: 12,
      alignItems: "center",
      gap: 12,
    },
    iconButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: theme.mode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
    },
  });
