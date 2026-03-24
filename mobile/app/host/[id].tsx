import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Socket } from "socket.io-client";
import { apiClient } from "../../src/api/client";
import { connectSocket, disconnectSocket } from "../../src/api/socket";
import { getLiveKitToken } from "../../src/api/livekit";
import VideoPlayer from "../../src/components/VideoPlayer";
import HostControls from "../../src/components/HostControls";
import ImageWithFallback from "../../src/components/ImageWithFallback";
import { LiveSession, Product, Message, ApiResponse } from "../../src/types";
import { AppTheme, useAppTheme } from "../../src/theme";

interface ProductListResponse {
  products: Product[];
  total: number;
}

const MAX_CHAT_MESSAGES = 200;

export default function HostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const socketCleanupRef = useRef<(() => void) | null>(null);

  const [session, setSession] = useState<LiveSession | null>(null);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [reactionCount, setReactionCount] = useState(0);
  const [endingSession, setEndingSession] = useState(false);

  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  }

  useEffect(() => {
    if (!sessionId) return;
    loadSession();
    loadMyProducts();
    setupSocket();
    fetchLiveKitToken();

    return () => {
      socketCleanupRef.current?.();
      socketCleanupRef.current = null;

      if (socketRef.current) {
        socketRef.current.emit("host_stream_ended", { sessionId });
        socketRef.current.emit("leave_live", sessionId);
      }
      disconnectSocket();
    };
  }, [sessionId]);

  async function fetchLiveKitToken() {
    if (!sessionId) return;
    try {
      const data = await getLiveKitToken(sessionId);
      setLkToken(data.token);
      setLkUrl(data.url);
    } catch (err: any) {
      console.error("Failed to get LiveKit token:", err.message);
    }
  }

  async function loadSession() {
    try {
      if (!sessionId) return;
      const res = await apiClient<ApiResponse<LiveSession>>(`/sessions/${sessionId}`);
      setSession(res.data);
      setMessages((res.data.messages || []).slice(0, MAX_CHAT_MESSAGES));
      setReactionCount((res.data.messages || []).filter((msg) => msg.type === "reaction").length);
      setViewerCount(res.data.viewerCount || 0);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function loadMyProducts() {
    try {
      const res = await apiClient<ApiResponse<ProductListResponse>>("/products");
      setMyProducts(res.data.products);
    } catch {}
  }

  async function setupSocket() {
    try {
      if (!sessionId) return;
      const socket = await connectSocket();
      socketRef.current = socket;

      socketCleanupRef.current?.();

      const handleViewerCountUpdate = (data: { count: number }) => {
        setViewerCount(data.count);
      };

      const handleNewReaction = (msg: Message) => {
        setMessages((prev) => [msg, ...prev].slice(0, MAX_CHAT_MESSAGES));
        setReactionCount((c) => c + 1);
      };

      const handleNewQuestion = (msg: Message) => {
        setMessages((prev) => [msg, ...prev].slice(0, MAX_CHAT_MESSAGES));
      };

      socket.on("viewer_count_update", handleViewerCountUpdate);
      socket.on("new_reaction", handleNewReaction);
      socket.on("new_question", handleNewQuestion);
      socket.emit("join_live", sessionId);

      socketCleanupRef.current = () => {
        socket.off("viewer_count_update", handleViewerCountUpdate);
        socket.off("new_reaction", handleNewReaction);
        socket.off("new_question", handleNewQuestion);
      };
    } catch (err) {
      console.error("Socket connection failed:", err);
    }
  }

  const handleConnectionChange = useCallback(
    (connected: boolean) => {
      setStreamConnected(connected);
      if (connected && socketRef.current) {
        socketRef.current.emit("host_stream_started", { sessionId });
      }
    },
    [sessionId]
  );

  const handleParticipantCount = useCallback((count: number) => {
    setViewerCount(Math.max(0, count - 1));
  }, []);

  async function handleEndSession() {
    if (!sessionId) {
      Alert.alert("Error", "Missing live session id");
      return;
    }
    const endSession = async () => {
      try {
        setEndingSession(true);
        if (socketRef.current) {
          socketRef.current.emit("host_stream_ended", { sessionId });
        }
        await apiClient(`/sessions/${sessionId}/end`, { method: "PATCH" });
        router.replace("/(tabs)");
      } catch (err: any) {
        Alert.alert("Error", err.message);
      } finally {
        setEndingSession(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to end this live session?");
      if (confirmed) {
        await endSession();
      }
      return;
    }

    Alert.alert("End Session", "Are you sure you want to end this live session?", [
      { text: "Cancel", style: "cancel" },
      { text: "End", style: "destructive", onPress: endSession },
    ]);
  }

  async function handleAddProduct(productId: string) {
    try {
      if (!sessionId) return;
      await apiClient(`/sessions/${sessionId}/products`, {
        method: "POST",
        body: { productId },
      });
      loadSession();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function handleRemoveProduct(productId: string) {
    try {
      if (!sessionId) return;
      await apiClient(`/sessions/${sessionId}/products`, {
        method: "DELETE",
        body: { productId },
      });
      loadSession();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  const showcasedIds = new Set(session?.sessionProducts?.map((sp) => sp.product.id) || []);
  const availableProducts = myProducts.filter((p) => !showcasedIds.has(p.id));
  const streamType = (session?.streamType as "mock" | "livekit") || "livekit";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.topBarRight}>
            {streamConnected && (
              <View style={styles.connectedBadge}>
                <View style={styles.connectedDot} />
                <Text style={styles.connectedText}>Live</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.endButton, endingSession && { opacity: 0.7 }]}
              onPress={handleEndSession}
              disabled={endingSession}
            >
              <Text style={styles.endButtonText}>{endingSession ? "Ending..." : "End Live"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.videoSection}>
          <VideoPlayer
            streamType={streamType}
            streamUrl={session?.streamUrl}
            livekitToken={lkToken}
            livekitUrl={lkUrl}
            isHost={true}
            isCameraEnabled={isCameraOn}
            isMicrophoneEnabled={isMicOn}
            cameraFacingMode={isFrontCamera ? "user" : "environment"}
            onConnectionChange={handleConnectionChange}
            onParticipantCountChange={handleParticipantCount}
          />
        </View>

        {streamType === "livekit" && (
          <HostControls
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            isFrontCamera={isFrontCamera}
            onToggleCamera={() => setIsCameraOn((v) => !v)}
            onToggleMic={() => setIsMicOn((v) => !v)}
            onFlipCamera={() => setIsFrontCamera((v) => !v)}
          />
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{viewerCount}</Text>
            <Text style={styles.statLabel}>Viewers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{reactionCount}</Text>
            <Text style={styles.statLabel}>Reactions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{messages.filter((m) => m.type === "question").length}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Showcase Products</Text>
        {session?.sessionProducts && session.sessionProducts.length > 0 ? (
          session.sessionProducts.map((sp) => (
            <View key={sp.product.id} style={styles.showcasedProduct}>
              <ImageWithFallback
                uri={sp.product.imageUrl}
                style={styles.productThumb}
                fallbackText="📦"
                fallbackStyle={styles.productEmoji}
              />
              <View style={styles.productInfo}>
                <Text style={styles.productTitle}>{sp.product.title}</Text>
                <Text style={styles.productPrice}>${sp.product.price.toFixed(2)}</Text>
              </View>
              <TouchableOpacity
                style={styles.unlistButton}
                onPress={() => handleRemoveProduct(sp.product.id)}
              >
                <Text style={styles.unlistText}>Unlist</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.noProducts}>No products added yet</Text>
        )}

        {availableProducts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Add from Your Products</Text>
            {availableProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.addProductRow}
                onPress={() => handleAddProduct(product.id)}
              >
              <ImageWithFallback
                uri={product.imageUrl}
                style={styles.productThumb}
                fallbackText="📦"
                fallbackStyle={styles.productEmoji}
              />
              <View style={styles.productInfo}>
                <Text style={styles.productTitle}>{product.title}</Text>
                <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
              </View>
              <Text style={styles.addIcon}>+</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Live Chat</Text>
        {messages.length === 0 ? (
          <Text style={styles.noMessages}>No messages yet</Text>
        ) : (
          messages.slice(0, 20).map((msg) => (
            <View key={msg.id} style={styles.messageRow}>
              <Text style={styles.messageBadge}>{msg.type === "reaction" ? "❤️" : "❓"}</Text>
              <View style={styles.messageContent}>
                <Text style={styles.messageSender}>{msg.user.name}</Text>
                <Text style={styles.messageText}>{msg.content}</Text>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backText: { color: theme.textMuted, fontSize: 16, fontWeight: "600" },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  connectedText: {
    color: "#22c55e",
    fontWeight: "700",
    fontSize: 12,
  },
  endButton: { backgroundColor: "#ef4444", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  endButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  videoSection: { marginHorizontal: 16 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    marginHorizontal: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    marginTop: 12,
  },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: theme.text },
  statLabel: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: theme.text, marginTop: 24, marginBottom: 12, marginHorizontal: 16 },
  showcasedProduct: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
  },
  productEmoji: { fontSize: 24 },
  productThumb: { width: 48, height: 48, borderRadius: 12 },
  productInfo: { flex: 1, marginLeft: 12 },
  productTitle: { fontSize: 15, fontWeight: "600", color: theme.text },
  productPrice: { fontSize: 14, color: theme.success, fontWeight: "700", marginTop: 2 },
  unlistButton: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  unlistText: { color: theme.textMuted, fontSize: 12, fontWeight: "700" },
  noProducts: { color: theme.textMuted, fontSize: 14, marginHorizontal: 16 },
  addProductRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: "dashed",
  },
  addIcon: { color: theme.accent, fontSize: 24, fontWeight: "700" },
  noMessages: { color: theme.textMuted, fontSize: 14, marginHorizontal: 16 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginBottom: 10,
  },
  messageBadge: { fontSize: 18, marginRight: 10, marginTop: 2 },
  messageContent: { flex: 1 },
  messageSender: { fontSize: 13, fontWeight: "700", color: theme.accent },
  messageText: { fontSize: 14, color: theme.text, marginTop: 2 },
});
