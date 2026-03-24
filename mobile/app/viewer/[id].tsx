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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Socket } from "socket.io-client";
import { apiClient } from "../../src/api/client";
import { connectSocket, disconnectSocket } from "../../src/api/socket";
import VideoPlayer from "../../src/components/VideoPlayer";
import { LiveSession, Message, ApiResponse } from "../../src/types";
import { AppTheme, useAppTheme } from "../../src/theme";

const REACTIONS = ["❤️", "🔥", "👏", "😍", "🎉", "💰"];

export default function ViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  const [session, setSession] = useState<LiveSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [questionText, setQuestionText] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string }[]>([]);
  const reactionIdRef = useRef(0);
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
    loadSession();
    setupSocket();

    return () => {
      if (socketRef.current && id) {
        socketRef.current.emit("leave_live", id);
      }
      disconnectSocket();
    };
  }, [id]);

  async function loadSession() {
    try {
      const res = await apiClient<ApiResponse<LiveSession>>(`/sessions/${id}`);
      setSession(res.data);
    } catch {}
  }

  async function setupSocket() {
    try {
      const socket = await connectSocket();
      socketRef.current = socket;

      socket.emit("join_live", id);

      socket.on("viewer_count_update", (data: { count: number }) => {
        setViewerCount(data.count);
      });

      socket.on("new_reaction", (msg: Message) => {
        setMessages((prev) => [msg, ...prev]);
        showFloatingReaction(msg.content);
      });

      socket.on("new_question", (msg: Message) => {
        setMessages((prev) => [msg, ...prev]);
      });
    } catch (err) {
      console.error("Socket connection failed:", err);
    }
  }

  function showFloatingReaction(emoji: string) {
    const rid = ++reactionIdRef.current;
    setFloatingReactions((prev) => [...prev, { id: rid, emoji }]);
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
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.viewerBadge}>
            <Text style={styles.viewerIcon}>👁</Text>
            <Text style={styles.viewerCountText}>{viewerCount}</Text>
          </View>
        </View>

        <View style={styles.videoContainer}>
          <VideoPlayer streamType={(session?.streamType as any) || "mock"} streamUrl={session?.streamUrl} />

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
            <Text style={styles.productsToggleText}>
              {showProducts ? "Hide Products ▲" : `Products (${products.length}) ▼`}
            </Text>
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
              <View style={styles.productCard}>
                <Text style={styles.productEmoji}>📦</Text>
                <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
              </View>
            )}
          />
        )}

        <View style={styles.chatSection}>
          <FlatList
            data={messages.slice(0, 30)}
            keyExtractor={(item) => item.id}
            inverted
            style={styles.chatList}
            renderItem={({ item }) => (
              <View style={styles.chatMessage}>
                <Text style={styles.chatBadge}>{item.type === "reaction" ? "" : "❓"}</Text>
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
  backText: { color: theme.textMuted, fontSize: 16, fontWeight: "600" },
  viewerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewerIcon: { fontSize: 14, marginRight: 4 },
  viewerCountText: { color: theme.text, fontWeight: "700", fontSize: 14 },
  videoContainer: { marginHorizontal: 16, position: "relative" },
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
  productEmoji: { fontSize: 28, marginBottom: 6 },
  productTitle: { fontSize: 13, fontWeight: "600", color: theme.text, textAlign: "center" },
  productPrice: { fontSize: 14, color: theme.success, fontWeight: "700", marginTop: 4 },
  chatSection: { flex: 1, marginTop: 8 },
  chatList: { paddingHorizontal: 16 },
  chatMessage: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  chatBadge: { fontSize: 14, marginRight: 4 },
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
