import { useState, useCallback } from "react";
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
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { apiClient } from "../../src/api/client";
import { Product, ApiResponse } from "../../src/types";
import { uploadProductImage } from "../../src/api/uploads";

interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    if (!title.trim() || !price.trim()) {
      Alert.alert("Error", "Title and price are required");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Error", "Enter a valid price");
      return;
    }

    setCreating(true);
    try {
      const createRes = await apiClient<ApiResponse<Product>>("/products", {
        method: "POST",
        body: { title: title.trim(), price: priceNum },
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
      setSelectedImage(null);
      fetchProducts();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setCreating(false);
    }
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
    const deleteProduct = async () => {
      try {
        setDeletingId(id);
        await apiClient(`/products/${id}`, { method: "DELETE" });
        fetchProducts();
      } catch (err: any) {
        Alert.alert("Error", err.message);
      } finally {
        setDeletingId(null);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to delete this product?");
      if (confirmed) {
        await deleteProduct();
      }
      return;
    }

    Alert.alert("Delete Product", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: deleteProduct },
    ]);
  }

  function renderProduct({ item }: { item: Product }) {
    return (
      <View style={styles.productCard}>
        <View style={styles.productIcon}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
          ) : (
            <Text style={styles.productEmoji}>📦</Text>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.deleteButton, deletingId === item.id && { opacity: 0.6 }]}
          onPress={() => handleDelete(item.id)}
          disabled={deletingId === item.id}
        >
          <Text style={styles.deleteText}>{deletingId === item.id ? "…" : "✕"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No products yet</Text>
            <Text style={styles.emptySubtitle}>Add products to showcase in live sessions</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setShowCreate(true)}>
        <Text style={styles.addButtonText}>+ Add Product</Text>
      </TouchableOpacity>

      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Product</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter product name"
              placeholderTextColor="#64748b"
              value={title}
              onChangeText={setTitle}
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
                onPress={() => { setShowCreate(false); setTitle(""); setPrice(""); setSelectedImage(null); }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                <Text style={styles.createText}>{creating ? "Adding..." : "Add Product"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  list: { padding: 16, paddingBottom: 100 },
  productCard: {
    backgroundColor: "#1e293b",
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
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  productEmoji: { fontSize: 24 },
  productImage: { width: 48, height: 48, borderRadius: 12 },
  productInfo: { flex: 1, marginLeft: 14 },
  productTitle: { fontSize: 16, fontWeight: "600", color: "#f8fafc" },
  productPrice: { fontSize: 15, color: "#22c55e", fontWeight: "700", marginTop: 2 },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: { color: "#ef4444", fontSize: 16, fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 100 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#f8fafc" },
  emptySubtitle: { fontSize: 15, color: "#94a3b8", marginTop: 4, textAlign: "center" },
  addButton: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: "#6366f1",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 22, fontWeight: "700", color: "#f8fafc", marginBottom: 12 },
  label: { fontSize: 14, fontWeight: "600", color: "#cbd5e1", marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#f8fafc",
    borderWidth: 1,
    borderColor: "#334155",
  },
  imagePickerBtn: {
    marginTop: 10,
    backgroundColor: "#334155",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  imagePickerBtnText: { color: "#f8fafc", fontWeight: "600", fontSize: 14 },
  imagePreviewWrap: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#334155",
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
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: "#334155", alignItems: "center" },
  cancelText: { color: "#94a3b8", fontWeight: "600", fontSize: 16 },
  createBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: "#6366f1", alignItems: "center" },
  createText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
