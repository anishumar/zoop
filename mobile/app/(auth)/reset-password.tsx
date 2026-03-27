import { useMemo, useRef, useState } from "react";
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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../src/api/client";
import { AppTheme, useAppTheme } from "../../src/theme";

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  function handleOtpChange(value: string, index: number) {
    const cleaned = value.replace(/[^0-9]/g, "").slice(-1);
    const next = [...otp];
    next[index] = cleaned;
    setOtp(next);
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyPress(key: string, index: number) {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await apiClient("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      Alert.alert("Sent", "A new code has been sent to your email.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not resend code");
    } finally {
      setResending(false);
    }
  }

  function handleContinue() {
    const code = otp.join("");
    if (code.length < 6) {
      Alert.alert("Error", "Please enter the full 6-digit code");
      return;
    }
    router.push({
      pathname: "/(auth)/new-password",
      params: { email, otp: code },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerStyle: { backgroundColor: theme.background },
          headerShadowVisible: false,
          headerTintColor: theme.text,
          headerBackTitle: "",
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.brand}>zoop</Text>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{" "}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>
          </View>

          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(r) => { inputRefs.current[i] = r; }}
                style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                value={digit}
                onChangeText={(v) => handleOtpChange(v, i)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={i === 0}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.resendRow}
            onPress={handleResend}
            disabled={resending}
          >
            <Text style={styles.resendText}>
              {resending ? "Sending..." : "Didn't get the code? "}
              {!resending && <Text style={styles.resendBold}>Resend</Text>}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scroll: { flexGrow: 1, padding: 24, paddingTop: 32 },
    header: { marginBottom: 36 },
    brand: { fontSize: 42, fontWeight: "800", color: theme.accent, marginBottom: 8 },
    title: { fontSize: 28, fontWeight: "700", color: theme.text },
    subtitle: { fontSize: 15, color: theme.textMuted, marginTop: 8, lineHeight: 22 },
    emailHighlight: { color: theme.text, fontWeight: "600" },
    otpRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
    otpInput: {
      flex: 1,
      height: 56,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
    },
    otpInputFilled: { borderColor: theme.accent },
    resendRow: { marginBottom: 32 },
    resendText: { fontSize: 14, color: theme.textMuted },
    resendBold: { color: theme.accent, fontWeight: "700" },
    button: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
    },
    buttonText: { color: theme.textOnAccent, fontSize: 16, fontWeight: "700" },
  });
