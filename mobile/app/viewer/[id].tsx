import { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Socket } from "socket.io-client";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../src/api/client";
import { connectSocket, disconnectSocket } from "../../src/api/socket";
import { getLiveKitToken } from "../../src/api/livekit";
// Removed VideoPlayer import to use GlobalPlayer singleton
import { LiveSession, Message, ApiResponse } from "../../src/types";
import { AppTheme, useAppTheme } from "../../src/theme";
import { usePlayer } from "../../src/contexts/PlayerContext";
import ImageWithFallback from "../../src/components/ImageWithFallback";

const { width } = Dimensions.get("window");
const REACTIONS = ["❤️", "🔥", "👏", "😍", "🎉", "💰"];
const MAX_CHAT_MESSAGES = 200;
const MAX_FLOATING_REACTIONS = 12;

export default function ViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const socketCleanupRef = useRef<(() => void) | null>(null);

  const [session, setSession] = useState<LiveSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [questionText, setQuestionText] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string }[]>([]);
  const reactionIdRef = useRef(0);

  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);
  const [highlightedProduct, setHighlightedProduct] = useState<string | null>(null);

  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    openPlayer,
    activeSession: playerActiveSession,
    lkToken: playerLkToken,
    lkUrl: playerLkUrl,
    closePlayer,
  } = usePlayer();

  const isMinimizing = useRef(false);
  const effectiveToken = lkToken ?? (playerActiveSession?.id === session?.id ? playerLkToken : null);
  const effectiveUrl = lkUrl ?? (playerActiveSession?.id === session?.id ? playerLkUrl : null);

  function handleBack() {
    console.log("handleBack called, session:", session?.id, "streamEnded:", streamEnded);
    // If we have a session and it hasn't ended, we minimize
    if (session && !streamEnded) {
      console.log("Minimizing player...");
      isMinimizing.current = true;
      openPlayer(session, effectiveToken, effectiveUrl, true);
    } else {
      console.log("Closing player...");
      closePlayer();
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  }

  useEffect(() => {
    loadSession();
    setupSocket();
    fetchLiveKitToken();

    return () => {
      socketCleanupRef.current?.();
      socketCleanupRef.current = null;

      if (!isMinimizing.current) {
        if (socketRef.current && id) {
          socketRef.current.emit("leave_live", id);
        }
        disconnectSocket();
      }
    };
  }, [id]); // Only run on ID change

  useEffect(() => {
    if (!session || isMinimizing.current || streamEnded) return;
    openPlayer(session, effectiveToken, effectiveUrl);
  }, [effectiveToken, effectiveUrl, openPlayer, session, streamEnded]);

  async function fetchLiveKitToken() {
    if (!id) return;
    try {
      const data = await getLiveKitToken(id as string);
      setLkToken(data.token);
      setLkUrl(data.url);
    } catch (err: any) {
      console.error("Failed to get LiveKit token:", err.message);
    }
  }

  async function loadSession() {
    try {
      const res = await apiClient<ApiResponse<LiveSession>>(`/sessions/${id}`);
      setSession(res.data);
      setMessages((res.data.messages || []).slice(0, MAX_CHAT_MESSAGES));
      setViewerCount(res.data.viewerCount || 0);
    } catch {}
  }

  async function setupSocket() {
    try {
      const socket = await connectSocket();
      socketRef.current = socket;

      socketCleanupRef.current?.();

      const handleViewerCountUpdate = (data: { count: number }) => {
        setViewerCount(data.count);
      };

      const handleNewReaction = (msg: Message) => {
        setMessages((prev) => [msg, ...prev].slice(0, MAX_CHAT_MESSAGES));
        showFloatingReaction(msg.content);
      };

      const handleNewQuestion = (msg: Message) => {
        setMessages((prev) => [msg, ...prev].slice(0, MAX_CHAT_MESSAGES));
      };

      const handleStreamEnded = () => {
        setStreamEnded(true);
        closePlayer();
      };

      const handleStreamStarted = () => {
        setStreamEnded(false);
      };

      const handleProductHighlight = (data: { productId: string }) => {
        setHighlightedProduct(data.productId);
        setTimeout(() => setHighlightedProduct(null), 5000);
      };

      const handleSessionProductsUpdated = (data: {
        sessionProducts: NonNullable<LiveSession["sessionProducts"]>;
      }) => {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                sessionProducts: data.sessionProducts,
              }
            : prev
        );
      };

      socket.on("viewer_count_update", handleViewerCountUpdate);
      socket.on("new_reaction", handleNewReaction);
      socket.on("new_question", handleNewQuestion);
      socket.on("stream_ended", handleStreamEnded);
      socket.on("stream_started", handleStreamStarted);
      socket.on("product_highlight", handleProductHighlight);
      socket.on("session_products_updated", handleSessionProductsUpdated);
      socket.emit("join_live", id);

      socketCleanupRef.current = () => {
        socket.off("viewer_count_update", handleViewerCountUpdate);
        socket.off("new_reaction", handleNewReaction);
        socket.off("new_question", handleNewQuestion);
        socket.off("stream_ended", handleStreamEnded);
        socket.off("stream_started", handleStreamStarted);
        socket.off("product_highlight", handleProductHighlight);
        socket.off("session_products_updated", handleSessionProductsUpdated);
      };
    } catch (err) {
      console.error("Socket connection failed:", err);
    }
  }

  function showFloatingReaction(emoji: string) {
    const rid = ++reactionIdRef.current;
    setFloatingReactions((prev) =>
      [...prev, { id: rid, emoji }].slice(-MAX_FLOATING_REACTIONS)
    );
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== rid));
    }, 2000);
  }

  function sendReaction(emoji: string) {
    if (socketRef.current) {
      socketRef.current.emit("send_reaction", { sessionId: id, content: emoji });
    }
  }

  function sendQuestion() {
    if (!questionText.trim() || !socketRef.current) return;
    socketRef.current.emit("send_question", { sessionId: id, content: questionText.trim() });
    setQuestionText("");
  }

  const products = session?.sessionProducts?.map((sp) => sp.product) || [];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color={theme.textMuted} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.topBarRight}>
            {streamConnected && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveLabel}>LIVE</Text>
              </View>
            )}
            <View style={styles.viewerBadge}>
              <Ionicons name="eye-outline" size={14} color={theme.text} style={styles.viewerIcon} />
              <Text style={styles.viewerCountText}>{viewerCount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.videoContainer}>
          {streamEnded && (
            <View style={styles.endedOverlay}>
              <Text style={styles.endedText}>Stream has ended</Text>
              <TouchableOpacity style={styles.goBackButton} onPress={handleBack}>
                <Text style={styles.goBackText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {!streamEnded && (
            <View style={styles.placeholderBox} />
          )}

          <View style={styles.floatingReactions}>
            {floatingReactions.map((r) => (
              <Text key={r.id} style={styles.floatingEmoji}>{r.emoji}</Text>
            ))}
          </View>
        </View>

        <View style={styles.sessionMeta}>
          <Text style={styles.sessionTitle}>{session?.title || "Live Session"}</Text>
          <Text style={styles.hostName}>Hosted by {session?.host?.name || "..."}</Text>
        </View>

        {products.length > 0 && (
          <TouchableOpacity style={styles.productsToggle} onPress={() => setShowProducts(!showProducts)}>
            <View style={styles.productsToggleContent}>
              <Text style={styles.productsToggleText}>
                {showProducts ? "Hide Products" : `Products (${products.length})`}
              </Text>
              <Ionicons
                name={showProducts ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.accent}
              />
            </View>
          </TouchableOpacity>
        )}

        {showProducts && (
          <FlatList
            data={products}
            horizontal
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.productsList}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.productCard,
                  highlightedProduct === item.id && styles.productHighlighted,
                ]}
              >
                <ImageWithFallback
                  uri={item.imageUrl}
                  style={styles.productImage}
                  fallback={
                    <Ionicons
                      name="cube-outline"
                      size={24}
                      color={theme.textMuted}
                      style={styles.productEmoji}
                    />
                  }
                />
                <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.productPrice}>₹{item.price.toFixed(2)}</Text>
                <Text style={styles.productMeta}>Qty: {item.quantity}</Text>
                <Text style={styles.productMeta} numberOfLines={2}>
                  Sizes: {item.sizes?.join(", ") || "Not set"}
                </Text>
              </View>
            )}
          />
        )}

        <View style={styles.chatSection}>
          <FlatList
            data={messages.slice(0, 50)}
            keyExtractor={(item) => item.id}
            inverted
            style={styles.chatList}
            renderItem={({ item }) => (
              <View style={styles.chatMessage}>
                <Ionicons
                  name={item.type === "reaction" ? "heart" : "help-circle-outline"}
                  size={16}
                  color={item.type === "reaction" ? theme.danger : theme.accent}
                  style={styles.chatBadge}
                />
                <Text style={styles.chatSender}>{item.user.name}: </Text>
                <Text style={styles.chatText}>{item.content}</Text>
              </View>
            )}
          />
        </View>

        <View style={styles.reactionBar}>
          {REACTIONS.map((emoji) => (
            <TouchableOpacity key={emoji} style={styles.reactionButton} onPress={() => sendReaction(emoji)}>
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.questionInput}
            placeholder="Ask a question..."
            placeholderTextColor="#64748b"
            value={questionText}
            onChangeText={setQuestionText}
            onSubmitEditing={sendQuestion}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendQuestion}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { color: theme.textMuted, fontSize: 16, fontWeight: "600" },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    marginRight: 6,
  },
  liveLabel: {
    color: "#ef4444",
    fontWeight: "800",
    fontSize: 12,
  },
  viewerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewerIcon: { marginRight: 4 },
  viewerCountText: { color: theme.text, fontWeight: "700", fontSize: 14 },
  videoContainer: {
    marginHorizontal: 16,
    position: "relative",
    width: width - 32,
    aspectRatio: 16 / 9,
  },
  placeholderBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  endedOverlay: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  endedText: {
    color: "#94a3b8",
    fontSize: 18,
    fontWeight: "700",
  },
  goBackButton: {
    marginTop: 16,
    backgroundColor: theme.accent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  goBackText: {
    color: theme.textOnAccent,
    fontWeight: "700",
    fontSize: 14,
  },
  floatingReactions: {
    position: "absolute",
    right: 12,
    bottom: 12,
    alignItems: "center",
  },
  floatingEmoji: { fontSize: 28, marginBottom: 4 },
  sessionMeta: { paddingHorizontal: 16, paddingTop: 12 },
  sessionTitle: { fontSize: 18, fontWeight: "700", color: theme.text },
  hostName: { fontSize: 14, color: theme.textMuted, marginTop: 2 },
  productsToggle: { paddingHorizontal: 16, paddingTop: 12 },
  productsToggleContent: { flexDirection: "row", alignItems: "center", gap: 4 },
  productsToggleText: { color: theme.accent, fontWeight: "700", fontSize: 14 },
  productsList: { paddingHorizontal: 16, paddingTop: 8 },
  productCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    marginRight: 12,
    width: 130,
    alignItems: "center",
  },
  productHighlighted: {
    borderWidth: 2,
    borderColor: theme.accent,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginBottom: 6,
  },
  productEmoji: { marginBottom: 6 },
  productTitle: { fontSize: 13, fontWeight: "600", color: theme.text, textAlign: "center" },
  productPrice: { fontSize: 14, color: theme.textMuted, fontWeight: "700", marginTop: 4 },
  productMeta: { fontSize: 12, color: theme.textMuted, marginTop: 2, textAlign: "center" },
  chatSection: { flex: 1, marginTop: 8 },
  chatList: { paddingHorizontal: 16 },
  chatMessage: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  chatBadge: { marginRight: 4, marginTop: 1 },
  chatSender: { fontSize: 13, fontWeight: "700", color: theme.accent },
  chatText: { fontSize: 13, color: theme.text },
  reactionBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  reactionButton: { padding: 6 },
  reactionEmoji: { fontSize: 24 },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  questionInput: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sendButton: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  sendText: { color: theme.textOnAccent, fontWeight: "700", fontSize: 15 },
});
