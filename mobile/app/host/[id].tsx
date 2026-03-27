import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Socket } from "socket.io-client";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../src/api/client";
import { connectSocket, disconnectSocket } from "../../src/api/socket";
import { getLiveKitToken } from "../../src/api/livekit";
import VideoPlayer from "../../src/components/VideoPlayer";
import HostControls from "../../src/components/HostControls";
import ImageWithFallback from "../../src/components/ImageWithFallback";
import { LiveSession, Product, Message, ApiResponse } from "../../src/types";
import { AppTheme, useAppTheme } from "../../src/theme";
import { usePlayer } from "../../src/contexts/PlayerContext";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLiveTimer } from "../../src/hooks/useLiveTimer";


interface ProductListResponse {
  products: Product[];
  total: number;
}

interface AiReplySuggestion {
  suggestedReply: string;
  reasoning: string;
  followUpPrompt: string;
}

interface AiEngagementSummary {
  summary: string;
  topSignals: string[];
  productMomentum: string;
  hostTip: string;
}

type AiPanelState = { type: "insights"; title: string; data: AiEngagementSummary };

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
  const streamDuration = useLiveTimer(session?.startedAt);
  const [endingSession, setEndingSession] = useState(false);
  const [aiReplyLoadingId, setAiReplyLoadingId] = useState<string | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiPanel, setAiPanel] = useState<AiPanelState | null>(null);
  const [showProductsSheet, setShowProductsSheet] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyingToName, setReplyingToName] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);

  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isImmersiveMode, setIsImmersiveMode] = useState(true);

  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { openPlayer } = usePlayer();
  const { user: authUser } = useAuth();
  const isMinimizing = useRef(false);


  function handleBack() {
    if (session) {
      isMinimizing.current = true;
      openPlayer(session, lkToken, lkUrl, true, true);
    }
    
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

      if (!isMinimizing.current) {
        if (socketRef.current) {
          socketRef.current.emit("host_stream_ended", { sessionId });
          socketRef.current.emit("leave_live", sessionId);
        }
        disconnectSocket();
      }
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

      const handleNewHostReply = (msg: Message) => {
        setMessages((prev) => [msg, ...prev].slice(0, MAX_CHAT_MESSAGES));
      };

      const handleConnect = () => {
        socket.emit("join_live", sessionId);
      };

      socket.on("connect", handleConnect);
      socket.on("viewer_count_update", handleViewerCountUpdate);
      socket.on("new_reaction", handleNewReaction);
      socket.on("new_question", handleNewQuestion);
      socket.on("new_host_reply", handleNewHostReply);

      if (socket.connected) {
        handleConnect();
      }

      socketCleanupRef.current = () => {
        socket.off("connect", handleConnect);
        socket.off("viewer_count_update", handleViewerCountUpdate);
        socket.off("new_reaction", handleNewReaction);
        socket.off("new_question", handleNewQuestion);
        socket.off("new_host_reply", handleNewHostReply);
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
      await loadSession();
      socketRef.current?.emit("session_products_sync", { sessionId });
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
      await loadSession();
      socketRef.current?.emit("session_products_sync", { sessionId });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function handleGenerateAiReply(message: Message) {
    if (!sessionId) return;

    try {
      setAiReplyLoadingId(message.id);
      const result = await apiClient<ApiResponse<AiReplySuggestion>>(`/sessions/${sessionId}/ai-reply`, {
        method: "POST",
        body: { question: message.content },
      });

      setReplyDraft(result.data.suggestedReply);
      setReplyingToName(message.user.name);
    } catch (err: any) {
      Alert.alert("AI Reply", err.message || "Failed to generate AI reply");
    } finally {
      setAiReplyLoadingId(null);
    }
  }

  async function handleSendReply() {
    if (!sessionId || !socketRef.current || !replyDraft.trim()) return;

    try {
      setIsSendingReply(true);
      socketRef.current.emit("send_host_reply", {
        sessionId,
        content: replyDraft.trim(),
      });
      setReplyDraft("");
      setReplyingToName(null);
      Keyboard.dismiss();
    } catch (err: any) {
      Alert.alert("Reply", err.message || "Failed to send reply");
    } finally {
      setIsSendingReply(false);
    }
  }

  async function handleGenerateAiInsights() {
    if (!sessionId) return;

    try {
      setAiInsightsLoading(true);
      const result = await apiClient<ApiResponse<AiEngagementSummary>>(
        `/sessions/${sessionId}/ai-engagement-summary`,
        {
          method: "POST",
        }
      );

      setAiPanel({
        type: "insights",
        title: "AI Engagement Summary",
        data: result.data,
      });
    } catch (err: any) {
      Alert.alert("AI Insights", err.message || "Failed to generate AI insights");
    } finally {
      setAiInsightsLoading(false);
    }
  }

  const showcasedIds = new Set(session?.sessionProducts?.map((sp) => sp.product.id) || []);
  const availableProducts = myProducts.filter((p) => !showcasedIds.has(p.id));
  const streamType = (session?.streamType as "mock" | "livekit") || "livekit";

  return (
    <View style={styles.container}>
      {isImmersiveMode && (
        <View style={StyleSheet.absoluteFill}>
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
            isFullscreen={true}
          />
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color={isImmersiveMode ? "#fff" : theme.textMuted} />
            </TouchableOpacity>
            
            <View style={styles.hostInfo}>
              <ImageWithFallback
                uri={authUser?.avatarUrl}
                style={styles.hostAvatar}
                fallback={
                  <View style={styles.hostAvatarPlaceholder}>
                    <Text style={styles.avatarLetter}>
                      {(authUser?.name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                }
              />
              <View>
                <Text style={[styles.hostName, isImmersiveMode && styles.textShadow]}>
                  {authUser?.name}
                </Text>
                <Text style={[styles.liveTimer, isImmersiveMode && styles.textShadow]}>
                  {streamDuration}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.topBarRight}>
            {!isImmersiveMode && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
              </View>
            )}

            <TouchableOpacity
              style={[styles.headerIconButton, isImmersiveMode && styles.immersiveHeaderButton, { borderRadius: 19, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }]}
              onPress={() => setIsImmersiveMode((v) => !v)}
            >
              <Ionicons
                name={isImmersiveMode ? "contract" : "expand"}
                size={22}
                color={isImmersiveMode ? "#fff" : theme.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.productsHeaderButton,
                showProductsSheet && styles.productsHeaderButtonActive,
                isImmersiveMode && !showProductsSheet && styles.immersiveHeaderButton
              ]}
              onPress={() => setShowProductsSheet((value) => !value)}
            >
              <Ionicons
                name="cube-outline"
                size={18}
                color={showProductsSheet ? theme.textOnAccent : (isImmersiveMode ? "#fff" : theme.text)}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.endButton, endingSession && { opacity: 0.7 }]}
              onPress={handleEndSession}
              disabled={endingSession}
            >
              <Text style={styles.endButtonText}>{endingSession ? "Ending..." : "End Live"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isImmersiveMode && (
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
        )}

        {!isImmersiveMode && (
          <HostControls
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            isFrontCamera={isFrontCamera}
            onToggleCamera={() => setIsCameraOn((v) => !v)}
            onToggleMic={() => setIsMicOn((v) => !v)}
            onFlipCamera={() => setIsFrontCamera((v) => !v)}
            onAiInsights={() => void handleGenerateAiInsights()}
            aiLoading={aiInsightsLoading}
          />
        )}

        {!isImmersiveMode && (
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
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{streamDuration}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          </View>
        )}

        <View style={[styles.mainContentArea, isImmersiveMode && styles.mainContentAreaImmersive]} pointerEvents="box-none">
          <View style={[styles.chatAreaWrapper, isImmersiveMode && styles.chatAreaWrapperImmersive]} pointerEvents="box-none">
            {!isImmersiveMode && <Text style={styles.sectionTitle}>Live Chat</Text>}
            <FlatList
              style={styles.chatList}
              contentContainerStyle={isImmersiveMode ? styles.chatListContentImmersive : styles.chatListContent}
              inverted
              showsVerticalScrollIndicator={false}
              data={messages}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={[styles.noMessages, isImmersiveMode && styles.textShadow]}>
                   No messages yet
                </Text>
              }
          renderItem={({ item: msg }) => (
            <View key={msg.id} style={styles.messageRow}>
              <Ionicons
                name={
                  msg.type === "reaction"
                    ? "heart"
                    : msg.type === "host_reply"
                    ? "chatbubble-ellipses-outline"
                    : "help-circle-outline"
                }
                size={18}
                color={
                  msg.type === "reaction"
                    ? theme.danger
                    : msg.type === "host_reply"
                    ? theme.textMuted
                    : theme.accent
                }
                style={styles.messageBadge}
              />
              <View style={styles.messageContent}>
                <Text style={[styles.messageSender, isImmersiveMode && styles.textShadow]}>{msg.user.name}</Text>
                <Text style={[styles.messageText, isImmersiveMode && styles.textShadow]}>{msg.content}</Text>
                {msg.type === "question" && (
                  <TouchableOpacity
                    style={[styles.aiReplyButton, isImmersiveMode && styles.aiReplyButtonImmersive, aiReplyLoadingId === msg.id && { opacity: 0.7 }]}
                    onPress={() => void handleGenerateAiReply(msg)}
                    disabled={aiReplyLoadingId === msg.id}
                  >
                    <Ionicons name="sparkles-outline" size={14} color={theme.accent} />
                    <Text style={styles.aiReplyButtonText}>
                      {aiReplyLoadingId === msg.id ? "Thinking..." : "AI Reply"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      </View>
        {isImmersiveMode && (
          <View style={styles.immersiveSideControls} pointerEvents="box-none">
            <HostControls
              layout="column"
              isCameraOn={isCameraOn}
              isMicOn={isMicOn}
              isFrontCamera={isFrontCamera}
              onToggleCamera={() => setIsCameraOn((v) => !v)}
              onToggleMic={() => setIsMicOn((v) => !v)}
              onFlipCamera={() => setIsFrontCamera((v) => !v)}
              onAiInsights={() => void handleGenerateAiInsights()}
              aiLoading={aiInsightsLoading}
            />
          </View>
        )}
    </View>

      <View
        style={[
          styles.commentBarWrapper,
          isImmersiveMode && styles.commentBarWrapperImmersive,
          { paddingBottom: isImmersiveMode ? Math.max(insets.bottom, 16) : Math.max(insets.bottom, 8) }
        ]}
      >

          <View style={styles.inputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Say something..."
              placeholderTextColor={theme.textMuted}
              value={replyDraft}
              onChangeText={setReplyDraft}
              multiline={true}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!replyDraft.trim() || isSendingReply) && { opacity: 0.5 }]}
              onPress={() => void handleSendReply()}
              disabled={!replyDraft.trim() || isSendingReply}
            >
              <Text style={styles.sendText}>{isSendingReply ? "..." : "Send"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={Boolean(aiPanel)} transparent animationType="slide" onRequestClose={() => setAiPanel(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {aiPanel && (
              <>
                <Text style={styles.modalTitle}>{aiPanel.title}</Text>

                <Text style={styles.modalLabel}>Summary</Text>
                <Text style={styles.modalText}>{aiPanel.data.summary}</Text>
                <Text style={styles.modalLabel}>Top Signals</Text>
                {aiPanel.data.topSignals.map((signal) => (
                  <View key={signal} style={styles.modalBulletRow}>
                    <View style={styles.modalBulletDot} />
                    <Text style={styles.modalBulletText}>{signal}</Text>
                  </View>
                ))}
                <Text style={styles.modalLabel}>Product Momentum</Text>
                <Text style={styles.modalText}>{aiPanel.data.productMomentum}</Text>
                <Text style={styles.modalLabel}>Host Tip</Text>
                <Text style={styles.modalText}>{aiPanel.data.hostTip}</Text>

                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setAiPanel(null)}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showProductsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductsSheet(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowProductsSheet(false)}
          />
          <View style={styles.bottomSheetCard}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetHeading}>Products</Text>
            <ScrollView
              style={styles.productsSheetScroll}
              contentContainerStyle={styles.productsSheetContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.productsSheetTitle}>Showcase Products</Text>
              {session?.sessionProducts && session.sessionProducts.length > 0 ? (
                session.sessionProducts.map((sp) => (
                  <View key={sp.product.id} style={styles.showcasedProduct}>
                    <ImageWithFallback
                      uri={sp.product.imageUrl}
                      style={styles.productThumb}
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
                      <Text style={styles.productTitle}>{sp.product.title}</Text>
                      <Text style={styles.productPrice}>₹{sp.product.price.toFixed(2)}</Text>
                      <Text style={styles.productMeta}>Qty: {sp.product.quantity}</Text>
                      <Text style={styles.productMeta}>Sizes: {sp.product.sizes?.join(", ") || "Not set"}</Text>
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

              <Text style={styles.productsSheetTitle}>Add from Your Products</Text>
              {availableProducts.length > 0 ? (
                availableProducts.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.addProductRow}
                    onPress={() => handleAddProduct(product.id)}
                  >
                    <ImageWithFallback
                      uri={product.imageUrl}
                      style={styles.productThumb}
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
                      <Text style={styles.productTitle}>{product.title}</Text>
                      <Text style={styles.productPrice}>₹{product.price.toFixed(2)}</Text>
                      <Text style={styles.productMeta}>Qty: {product.quantity}</Text>
                      <Text style={styles.productMeta}>Sizes: {product.sizes?.join(", ") || "Not set"}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color={theme.accent} style={styles.addIcon} />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noProducts}>All your products are already showcased</Text>
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
  container: { flex: 1, backgroundColor: theme.background },
  keyboardView: { flex: 1 },
  mainContentArea: {
    flex: 1,
    flexDirection: "row",
  },
  mainContentAreaImmersive: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  chatAreaWrapper: {
    flex: 1,
  },
  chatAreaWrapperImmersive: {
    maxHeight: 280,
    flex: 0,
    width: "55%",
    alignSelf: "flex-end",
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingBottom: 16,
  },
  chatListContentImmersive: {
    paddingBottom: 24,
    paddingLeft: 0,
    paddingRight: 8,
  },
  immersiveSideControls: {
    justifyContent: "flex-end",
    paddingBottom: 24,
    paddingRight: 8,
    width: 80,
  },
  textShadow: {
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerIconButton: {
    padding: 6,
  },
  scroll: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  hostInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  hostAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  avatarLetter: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  hostName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  liveTimer: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { color: theme.textMuted, fontSize: 16, fontWeight: "600" },
  productsHeaderButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.surface,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  immersiveHeaderButton: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  commentBarWrapperImmersive: {
    backgroundColor: "transparent",
  },
  productsHeaderButtonActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    minWidth: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ef4444",
  },

  liveLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  endButton: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 80,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  endButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
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
  productsSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
    marginTop: 10,
    marginBottom: 10,
    marginHorizontal: 16,
  },
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
  statValue: { fontSize: 22, fontWeight: "800", color: theme.text, fontVariant: ["tabular-nums"] },
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
  productEmoji: {},
  productThumb: { width: 48, height: 48, borderRadius: 12 },
  productInfo: { flex: 1, marginLeft: 12 },
  productTitle: { fontSize: 15, fontWeight: "600", color: theme.text },
  productPrice: { fontSize: 14, color: theme.textMuted, fontWeight: "700", marginTop: 2 },
  productMeta: { fontSize: 12, color: theme.textMuted, marginTop: 4 },
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
  addIcon: {},
  noMessages: { color: theme.textMuted, fontSize: 14, marginHorizontal: 16 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginBottom: 10,
  },
  messageBadge: { marginRight: 10, marginTop: 2 },
  messageContent: { flex: 1 },
  messageSender: { fontSize: 13, fontWeight: "700", color: theme.accent },
  messageText: { fontSize: 14, color: theme.text, marginTop: 2 },
  aiReplyButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  aiReplyButtonImmersive: {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  aiReplyButtonText: { color: theme.accent, fontSize: 12, fontWeight: "700" },
  commentBarWrapper: {
    paddingVertical: 8,
  },
  replyingToHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  replyingToText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
    alignItems: "flex-end",
  },
  commentInput: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 10,
    paddingBottom: Platform.OS === "ios" ? 10 : 10,
    fontSize: 15,
    lineHeight: 22,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 44,
    maxHeight: 96, // 3 lines (3 * 22 lineHeight + 20 padding + 2 border)
    textAlignVertical: "top",
  },
  sendButton: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  sendText: {
    color: theme.textOnAccent,
    fontWeight: "700",
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 10,
  },
  modalTitle: { fontSize: 22, fontWeight: "700", color: theme.text, marginBottom: 8 },
  modalLabel: { fontSize: 12, fontWeight: "700", color: theme.accent, textTransform: "uppercase", marginTop: 6 },
  modalText: { fontSize: 14, color: theme.text, lineHeight: 20 },
  modalBulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  modalBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.accent,
    marginTop: 7,
  },
  modalBulletText: { flex: 1, fontSize: 14, color: theme.text, lineHeight: 20 },
  modalCloseButton: {
    marginTop: 14,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
  },
  modalCloseText: { color: theme.textMuted, fontSize: 16, fontWeight: "700" },
});
