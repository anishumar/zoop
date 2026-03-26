import { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  Dimensions,
  Platform,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Image,
  Animated,
} from "react-native";

import { useRouter, useFocusEffect, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../src/contexts/AuthContext";
import { apiClient } from "../../src/api/client";
import { Product, User, ApiResponse, LiveSession } from "../../src/types";
import { AppTheme, useAppTheme } from "../../src/theme";
import { uploadProductImage, uploadReelVideo } from "../../src/api/uploads";

import ImageWithFallback from "../../src/components/ImageWithFallback";
import ProfileMenuBottomSheet from "../../src/components/ProfileMenuBottomSheet";
import CreateMenuBottomSheet from "../../src/components/CreateMenuBottomSheet";

interface ProductListResponse {
  products: Product[];
  total: number;
}

type ProfileTab = "streams" | "products";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PADDING = 16;
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

const PRODUCT_SIZE_OPTIONS = ["S", "M", "L", "XL", "Free Size"] as const;

export default function ProfileScreen() {
  const { user, loading, logout, setUser } = useAuth();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeTab, setActiveTab] = useState<ProfileTab>("streams");
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [streams, setStreams] = useState<LiveSession[]>([]);
  const [fetchingStreams, setFetchingStreams] = useState(false);
  const [actionStream, setActionStream] = useState<LiveSession | null>(null);
  const [deletingStreamId, setDeletingStreamId] = useState<string | null>(null);

  const pagerRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const tabIndicatorX = scrollX.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [0, SCREEN_WIDTH / 2],
    extrapolate: "clamp",
  });



  // Product CRUD state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [actionProduct, setActionProduct] = useState<Product | null>(null);
  const [prodTitle, setProdTitle] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodQuantity, setProdQuantity] = useState("1");
  const [prodSizes, setProdSizes] = useState<string[]>([]);
  const [prodImage, setProdImage] = useState<{
    uri: string;
    mimeType: string;
    fileSize: number;
    width?: number;
    height?: number;
  } | null>(null);
  const [prodSaving, setProdSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reel creation state
  const [showReelForm, setShowReelForm] = useState(false);
  const [reelTitle, setReelTitle] = useState("");
  const [reelDescription, setReelDescription] = useState("");
  const [reelVideo, setReelVideo] = useState<{ uri: string; mimeType: string; fileSize: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Go Live state
  const [showGoLive, setShowGoLive] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [creating, setCreating] = useState(false);



  // ─── Data Fetching ──────────────────────────────────

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient<ApiResponse<ProductListResponse>>("/products");
      setProducts(res.data.products);
    } catch (err: any) {
      console.error("Failed to fetch products:", err.message);
    }
  }, [user]);

  const fetchFollowCounts = useCallback(async () => {
    if (!user) return;
    try {
      const [followersRes, followingRes] = await Promise.all([
        apiClient<ApiResponse<{ users: { id: string }[]; total: number }>>("/users/followers"),
        apiClient<ApiResponse<{ users: { id: string }[]; total: number }>>("/users/following"),
      ]);
      setFollowerCount(followersRes.data.total);
      setFollowingCount(followingRes.data.total);
    } catch {
      // silently fail
    }
  }, [user]);

  const fetchStreams = useCallback(async () => {
    if (!user) return;
    setFetchingStreams(true);
    try {
      const res = await apiClient<ApiResponse<{ sessions: LiveSession[] }>>(
        `/sessions/user/${user.id}/archived`
      );
      setStreams(res.data.sessions);
    } catch (err: any) {
      console.error("Failed to fetch streams:", err.message);
    } finally {
      setFetchingStreams(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (loading || !user) return;
      fetchProducts();
      fetchFollowCounts();
      fetchStreams();
    }, [loading, user, fetchProducts, fetchFollowCounts, fetchStreams])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchProducts(), fetchFollowCounts(), fetchStreams()]);
    setRefreshing(false);
  }

  function scrollToPage(index: number) {
    pagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setActiveTab(index === 0 ? "streams" : "products");
  }

  function handlePageChange(e: any) {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveTab(page === 0 ? "streams" : "products");
  }



  // ─── Product CRUD Handlers ──────────────────────────

  function resetProductForm() {
    setShowProductForm(false);
    setEditingProduct(null);
    setProdTitle("");
    setProdDescription("");
    setProdPrice("");
    setProdQuantity("1");
    setProdSizes([]);
    setProdImage(null);
  }

  function openCreateProductModal() {
    resetProductForm();
    setShowProductForm(true);
  }

  function openEditProductModal(product: Product) {
    setEditingProduct(product);
    setProdTitle(product.title);
    setProdDescription(product.description || "");
    setProdPrice(String(product.price));
    setProdQuantity(String(product.quantity));
    setProdSizes(product.sizes ?? []);
    setProdImage(null);
    setShowProductForm(true);
  }

  async function handleSubmitProduct() {
    if (!prodTitle.trim() || !prodPrice.trim() || !prodQuantity.trim()) {
      Alert.alert("Error", "Title, price and quantity are required"); return;
    }
    const priceNum = parseFloat(prodPrice);
    if (isNaN(priceNum) || priceNum <= 0) { Alert.alert("Error", "Enter a valid price"); return; }
    const quantityNum = parseInt(prodQuantity, 10);
    if (!Number.isInteger(quantityNum) || quantityNum < 0) { Alert.alert("Error", "Enter a valid quantity"); return; }
    if (prodSizes.length === 0) { Alert.alert("Error", "Select at least one size"); return; }

    setProdSaving(true);
    try {
      const productRes = editingProduct
        ? await apiClient<ApiResponse<Product>>(`/products/${editingProduct.id}`, {
          method: "PUT",
          body: { title: prodTitle.trim(), description: prodDescription.trim() || undefined, price: priceNum, quantity: quantityNum, sizes: prodSizes },
        })
        : await apiClient<ApiResponse<Product>>("/products", {
          method: "POST",
          body: { title: prodTitle.trim(), description: prodDescription.trim() || undefined, price: priceNum, quantity: quantityNum, sizes: prodSizes },
        });

      if (prodImage) {
        const uploaded = await uploadProductImage(prodImage);
        await apiClient(`/products/${productRes.data.id}/image`, {
          method: "PATCH",
          body: {
            ...uploaded,
            imageMimeType: prodImage.mimeType,
            imageSize: prodImage.fileSize,
            imageWidth: prodImage.width,
            imageHeight: prodImage.height,
          },
        });
      }

      resetProductForm();
      fetchProducts();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setProdSaving(false);
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

  function toggleSize(size: string) {

    setProdSizes((c) => c.includes(size) ? c.filter((s) => s !== size) : [...c, size]);
  }

  function handlePickProductImage() {
    if (Platform.OS === "web") { pickProdFromGallery(); return; }
    Alert.alert("Add Product Image", "Choose image source", [
      { text: "Camera", onPress: () => void pickProdFromCamera() },
      { text: "Gallery", onPress: () => void pickProdFromGallery() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function pickProdFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission denied"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets.length) {
      const a = result.assets[0];
      setProdImage({ uri: a.uri, mimeType: a.mimeType || "image/jpeg", fileSize: a.fileSize || 0, width: a.width, height: a.height });
    }
  }

  async function pickProdFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission denied"); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets.length) {
      const a = result.assets[0];
      setProdImage({ uri: a.uri, mimeType: a.mimeType || "image/jpeg", fileSize: a.fileSize || 0, width: a.width, height: a.height });
    }
  }

  async function handleDeleteStream(id: string) {
    try {
      setDeletingStreamId(id);
      await apiClient(`/sessions/${id}`, { method: "DELETE" });
      setStreams((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setDeletingStreamId(null);
    }
  }

  async function handleDeleteSelectedStream() {
    if (!actionStream) return;
    const id = actionStream.id;
    setActionStream(null);
    await handleDeleteStream(id);
  }

  async function handleDeleteProduct(id: string) {
    try {
      setDeletingId(id);
      await apiClient(`/products/${id}`, { method: "DELETE" });
      fetchProducts();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function handleProductOptions(product: Product) {
    if (deletingId || prodSaving) return;
    setActionProduct(product);
  }

  function handleEditSelectedProduct() {
    if (!actionProduct) return;
    const p = actionProduct;
    setActionProduct(null);
    openEditProductModal(p);
  }

  async function handleDeleteSelectedProduct() {
    if (!actionProduct) return;
    const id = actionProduct.id;
    setActionProduct(null);
    await handleDeleteProduct(id);
  }

  const resetReelForm = useCallback(() => {
    setReelTitle("");
    setReelDescription("");
    setReelVideo(null);
    setShowReelForm(false);
  }, []);

  const handlePickReel = useCallback(async (source: "camera" | "gallery") => {
    const permission = source === "camera" 
      ? await ImagePicker.requestCameraPermissionsAsync() 
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", `Please allow access to your ${source === "camera" ? "camera" : "gallery"} to create a reel.`);
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["videos"],
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    };

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setReelVideo({
        uri: asset.uri,
        mimeType: asset.mimeType || "video/mp4",
        fileSize: asset.fileSize || 0,
      });
      setShowReelForm(true);
    }
  }, []);

  const handlePostReel = useCallback(async () => {
    if (!reelTitle.trim() || !reelVideo) {
      Alert.alert("Error", "Title and video are required");
      return;
    }

    setUploading(true);
    try {
      const { videoUrl } = await uploadReelVideo(reelVideo);
      await apiClient("/sessions/reel", {
        method: "POST",
        body: {
          title: reelTitle.trim(),
          description: reelDescription.trim() || undefined,
          recordingUrl: videoUrl,
        },
      });

      Alert.alert("Success", "Your reel has been posted!");
      resetReelForm();
      handleRefresh();
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Something went wrong");
    } finally {
      setUploading(false);
    }
  }, [reelTitle, reelDescription, reelVideo, resetReelForm, handleRefresh]);





  // ─── Render Helpers ─────────────────────────────────

  function renderProfileHeader() {
    return (
      <View style={styles.headerSection}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{products.length}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streams.length}</Text>
            <Text style={styles.statLabel}>Streams</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
      </View>
    );
  }

  function renderProductCard({ item, index }: { item: Product; index: number }) {
    return (
      <TouchableOpacity
        style={[styles.gridCard, deletingId === item.id && { opacity: 0.5 }]}
        activeOpacity={0.8}
        onLongPress={() => {
          Alert.alert("Delete Product", `Are you sure you want to delete "${item.title}"?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => void handleDeleteProduct(item.id) },
          ]);
        }}
        onPress={() => handleProductOptions(item)}
      >
        <View style={styles.gridImageWrapper}>
          <ImageWithFallback
            uri={item.imageUrl}
            style={styles.gridImage}
            fallback={
              <View style={styles.gridImagePlaceholder}>
                <Ionicons name="cube-outline" size={32} color={theme.textMuted} />
              </View>
            }
          />
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

  function renderStreamCard({ item }: { item: LiveSession }) {
    return (
      <TouchableOpacity
        style={[styles.streamCard, deletingStreamId === item.id && { opacity: 0.5 }]}
        onPress={() => {
          if (item.isLive) {
            router.push(`/viewer/${item.id}`);
          } else {
            router.push(`/reels?startId=${item.id}&source=profile&hostId=${user?.id}`);
          }
        }}

        onLongPress={() => setActionStream(item)}
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
          {item.description && (
            <View style={styles.reelBadge}>
              <Ionicons name="film-outline" size={10} color="#fff" />
              <Text style={styles.reelBadgeText}>REEL</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderStreamsEmpty() {
    return (
      <View style={styles.emptyContent}>
        <Ionicons name="videocam-off-outline" size={56} color={theme.textMuted} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>No past streams</Text>
        <Text style={styles.emptySubtitle}>Your past live streams will appear here</Text>
      </View>
    );
  }

  function renderProductsEmpty() {
    return (
      <View style={styles.emptyContent}>
        <Ionicons name="cube-outline" size={56} color={theme.textMuted} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>No products yet</Text>
        <Text style={styles.emptySubtitle}>Tap + Product to add your first product</Text>
      </View>
    );
  }

  // ─── Modals ─────────────────────────────────────────

  const modals = (
    <>
      <Stack.Screen
        options={{
          headerTitle: "",
          headerLeft: () => (
            <TouchableOpacity style={[styles.navAvatar, { marginLeft: 16 }]} onPress={() => setShowMenu(true)}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={{ width: 34, height: 34, borderRadius: 17 }} />
              ) : (
                <Text style={styles.navAvatarText}>{user?.name?.charAt(0).toUpperCase() || "?"}</Text>
              )}
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRightRow}>
              <TouchableOpacity
                style={[styles.headerPill, { marginRight: 16 }]}
                onPress={() => {
                  if (activeTab === "products") {
                    openCreateProductModal();
                  } else {
                    setShowCreateMenu(true);
                  }
                }}
              >
                <Ionicons name="add" size={18} color={theme.textOnAccent} />
                <Text style={styles.headerPillText}>{activeTab === "products" ? "Product" : "Create"}</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ProfileMenuBottomSheet visible={showMenu} onClose={() => setShowMenu(false)} />
      <CreateMenuBottomSheet 
        visible={showCreateMenu} 
        onClose={() => setShowCreateMenu(false)} 
        onAction={(action) => {
          if (action === "go_live") setShowGoLive(true);
          if (action === "create_reel") {
            Alert.alert("Create Reel", "Choose video source", [
              { text: "Camera", onPress: () => void handlePickReel("camera") },
              { text: "Gallery", onPress: () => void handlePickReel("gallery") },
              { text: "Cancel", style: "cancel" },
            ]);
          }
        }}
      />



      {/* Product Create/Edit Modal */}
      <Modal visible={showProductForm} transparent animationType="slide" onRequestClose={resetProductForm}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={resetProductForm} />
            <View style={[styles.formSheet, { maxHeight: "88%" }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={resetProductForm}>
                  <Text style={styles.modalHeaderLeft}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>{editingProduct ? "Edit Product" : "New Product"}</Text>
                <TouchableOpacity onPress={handleSubmitProduct} disabled={prodSaving}>
                  <Text style={[styles.headerActionText, prodSaving && { opacity: 0.5 }]}>
                    {prodSaving ? "..." : (editingProduct ? "Update" : "Create")}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.formScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Name</Text>
                <TextInput style={styles.input} placeholder="Enter product name" placeholderTextColor="#64748b" value={prodTitle} onChangeText={setProdTitle} />
                
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput 
                  style={[styles.input, { minHeight: 80, textAlignVertical: "top", paddingTop: 16 }]} 
                  placeholder="Tell buyers about this product..." 
                  placeholderTextColor="#64748b"
                  value={prodDescription} 
                  onChangeText={setProdDescription} 
                  multiline 
                />

                <Text style={styles.label}>Price (₹)</Text>
                <TextInput style={styles.input} placeholder="₹0" placeholderTextColor="#64748b" value={prodPrice} onChangeText={setProdPrice} keyboardType="decimal-pad" />

                <Text style={styles.label}>Quantity</Text>
                <TextInput style={styles.input} placeholder="0" placeholderTextColor="#64748b" value={prodQuantity} onChangeText={setProdQuantity} keyboardType="number-pad" />

                <Text style={styles.label}>Sizes</Text>
                <View style={styles.sizeOptions}>
                  {PRODUCT_SIZE_OPTIONS.map((size) => {
                    const sel = prodSizes.includes(size);
                    return (
                      <TouchableOpacity key={size} style={[styles.sizeChip, sel && styles.sizeChipSelected]} onPress={() => toggleSize(size)}>
                        <Text style={[styles.sizeChipText, sel && styles.sizeChipTextSelected]}>{size}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Product Image</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickProductImage}>
                  <Text style={styles.imagePickerBtnText}>
                    {prodImage ? "Change Image" : Platform.OS === "web" ? "Choose from Gallery" : "Camera or Gallery"}
                  </Text>
                </TouchableOpacity>
                {prodImage && (
                  <View style={styles.imagePreviewWrap}>
                    <Image source={{ uri: prodImage.uri }} style={styles.imagePreview} />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setProdImage(null)}>
                      <Text style={styles.removeImageText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Go Live Modal */}
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
            <View style={styles.formSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowGoLive(false)}>
                  <Text style={styles.modalHeaderLeft}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>Start Live Session</Text>
                <TouchableOpacity onPress={handleGoLive} disabled={creating}>
                  <Text style={[styles.headerActionText, creating && { opacity: 0.5 }]}>
                    {creating ? "..." : "Go Live"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Session title..."
                  placeholderTextColor="#64748b"
                  value={sessionTitle}
                  onChangeText={setSessionTitle}
                  autoFocus={Platform.OS === "web"}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reel Metadata Modal */}
      <Modal visible={showReelForm} transparent animationType="slide" onRequestClose={resetReelForm}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={resetReelForm} />
            <View style={[styles.formSheet, { maxHeight: "80%" }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={resetReelForm}>
                  <Text style={styles.modalHeaderLeft}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>New Reel</Text>
                <TouchableOpacity onPress={handlePostReel} disabled={uploading}>
                  {uploading ? (
                    <ActivityIndicator color={theme.accent} size="small" />
                  ) : (
                    <Text style={styles.headerActionText}>Post</Text>
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.formScrollContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Title</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Enter a catchy title..." 
                  placeholderTextColor="#64748b"
                  value={reelTitle}
                  onChangeText={setReelTitle}
                />

                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput 
                  style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]} 
                  placeholder="What's this reel about?" 
                  placeholderTextColor="#64748b"
                  value={reelDescription}
                  onChangeText={setReelDescription}
                  multiline
                />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Stream Action Modal (Delete) */}

      <Modal visible={Boolean(actionStream)} transparent animationType="fade" onRequestClose={() => setActionStream(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setActionStream(null)} />
          <View style={styles.menuSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setActionStream(null)}>
                <Text style={styles.modalHeaderLeft}>Cancel</Text>
              </TouchableOpacity>
              <View style={styles.modalHeaderRight}>
                <TouchableOpacity
                  onPress={() => void handleDeleteSelectedStream()}
                  disabled={Boolean(actionStream && deletingStreamId === actionStream.id)}
                >
                  {actionStream && deletingStreamId === actionStream.id ? (
                    <ActivityIndicator size="small" color={theme.danger} />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color={theme.danger} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {actionStream && (
              <View style={styles.actionSummary}>
                <View style={{ width: "100%", height: 180, borderRadius: 12, backgroundColor: theme.surfaceAlt, overflow: "hidden", marginBottom: 16 }}>
                  {actionStream.thumbnailUrl ? (
                    <Image source={{ uri: actionStream.thumbnailUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                      <Ionicons name="videocam-outline" size={48} color={theme.textMuted} />
                    </View>
                  )}
                </View>
                <Text style={[styles.actionName, { fontSize: 18 }]} numberOfLines={2}>{actionStream.title}</Text>
                <Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>
                  {actionStream.endedAt ? new Date(actionStream.endedAt).toLocaleDateString() : "Recently Recorded"}
                </Text>

                <TouchableOpacity 
                  style={{ marginTop: 24, backgroundColor: theme.accent, padding: 16, borderRadius: 12, alignItems: "center" }}
                  onPress={() => {
                    router.push(`/reels?startId=${actionStream.id}&hostId=${user?.id}&source=profile`);
                    setActionStream(null);
                  }}
                >
                  <Text style={{ color: theme.textOnAccent, fontWeight: "800", fontSize: 16 }}>Play Recording</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Product Action Modal (Edit / Delete) */}
      <Modal visible={Boolean(actionProduct)} transparent animationType="fade" onRequestClose={() => setActionProduct(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setActionProduct(null)} />
          <View style={styles.menuSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setActionProduct(null)}>
                <Text style={styles.modalHeaderLeft}>Cancel</Text>
              </TouchableOpacity>
              <View style={styles.modalHeaderRight}>
                <TouchableOpacity onPress={handleEditSelectedProduct}>
                  <Text style={styles.headerEditText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {actionProduct && (
              <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
                {/* Image Card */}
                <View style={{ width: "100%", height: 320, borderRadius: 16, backgroundColor: theme.surfaceAlt, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: theme.border }}>
                  <ImageWithFallback 
                    uri={actionProduct.imageUrl} 
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                    fallback={<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><Ionicons name="cube-outline" size={48} color={theme.textMuted} /></View>}
                  />
                </View>

                {/* Info Text (Without background card) */}
                <Text style={{ fontSize: 24, fontWeight: "800", color: theme.text }} numberOfLines={2}>{actionProduct.title}</Text>
                <Text style={{ fontSize: 20, color: theme.accent, fontWeight: "700", marginTop: 8 }}>₹{actionProduct.price.toFixed(2)}</Text>
                
                <View style={{ flexDirection: "row", gap: 24, marginTop: 20 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: theme.textMuted, marginBottom: 4, fontWeight: "600", textTransform: "uppercase" }}>Stock</Text>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text }}>{actionProduct.quantity} items left</Text>
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={{ fontSize: 13, color: theme.textMuted, marginBottom: 4, fontWeight: "600", textTransform: "uppercase" }}>Dimensions / Sizes</Text>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: theme.text }} numberOfLines={1}>{actionProduct.sizes?.join(", ") || "One Size"}</Text>
                  </View>
                </View>
                
                {actionProduct.description && (
                  <View style={{ marginTop: 20 }}>
                     <Text style={{ fontSize: 13, color: theme.textMuted, marginBottom: 6, fontWeight: "600", textTransform: "uppercase" }}>Description</Text>
                     <Text style={{ fontSize: 15, color: theme.text, lineHeight: 22 }}>{actionProduct.description}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>


    </>
  );

  // ─── Main Render ─────────────────────────────────────

  return (
    <View style={styles.container}>
      {modals}
      {renderProfileHeader()}

      {/* Segmented Control */}
      <View style={styles.segmentedWrapper}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity style={styles.segmentTab} onPress={() => scrollToPage(0)} activeOpacity={0.8}>
            <Ionicons name="videocam-outline" size={15} color={activeTab === "streams" ? theme.text : theme.textMuted} style={styles.segmentIcon} />
            <Text style={[styles.segmentText, activeTab === "streams" && styles.segmentTextActive]}>Streams</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.segmentTab} onPress={() => scrollToPage(1)} activeOpacity={0.8}>
            <Ionicons name="cube-outline" size={15} color={activeTab === "products" ? theme.text : theme.textMuted} style={styles.segmentIcon} />
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
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: Platform.OS !== "web" })}

        onMomentumScrollEnd={handlePageChange}
        style={{ flex: 1 }}
      >
        <View style={{ width: SCREEN_WIDTH }}>
          <FlatList
            data={streams}
            keyExtractor={(item) => item.id}
            renderItem={renderStreamCard}
            numColumns={2}
            contentContainerStyle={styles.gridList}
            columnWrapperStyle={styles.gridRow}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
            ListEmptyComponent={fetchingStreams ? <ActivityIndicator style={{ marginTop: 40 }} /> : renderStreamsEmpty}
          />
        </View>
        <View style={{ width: SCREEN_WIDTH }}>
          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            renderItem={renderProductCard}
            numColumns={2}
            contentContainerStyle={styles.gridList}
            columnWrapperStyle={styles.gridRow}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
            ListEmptyComponent={renderProductsEmpty}
          />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    // Header Right
    headerRightRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerPill: {
      flexDirection: "row", alignItems: "center", backgroundColor: theme.accent,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4,
    },
    headerPillText: { color: theme.textOnAccent, fontWeight: "700", fontSize: 14 },

    // Nav Avatar
    navAvatar: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: theme.accent,
      justifyContent: "center", alignItems: "center", marginRight: 16,
    },
    navAvatarText: { fontSize: 15, fontWeight: "800", color: theme.textOnAccent },

    // Profile Header
    headerSection: { alignItems: "center", paddingTop: 12, paddingBottom: 8 },

    // Stats Row
    statsRow: {
      flexDirection: "row", alignItems: "center", marginTop: 4, backgroundColor: theme.surface,
      borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: theme.border,
    },
    statItem: { alignItems: "center", flex: 1 },
    statValue: { fontSize: 20, fontWeight: "800", color: theme.text },
    statLabel: { fontSize: 12, color: theme.textMuted, marginTop: 2, fontWeight: "500" },
    statDivider: { width: 1, height: 28, backgroundColor: theme.border },

    // Segmented Control
    segmentedWrapper: { width: "100%", marginTop: 20 },
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
    segmentIcon: { marginRight: 6 },
    segmentText: { fontSize: 15, fontWeight: "600", color: theme.textMuted },
    segmentTextActive: { color: theme.text, fontWeight: "700" },

    // Modal overlay
    // Go Live Modal Styles
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

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },


    // Menu Sheet
    menuSheet: {
      backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 40 : 24,
      borderWidth: 1, borderBottomWidth: 0, borderColor: theme.border,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20 },
        android: { elevation: 24 },
      }),
    },
    menuHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: theme.border, marginBottom: 16 },
    menuHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingBottom: 16 },
    menuAvatar: {
      width: 52, height: 52, borderRadius: 26, backgroundColor: theme.accent,
      justifyContent: "center", alignItems: "center",
    },
    menuAvatarText: { fontSize: 22, fontWeight: "800", color: theme.textOnAccent },
    menuHeaderInfo: { marginLeft: 14, flex: 1 },
    menuHeaderName: { fontSize: 18, fontWeight: "700", color: theme.text },
    menuHeaderEmail: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
    menuDivider: { height: 1, backgroundColor: theme.border, marginHorizontal: 24, marginVertical: 4 },
    menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 24 },
    menuItemIcon: { width: 28 },
    menuItemLabel: { flex: 1, fontSize: 16, fontWeight: "600", color: theme.text, marginLeft: 8 },
    menuItemLabelDanger: { color: theme.danger },

    // Edit Field Modal
    editModalTitle: { fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 16, paddingHorizontal: 24 },
    editInput: {
      backgroundColor: theme.background, borderRadius: 12, padding: 16, fontSize: 16,
      color: theme.text, borderWidth: 1, borderColor: theme.border, marginHorizontal: 24, minHeight: 50,
    },
    editButtons: { flexDirection: "row", marginTop: 20, paddingHorizontal: 24, gap: 12 },
    editCancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: theme.surfaceAlt, alignItems: "center" },
    editSaveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: theme.accent, alignItems: "center" },

    // Product Form Modal
    formSheet: {
      backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 40 : 24,
      borderWidth: 1, borderBottomWidth: 0, borderColor: theme.border,
    },
    formScrollContent: { paddingHorizontal: 24, paddingBottom: 8 },
    formTitle: { fontSize: 22, fontWeight: "700", color: theme.text, marginBottom: 12, marginTop: 8 },
    formButtons: { flexDirection: "row", marginTop: 24, gap: 12 },
    label: { fontSize: 14, fontWeight: "600", color: theme.textMuted, marginBottom: 6, marginTop: 14 },
    input: {
      backgroundColor: theme.background, borderRadius: 12, padding: 16, fontSize: 16,
      color: theme.text, borderWidth: 1, borderColor: theme.border,
    },
    sizeOptions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
    sizeChip: {
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
      backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border,
    },
    sizeChipSelected: { backgroundColor: theme.accent, borderColor: theme.accent },
    sizeChipText: { color: theme.text, fontWeight: "600", fontSize: 13 },
    sizeChipTextSelected: { color: theme.textOnAccent },
    imagePickerBtn: { marginTop: 10, backgroundColor: theme.surfaceAlt, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
    imagePickerBtnText: { color: theme.text, fontWeight: "600", fontSize: 14 },
    imagePreviewWrap: {
      marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: theme.background, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.border,
    },
    imagePreview: { width: 54, height: 54, borderRadius: 10 },
    removeImageBtn: { backgroundColor: "#7f1d1d", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    removeImageText: { color: "#fecaca", fontWeight: "700", fontSize: 12 },

    // Action Modal
    actionSummary: {
      backgroundColor: theme.background, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: theme.border, marginHorizontal: 24, marginBottom: 18,
    },
    actionName: { fontSize: 18, fontWeight: "700", color: theme.text },
    actionPrice: { fontSize: 15, color: theme.textMuted, fontWeight: "700", marginTop: 6 },
    actionMeta: { fontSize: 13, color: theme.textMuted, marginTop: 4 },
    actionButtons: { gap: 12, paddingHorizontal: 24 },
    actionPrimaryBtn: {
      backgroundColor: theme.surfaceAlt, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    },
    actionPrimaryText: { color: theme.text, fontWeight: "700", fontSize: 16 },
    actionDeleteBtn: { backgroundColor: "#7f1d1d" },
    actionDeleteText: { color: "#fecaca", fontWeight: "700", fontSize: 16 },
    actionCancelBtn: {
      marginTop: 14, paddingVertical: 14, borderRadius: 12,
      backgroundColor: theme.surfaceAlt, alignItems: "center", marginHorizontal: 24,
    },

    // Common text
    cancelText: { color: theme.textMuted, fontWeight: "600", fontSize: 16 },
    createText: { color: theme.textOnAccent, fontWeight: "700", fontSize: 16 },

    // Grid
    gridList: { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 100 },
    gridRow: { justifyContent: "space-between", marginBottom: GRID_GAP },
    gridCard: { 
      width: CARD_WIDTH, 
      backgroundColor: theme.surface, 
      borderRadius: 16, 
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
      // Subtle shadow for depth
      ...(Platform.OS === "ios"
        ? { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 }
        : { elevation: 2 }),
    },
    gridImageWrapper: { width: "100%", aspectRatio: 1, backgroundColor: theme.surfaceAlt },
    gridImage: { width: "100%", height: "100%" },
    gridImagePlaceholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
    gridCardInfo: { padding: 12 },
    gridCardTitle: { fontSize: 14, fontWeight: "600", color: theme.text, marginBottom: 4 },
    gridCardPrice: { fontSize: 15, fontWeight: "800", color: theme.accent },
    gridCardMeta: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
    gridCardMetaText: { fontSize: 12, color: theme.textMuted, fontWeight: "500" },

    // Empty States
    emptyContent: { alignItems: "center", paddingTop: 48, paddingHorizontal: 32 },
    emptyIcon: { marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.text },
    emptySubtitle: { fontSize: 14, color: theme.textMuted, marginTop: 4, textAlign: "center" },

    // Saving Overlay
    savingOverlay: {
      ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center", alignItems: "center", zIndex: 999,
    },
    savingText: { color: "#fff", fontSize: 16, fontWeight: "600", marginTop: 12 },
    
    // Stream List
    streamCard: {
      width: CARD_WIDTH,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.surfaceAlt,
    },
    streamThumbnail: {
      width: "100%",
      aspectRatio: 1, // Change to 1 for consistency with products
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
      bottom: 8,
      right: 8,
      backgroundColor: "rgba(0,0,0,0.6)",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      gap: 4,
      zIndex: 2,
    },
    reelBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "800",
    },

    // Modal Header
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 20,
    },
    modalHeaderTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.text,
    },
    modalHeaderLeft: {
      fontSize: 16,
      color: theme.text,
      fontWeight: "500",
    },
    modalHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    headerDeleteText: {
      color: theme.danger,
      fontWeight: "600",
      fontSize: 16,
    },
    headerEditText: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 16,
    },
    headerActionText: {
      color: theme.accent,
      fontWeight: "700",
      fontSize: 16,
    },
  });
