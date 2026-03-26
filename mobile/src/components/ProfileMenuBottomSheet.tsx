import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../api/client";
import { User, ApiResponse, Product } from "../types";
import { AppTheme, useAppTheme } from "../theme";
import { uploadAvatarImage } from "../api/uploads";
import ImageWithFallback from "./ImageWithFallback";

interface ProfileMenuBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileMenuBottomSheet({ visible, onClose }: ProfileMenuBottomSheetProps) {
  const router = useRouter();
  const { user, setUser, logout } = useAuth();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"menu" | "edit" | "wishlist">("menu");
  const [editField, setEditField] = useState<"name" | "bio" | "phone" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [loadingWishlist, setLoadingWishlist] = useState(false);

  const editFieldLabels: Record<string, string> = { name: "Edit Name", bio: "Edit About", phone: "Phone Number" };

  const menuItems = [
    { icon: "create-outline", label: "Edit Name", onPress: () => handleMenuAction("edit_name") },
    { icon: "camera-outline", label: "Profile Picture", onPress: () => handleMenuAction("profile_picture") },
    { icon: "information-circle-outline", label: "About", onPress: () => handleMenuAction("about") },
    { icon: "call-outline", label: "Phone Number", onPress: () => handleMenuAction("phone") },
    { icon: "heart-outline", label: "My Wishlist", onPress: () => handleMenuAction("wishlist") },
    { icon: "log-out-outline", label: "Sign Out", onPress: () => handleMenuAction("signout"), danger: true },
  ];

  async function fetchWishlist() {
    setLoadingWishlist(true);
    try {
      const res = await apiClient<ApiResponse<{ products: Product[] }>>("/wishlist");
      setWishlistProducts(res.data.products);
    } catch (err) {}
    setLoadingWishlist(false);
  }

  function handleMenuAction(action: string) {
    switch (action) {
      case "edit_name":
        setEditValue(user?.name || "");
        setEditField("name");
        setView("edit");
        break;
      case "about":
        setEditValue(user?.bio || "");
        setEditField("bio");
        setView("edit");
        break;
      case "phone":
        setEditValue(user?.phone || "");
        setEditField("phone");
        setView("edit");
        break;
      case "profile_picture":
        handlePickAvatar();
        break;
      case "wishlist":
        setView("wishlist");
        fetchWishlist();
        break;
      case "signout":
        onClose();
        setTimeout(() => logout(), 300);
        break;
    }
  }

  function handleBack() {
    setView("menu");
    setEditField(null);
  }

