import { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Dimensions,
  ScrollView,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient } from "../../src/api/client";
import { ApiResponse, LiveSession, Product } from "../../src/types";
import { AppTheme, useAppTheme } from "../../src/theme";
import { useAuth } from "../../src/contexts/AuthContext";

interface UserProfile {
  id: string;
  name: string;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  streamCount: number;
  isFollowing: boolean;
}

type Tab = "streams" | "products";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { user: me } = useAuth();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [streams, setStreams] = useState<LiveSession[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("streams");

  const pagerRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const tabIndicatorX = scrollX.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [0, SCREEN_WIDTH / 2],
    extrapolate: "clamp",
  });

  function scrollToPage(index: number) {
    pagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setActiveTab(index === 0 ? "streams" : "products");
  }

  function handlePageChange(e: any) {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveTab(page === 0 ? "streams" : "products");
  }

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [profileRes, streamsRes, productsRes] = await Promise.all([
        apiClient<ApiResponse<UserProfile>>(`/users/${id}/profile`),
        apiClient<ApiResponse<{ sessions: LiveSession[] }>>(`/sessions/user/${id}/archived`),
        apiClient<ApiResponse<{ products: Product[] }>>(`/products/user/${id}`),
      ]);
      setProfile(profileRes.data);
      setIsFollowing(profileRes.data.isFollowing);
      setStreams(streamsRes.data.sessions);
      setProducts(productsRes.data.products);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  async function handleFollowToggle() {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setProfile((p) => p ? { ...p, followerCount: p.followerCount + (wasFollowing ? -1 : 1) } : p);
    try {
      await apiClient(`/users/${profile.id}/${wasFollowing ? "unfollow" : "follow"}`, { method: "POST" });
    } catch (err: any) {
      setIsFollowing(wasFollowing);
      setProfile((p) => p ? { ...p, followerCount: p.followerCount + (wasFollowing ? 1 : -1) } : p);
      Alert.alert("Error", err.message);
    } finally {
      setFollowLoading(false);
    }
  }

  function renderStreamCard({ item }: { item: LiveSession }) {
    return (
      <TouchableOpacity
        style={styles.gridCard}
        onPress={() => router.push(`/viewer/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.streamThumbnail}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="videocam-outline" size={28} color={theme.textMuted} />
            </View>
          )}
          <View style={styles.playOverlay}>
            <Ionicons name="play" size={16} color="#fff" />
          </View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardSub}>
            {item.endedAt ? new Date(item.endedAt).toLocaleDateString() : "Recorded"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderProductCard({ item }: { item: Product }) {
    return (
      <View style={styles.gridCard}>
        <View style={styles.productThumbnail}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="cube-outline" size={28} color={theme.textMuted} />
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardPrice}>₹{item.price.toFixed(2)}</Text>
          <Text style={styles.cardSub}>Qty: {item.quantity}</Text>
        </View>
      </View>
    );
  }

  function renderHeader() {
    if (!profile) return null;
    const isOwnProfile = me?.id === profile.id;
    return (
      <View>
        {/* Profile Info */}
        <View style={styles.profileHeader}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{profile.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <Text style={styles.userName}>{profile.name}</Text>
          {profile.bio ? <Text style={styles.userBio}>{profile.bio}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{streams.length}</Text>
              <Text style={styles.statLabel}>Streams</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          {!isOwnProfile && (
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followBtnActive]}
              onPress={handleFollowToggle}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? theme.textMuted : theme.textOnAccent} />
              ) : (
                <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

      </View>
    );
  }

  function renderEmpty() {
    if (activeTab === "streams") {
      return (
        <View style={styles.emptyContent}>
          <Ionicons name="videocam-off-outline" size={48} color={theme.textMuted} />
          <Text style={styles.emptyText}>No past streams</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContent}>
        <Ionicons name="cube-outline" size={48} color={theme.textMuted} />
        <Text style={styles.emptyText}>No products listed</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Stack.Screen options={{ headerTitle: "Profile" }} />
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerTitle: profile?.name ?? "Profile" }} />
      {renderHeader()}

      {/* Segmented Control */}
      <View style={styles.segmentedWrapper}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity style={styles.segmentTab} onPress={() => scrollToPage(0)} activeOpacity={0.8}>
            <Ionicons name="videocam-outline" size={15} color={activeTab === "streams" ? theme.text : theme.textMuted} style={{ marginRight: 5 }} />
            <Text style={[styles.segmentText, activeTab === "streams" && styles.segmentTextActive]}>Streams</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.segmentTab} onPress={() => scrollToPage(1)} activeOpacity={0.8}>
            <Ionicons name="cube-outline" size={15} color={activeTab === "products" ? theme.text : theme.textMuted} style={{ marginRight: 5 }} />
            <Text style={[styles.segmentText, activeTab === "products" && styles.segmentTextActive]}>Products</Text>
          </TouchableOpacity>
        </View>
        <Animated.View style={[styles.tabIndicator, { transform: [{ translateX: tabIndicatorX }] }]} />
        <View style={styles.tabDivider} />
      </View>

      <Animated.ScrollView
        ref={pagerRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={handlePageChange}
        style={{ flex: 1 }}
      >
        <View style={{ width: SCREEN_WIDTH }}>
          <FlatList
            data={streams}
            keyExtractor={(item) => item.id}
            renderItem={renderStreamCard}
            numColumns={2}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            columnWrapperStyle={styles.gridRow}
            ListEmptyComponent={renderEmpty}
          />
        </View>
        <View style={{ width: SCREEN_WIDTH }}>
          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            renderItem={renderProductCard}
            numColumns={2}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            columnWrapperStyle={styles.gridRow}
            ListEmptyComponent={renderEmpty}
          />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    list: { paddingTop: 8 },
    gridRow: { paddingHorizontal: 16, gap: 12, marginBottom: 12 },

    // Profile header
    profileHeader: { alignItems: "center", paddingTop: 28, paddingHorizontal: 24, paddingBottom: 4 },
    avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 12 },
    avatarPlaceholder: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.accent,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    avatarInitial: { fontSize: 36, fontWeight: "800", color: theme.textOnAccent },
    userName: { fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 4 },
    userBio: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: "center",
      paddingHorizontal: 16,
      marginBottom: 4,
      lineHeight: 20,
    },

    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 18,
      width: "100%",
    },
    statItem: { flex: 1, alignItems: "center" },
    statValue: { fontSize: 20, fontWeight: "800", color: theme.text },
    statLabel: { fontSize: 12, color: theme.textMuted, marginTop: 2, fontWeight: "500" },
    statDivider: { width: 1, height: 32, backgroundColor: theme.border },

    followBtn: {
      paddingHorizontal: 48,
      paddingVertical: 11,
      borderRadius: 24,
      backgroundColor: theme.accent,
      marginBottom: 8,
      minWidth: 160,
      alignItems: "center",
    },
    followBtnActive: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: theme.border,
    },
    followBtnText: { fontSize: 15, fontWeight: "700", color: theme.textOnAccent },
    followBtnTextActive: { color: theme.textMuted },

    // Segmented control
    segmentedWrapper: { marginTop: 16 },
    segmentedControl: { flexDirection: "row" },
    segmentTab: { flex: 1, flexDirection: "row", paddingVertical: 13, alignItems: "center", justifyContent: "center" },
    segmentTabActive: {},
    tabIndicator: {
      height: 2.5,
      width: SCREEN_WIDTH / 2,
      backgroundColor: theme.accent,
      borderRadius: 1.5,
    },
    tabDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginTop: -StyleSheet.hairlineWidth },
    segmentText: { fontSize: 15, fontWeight: "600", color: theme.textMuted },
    segmentTextActive: { color: theme.text, fontWeight: "700" },

    // Shared grid card
    gridCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      overflow: "hidden",
    },

    // Stream thumbnail (portrait)
    streamThumbnail: {
      aspectRatio: 9 / 16,
      backgroundColor: theme.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
    },

    // Product thumbnail (square)
    productThumbnail: {
      aspectRatio: 1,
      backgroundColor: theme.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
    },

    thumbnailPlaceholder: { justifyContent: "center", alignItems: "center", flex: 1 },
    playOverlay: {
      position: "absolute",
      bottom: 8,
      right: 8,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 14,
      padding: 5,
    },

    cardInfo: { padding: 8 },
    cardTitle: { fontSize: 13, fontWeight: "600", color: theme.text },
    cardSub: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
    cardPrice: { fontSize: 13, fontWeight: "700", color: theme.accent, marginTop: 2 },

    emptyContent: { alignItems: "center", paddingTop: 48, gap: 12 },
    emptyText: { fontSize: 15, color: theme.textMuted },
  });
