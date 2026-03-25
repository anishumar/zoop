import { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Dimensions,
  Modal,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Socket } from "socket.io-client";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../src/api/client";
import { connectSocket, disconnectSocket } from "../../src/api/socket";
import { getLiveKitToken } from "../../src/api/livekit";
import { LiveSession, Message, ApiResponse } from "../../src/types";
import { AppTheme, useAppTheme } from "../../src/theme";
import { usePlayer } from "../../src/contexts/PlayerContext";
import ImageWithFallback from "../../src/components/ImageWithFallback";
import VideoPlayer from "../../src/components/VideoPlayer";

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
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);
  const [highlightedProduct, setHighlightedProduct] = useState<string | null>(null);

  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
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
    // Only minimize for active live sessions
    if (session && session.isLive && !streamEnded) {
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
    fetchWishlist();

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
  }, [id]);

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

  async function fetchWishlist() {
    try {
      const res = await apiClient<ApiResponse<{ products: { id: string }[] }>>("/wishlist");
      setWishlist(new Set(res.data.products.map(p => p.id)));
    } catch (err) {}
  }

  async function toggleWishlist(productId: string) {
    try {
      setWishlist((prev) => {
        const next = new Set(prev);
        if (next.has(productId)) next.delete(productId);
        else next.add(productId);
        return next;
      });
      await apiClient(`/wishlist/${productId}/toggle`, { method: "POST" });
    } catch {
      fetchWishlist();
    }
  }

  async function loadSession() {
    try {
      const res = await apiClient<ApiResponse<LiveSession>>(`/sessions/${id}`);
      setSession(res.data);
      setMessages((res.data.messages || []).slice(0, MAX_CHAT_MESSAGES));
      setViewerCount(res.data.viewerCount || 0);

      if (res.data.isLive) {
        setupSocket();
        fetchLiveKitToken();
      }
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

      const handleNewHostReply = (msg: Message) => {
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

      const handleConnect = () => {
        socket.emit("join_live", id);
      };

      socket.on("connect", handleConnect);
      socket.on("viewer_count_update", handleViewerCountUpdate);
      socket.on("new_reaction", handleNewReaction);
      socket.on("new_question", handleNewQuestion);
      socket.on("new_host_reply", handleNewHostReply);
      socket.on("stream_ended", handleStreamEnded);
      socket.on("stream_started", handleStreamStarted);
      socket.on("product_highlight", handleProductHighlight);
      socket.on("session_products_updated", handleSessionProductsUpdated);

      if (socket.connected) {
        handleConnect();
      }

      socketCleanupRef.current = () => {
        socket.off("connect", handleConnect);
        socket.off("viewer_count_update", handleViewerCountUpdate);
        socket.off("new_reaction", handleNewReaction);
        socket.off("new_question", handleNewQuestion);
        socket.off("new_host_reply", handleNewHostReply);
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
    Keyboard.dismiss();
  }

  const products = session?.sessionProducts?.map((sp) => sp.product) || [];
  
  // Logic to determine if we should show live or VOD
  const isVod = !session?.isLive && !!session?.recordingUrl;
  const streamType = isVod ? "vod" : ((session?.streamType as "mock" | "livekit") || "livekit");
  const displayStreamUrl = isVod ? session?.recordingUrl : session?.streamUrl;

  const handleConnectionChange = (connected: boolean) => {
    setStreamConnected(connected);
  };

  return (
    <View style={styles.container}>
      {/* Fullscreen video background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <VideoPlayer
          streamType={streamType}
          streamUrl={displayStreamUrl}
          livekitToken={effectiveToken}
          livekitUrl={effectiveUrl}
          isHost={false}
          onConnectionChange={handleConnectionChange}
          isFullscreen={true}
        />
      </View>

      {/* Show ended overlay only if it's NOT a VOD and stream has ended during session */}
      {streamEnded && !isVod && (
        <View style={[StyleSheet.absoluteFill, styles.endedOverlay]}>
          <Text style={styles.endedText}>Stream has ended</Text>
          <TouchableOpacity style={styles.goBackButton} onPress={handleBack}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
            <Text style={[styles.backText, styles.textShadow]}>Back</Text>
          </TouchableOpacity>
          <View style={styles.topBarRight}>
            {streamConnected && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveLabel}>LIVE</Text>
              </View>
            )}
            <View style={styles.viewerBadge}>
              <Ionicons name="eye-outline" size={14} color="#fff" style={styles.viewerIcon} />
              <Text style={styles.viewerCountText}>{viewerCount}</Text>
            </View>
            {products.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.productsHeaderButton,
                  showProducts && styles.productsHeaderButtonActive,
                ]}
                onPress={() => setShowProducts((v) => !v)}
              >
                <Ionicons
                  name="cube-outline"
                  size={18}
                  color={showProducts ? theme.textOnAccent : "#fff"}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Session Meta - overlaid below top bar */}
        <View style={styles.sessionMeta}>
          <Text style={[styles.sessionTitle, styles.textShadow]}>
            {session?.title || "Live Session"}
          </Text>
          <Text style={[styles.hostName, styles.textShadow]}>
            Hosted by {session?.host?.name || "..."}
          </Text>
        </View>

        {/* Main content area: chat on the left, reactions on the right */}
        <View style={styles.mainContentArea} pointerEvents="box-none">
          {/* Chat overlay - bottom left */}
          <View style={styles.chatAreaWrapper} pointerEvents="box-none">
            <FlatList
              style={styles.chatList}
              contentContainerStyle={styles.chatListContent}
              inverted
              showsVerticalScrollIndicator={false}
              data={messages.slice(0, 50)}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={[styles.noMessages, styles.textShadow]}>
                   No messages yet
                </Text>
              }
              renderItem={({ item }) => (
                <View style={styles.chatMessage}>
                  <Ionicons
                    name={
                      item.type === "reaction"
                        ? "heart"
                        : item.type === "host_reply"
                        ? "chatbubble-ellipses-outline"
                        : "help-circle-outline"
                    }
                    size={16}
                    color={
                      item.type === "reaction"
                        ? "#ef4444"
                        : item.type === "host_reply"
                        ? "rgba(255,255,255,0.7)"
                        : "#60a5fa"
                    }
                    style={styles.chatBadge}
                  />
                  <View style={styles.chatMessageContent}>
                    <Text style={[styles.chatSender, styles.textShadow]}>{item.user.name}</Text>
                    <Text style={[styles.chatText, styles.textShadow]}>{item.content}</Text>
                  </View>
                </View>
              )}
            />
          </View>

          {/* Right side: reactions column + floating emojis (ONLY FOR LIVE) */}
          {session?.isLive && (
            <View style={styles.sideControlsWrapper} pointerEvents="box-none">
              <View style={styles.floatingReactions}>
                {floatingReactions.map((r) => (
                  <Text key={r.id} style={styles.floatingEmoji}>{r.emoji}</Text>
                ))}
              </View>
              <View style={styles.reactionBar}>
                {REACTIONS.map((emoji) => (
                  <TouchableOpacity key={emoji} style={styles.reactionButton} onPress={() => sendReaction(emoji)}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Bottom input bar (ONLY FOR LIVE) */}
        {session?.isLive && (
          <View
            style={[
              styles.inputBarWrapper,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.questionInput}
                placeholder="Ask a question..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={questionText}
                onChangeText={setQuestionText}
                onSubmitEditing={sendQuestion}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendButton, !questionText.trim() && { opacity: 0.5 }]}
                onPress={sendQuestion}
                disabled={!questionText.trim()}
              >
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Products Bottom Sheet Modal */}
      <Modal
        visible={showProducts}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProducts(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowProducts(false)}
          />
          <View style={styles.bottomSheetCard}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetHeading}>Products ({products.length})</Text>
            <ScrollView
              style={styles.productsSheetScroll}
              contentContainerStyle={styles.productsSheetContent}
              showsVerticalScrollIndicator={false}
            >
              {products.map((item) => (
                <View
                  key={item.id}
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
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitle}>{item.title}</Text>
                    <Text style={styles.productPrice}>₹{item.price.toFixed(2)}</Text>
                    <Text style={styles.productMeta}>Qty: {item.quantity}</Text>
                    <Text style={styles.productMeta}>
                      Sizes: {item.sizes?.join(", ") || "Not set"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.wishlistBtn}
                    onPress={() => toggleWishlist(item.id)}
                  >
                    <Ionicons
                      name={wishlist.has(item.id) ? "heart" : "heart-outline"}
                      size={22}
                      color={wishlist.has(item.id) ? "#ef4444" : theme.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              ))}
              {products.length === 0 && (
                <Text style={styles.noProducts}>No products showcased yet</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  keyboardView: { flex: 1 },

  // Text shadow for readability over video
  textShadow: {
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 16, fontWeight: "600" },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.3)",
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
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
  viewerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewerIcon: { marginRight: 4 },
  viewerCountText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  productsHeaderButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  productsHeaderButtonActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },

  // Session meta
  sessionMeta: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  sessionTitle: { fontSize: 18, fontWeight: "700" },
  hostName: { fontSize: 14, marginTop: 2, color: "rgba(255,255,255,0.7)" },

  // Stream ended overlay
  endedOverlay: {
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
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

  // Main content area (chat left, reactions right)
  mainContentArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  // Chat area - bottom left
  chatAreaWrapper: {
    maxHeight: 280,
    flex: 0,
    width: "60%",
    alignSelf: "flex-end",
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 8,
  },
  chatMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  chatBadge: { marginRight: 6, marginTop: 2 },
  chatMessageContent: { flex: 1 },
  chatSender: { fontSize: 13, fontWeight: "700", color: "#60a5fa" },
  chatText: { fontSize: 13, marginTop: 1 },
  noMessages: { fontSize: 14, paddingHorizontal: 16 },

  // Right side controls
  sideControlsWrapper: {
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 8,
    paddingRight: 12,
    width: 64,
  },
  floatingReactions: {
    alignItems: "center",
    marginBottom: 8,
  },
  floatingEmoji: { fontSize: 28, marginBottom: 4 },
  reactionBar: {
    alignItems: "center",
    gap: 4,
  },
  reactionButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionEmoji: { fontSize: 22 },

  // Bottom input bar
  inputBarWrapper: {
    backgroundColor: "transparent",
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "flex-end",
  },
  questionInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    minHeight: 44,
  },
  sendButton: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  sendText: { color: theme.textOnAccent, fontWeight: "700", fontSize: 15 },

  // Products bottom sheet
  bottomSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bottomSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.38)",
  },
  bottomSheetCard: {
    maxHeight: "78%",
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.border,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 26 : 18,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  bottomSheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.border,
    marginBottom: 12,
  },
  bottomSheetHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
    marginHorizontal: 20,
    marginBottom: 2,
  },
  productsSheetScroll: { maxHeight: "100%" },
  productsSheetContent: { paddingTop: 10, paddingBottom: 24 },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  productHighlighted: {
    borderWidth: 2,
    borderColor: theme.accent,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  productEmoji: {},
  productInfo: { flex: 1, marginLeft: 12 },
  productTitle: { fontSize: 15, fontWeight: "600", color: theme.text },
  productPrice: { fontSize: 14, color: theme.textMuted, fontWeight: "700", marginTop: 2 },
  productMeta: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  wishlistBtn: {
    padding: 8,
  },
  noProducts: { color: theme.textMuted, fontSize: 14, marginHorizontal: 16 },
});
