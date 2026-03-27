import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../src/api/client";
import { AppTheme, useAppTheme } from "../../src/theme";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handleSend() {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      await apiClient("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });
      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: email.trim().toLowerCase() },
      });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.brand}>zoop</Text>
            <Text style={styles.title}>Forgot password?</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a 6-digit reset code.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSend}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Sending..." : "Send Reset Code"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.linkContainer}
            >
              <Text style={styles.linkText}>
                Remember your password?{" "}
                <Text style={styles.linkBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
    backBtn: { marginBottom: 24 },
    header: { marginBottom: 40 },
    brand: {
      fontSize: 42,
      fontWeight: "800",
      color: theme.accent,
      marginBottom: 8,
    },
    title: { fontSize: 28, fontWeight: "700", color: theme.text },
    subtitle: {
      fontSize: 15,
      color: theme.textMuted,
      marginTop: 8,
      lineHeight: 22,
    },
    form: {},
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textMuted,
      marginBottom: 6,
      marginTop: 16,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    button: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      marginTop: 28,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: theme.textOnAccent, fontSize: 16, fontWeight: "700" },
    linkContainer: { marginTop: 20, alignItems: "center" },
    linkText: { color: theme.textMuted, fontSize: 14 },
    linkBold: { color: theme.accent, fontWeight: "700" },
  });
