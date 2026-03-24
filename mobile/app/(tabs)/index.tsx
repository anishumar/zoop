import { useState, useCallback, useMemo } from "react";
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
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../src/api/client";
import { LiveSession, ApiResponse } from "../../src/types";
import { AppTheme, useAppTheme } from "../../src/theme";
import { useAuth } from "../../src/contexts/AuthContext";

interface SessionListResponse {
  sessions: LiveSession[];
  total: number;
  page: number;
  totalPages: number;
}

type TabKey = "live" | "following";

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("live");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [followingSessions, setFollowingSessions] = useState<LiveSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showGoLive, setShowGoLive] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { user } = useAuth();
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followingId, setFollowingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiClient<ApiResponse<SessionListResponse>>("/sessions/live");
      setSessions(res.data.sessions);
    } catch (err: any) {
      console.error("Failed to fetch sessions:", err.message);
    }
  }, []);

  const fetchFollowingSessions = useCallback(async () => {
    try {
      const res = await apiClient<ApiResponse<SessionListResponse>>("/sessions/live/following");
      setFollowingSessions(res.data.sessions);
    } catch (err: any) {
      console.error("Failed to fetch following sessions:", err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSessions();
      fetchFollowing();
      fetchFollowingSessions();
    }, [fetchSessions, fetchFollowingSessions])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchSessions(), fetchFollowing(), fetchFollowingSessions()]);
    setRefreshing(false);
  }

  const displayedSessions = activeTab === "live" ? sessions : followingSessions;

  async function fetchFollowing() {
    try {
      const res = await apiClient<ApiResponse<{ users: { id: string }[] }>>("/users/following");
      setFollowedIds(new Set((res.data.users || []).map((u) => u.id)));
    } catch {
      // silently fail — not critical
    }
  }

  async function handleFollow(hostId: string, e: any) {
    e.stopPropagation();
    if (!user || hostId === user.id) return;
    const isFollowing = followedIds.has(hostId);
    setFollowingId(hostId);
    try {
      await apiClient(`/users/${hostId}/${isFollowing ? "unfollow" : "follow"}`, { method: "POST" });
      setFollowedIds((prev) => {
        const next = new Set(prev);
        isFollowing ? next.delete(hostId) : next.add(hostId);
        return next;
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setFollowingId(null);
    }
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
    const isOwn = item.hostId === user?.id;
    const isFollowed = followedIds.has(item.hostId);
    const isLoadingFollow = followingId === item.hostId;
    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => {
          router.push(isOwn ? `/host/${item.id}` : `/viewer/${item.id}`);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.sessionVideoPlaceholder}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Ionicons name="videocam" size={48} color={theme.textMuted} />
        </View>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.sessionMeta}>
            <Text style={styles.sessionHost}>{item.host?.name || "Unknown"}</Text>
            <View style={styles.sessionMetaRight}>
              {item.viewerCount > 0 && (
                <View style={styles.sessionViewers}>
                  <Ionicons name="eye-outline" size={14} color={theme.textMuted} />
                  <Text style={styles.sessionViewersText}>{item.viewerCount}</Text>
                </View>
              )}
              {!isOwn && (
                <TouchableOpacity
                  style={[styles.followButton, isFollowed && styles.followButtonActive]}
                  onPress={(e) => handleFollow(item.hostId, e)}
                  disabled={isLoadingFollow}
                  activeOpacity={0.75}
                >
                  {isLoadingFollow ? (
                    <ActivityIndicator size="small" color={isFollowed ? theme.textMuted : theme.textOnAccent} />
                  ) : (
                    <Text style={[styles.followButtonText, isFollowed && styles.followButtonTextActive]}>
                      {isFollowed ? "Following" : "Follow"}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity style={styles.headerPill} onPress={() => setShowGoLive(true)}>
              <Ionicons name="add" size={18} color={theme.textOnAccent} />
              <Text style={styles.headerPillText}>Go Live</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.segmentedWrapper}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentTab, activeTab === "live" && styles.segmentTabActive]}
            onPress={() => setActiveTab("live")}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, activeTab === "live" && styles.segmentTextActive]}>Live</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentTab, activeTab === "following" && styles.segmentTabActive]}
            onPress={() => setActiveTab("following")}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, activeTab === "following" && styles.segmentTextActive]}>Following</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={displayedSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={activeTab === "following" ? "people-outline" : "radio-outline"}
              size={56}
              color={theme.textMuted}
              style={styles.emptyEmoji}
            />
            <Text style={styles.emptyTitle}>
              {activeTab === "following" ? "No live from people you follow" : "No live sessions"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "following"
                ? "Follow creators to see their streams here"
                : "Be the first to go live!"}
            </Text>
          </View>
        }
      />

      <Modal visible={showGoLive} transparent animationType="slide" onRequestClose={() => setShowGoLive(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={StyleSheet.absoluteFill} 
              activeOpacity={1} 
              onPress={() => setShowGoLive(false)}
            />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Start Live Session</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Session title..."
                placeholderTextColor="#64748b"
                value={sessionTitle}
                onChangeText={setSessionTitle}
                autoFocus={Platform.OS === "web"}
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  segmentedWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: theme.surfaceAlt,
    borderRadius: 12,
    padding: 3,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentTabActive: {
    backgroundColor: theme.surface,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 }
      : { elevation: 2 }),
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.textMuted,
  },
  segmentTextActive: {
    color: theme.text,
    fontWeight: "700",
  },
  list: { padding: 16, paddingBottom: 100 },
  sessionCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  sessionVideoPlaceholder: {
    height: 180,
    backgroundColor: theme.surfaceAlt,
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
  placeholderEmoji: { marginBottom: 0 },
  sessionInfo: { padding: 14 },
  sessionTitle: { fontSize: 17, fontWeight: "700", color: theme.text },
  sessionMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  sessionMetaRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  sessionHost: { fontSize: 14, color: theme.textMuted, flex: 1 },
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: theme.accent,
  },
  followButtonActive: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.border,
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textOnAccent,
  },
  followButtonTextActive: {
    color: theme.textMuted,
  },
  sessionViewers: { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionViewersText: { fontSize: 13, color: theme.textMuted, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: 100 },
  emptyEmoji: { marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: theme.text },
  emptySubtitle: { fontSize: 15, color: theme.textMuted, marginTop: 4 },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 16,
    gap: 4,
  },
  headerPillText: {
    color: theme.textOnAccent,
    fontWeight: "700",
    fontSize: 14,
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
  },
  modalTitle: { fontSize: 22, fontWeight: "700", color: theme.text, marginBottom: 20 },
  modalInput: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalButtons: { flexDirection: "row", marginTop: 20, gap: 12 },
  modalCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.surfaceAlt,
    alignItems: "center",
  },
  modalCancelText: { color: theme.textMuted, fontWeight: "600", fontSize: 16 },
  modalConfirm: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.accent,
    alignItems: "center",
  },
  modalConfirmText: { color: theme.textOnAccent, fontWeight: "700", fontSize: 16 },
});
