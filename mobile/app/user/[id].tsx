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
  Modal,
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
  productCount: number;
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistLoading, setWishlistLoading] = useState(false);




  const fetchWishlist = useCallback(async () => {
    try {
      const res = await apiClient<ApiResponse<{ products: Product[] }>>("/wishlist");
      setWishlistIds(new Set(res.data.products.map(p => p.id)));
    } catch (err) {}
  }, []);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [profileRes, streamsRes, productsRes] = await Promise.all([
        apiClient<ApiResponse<UserProfile>>(`/users/${id}/profile`),
        apiClient<ApiResponse<{ sessions: LiveSession[] }>>(`/sessions/user/${id}/archived`),
        apiClient<ApiResponse<{ products: Product[] }>>(`/products/user/${id}`),
        fetchWishlist(),
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
  }, [id, fetchWishlist]);

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

  async function toggleWishlist(productId: string) {
    if (wishlistLoading) return;
    const isAdding = !wishlistIds.has(productId);
    
    // Optimistic UI
    const newIds = new Set(wishlistIds);
    if (isAdding) newIds.add(productId);
    else newIds.delete(productId);
    setWishlistIds(newIds);

    try {
      await apiClient(`/wishlist/${productId}/toggle`, { method: "POST" });
    } catch (err: any) {
      // Revert on error
      const revertIds = new Set(wishlistIds);
      if (isAdding) revertIds.delete(productId);
      else revertIds.add(productId);
      setWishlistIds(revertIds);
      Alert.alert("Error", err.message);
    }
  }

  function renderStreamCard({ item }: { item: LiveSession }) {
    const isReel = Boolean(item.description);
    return (
      <TouchableOpacity
        style={styles.streamCard}
        onPress={() => router.push(`/reels?startId=${item.id}&hostId=${profile?.id}&source=profile`)}
        activeOpacity={0.7}
      >
        <View style={styles.streamThumbnail}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={styles.streamThumbnailImage} />
          ) : (
            <View style={styles.streamThumbnailPlaceholder}>
              <Ionicons name="videocam-outline" size={32} color={theme.textMuted} />
            </View>
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playIconCircle}>
              <Ionicons name="play" size={12} color="#fff" style={{ marginLeft: 1.5 }} />
            </View>
          </View>
          {isReel && (
            <View style={styles.reelBadge}>
              <Ionicons name="film-outline" size={10} color="#fff" />
              <Text style={styles.reelBadgeText}>REEL</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderProductCard({ item }: { item: Product }) {
    const isWishlisted = wishlistIds.has(item.id);
    return (
      <TouchableOpacity 
        style={styles.gridCard}
        activeOpacity={0.8}
        onPress={() => setSelectedProduct(item)}
      >
        <View style={styles.gridImageWrapper}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.gridImage} />
          ) : (
            <View style={styles.gridImagePlaceholder}>
              <Ionicons name="cube-outline" size={32} color={theme.textMuted} />
            </View>
          )}
          {isWishlisted && (
            <View style={styles.cardHeart}>
              <Ionicons name="heart" size={14} color="#ef4444" />
            </View>
          )}
        </View>
        <View style={styles.gridCardInfo}>
          <Text style={styles.gridCardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.gridCardPrice}>₹{item.price.toFixed(2)}</Text>
          <View style={styles.gridCardMeta}>
             <Text style={styles.gridCardMetaText}>Qty: {item.quantity}</Text>
             {item.sizes && item.sizes.length > 0 && (
                <Text style={styles.gridCardMetaText} numberOfLines={1}>{item.sizes.join(", ")}</Text>
             )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const renderProductModal = () => {
    if (!selectedProduct) return null;
    const isWishlisted = wishlistIds.has(selectedProduct.id);

    return (
      <Modal visible={!!selectedProduct} transparent animationType="fade" onRequestClose={() => setSelectedProduct(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedProduct(null)} />
          <View style={styles.productModalSheet}>
            <View style={styles.modalHeaderClose}>
              <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.modalCloseBtnTextWrapper}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
              <View style={styles.modalHandle} />
              <View style={{ width: 60 }} />
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.productModalImageContainer}>
                {selectedProduct.imageUrl ? (
                  <Image source={{ uri: selectedProduct.imageUrl }} style={styles.productModalImage} />
                ) : (
                  <View style={styles.productModalPlaceholder}>
                    <Ionicons name="cube-outline" size={64} color={theme.textMuted} />
                  </View>
                )}
              </View>

              <View style={styles.productModalInfo}>
                <View style={styles.productModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productModalTitle}>{selectedProduct.title}</Text>
                    <Text style={styles.productModalPrice}>₹{selectedProduct.price.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.wishlistToggle, isWishlisted && styles.wishlistToggleActive]}
                    onPress={() => toggleWishlist(selectedProduct.id)}
                  >
                    <Ionicons name={isWishlisted ? "heart" : "heart-outline"} size={24} color={isWishlisted ? "#ef4444" : theme.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalDivider} />
                
                <Text style={styles.sectionLabel}>Description</Text>
                <Text style={styles.productModalDesc}>
                  {selectedProduct.description || "No description available for this product."}
                </Text>

              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };


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
              <Text style={styles.statValue}>{profile.productCount}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
            <View style={styles.statDivider} />
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

  const headerOptions = useMemo(() => ({
    headerTitle: "",
    headerStyle: { 
      backgroundColor: theme.background,
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 0,
    },
    headerTintColor: theme.text,
    headerTitleStyle: { 
      fontWeight: "700" as const, 
      color: theme.text,
      fontSize: 18,
    },
    headerShadowVisible: false,
    headerBackTitleVisible: false,
    headerTitleAlign: "center" as const,
    headerLeft: () => (
      <TouchableOpacity 
        onPress={() => router.back()} 
        style={{ marginLeft: Platform.OS === "web" ? 16 : 0, padding: 4 }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={26} color={theme.text} />
      </TouchableOpacity>
    ),
  }), [theme, loading, profile, router]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Stack.Screen options={headerOptions} />
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />
      {renderProductModal()}
      
      <FlatList
        key={activeTab} 
        data={(activeTab === "streams" ? streams : products) as any}
        keyExtractor={(item) => item.id}
        renderItem={(activeTab === "streams" ? renderStreamCard : renderProductCard) as any}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <View>
            {renderHeader()}
            <View style={styles.segmentedWrapper}>
              <View style={styles.segmentedControl}>
                <TouchableOpacity 
                  style={styles.segmentTab} 
                  onPress={() => setActiveTab("streams")} 
                  activeOpacity={0.8}
                >
                  <Ionicons name="videocam-outline" size={15} color={activeTab === "streams" ? theme.text : theme.textMuted} style={{ marginRight: 5 }} />
                  <Text style={[styles.segmentText, activeTab === "streams" && styles.segmentTextActive]}>Streams</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.segmentTab} 
                  onPress={() => setActiveTab("products")} 
                  activeOpacity={0.8}
                >
                  <Ionicons name="cube-outline" size={15} color={activeTab === "products" ? theme.text : theme.textMuted} style={{ marginRight: 5 }} />
                  <Text style={[styles.segmentText, activeTab === "products" && styles.segmentTextActive]}>Products</Text>
                </TouchableOpacity>
              </View>
              <View style={[
                styles.tabIndicator, 
                { transform: [{ translateX: activeTab === "streams" ? 0 : SCREEN_WIDTH / 2 }] }
              ]} />
              <View style={styles.tabDivider} />
            </View>
          </View>
        }
        ListEmptyComponent={renderEmpty}
      />
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
    segmentedWrapper: { marginTop: 16, marginBottom: 12 },
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

    // Updated grid card (Products)
    gridCard: {
      width: (SCREEN_WIDTH - 32 - 12) / 2,
      backgroundColor: theme.surface,
      borderRadius: 14,
      overflow: "hidden",
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10 },
        android: { elevation: 3 },
      }),
    },
    gridImageWrapper: { width: "100%", height: (SCREEN_WIDTH - 32 - 12) / 2, backgroundColor: theme.surfaceAlt },
    gridImage: { width: "100%", height: "100%", resizeMode: "cover" },
    gridImagePlaceholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
    gridCardInfo: { padding: 12 },
    gridCardTitle: { fontSize: 14, fontWeight: "600", color: theme.text, marginBottom: 4 },
    gridCardPrice: { fontSize: 15, fontWeight: "800", color: theme.accent },
    gridCardMeta: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
    gridCardMetaText: { fontSize: 12, color: theme.textMuted, fontWeight: "500" },

    // Stream List
    streamCard: {
      width: (SCREEN_WIDTH - 32 - 12) / 2,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.surfaceAlt,
    },
    streamThumbnail: {
      width: "100%",
      aspectRatio: 1, // Matches products for cleaner grid
      backgroundColor: theme.surfaceAlt,
      position: "relative",
    },
    streamThumbnailImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    streamThumbnailPlaceholder: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    playOverlay: {
      position: "absolute",
      top: 8,
      left: 8,
      zIndex: 1,
    },
    playIconCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    reelBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(0,0,0,0.6)",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    reelBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

    emptyContent: { alignItems: "center", paddingTop: 48, gap: 12 },
    emptyText: { fontSize: 15, color: theme.textMuted },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    productModalSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      maxHeight: "90%",
      paddingTop: 12,
    },
    modalHandle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
    },
    modalHeaderClose: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    modalCloseBtnTextWrapper: {
      paddingVertical: 8,
      paddingHorizontal: 4,
      justifyContent: "center",
    },
    modalCloseText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.accent,
    },
    productModalImageContainer: {
      width: "100%",
      aspectRatio: 1,
      backgroundColor: theme.surfaceAlt,
    },
    productModalImage: { width: "100%", height: "100%", resizeMode: "cover" },
    productModalPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
    productModalInfo: { padding: 24, paddingBottom: 40 },
    productModalHeader: { flexDirection: "row", alignItems: "flex-start" },
    productModalTitle: { fontSize: 24, fontWeight: "800", color: theme.text, flex: 1 },
    productModalPrice: { fontSize: 20, fontWeight: "700", color: theme.accent, marginTop: 4 },
    wishlistToggle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 12,
    },
    wishlistToggleActive: {
      backgroundColor: "rgba(239, 68, 68, 0.1)",
    },
    modalDivider: { height: 1, backgroundColor: theme.border, marginVertical: 20 },
    sectionLabel: { fontSize: 13, fontWeight: "700", color: theme.textMuted, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 },
    productModalDesc: { fontSize: 16, lineHeight: 24, color: theme.text, opacity: 0.8, marginBottom: 32 },
    closeBtn: {
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: theme.accent,
      alignItems: "center",
    },
    closeBtnText: { color: theme.textOnAccent, fontWeight: "700", fontSize: 16 },
    cardHeart: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(255,255,255,0.9)",
      borderRadius: 10,
      padding: 4,
    },
  });