  async function removeFromWishlist(productId: string) {
    try {
      setWishlistProducts(prev => prev.filter(p => p.id !== productId));
      await apiClient(`/wishlist/${productId}/toggle`, { method: "POST" });
    } catch (err) {
      fetchWishlist();
    }
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
      handleBack();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePickAvatar() {
    if (Platform.OS === "web") { pickAvatarFromGallery(); return; }
    Alert.alert("Profile Picture", "Choose image source", [
      { text: "Camera", onPress: () => void pickAvatarFromCamera() },
      { text: "Gallery", onPress: () => void pickAvatarFromGallery() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function pickAvatarFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission denied", "Please allow gallery access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets.length) await uploadAvatar(result.assets[0]);
  }

  async function pickAvatarFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission denied", "Please allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets.length) await uploadAvatar(result.assets[0]);
  }

  async function uploadAvatar(asset: ImagePicker.ImagePickerAsset) {
    try {
      setSaving(true);
      const uploaded = await uploadAvatarImage({
        uri: asset.uri, mimeType: asset.mimeType || "image/jpeg", fileSize: asset.fileSize || 0,
      });
      const res = await apiClient<ApiResponse<User>>("/users/avatar", { method: "PATCH", body: uploaded });
      setUser(res.data);
      Alert.alert("Success", "Profile picture updated!");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to upload avatar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />

            {view === "menu" ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.menuHeader}>
                  <View style={styles.menuAvatar}>
                    {user?.avatarUrl ? (
                      <Image source={{ uri: user.avatarUrl }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                    ) : (
                      <Text style={styles.menuAvatarText}>{user?.name?.charAt(0).toUpperCase() || "?"}</Text>
                    )}
                  </View>
                  <View style={styles.menuHeaderInfo}>
                    <Text style={styles.menuHeaderName}>{user?.name}</Text>
                    <Text style={styles.menuHeaderEmail}>{user?.email}</Text>
                  </View>
                </View>
                <View style={styles.menuDivider} />
                {menuItems.map((item) => (
                  <View key={item.label}>
                    {item.danger && <View style={styles.menuDivider} />}
                    <TouchableOpacity style={styles.menuItem} onPress={item.onPress} activeOpacity={0.6}>
                      <Ionicons name={item.icon as any} size={22} color={item.danger ? theme.danger : theme.text} style={styles.menuItemIcon} />
                      <Text style={[styles.menuItemLabel, item.danger && styles.menuItemLabelDanger]}>{item.label}</Text>
                      {!item.danger && <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />}
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : view === "edit" ? (
              <View style={{ paddingBottom: 10 }}>
                <View style={[styles.menuHeader, { paddingHorizontal: 16, paddingBottom: 20 }]}>
                  <TouchableOpacity onPress={handleBack} style={{ padding: 4 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={[styles.menuHeaderName, { marginLeft: 16, fontSize: 20 }]}>
                    {editField ? editFieldLabels[editField] : ""}
                  </Text>
                </View>

                <TextInput
                  style={[styles.editInput, editField === "bio" && { minHeight: 120, textAlignVertical: "top" }]}
                  value={editValue}
                  onChangeText={setEditValue}
                  placeholder={editField === "name" ? "Your name" : editField === "bio" ? "Tell people about yourself" : "Phone number"}
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                  multiline={editField === "bio"}
                  numberOfLines={editField === "bio" ? 4 : 1}
                  keyboardType={editField === "phone" ? "phone-pad" : "default"}
                />

                <View style={[styles.editButtons, { marginTop: 24 }]}>
                  <TouchableOpacity style={[styles.editSaveBtn, { flex: 1 }, saving && { opacity: 0.6 }]} onPress={handleSaveField} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={theme.textOnAccent} /> : <Text style={styles.createText}>Save Changes</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={[styles.menuHeader, { paddingHorizontal: 16, paddingBottom: 10 }]}>
                  <TouchableOpacity onPress={handleBack} style={{ padding: 4 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={[styles.menuHeaderName, { marginLeft: 16, fontSize: 20 }]}>My Wishlist</Text>
                </View>

                {loadingWishlist ? (
                  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 50 }}>
                    <ActivityIndicator size="large" color={theme.accent} />
                  </View>
                ) : wishlistProducts.length === 0 ? (
                  <View style={{ alignItems: "center", paddingTop: 80, paddingHorizontal: 32 }}>
                    <Ionicons name="heart-outline" size={56} color={theme.textMuted} />
                    <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text, marginTop: 16 }}>Wishlist is empty</Text>
                    <Text style={{ fontSize: 14, color: theme.textMuted, marginTop: 4, textAlign: "center" }}>Products you ♥️ during streams will appear here</Text>
                  </View>
                ) : (
                  <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
                      {wishlistProducts.map(item => (
                        <View key={item.id} style={{ width: "48%", marginBottom: 16, backgroundColor: theme.surfaceAlt, borderRadius: 12, overflow: "hidden" }}>
                          <View style={{ width: "100%", height: 120 }}>
                            <ImageWithFallback uri={item.imageUrl} style={{ width: "100%", height: "100%" }} />
                            <TouchableOpacity 
                              style={{ position: "absolute", top: 6, right: 6, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 12, padding: 4 }}
                              onPress={() => removeFromWishlist(item.id)}
                            >
                              <Ionicons name="heart" size={16} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                          <View style={{ padding: 8 }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }} numberOfLines={1}>{item.title}</Text>
                            <Text style={{ fontSize: 14, fontWeight: "800", color: theme.accent, marginTop: 2 }}>₹{item.price}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.savingText}>Processing...</Text>
        </View>
      )}
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  menuSheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderWidth: 1, borderBottomWidth: 0, borderColor: theme.border,
    minHeight: 600,
    maxHeight: "92%",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 24 },
    }),
  },
  menuHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: theme.border, marginBottom: 16 },
  menuHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingBottom: 16 },
  menuAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.accent, justifyContent: "center", alignItems: "center" },
  menuAvatarText: { fontSize: 22, fontWeight: "800", color: theme.textOnAccent },
  menuHeaderInfo: { marginLeft: 14, flex: 1 },
  menuHeaderName: { fontSize: 18, fontWeight: "700", color: theme.text },
  menuHeaderEmail: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: theme.border, marginHorizontal: 24, marginVertical: 4 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 24 },
  menuItemIcon: { width: 28 },
  menuItemLabel: { flex: 1, fontSize: 16, fontWeight: "600", color: theme.text, marginLeft: 8 },
  menuItemLabelDanger: { color: theme.danger },

  editModalTitle: { fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 16, paddingHorizontal: 24 },
  editInput: { backgroundColor: theme.background, borderRadius: 12, padding: 16, fontSize: 16, color: theme.text, borderWidth: 1, borderColor: theme.border, marginHorizontal: 24, minHeight: 50 },
  editButtons: { flexDirection: "row", marginTop: 20, paddingHorizontal: 24, gap: 12 },
  editCancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: theme.surfaceAlt, alignItems: "center" },
  editSaveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: theme.accent, alignItems: "center" },

  cancelText: { color: theme.textMuted, fontWeight: "600", fontSize: 16 },
  createText: { color: theme.textOnAccent, fontWeight: "700", fontSize: 16 },

  savingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  savingText: { color: "#fff", fontSize: 16, fontWeight: "600", marginTop: 12 },
});
