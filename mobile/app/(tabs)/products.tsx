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
  Image,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useFocusEffect, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../src/api/client";
import { Product, ApiResponse } from "../../src/types";
import { uploadProductImage } from "../../src/api/uploads";
import { AppTheme, useAppTheme } from "../../src/theme";
import ImageWithFallback from "../../src/components/ImageWithFallback";

interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}



const PRODUCT_SIZE_OPTIONS = ["S", "M", "L", "XL", "Free Size"] as const;

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [actionProduct, setActionProduct] = useState<Product | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    mimeType: string;
    fileSize: number;
    width?: number;
    height?: number;
  } | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await apiClient<ApiResponse<ProductListResponse>>("/products");
      setProducts(res.data.products);
    } catch (err: any) {
      console.error("Failed to fetch products:", err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }

  async function handleCreate() {
    if (!title.trim() || !price.trim() || !quantity.trim()) {
      Alert.alert("Error", "Title, price and quantity are required");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Error", "Enter a valid price");
      return;
    }
    const quantityNum = parseInt(quantity, 10);
    if (!Number.isInteger(quantityNum) || quantityNum < 0) {
      Alert.alert("Error", "Enter a valid quantity");
      return;
    }
    if (selectedSizes.length === 0) {
      Alert.alert("Error", "Select at least one size");
      return;
    }

    setCreating(true);
    try {
      const createRes = await apiClient<ApiResponse<Product>>("/products", {
        method: "POST",
        body: { title: title.trim(), price: priceNum, quantity: quantityNum, sizes: selectedSizes },
      });

      if (selectedImage) {
        const uploaded = await uploadProductImage(selectedImage);
        await apiClient(`/products/${createRes.data.id}/image`, {
          method: "PATCH",
          body: {
            ...uploaded,
            imageMimeType: selectedImage.mimeType,
            imageSize: selectedImage.fileSize,
            imageWidth: selectedImage.width,
            imageHeight: selectedImage.height,
          },
        });
      }

      setShowCreate(false);
      setTitle("");
      setPrice("");
      setQuantity("1");
      setSelectedSizes([]);
      setSelectedImage(null);
      fetchProducts();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setShowCreate(false);
    setEditingProduct(null);
    setTitle("");
    setPrice("");
    setQuantity("1");
    setSelectedSizes([]);
    setSelectedImage(null);
  }

  function openCreateModal() {
    setEditingProduct(null);
    setTitle("");
    setPrice("");
    setQuantity("1");
    setSelectedSizes([]);
    setSelectedImage(null);
    setShowCreate(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setTitle(product.title);
    setPrice(String(product.price));
    setQuantity(String(product.quantity));
    setSelectedSizes(product.sizes ?? []);
    setSelectedImage(null);
    setShowCreate(true);
  }

  async function handleSubmitProduct() {
    if (!title.trim() || !price.trim() || !quantity.trim()) {
      Alert.alert("Error", "Title, price and quantity are required");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Error", "Enter a valid price");
      return;
    }
    const quantityNum = parseInt(quantity, 10);
    if (!Number.isInteger(quantityNum) || quantityNum < 0) {
      Alert.alert("Error", "Enter a valid quantity");
      return;
    }
    if (selectedSizes.length === 0) {
      Alert.alert("Error", "Select at least one size");
      return;
    }

    setCreating(true);
    try {
      const productRes = editingProduct
        ? await apiClient<ApiResponse<Product>>(`/products/${editingProduct.id}`, {
          method: "PUT",
          body: { title: title.trim(), price: priceNum, quantity: quantityNum, sizes: selectedSizes },
        })
        : await apiClient<ApiResponse<Product>>("/products", {
          method: "POST",
          body: { title: title.trim(), price: priceNum, quantity: quantityNum, sizes: selectedSizes },
        });

      if (selectedImage) {
        const uploaded = await uploadProductImage(selectedImage);
        await apiClient(`/products/${productRes.data.id}/image`, {
          method: "PATCH",
          body: {
            ...uploaded,
            imageMimeType: selectedImage.mimeType,
            imageSize: selectedImage.fileSize,
            imageWidth: selectedImage.width,
            imageHeight: selectedImage.height,
          },
        });
      }

      resetForm();
      fetchProducts();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setCreating(false);
    }
  }

  function toggleSize(size: string) {
    setSelectedSizes((current) =>
      current.includes(size) ? current.filter((item) => item !== size) : [...current, size]
    );
  }

  async function openGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission denied", "Please allow gallery permission to add images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets.length) return;
    const asset = result.assets[0];
    setSelectedImage({
      uri: asset.uri,
      mimeType: asset.mimeType || "image/jpeg",
      fileSize: asset.fileSize || 0,
      width: asset.width,
      height: asset.height,
    });
  }

  async function openCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission denied", "Please allow camera permission to capture images.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets.length) return;
    const asset = result.assets[0];
    setSelectedImage({
      uri: asset.uri,
      mimeType: asset.mimeType || "image/jpeg",
      fileSize: asset.fileSize || 0,
      width: asset.width,
      height: asset.height,
    });
  }

  function handlePickImage() {
    if (Platform.OS === "web") {
      openGallery();
      return;
    }

    Alert.alert("Add Product Image", "Choose image source", [
      { text: "Camera", onPress: () => void openCamera() },
      { text: "Gallery", onPress: () => void openGallery() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleDelete(id: string) {
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
    if (deletingId || creating) return;
    setActionProduct(product);
  }

  function handleEditSelectedProduct() {
    if (!actionProduct) return;
    const product = actionProduct;
    setActionProduct(null);
    openEditModal(product);
  }

  async function handleDeleteSelectedProduct() {
    if (!actionProduct) return;
    const productId = actionProduct.id;
    setActionProduct(null);
    await handleDelete(productId);
  }



  function renderProduct({ item }: { item: Product }) {
    return (
      <View style={[styles.productCard, deletingId === item.id && { opacity: 0.6 }]}>
        <View style={styles.productIcon}>
          <ImageWithFallback
            uri={item.imageUrl}
            style={styles.productImage}
            fallback={
              <Ionicons
                name="cube-outline"
                size={24}
                color={theme.textMuted}
                style={styles.productEmoji}
              />
            }
          />
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.productPrice}>₹{item.price.toFixed(2)}</Text>
          <Text style={styles.productMeta}>Qty: {item.quantity}</Text>
          <Text style={styles.productMeta}>Sizes: {item.sizes?.join(", ") || "Not set"}</Text>
          {deletingId === item.id && <Text style={styles.productHint}>Deleting...</Text>}
        </View>
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={() => handleProductOptions(item)}
          disabled={deletingId === item.id}
        >
          <Ionicons name="ellipsis-horizontal-circle-outline" size={22} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity style={styles.headerPill} onPress={openCreateModal}>
              <Ionicons name="add" size={18} color={theme.textOnAccent} />
              <Text style={styles.headerPillText}>Product</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={56} color={theme.textMuted} style={styles.emptyEmoji} />
            <Text style={styles.emptyTitle}>No products yet</Text>
            <Text style={styles.emptySubtitle}>Add products to showcase in live sessions</Text>
          </View>
        }
      />

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={resetForm}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={resetForm}
            />
            <View style={[styles.modalContent, styles.formModalContent]}>
              <ScrollView
                contentContainerStyle={styles.formScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.modalTitle}>{editingProduct ? "Edit Product" : "New Product"}</Text>
                
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter product name"
                  placeholderTextColor="#64748b"
                  value={title}
                  onChangeText={setTitle}
                  autoFocus={Platform.OS === "web"}
                />
                
                <Text style={styles.label}>Price (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="₹0"
                  placeholderTextColor="#64748b"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>Sizes</Text>
                <View style={styles.sizeOptions}>
                  {PRODUCT_SIZE_OPTIONS.map((size) => {
                    const isSelected = selectedSizes.includes(size);
                    return (
                      <TouchableOpacity
                        key={size}
                        style={[styles.sizeChip, isSelected && styles.sizeChipSelected]}
                        onPress={() => toggleSize(size)}
                      >
                        <Text style={[styles.sizeChipText, isSelected && styles.sizeChipTextSelected]}>
                          {size}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Product Image</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage}>
                  <Text style={styles.imagePickerBtnText}>
                    {selectedImage ? "Change Image" : Platform.OS === "web" ? "Choose from Gallery" : "Camera or Gallery"}
                  </Text>
                </TouchableOpacity>
                {selectedImage && (
                  <View style={styles.imagePreviewWrap}>
                    <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
                      <Text style={styles.removeImageText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={resetForm}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.createBtn, creating && { opacity: 0.6 }]}
                    onPress={handleSubmitProduct}
                    disabled={creating}
                  >
                    <Text style={styles.createText}>
                      {creating ? (editingProduct ? "Saving..." : "Adding...") : editingProduct ? "Save Changes" : "Add Product"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={Boolean(actionProduct)}
        transparent
        animationType="slide"
        onRequestClose={() => setActionProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {actionProduct && (
              <View style={styles.actionSummary}>
                <Text style={styles.actionName} numberOfLines={1}>
                  {actionProduct.title}
                </Text>
                <Text style={styles.actionPrice}>₹{actionProduct.price.toFixed(2)}</Text>
                <Text style={styles.actionMeta}>Qty: {actionProduct.quantity}</Text>
                <Text style={styles.actionMeta}>
                  Sizes: {actionProduct.sizes?.join(", ") || "Not set"}
                </Text>
              </View>
            )}

            <View style={styles.actionButtons}>

              <TouchableOpacity style={styles.actionPrimaryBtn} onPress={handleEditSelectedProduct}>
                <Ionicons name="create-outline" size={18} color={theme.text} />
                <Text style={styles.actionPrimaryText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionPrimaryBtn,
                  styles.actionDeleteBtn,
                  actionProduct && deletingId === actionProduct.id && { opacity: 0.6 },
                ]}
                onPress={() => void handleDeleteSelectedProduct()}
                disabled={Boolean(actionProduct && deletingId === actionProduct.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#fecaca" />
                <Text style={styles.actionDeleteText}>
                  {actionProduct && deletingId === actionProduct.id ? "Deleting..." : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>



            <TouchableOpacity style={styles.actionCancelBtn} onPress={() => setActionProduct(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    list: { padding: 16, paddingBottom: 100 },
    productCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    productIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
    },
    productEmoji: {},
    productImage: { width: 48, height: 48, borderRadius: 12 },
    productInfo: { flex: 1, marginLeft: 14 },
    productTitle: { fontSize: 16, fontWeight: "600", color: theme.text },
    productPrice: { fontSize: 15, color: theme.textMuted, fontWeight: "700", marginTop: 2 },
    productMeta: { fontSize: 12, color: theme.textMuted, marginTop: 4 },
    productHint: { fontSize: 12, color: theme.textMuted, marginTop: 6 },
    optionsButton: {
      padding: 4,
      marginLeft: 8,
    },
    empty: { alignItems: "center", marginTop: 100 },
    emptyEmoji: { marginBottom: 16 },
    emptyTitle: { fontSize: 20, fontWeight: "700", color: theme.text },
    emptySubtitle: { fontSize: 15, color: theme.textMuted, marginTop: 4, textAlign: "center" },
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
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
    },
    formModalContent: {
      maxHeight: "88%",
    },
    formScrollContent: {
      paddingBottom: 8,
    },
    modalTitle: { fontSize: 22, fontWeight: "700", color: theme.text, marginBottom: 12 },
    actionSummary: {
      backgroundColor: theme.background,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 18,
    },
    actionName: { fontSize: 18, fontWeight: "700", color: theme.text },
    actionPrice: { fontSize: 15, color: theme.textMuted, fontWeight: "700", marginTop: 6 },
    actionMeta: { fontSize: 13, color: theme.textMuted, marginTop: 4 },
    actionButtons: { gap: 12 },
    actionPrimaryBtn: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    actionPrimaryText: { color: theme.text, fontWeight: "700", fontSize: 16 },
    actionDeleteBtn: { backgroundColor: "#7f1d1d" },
    actionDeleteText: { color: "#fecaca", fontWeight: "700", fontSize: 16 },
    actionCancelBtn: {
      marginTop: 14,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
    },
    label: { fontSize: 14, fontWeight: "600", color: theme.textMuted, marginBottom: 6, marginTop: 14 },
    input: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    imagePickerBtn: {
      marginTop: 10,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    imagePickerBtnText: { color: theme.text, fontWeight: "600", fontSize: 14 },
    sizeOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 10,
    },
    sizeChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sizeChipSelected: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    sizeChipText: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 13,
    },
    sizeChipTextSelected: {
      color: theme.textOnAccent,
    },
    imagePreviewWrap: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    imagePreview: { width: 54, height: 54, borderRadius: 10 },
    removeImageBtn: {
      backgroundColor: "#7f1d1d",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    removeImageText: { color: "#fecaca", fontWeight: "700", fontSize: 12 },
    modalButtons: { flexDirection: "row", marginTop: 24, gap: 12 },
    cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: theme.surfaceAlt, alignItems: "center" },
    cancelText: { color: theme.textMuted, fontWeight: "600", fontSize: 16 },
    createBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: theme.accent, alignItems: "center" },
    createText: { color: theme.textOnAccent, fontWeight: "700", fontSize: 16 },
  });
