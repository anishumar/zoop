import { useState, useCallback, useMemo } from "react";
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
} from "react-native";
import { useFocusEffect, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../src/contexts/AuthContext";
import { apiClient } from "../../src/api/client";
import { Product, User, ApiResponse } from "../../src/types";
import { AppTheme, useAppTheme } from "../../src/theme";
import { uploadAvatarImage } from "../../src/api/uploads";
import ImageWithFallback from "../../src/components/ImageWithFallback";

interface ProductListResponse {
  products: Product[];
  total: number;
}

type ProfileTab = "streams" | "products";

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PADDING = 16;
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuth();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeTab, setActiveTab] = useState<ProfileTab>("streams");
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Edit modal state
  type EditField = "name" | "bio" | "phone" | null;
  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await apiClient<ApiResponse<ProductListResponse>>("/products");
      setProducts(res.data.products);
    } catch (err: any) {
      console.error("Failed to fetch products:", err.message);
    }
  }, []);

  const fetchFollowCounts = useCallback(async () => {
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
      fetchFollowCounts();
    }, [fetchProducts, fetchFollowCounts])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchProducts(), fetchFollowCounts()]);
    setRefreshing(false);
  }

  function handleMenuAction(action: string) {
    setShowMenu(false);
    // small delay so menu closes before opening new modal
    setTimeout(() => {
      switch (action) {
        case "edit_name":
          setEditValue(user?.name || "");
          setEditField("name");
          break;
        case "about":
          setEditValue(user?.bio || "");
          setEditField("bio");
          break;
        case "phone":
          setEditValue(user?.phone || "");
          setEditField("phone");
          break;
        case "profile_picture":
          handlePickAvatar();
          break;
        case "wishlist":
          Alert.alert("Wishlist", "Coming soon!");
          break;
        case "signout":
          logout();
          break;
      }
    }, 300);
  }

  async function handleSaveField() {
    if (!editField) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      body[editField] = editValue;
      const res = await apiClient<ApiResponse<User>>("/users/profile", {
        method: "PATCH",
        body,
      });
      setUser(res.data);
      setEditField(null);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePickAvatar() {
    if (Platform.OS === "web") {
      pickFromGallery();
      return;
    }
    Alert.alert("Profile Picture", "Choose image source", [
      { text: "Camera", onPress: () => void pickFromCamera() },
      { text: "Gallery", onPress: () => void pickFromGallery() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission denied", "Please allow gallery access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length) {
      await uploadAvatar(result.assets[0]);
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission denied", "Please allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length) {
      await uploadAvatar(result.assets[0]);
    }
  }

  async function uploadAvatar(asset: ImagePicker.ImagePickerAsset) {
    try {
      setSaving(true);
      const uploaded = await uploadAvatarImage({
        uri: asset.uri,
        mimeType: asset.mimeType || "image/jpeg",
        fileSize: asset.fileSize || 0,
      });
      const res = await apiClient<ApiResponse<User>>("/users/avatar", {
        method: "PATCH",
        body: uploaded,
      });
      setUser(res.data);
      Alert.alert("Success", "Profile picture updated!");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to upload avatar");
    } finally {
      setSaving(false);
    }
  }

  const editFieldLabels: Record<string, string> = {
    name: "Edit Name",
    bio: "Edit About",
    phone: "Phone Number",
  };

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
            <Text style={styles.statValue}>0</Text>
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

        {/* Segmented Control */}
        <View style={styles.segmentedWrapper}>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[styles.segmentTab, activeTab === "streams" && styles.segmentTabActive]}
              onPress={() => setActiveTab("streams")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="videocam-outline"
                size={16}
                color={activeTab === "streams" ? theme.text : theme.textMuted}
                style={styles.segmentIcon}
              />
              <Text style={[styles.segmentText, activeTab === "streams" && styles.segmentTextActive]}>Streams</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentTab, activeTab === "products" && styles.segmentTabActive]}
              onPress={() => setActiveTab("products")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="cube-outline"
                size={16}
                color={activeTab === "products" ? theme.text : theme.textMuted}
                style={styles.segmentIcon}
              />
              <Text style={[styles.segmentText, activeTab === "products" && styles.segmentTextActive]}>Products</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  function renderProductCard({ item, index }: { item: Product; index: number }) {
    const isLeft = index % 2 === 0;
    return (
      <View style={[styles.gridCard, isLeft ? styles.gridCardLeft : styles.gridCardRight]}>
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
              <Text style={styles.gridCardMetaText} numberOfLines={1}>
                {item.sizes.join(", ")}
              </Text>
            )}
          </View>
        </View>
      </View>
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
        <Text style={styles.emptySubtitle}>Add products from the Products tab to see them here</Text>
      </View>
    );
  }

  const menuItems: MenuItem[] = [
    { icon: "create-outline", label: "Edit Name", onPress: () => handleMenuAction("edit_name") },
    { icon: "camera-outline", label: "Profile Picture", onPress: () => handleMenuAction("profile_picture") },
    { icon: "information-circle-outline", label: "About", onPress: () => handleMenuAction("about") },
    { icon: "call-outline", label: "Phone Number", onPress: () => handleMenuAction("phone") },
    { icon: "heart-outline", label: "My Wishlist", onPress: () => handleMenuAction("wishlist") },
    { icon: "log-out-outline", label: "Sign Out", onPress: () => handleMenuAction("signout"), danger: true },
  ];

  const listContent = (
    <>
      <Stack.Screen
        options={{
          title: user?.name || "Profile",
          headerRight: () => (
            <View style={styles.headerRightRow}>
              <TouchableOpacity
                style={styles.headerPill}
                onPress={() => {
                  if (activeTab === "streams") {
                    Alert.alert("Create Stream", "Coming soon!");
                  } else {
                    // Navigate to Products tab — or show create product modal
                    Alert.alert("Add Product", "Go to the Products tab to add a product.");
                  }
                }}
              >
                <Ionicons name="add" size={18} color={theme.textOnAccent} />
                <Text style={styles.headerPillText}>
                  {activeTab === "streams" ? "Create" : "Product"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navAvatar} onPress={() => setShowMenu(true)}>
                <Text style={styles.navAvatarText}>{user?.name?.charAt(0).toUpperCase() || "?"}</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Menu Modal */}
      <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          />
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />

            {/* Menu header with avatar */}
            <View style={styles.menuHeader}>
              <View style={styles.menuAvatar}>
                <Text style={styles.menuAvatarText}>{user?.name?.charAt(0).toUpperCase() || "?"}</Text>
              </View>
              <View style={styles.menuHeaderInfo}>
                <Text style={styles.menuHeaderName}>{user?.name}</Text>
                <Text style={styles.menuHeaderEmail}>{user?.email}</Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            {/* Menu items */}
            {menuItems.map((item, index) => (
              <View key={item.label}>
                {item.danger && <View style={styles.menuDivider} />}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={item.danger ? theme.danger : theme.text}
                    style={styles.menuItemIcon}
                  />
                  <Text style={[styles.menuItemLabel, item.danger && styles.menuItemLabelDanger]}>
                    {item.label}
                  </Text>
                  {!item.danger && (
                    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      {/* Edit Field Modal */}
      <Modal
        visible={editField !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditField(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <View style={styles.menuOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setEditField(null)}
            />
            <View style={[styles.menuSheet, { paddingBottom: Platform.OS === "ios" ? 40 : 24 }]}>
              <View style={styles.menuHandle} />
              <Text style={styles.editModalTitle}>
                {editField ? editFieldLabels[editField] : ""}
              </Text>
              <TextInput
                style={[
                  styles.editInput,
                  editField === "bio" && { minHeight: 100, textAlignVertical: "top" },
                ]}
                value={editValue}
                onChangeText={setEditValue}
                placeholder={
                  editField === "name"
                    ? "Your name"
                    : editField === "bio"
                    ? "Tell people about yourself"
                    : "Phone number"
                }
                placeholderTextColor={theme.textMuted}
                autoFocus
                multiline={editField === "bio"}
                numberOfLines={editField === "bio" ? 4 : 1}
                keyboardType={editField === "phone" ? "phone-pad" : "default"}
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={styles.editCancelBtn}
                  onPress={() => setEditField(null)}
                >
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editSaveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSaveField}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={theme.textOnAccent} />
                  ) : (
                    <Text style={styles.editSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Saving overlay */}
      {saving && !editField && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.savingText}>Uploading...</Text>
        </View>
      )}
    </>
  );

  if (activeTab === "products") {
    return (
      <View style={styles.container}>
        {listContent}
        <FlatList
          key="products-grid"
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProductCard}
          numColumns={2}
          ListHeaderComponent={renderProfileHeader}
          contentContainerStyle={styles.gridList}
          columnWrapperStyle={styles.gridRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
          ListEmptyComponent={renderProductsEmpty}
        />
      </View>
    );
  }

  // Streams tab — for now just an empty placeholder
  return (
    <View style={styles.container}>
      {listContent}
      <FlatList
        key="streams-list"
        data={[]}
        keyExtractor={() => "empty"}
        renderItem={() => null}
        ListHeaderComponent={renderProfileHeader}
        contentContainerStyle={styles.gridList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
        ListEmptyComponent={renderStreamsEmpty}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    // --- Header Right ---
    headerRightRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 4,
    },
    headerPillText: {
      color: theme.textOnAccent,
      fontWeight: "700",
      fontSize: 14,
    },

    // --- Nav Avatar ---
    navAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.accent,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    navAvatarText: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.textOnAccent,
    },

    // --- Header / Profile Info ---
    headerSection: {
      alignItems: "center",
      paddingTop: 12,
      paddingBottom: 8,
    },

    // --- Stats Row ---
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      backgroundColor: theme.surface,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    statItem: {
      alignItems: "center",
      flex: 1,
    },
    statValue: { fontSize: 20, fontWeight: "800", color: theme.text },
    statLabel: { fontSize: 12, color: theme.textMuted, marginTop: 2, fontWeight: "500" },
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: theme.border,
    },

    // --- Segmented Control ---
    segmentedWrapper: {
      width: "100%",
      paddingHorizontal: 16,
      marginTop: 24,
      marginBottom: 4,
    },
    segmentedControl: {
      flexDirection: "row",
      backgroundColor: theme.surfaceAlt,
      borderRadius: 12,
      padding: 3,
    },
    segmentTab: {
      flex: 1,
      flexDirection: "row",
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
    segmentIcon: {
      marginRight: 6,
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

    // --- Menu Modal ---
    menuOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    menuSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 10,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
        },
        android: { elevation: 24 },
      }),
    },
    menuHandle: {
      alignSelf: "center",
      width: 42,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginBottom: 16,
    },
    menuHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingBottom: 16,
    },
    menuAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    menuAvatarText: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.textOnAccent,
    },
    menuHeaderInfo: {
      marginLeft: 14,
      flex: 1,
    },
    menuHeaderName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    menuHeaderEmail: {
      fontSize: 13,
      color: theme.textMuted,
      marginTop: 2,
    },
    menuDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginHorizontal: 24,
      marginVertical: 4,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 24,
    },
    menuItemIcon: {
      width: 28,
    },
    menuItemLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginLeft: 8,
    },
    menuItemLabelDanger: {
      color: theme.danger,
    },

    // --- Grid List ---
    gridList: {
      paddingHorizontal: GRID_PADDING,
      paddingBottom: 100,
    },
    gridRow: {
      justifyContent: "space-between",
      marginBottom: GRID_GAP,
    },
    gridCard: {
      width: CARD_WIDTH,
      backgroundColor: theme.surface,
      borderRadius: 14,
      overflow: "hidden",
    },
    gridCardLeft: {},
    gridCardRight: {},
    gridImageWrapper: {
      width: "100%",
      height: CARD_WIDTH,
      backgroundColor: theme.surfaceAlt,
    },
    gridImage: {
      width: "100%",
      height: "100%",
    },
    gridImagePlaceholder: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    gridCardInfo: {
      padding: 10,
    },
    gridCardTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    gridCardPrice: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.accent,
      marginTop: 3,
    },
    gridCardMeta: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
      flexWrap: "wrap",
    },
    gridCardMetaText: {
      fontSize: 11,
      color: theme.textMuted,
      fontWeight: "500",
    },

    // --- Empty States ---
    emptyContent: {
      alignItems: "center",
      paddingTop: 48,
      paddingHorizontal: 32,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textMuted,
      marginTop: 4,
      textAlign: "center",
    },

    // --- Edit Modal ---
    editModalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 16,
      paddingHorizontal: 24,
    },
    editInput: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      marginHorizontal: 24,
      minHeight: 50,
    },
    editButtons: {
      flexDirection: "row",
      marginTop: 20,
      paddingHorizontal: 24,
      gap: 12,
    },
    editCancelBtn: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
    },
    editCancelText: {
      color: theme.textMuted,
      fontWeight: "600",
      fontSize: 16,
    },
    editSaveBtn: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.accent,
      alignItems: "center",
    },
    editSaveText: {
      color: theme.textOnAccent,
      fontWeight: "700",
      fontSize: 16,
    },

    // --- Saving Overlay ---
    savingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 999,
    },
    savingText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
      marginTop: 12,
    },
  });
