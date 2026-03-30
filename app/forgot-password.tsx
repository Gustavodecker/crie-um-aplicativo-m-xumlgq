
import React, { useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, shadows } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { BACKEND_URL } from "@/utils/api";
import { ChevronLeft } from "lucide-react-native";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const router = useRouter();

  const handleBack = () => {
    console.log("[ForgotPassword] User pressed 'Voltar' button");
    router.back();
  };

  const handleSubmit = async () => {
    console.log("[ForgotPassword] User pressed 'Enviar nova senha' button, email:", email);

    if (!email.trim()) {
      setError("Por favor, informe seu e-mail");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[API] POST /api/auth/forgot-password — sending request for email:", email);

      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      console.log("[ForgotPassword] Response status:", response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error("[ForgotPassword] Error response:", response.status, text);
        let errorMsg = "Erro ao solicitar nova senha. Tente novamente.";
        try {
          const errJson = JSON.parse(text);
          if (errJson.message) errorMsg = errJson.message;
          else if (errJson.error) errorMsg = errJson.error;
        } catch {
          // not JSON — keep generic message
        }
        setError(errorMsg);
        return;
      }

      const data = await response.json();
      const receivedTempPassword = data?.tempPassword ?? null;
      console.log("[ForgotPassword] Success — tempPassword received:", !!receivedTempPassword);
      setTempPassword(receivedTempPassword);
    } catch (err: any) {
      console.error("[ForgotPassword] Network error:", err);
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoToChangePassword = () => {
    console.log("[ForgotPassword] User pressed 'Alterar senha agora' — navigating to /change-password");
    router.replace({
      pathname: "/change-password",
      params: { email: email.trim(), fromForgotPassword: "true" },
    });
  };

  const handleGoToLogin = () => {
    console.log("[ForgotPassword] User pressed 'Voltar para o login' after success");
    router.replace("/auth");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {!tempPassword ? (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <ChevronLeft size={20} color={colors.primary} />
                <Text style={styles.backButtonText}>Voltar</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <IconSymbol
                  ios_icon_name="key.fill"
                  android_material_icon_name="key"
                  size={48}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.title}>Esqueci minha senha</Text>
              <Text style={styles.subtitle}>
                Informe seu e-mail e enviaremos uma senha temporária para você acessar sua conta.
              </Text>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <IconSymbol
                  ios_icon_name="exclamationmark.triangle.fill"
                  android_material_icon_name="warning"
                  size={20}
                  color={colors.error}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {tempPassword ? (
              <View style={styles.successSection}>
                <View style={styles.successContainer}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check_circle"
                    size={24}
                    color={colors.success}
                  />
                  <Text style={styles.successText}>
                    Senha provisória gerada com sucesso!
                  </Text>
                </View>

                <View style={styles.tempPasswordBox}>
                  <Text style={styles.tempPasswordLabel}>Sua senha provisória é:</Text>
                  <Text style={styles.tempPasswordValue}>{tempPassword}</Text>
                  <Text style={styles.tempPasswordHint}>
                    Use esta senha para fazer login. Você será solicitada a criar uma nova senha em seguida.
                  </Text>
                </View>

                <TouchableOpacity style={styles.button} onPress={handleGoToChangePassword}>
                  <Text style={styles.buttonText}>Alterar senha agora</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkButton} onPress={handleGoToLogin}>
                  <Text style={styles.linkText}>Voltar para o login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <IconSymbol
                    ios_icon_name="envelope.fill"
                    android_material_icon_name="email"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Seu e-mail"
                    placeholderTextColor={colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Enviar nova senha</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    marginBottom: spacing.lg,
    paddingVertical: spacing.xs,
  },
  backButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: "500",
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  form: {
    gap: spacing.lg,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 14,
  },
  successSection: {
    gap: spacing.lg,
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success + "20",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  successText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  tempPasswordBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary + "40",
    ...shadows.sm,
  },
  tempPasswordLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  tempPasswordValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.primary,
    letterSpacing: 4,
  },
  tempPasswordHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
