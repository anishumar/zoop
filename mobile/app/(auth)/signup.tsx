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
import { useAuth } from "../../src/contexts/AuthContext";
import { AppTheme, useAppTheme } from "../../src/theme";

import { SafeAreaView } from "react-native-safe-area-context";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password);
    } catch (err: any) {
      Alert.alert("Signup Failed", err.message || "Something went wrong");
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brand}>zoop</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join the live commerce revolution</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#64748b"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Min 6 characters"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignup} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Creating account..." : "Create Account"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.linkContainer}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkBold}>Sign In</Text>
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
  header: { marginBottom: 40 },
  brand: { fontSize: 42, fontWeight: "800", color: theme.accent, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "700", color: theme.text },
  subtitle: { fontSize: 16, color: theme.textMuted, marginTop: 4 },
  form: {},
  label: { fontSize: 14, fontWeight: "600", color: theme.textMuted, marginBottom: 6, marginTop: 16 },
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
