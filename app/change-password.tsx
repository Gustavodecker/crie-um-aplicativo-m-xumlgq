
import React, { useState } from "react";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, shadows } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { BACKEND_URL } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { user, clearRequirePasswordChange } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; fromForgotPassword?: string }>();

  // Email comes from route params (forgot-password flow) or from the logged-in user
  const emailToUse = params.email || user?.email || "";

  const handleChangePassword = async () => {
    console.log("[ChangePassword] User pressed 'Salvar nova senha' button");
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Por favor, preencha todos os campos");
      return;
    }

    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (!emailToUse) {
      setError("Email não encontrado. Faça login novamente.");
      return;
    }

    setLoading(true);

    try {
      console.log("[API] POST /api/auth/change-password — sending request for email:", emailToUse);

      const response = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToUse,
          currentPassword,
          newPassword,
        }),
      });

      console.log("[ChangePassword] Response status:", response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error("[ChangePassword] Error response:", response.status, text);

        if (response.status === 401) {
          setError("Senha atual incorreta");
          return;
        }

        let errorMsg = "Erro ao alterar senha. Tente novamente.";
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

      console.log("[ChangePassword] Password changed successfully");
      await clearRequirePasswordChange();
      console.log("[ChangePassword] requirePasswordChange cleared — navigating to /(tabs)");

      Alert.alert("Senha alterada", "Sua nova senha foi salva com sucesso!", [
        {
          text: "OK",
          onPress: () => {
            console.log("[ChangePassword] User confirmed success alert — navigating to /(tabs)");
            router.replace("/(tabs)");
          },
        },
      ]);
    } catch (err: any) {
      console.error("[ChangePassword] Network error:", err);
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordTooShort = newPassword.length > 0 && newPassword.length < 6;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <IconSymbol
                  ios_icon_name="lock.shield.fill"
                  android_material_icon_name="lock"
                  size={48}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.title}>Criar nova senha</Text>
              <Text style={styles.subtitle}>
                Por segurança, você precisa criar uma nova senha antes de continuar.
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

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Senha atual</Text>
                <View style={styles.inputContainer}>
                  <IconSymbol
                    ios_icon_name="lock.fill"
                    android_material_icon_name="lock"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Sua senha atual ou provisória"
                    placeholderTextColor={colors.textSecondary}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry={!showCurrentPassword}
                    editable={!loading}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      console.log("[ChangePassword] User toggled current password visibility");
                      setShowCurrentPassword(!showCurrentPassword);
                    }}
                    style={styles.eyeButton}
                  >
                    <IconSymbol
                      ios_icon_name={showCurrentPassword ? "eye.slash.fill" : "eye.fill"}
                      android_material_icon_name={showCurrentPassword ? "visibility-off" : "visibility"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nova senha</Text>
                <View style={[styles.inputContainer, passwordTooShort && styles.inputError]}>
                  <IconSymbol
                    ios_icon_name="lock.fill"
                    android_material_icon_name="lock"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={colors.textSecondary}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    editable={!loading}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      console.log("[ChangePassword] User toggled new password visibility");
                      setShowNewPassword(!showNewPassword);
                    }}
                    style={styles.eyeButton}
                  >
                    <IconSymbol
                      ios_icon_name={showNewPassword ? "eye.slash.fill" : "eye.fill"}
                      android_material_icon_name={showNewPassword ? "visibility-off" : "visibility"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {passwordTooShort ? (
                  <Text style={styles.fieldHint}>Mínimo de 6 caracteres</Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirmar nova senha</Text>
                <View style={[styles.inputContainer, confirmPassword.length > 0 && !passwordsMatch && styles.inputError]}>
                  <IconSymbol
                    ios_icon_name="lock.fill"
                    android_material_icon_name="lock"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Repita a nova senha"
                    placeholderTextColor={colors.textSecondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      console.log("[ChangePassword] User toggled confirm password visibility");
                      setShowConfirmPassword(!showConfirmPassword);
                    }}
                    style={styles.eyeButton}
                  >
                    <IconSymbol
                      ios_icon_name={showConfirmPassword ? "eye.slash.fill" : "eye.fill"}
                      android_material_icon_name={showConfirmPassword ? "visibility-off" : "visibility"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && !passwordsMatch ? (
                  <Text style={styles.fieldHint}>As senhas não coincidem</Text>
                ) : null}
                {passwordsMatch ? (
                  <Text style={styles.fieldHintSuccess}>Senhas coincidem</Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleChangePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Salvar nova senha</Text>
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <IconSymbol
                  ios_icon_name="info.circle"
                  android_material_icon_name="info"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.infoText}>
                  Escolha uma senha segura com pelo menos 6 caracteres. Você usará ela em todos os próximos acessos.
                </Text>
              </View>
            </View>
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
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  inputError: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  fieldHint: {
    fontSize: 12,
    color: colors.error,
    marginLeft: spacing.xs,
  },
  fieldHintSuccess: {
    fontSize: 12,
    color: colors.success,
    marginLeft: spacing.xs,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginTop: spacing.md,
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
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary + "15",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});
