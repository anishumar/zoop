import { useEffect, useState, useRef } from "react";
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
import VideoPlayer from "../../src/components/VideoPlayer";
import { LiveSession, Product, Message, ApiResponse } from "../../src/types";

interface ProductListResponse {
  products: Product[];
  total: number;
}

export default function HostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  const [session, setSession] = useState<LiveSession | null>(null);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [reactionCount, setReactionCount] = useState(0);
  const [endingSession, setEndingSession] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    loadSession();
    loadMyProducts();
    setupSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave_live", sessionId);
      }
      disconnectSocket();
    };
  }, [sessionId]);

  async function loadSession() {
    try {
      if (!sessionId) return;
      const res = await apiClient<ApiResponse<LiveSession>>(`/sessions/${sessionId}`);
      setSession(res.data);
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

      socket.emit("join_live", sessionId);

      socket.on("viewer_count_update", (data: { count: number }) => {
        setViewerCount(data.count);
      });

      socket.on("new_reaction", (msg: Message) => {
        setMessages((prev) => [msg, ...prev]);
        setReactionCount((c) => c + 1);
      });

      socket.on("new_question", (msg: Message) => {
        setMessages((prev) => [msg, ...prev]);
      });
    } catch (err) {
      console.error("Socket connection failed:", err);
    }
  }

  async function handleEndSession() {
    if (!sessionId) {
      Alert.alert("Error", "Missing live session id");
      return;
    }
    const endSession = async () => {
      try {
        setEndingSession(true);
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

  const showcasedIds = new Set(session?.sessionProducts?.map((sp) => sp.product.id) || []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.endButton, endingSession && { opacity: 0.7 }]}
            onPress={handleEndSession}
            disabled={endingSession}
          >
            <Text style={styles.endButtonText}>{endingSession ? "Ending..." : "End Live"}</Text>
          </TouchableOpacity>
        </View>

        <VideoPlayer streamType={(session?.streamType as any) || "mock"} streamUrl={session?.streamUrl} />

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
              <Text style={styles.productEmoji}>📦</Text>
              <View style={styles.productInfo}>
                <Text style={styles.productTitle}>{sp.product.title}</Text>
                <Text style={styles.productPrice}>${sp.product.price.toFixed(2)}</Text>
              </View>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noProducts}>No products added yet</Text>
        )}

        <Text style={styles.sectionTitle}>Add from Your Products</Text>
        {myProducts.filter((p) => !showcasedIds.has(p.id)).map((product) => (
          <TouchableOpacity
            key={product.id}
            style={styles.addProductRow}
            onPress={() => handleAddProduct(product.id)}
          >
            <Text style={styles.productEmoji}>📦</Text>
            <View style={styles.productInfo}>
              <Text style={styles.productTitle}>{product.title}</Text>
              <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
            </View>
            <Text style={styles.addIcon}>+</Text>
          </TouchableOpacity>
        ))}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  backText: { color: "#94a3b8", fontSize: 16, fontWeight: "600" },
  endButton: { backgroundColor: "#ef4444", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  endButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    marginHorizontal: 16,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    marginTop: 12,
  },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#f8fafc" },
  statLabel: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#f8fafc", marginTop: 24, marginBottom: 12, marginHorizontal: 16 },
  showcasedProduct: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
  },
  productEmoji: { fontSize: 24 },
  productInfo: { flex: 1, marginLeft: 12 },
  productTitle: { fontSize: 15, fontWeight: "600", color: "#f8fafc" },
  productPrice: { fontSize: 14, color: "#22c55e", fontWeight: "700", marginTop: 2 },
  checkmark: { color: "#22c55e", fontSize: 20, fontWeight: "700" },
  noProducts: { color: "#64748b", fontSize: 14, marginHorizontal: 16 },
  addProductRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  addIcon: { color: "#6366f1", fontSize: 24, fontWeight: "700" },
  noMessages: { color: "#64748b", fontSize: 14, marginHorizontal: 16 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginBottom: 10,
  },
  messageBadge: { fontSize: 18, marginRight: 10, marginTop: 2 },
  messageContent: { flex: 1 },
  messageSender: { fontSize: 13, fontWeight: "700", color: "#6366f1" },
  messageText: { fontSize: 14, color: "#e2e8f0", marginTop: 2 },
});
