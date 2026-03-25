import { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../src/api/client";
import { LiveSession, Message, ApiResponse } from "../src/types";
import { useAuth } from "../src/contexts/AuthContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ReelsScreen() {
  const { startId, source, hostId } = useLocalSearchParams<{ startId: string; source?: string; hostId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});

  const flatListRef = useRef<FlatList>(null);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveId(viewableItems[0].item.id);
    }
  }).current;

  useEffect(() => {
    async function load() {
      try {
        // Fetch from profile archived or following depending on source
        const endpoint = source === "profile" && hostId
          ? `/sessions/user/${hostId}/archived`
          : "/sessions/live/following";

        const [sessionsRes, followingRes] = await Promise.all([
          apiClient<ApiResponse<{ sessions: LiveSession[] }>>(endpoint),
          apiClient<ApiResponse<{ users: { id: string }[] }>>("/users/following"),
        ]);

        const recorded = sessionsRes.data.sessions.filter(
          (s) => s.recordingUrl && !s.isLive
        );

        setSessions(recorded);
        setFollowedIds(new Set((followingRes.data.users || []).map((u) => u.id)));

        const startIndex = Math.max(0, recorded.findIndex((s) => s.id === startId));
        if (recorded.length > 0) setActiveId(recorded[startIndex].id);

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
  }, [startId]);

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

  // Lazy-load messages for the active reel
  useEffect(() => {
    if (!activeId || messagesCache[activeId]) return;
    apiClient<ApiResponse<LiveSession>>(`/sessions/${activeId}`)
      .then((res) => {
        setMessagesCache((prev) => ({
          ...prev,
          [activeId]: (res.data.messages || []).filter((m) => m.type !== "reaction"),
        }));
      })
      .catch(() => {});
  }, [activeId]);

  function renderReel({ item }: { item: LiveSession }) {
    const isActive = item.id === activeId;
    const isOwn = item.hostId === user?.id;
    const isFollowed = followedIds.has(item.hostId);
    const isLoadingFollow = followingId === item.hostId;
    const comments = messagesCache[item.id] || [];

    return (
      <View style={styles.reel}>
        {/* Full-screen video */}
        <Video
          source={{ uri: item.recordingUrl! }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive}
          isLooping
          useNativeControls={false}
        />

        {/* Dark gradient at bottom */}
        <View style={styles.gradient} pointerEvents="none" />

        {/* Info overlay */}
        <View style={[styles.overlay, { paddingBottom: insets.bottom + 20 }]}>
          {/* Comments section */}
          {comments.length > 0 && (
            <ScrollView
              style={styles.commentsContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {comments.slice(-6).map((msg) => (
                <View key={msg.id} style={styles.commentRow}>
                  <Text style={styles.commentName}>{msg.user?.name || "User"}</Text>
                  <Text style={styles.commentText}>{msg.content}</Text>
                </View>
              ))}
            </ScrollView>
          )}
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
        renderItem={renderReel}
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
            <Text style={{ color: "#fff", fontSize: 16 }}>No recorded streams</Text>
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

  // Back button — fixed, above the FlatList
  backButton: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    padding: 6,
  },

  // Each reel page
  reel: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
  },

  // Gradient-like dark layer at bottom
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: "transparent",
    // Simulate gradient using multiple views would require LinearGradient;
    // use a simple dark overlay with low opacity instead
    borderBottomWidth: 0,
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

  // Comments
  commentsContainer: {
    maxHeight: 160,
    marginBottom: 14,
  },
  commentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  commentName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    marginRight: 6,
  },
  commentText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    flexShrink: 1,
  },
});
