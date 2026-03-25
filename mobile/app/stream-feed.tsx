import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../src/api/client";
import { getLiveKitToken } from "../src/api/livekit";
import { LiveSession, ApiResponse } from "../src/types";
import { useAuth } from "../src/contexts/AuthContext";
import LiveKitRoom from "../src/components/LiveKitRoom";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface SessionListResponse {
  sessions: LiveSession[];
  total: number;
  page: number;
  totalPages: number;
}

export default function StreamFeedScreen() {
  const { tab, startId } = useLocalSearchParams<{ tab: string; startId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followingId, setFollowingId] = useState<string | null>(null);

  // LiveKit tokens cache: sessionId -> { token, url }
  const [tokenCache, setTokenCache] = useState<Record<string, { token: string; url: string }>>({});

  const flatListRef = useRef<FlatList>(null);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveId(viewableItems[0].item.id);
    }
  }).current;

  // Fetch LiveKit token for a live session
  const fetchTokenForSession = useCallback(async (sessionId: string) => {
    if (tokenCache[sessionId]) return; // Already cached
    try {
      const data = await getLiveKitToken(sessionId);
      setTokenCache((prev) => ({ ...prev, [sessionId]: { token: data.token, url: data.url } }));
    } catch (err: any) {
      console.error(`[StreamFeed] Failed to get token for ${sessionId}:`, err.message);
    }
  }, [tokenCache]);

  // When active item changes, fetch token if it's a live session
  useEffect(() => {
    if (!activeId) return;
    const session = sessions.find((s) => s.id === activeId);
    if (session?.isLive && !tokenCache[activeId]) {
      fetchTokenForSession(activeId);
    }
  }, [activeId, sessions, tokenCache, fetchTokenForSession]);

  useEffect(() => {
    async function load() {
      try {
        const endpoint = tab === "following" ? "/sessions/live/following" : "/sessions/live";
        const [sessionsRes, followingRes] = await Promise.all([
          apiClient<ApiResponse<SessionListResponse>>(endpoint),
          apiClient<ApiResponse<{ users: { id: string }[] }>>("/users/following"),
        ]);

        const allSessions = sessionsRes.data.sessions;
        setSessions(allSessions);
        setFollowedIds(new Set((followingRes.data.users || []).map((u) => u.id)));

        const startIndex = Math.max(0, allSessions.findIndex((s) => s.id === startId));
        if (allSessions.length > 0) setActiveId(allSessions[startIndex].id);

        if (startIndex > 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: startIndex, animated: false });
          }, 120);
        }
      } catch (err: any) {
        Alert.alert("Error", err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tab, startId]);

  async function handleFollow(hostId: string) {
    if (!user || hostId === user.id || followingId) return;
    const wasFollowing = followedIds.has(hostId);
    setFollowingId(hostId);
    setFollowedIds((prev) => {
      const next = new Set(prev);
      wasFollowing ? next.delete(hostId) : next.add(hostId);
      return next;
    });
    try {
      await apiClient(`/users/${hostId}/${wasFollowing ? "unfollow" : "follow"}`, {
        method: "POST",
      });
    } catch {
      setFollowedIds((prev) => {
        const next = new Set(prev);
        wasFollowing ? next.add(hostId) : next.delete(hostId);
        return next;
      });
    } finally {
      setFollowingId(null);
    }
  }

  function renderStreamItem({ item }: { item: LiveSession }) {
    const isActive = item.id === activeId;
    const isOwn = item.hostId === user?.id;
    const isFollowed = followedIds.has(item.hostId);
    const isLoadingFollow = followingId === item.hostId;
    const isVod = !item.isLive && !!item.recordingUrl;
    const cached = tokenCache[item.id];

    return (
      <View style={styles.streamPage}>
        {/* Video content */}
        {isVod ? (
          // ── VOD (recorded stream) ──
          <Video
            source={{ uri: item.recordingUrl! }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive}
            isLooping
            useNativeControls={false}
          />
        ) : item.isLive && cached ? (
          // ── Live stream with token ──
          <LiveKitRoom
            token={cached.token}
            url={cached.url}
            isHost={false}
            isFullscreen={true}
          />
        ) : item.isLive ? (
          // ── Live stream, waiting for token ──
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.connectingText}>Connecting to live…</Text>
          </View>
        ) : (
          // ── Fallback ──
          <View style={styles.centerContent}>
            <Ionicons name="videocam-off-outline" size={48} color="#94a3b8" />
            <Text style={styles.connectingText}>No recording available</Text>
          </View>
        )}

        {/* Dark gradient at bottom */}
        <View style={styles.gradient} pointerEvents="none" />

        {/* Info overlay */}
        <View style={[styles.overlay, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.infoRow}>
            {/* Avatar + text */}
            <TouchableOpacity
              style={styles.hostInfo}
              onPress={() => router.push(`/user/${item.hostId}`)}
              activeOpacity={0.8}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.host?.name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hostName}>{item.host?.name || "Unknown"}</Text>
                <Text style={styles.reelTitle} numberOfLines={2}>{item.title}</Text>
              </View>
            </TouchableOpacity>

            {/* Follow button */}
            {!isOwn && (
              <TouchableOpacity
                style={[styles.followBtn, isFollowed && styles.followBtnActive]}
                onPress={() => handleFollow(item.hostId)}
                disabled={!!isLoadingFollow}
                activeOpacity={0.8}
              >
                <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextActive]}>
                  {isLoadingFollow ? "..." : isFollowed ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Live / Recorded badge */}
        <View style={[styles.badge, { top: insets.top + 56 }]}>
          {item.isLive ? (
            <>
              <View style={styles.liveDot} />
              <Text style={styles.badgeText}>LIVE</Text>
              {(item.viewerCount ?? 0) > 0 && (
                <Text style={styles.viewerCountText}> · {item.viewerCount}</Text>
              )}
            </>
          ) : item.recordingUrl ? (
            <>
              <Ionicons name="play-circle" size={14} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>RECORDED</Text>
            </>
          ) : null}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed back button */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 8 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderStreamItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          }, 200);
        }}
        ListEmptyComponent={
          <View style={styles.loadingContainer}>
            <Ionicons name="videocam-off-outline" size={56} color="#94a3b8" />
            <Text style={{ color: "#fff", fontSize: 16, marginTop: 12 }}>No streams available</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  loadingContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  backButton: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    padding: 6,
  },

  streamPage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
  },

  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a1a",
  },
  connectingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 12,
  },

  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: "transparent",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 60,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },

  hostInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 2,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#fff" },

  hostName: { fontSize: 15, fontWeight: "700", color: "#fff" },
  reelTitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2, lineHeight: 18 },

  followBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    flexShrink: 0,
  },
  followBtnActive: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
  },
  followBtnText: { fontSize: 13, fontWeight: "700", color: "#000" },
  followBtnTextActive: { color: "#fff" },

  badge: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    marginRight: 6,
  },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  viewerCountText: { color: "rgba(255,255,255,0.8)", fontWeight: "600", fontSize: 12 },
});
