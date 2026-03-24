import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../src/api/client";
import { Product, ApiResponse } from "../src/types";
import { AppTheme, useAppTheme } from "../src/theme";
import ImageWithFallback from "../src/components/ImageWithFallback";
import { SafeAreaView } from "react-native-safe-area-context";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PADDING = 16;
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

export default function WishlistScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();

  const fetchWishlist = useCallback(async () => {
    try {
      const res = await apiClient<ApiResponse<{ products: Product[] }>>("/wishlist");
      setProducts(res.data.products);
    } catch (err) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchWishlist();
    }, [fetchWishlist])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await fetchWishlist();
    setRefreshing(false);
  }

  async function removeFromWishlist(productId: string) {
    try {
      setProducts(prev => prev.filter(p => p.id !== productId));
      await apiClient(`/wishlist/${productId}/toggle`, { method: "POST" });
    } catch (err) {
      fetchWishlist(); // Revert on failure
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridList}
        columnWrapperStyle={styles.gridRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Ionicons name="heart-outline" size={56} color={theme.textMuted} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Wishlist is empty</Text>
            <Text style={styles.emptySubtitle}>Products you ♥️ during streams will appear here</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.gridCard} activeOpacity={0.8}>
            <TouchableOpacity 
              style={styles.removeBtn}
              onPress={() => removeFromWishlist(item.id)}
            >
              <Ionicons name="heart" size={20} color="#ef4444" />
            </TouchableOpacity>
            <View style={styles.gridImageWrapper}>
              <ImageWithFallback
                uri={item.imageUrl}
                style={styles.gridImage}
                fallback={<View style={styles.gridImagePlaceholder}><Ionicons name="cube-outline" size={32} color={theme.textMuted} /></View>}
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
        )}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: theme.border,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: theme.text },

  gridList: { paddingHorizontal: GRID_PADDING, paddingTop: 16, paddingBottom: 100 },
  gridRow: { justifyContent: "space-between", marginBottom: GRID_GAP },
  gridCard: { width: CARD_WIDTH, backgroundColor: theme.surface, borderRadius: 14, overflow: "hidden", position: "relative" },
  gridImageWrapper: { width: "100%", height: CARD_WIDTH, backgroundColor: theme.surfaceAlt },
  gridImage: { width: "100%", height: "100%" },
  gridImagePlaceholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  gridCardInfo: { padding: 10 },
  gridCardTitle: { fontSize: 14, fontWeight: "600", color: theme.text },
  gridCardPrice: { fontSize: 15, fontWeight: "800", color: theme.accent, marginTop: 3 },
  gridCardMeta: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  gridCardMetaText: { fontSize: 11, color: theme.textMuted, fontWeight: "500" },

  removeBtn: { position: "absolute", top: 8, right: 8, zIndex: 10, padding: 6, backgroundColor: theme.surfaceAlt, borderRadius: 16 },

  emptyContent: { alignItems: "center", paddingTop: 100, paddingHorizontal: 32 },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.text },
  emptySubtitle: { fontSize: 14, color: theme.textMuted, marginTop: 4, textAlign: "center" },
});
