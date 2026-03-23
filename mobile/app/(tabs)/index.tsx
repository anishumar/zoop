import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { apiClient } from "../../src/api/client";
import { LiveSession, ApiResponse } from "../../src/types";

interface SessionListResponse {
  sessions: LiveSession[];
  total: number;
  page: number;
  totalPages: number;
}

export default function HomeScreen() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showGoLive, setShowGoLive] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiClient<ApiResponse<SessionListResponse>>("/sessions/live");
      setSessions(res.data.sessions);
    } catch (err: any) {
      console.error("Failed to fetch sessions:", err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSessions();
    }, [fetchSessions])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  }

  async function handleGoLive() {
    if (!sessionTitle.trim()) {
      Alert.alert("Error", "Please enter a session title");
      return;
    }
    setCreating(true);
    try {
      const res = await apiClient<ApiResponse<LiveSession>>("/sessions", {
        method: "POST",
        body: { title: sessionTitle.trim() },
      });
      setShowGoLive(false);
      setSessionTitle("");
      router.push(`/host/${res.data.id}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setCreating(false);
    }
  }

  function renderSession({ item }: { item: LiveSession }) {
    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => router.push(`/viewer/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.sessionVideoPlaceholder}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.placeholderEmoji}>🎬</Text>
        </View>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.sessionHost}>{item.host?.name || "Unknown"}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📡</Text>
            <Text style={styles.emptyTitle}>No live sessions</Text>
            <Text style={styles.emptySubtitle}>Be the first to go live!</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.goLiveButton} onPress={() => setShowGoLive(true)}>
        <Text style={styles.goLiveText}>Go Live</Text>
      </TouchableOpacity>

      <Modal visible={showGoLive} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start Live Session</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Session title..."
              placeholderTextColor="#64748b"
              value={sessionTitle}
              onChangeText={setSessionTitle}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowGoLive(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, creating && { opacity: 0.6 }]}
                onPress={handleGoLive}
                disabled={creating}
              >
                <Text style={styles.modalConfirmText}>{creating ? "Starting..." : "Go Live"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  list: { padding: 16, paddingBottom: 100 },
  sessionCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  sessionVideoPlaceholder: {
    height: 180,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
  },
  liveBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff", marginRight: 6 },
  liveText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  placeholderEmoji: { fontSize: 48 },
  sessionInfo: { padding: 14 },
  sessionTitle: { fontSize: 17, fontWeight: "700", color: "#f8fafc" },
  sessionHost: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
  empty: { alignItems: "center", marginTop: 100 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#f8fafc" },
  emptySubtitle: { fontSize: 15, color: "#94a3b8", marginTop: 4 },
  goLiveButton: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: "#ef4444",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  goLiveText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 22, fontWeight: "700", color: "#f8fafc", marginBottom: 20 },
  modalInput: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#f8fafc",
    borderWidth: 1,
    borderColor: "#334155",
  },
  modalButtons: { flexDirection: "row", marginTop: 20, gap: 12 },
  modalCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#334155",
    alignItems: "center",
  },
  modalCancelText: { color: "#94a3b8", fontWeight: "600", fontSize: 16 },
  modalConfirm: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#ef4444",
    alignItems: "center",
  },
  modalConfirmText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
