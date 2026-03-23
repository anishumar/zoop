import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || "?"}</Text>
      </View>

      <Text style={styles.name}>{user?.name}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>User ID</Text>
          <Text style={styles.cardValue} numberOfLines={1}>{user?.id}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Joined</Text>
          <Text style={styles.cardValue}>
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", paddingTop: 40 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: { fontSize: 36, fontWeight: "800", color: "#fff" },
  name: { fontSize: 24, fontWeight: "700", color: "#f8fafc" },
  email: { fontSize: 15, color: "#94a3b8", marginTop: 4 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    marginTop: 32,
    marginHorizontal: 24,
    width: "85%",
    padding: 20,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  cardLabel: { fontSize: 14, color: "#94a3b8" },
  cardValue: { fontSize: 14, color: "#f8fafc", fontWeight: "500", maxWidth: "60%", textAlign: "right" },
  divider: { height: 1, backgroundColor: "#334155", marginVertical: 4 },
  logoutButton: {
    marginTop: 40,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  logoutText: { color: "#ef4444", fontSize: 16, fontWeight: "700" },
});
