import { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  StyleSheet,
  Platform,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../src/api/client";
import { LiveSession, Message, ApiResponse, Product } from "../src/types";
import { useAuth } from "../src/contexts/AuthContext";
import { useAppTheme, AppTheme } from "../src/theme";
import ImageWithFallback from "../src/components/ImageWithFallback";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ReelsScreen() {
  const { startId, source, hostId } = useLocalSearchParams<{ startId: string; source?: string; hostId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});
  const [showProducts, setShowProducts] = useState(false);

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

  useEffect(() => {
    if (!activeId || messagesCache[activeId]) return;
    apiClient<ApiResponse<LiveSession>>(`/sessions/${activeId}`)
      .then((res) => {
        setMessagesCache((prev) => ({
          ...prev,
          [activeId]: res.data.messages || [],
        }));
      })
      .catch(() => {});
  }, [activeId]);

  function renderReel({ item }: { item: LiveSession }) {
    const isActive = item.id === activeId;
    const isOwn = item.hostId === user?.id;
    const isFollowed = followedIds.has(item.hostId);
    const isLoadingFollow = followingId === item.hostId;
    const messages = messagesCache[item.id] || [];
    const products = item.sessionProducts?.map(sp => sp.product) || [];

    return (
      <View style={styles.reel}>
        <Video
          source={{ uri: item.recordingUrl! }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive}
          isLooping
          useNativeControls={false}
        />

        <View style={[styles.overlay, { paddingBottom: insets.bottom + 20 }]}>
          {messages.length > 0 && (
            <ScrollView
              style={styles.commentsContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {messages.slice(0, 30).reverse().map((msg) => (
                <View key={msg.id} style={styles.commentRow}>
                  {msg.type === "reaction" ? (
                    <Text style={styles.reactionText}>
                      <Text style={styles.commentName}>{msg.user?.name || "User"}</Text> sent {msg.content}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.commentName}>{msg.user?.name || "User"}</Text>
                      <Text style={styles.commentText}>{msg.content}</Text>
                    </>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.infoRow}>
            <TouchableOpacity
              style={styles.hostInfo}
              onPress={() => router.push(`/user/${item.hostId}`)}
              activeOpacity={0.8}
            >
              <ImageWithFallback
                uri={item.host?.avatarUrl}
                style={styles.avatar}
                fallback={
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.host?.name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                }
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.hostName}>{item.host?.name || "Unknown"}</Text>
                <Text style={styles.reelTitle} numberOfLines={2}>{item.title}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.sideButtons}>
              {products.length > 0 && (
                <TouchableOpacity
                  style={styles.productToggleBtn}
                  onPress={() => setShowProducts(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cube-outline" size={24} color="#fff" />
                  <Text style={styles.productCountBadge}>{products.length}</Text>
                </TouchableOpacity>
              )}
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
      </View>
    );
  }

  const activeSessionData = sessions.find(s => s.id === activeId);
  const activeProducts = activeSessionData?.sessionProducts?.map(sp => sp.product) || [];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetHeading}>Products ({activeProducts.length})</Text>
              <TouchableOpacity onPress={() => setShowProducts(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.productsSheetScroll}
              contentContainerStyle={styles.productsSheetContent}
              showsVerticalScrollIndicator={false}
            >
              {activeProducts.map((p) => (
                <View key={p.id} style={styles.productCard}>
                  <ImageWithFallback
                    uri={p.imageUrl}
                    style={styles.productImage}
                    fallback={
                      <View style={styles.productPlaceholder}>
                        <Ionicons name="cube-outline" size={20} color={theme.textMuted} />
                      </View>
                    }
                  />
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitle}>{p.title}</Text>
                    <Text style={styles.productPrice}>₹{p.price.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity style={styles.viewProductBtn}>
                    <Text style={styles.viewProductText}>View</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  reel: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hostInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  hostName: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  reelTitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  followBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  followBtnActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  followBtnText: { fontSize: 13, fontWeight: "700", color: "#000" },
  followBtnTextActive: { color: "#fff" },

  commentsContainer: {
    maxHeight: 180,
    marginBottom: 14,
  },
  commentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  commentName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#60a5fa",
    marginRight: 6,
  },
  commentText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    flexShrink: 1,
  },
  reactionText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontStyle: "italic",
  },
  sideButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  productToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  productCountBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: theme.accent,
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    textAlign: "center",
    lineHeight: 18,
    overflow: "hidden",
  },

  bottomSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bottomSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.4)",
  },
  bottomSheetCard: {
    maxHeight: "75%",
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.border,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  bottomSheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.border,
    marginBottom: 14,
  },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  bottomSheetHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
  },
  productsSheetScroll: {
    maxHeight: "100%",
  },
  productsSheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surfaceAlt,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  productPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: theme.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
    marginLeft: 14,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.text,
  },
  productPrice: {
    fontSize: 14,
    color: theme.accent,
    fontWeight: "700",
    marginTop: 2,
  },
  viewProductBtn: {
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  viewProductText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.text,
  },
});
