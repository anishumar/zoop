import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/contexts/AuthContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={styles.container}>
          <Text style={styles.title}>Zoop Live Commerce</Text>
          <Text style={styles.subtitle}>Platform is ready</Text>
          <StatusBar style="auto" />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 16,
    marginTop: 8,
  },
});
