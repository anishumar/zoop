import { useEffect } from "react";
import { Slot, useRouter, useSegments, Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { ActivityIndicator, View, Platform } from "react-native";
import { useAppTheme } from "../src/theme";
import { PlayerProvider } from "../src/contexts/PlayerContext";
import MiniPlayer from "../src/components/MiniPlayer";
import GlobalPlayer from "../src/components/GlobalPlayer";

// Register LiveKit globals as early as possible (Native only)
if (Platform.OS !== "web") {
  try {
    const { registerGlobals } = require("@livekit/react-native");
    registerGlobals();
  } catch (e) {
    console.warn("Failed to register LiveKit globals:", e);
  }
}

// Polyfill Event for livekit-client in environments where it might be missing
if (typeof global.Event === "undefined") {
  // @ts-ignore
  global.Event = class Event {
    constructor(type: string) {
      this.type = type;
    }
    type: string;
  };
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const theme = useAppTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="viewer/[id]" />
        <Stack.Screen name="host/[id]" />
        <Stack.Screen name="user/[id]" options={{ headerShown: true, headerBackTitle: "" }} />
      </Stack>
      <MiniPlayer />
      <GlobalPlayer />
    </>
  );
}

export default function RootLayout() {
  const theme = useAppTheme();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PlayerProvider>
          <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
          <RootNavigator />
        </PlayerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
