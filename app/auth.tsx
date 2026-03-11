
import { LoadingButton } from "@/components/LoadingButton";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost, apiGet } from "@/utils/api";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography, spacing, shadows } from "@/styles/commonStyles";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState } from "react";

type UserRole = "consultant" | "mother";

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  appName: {
    fontSize: 42,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 2,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 16,
    color: "#E5E7EB",
    marginTop: spacing.sm,
    textAlign: "center",
    fontWeight: "300",
    letterSpacing: 0.5,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 24,
    padding: spacing.xl,
    ...shadows.large,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
  },
  button: {
    backgroundColor: "#2F4F6F",
    borderRadius: 18,
    padding: spacing.lg,
    alignItems: "center",
    marginTop: spacing.md,
    ...shadows.medium,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  switchText: {
    textAlign: "center",
    marginTop: spacing.lg,
    fontSize: 14,
    color: colors.textSecondary,
  },
  switchLink: {
    color: colors.primary,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    ...shadows.large,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.xl,
    textAlign: "center",
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const router = useRouter();

  const showErrorModal = (msg: string) => {
    setErrorMessage(msg);
    setErrorModalVisible(true);
  };

  const handleAuth = async () => {
    if (!email || !password) {
      showErrorModal("Por favor, preencha todos os campos.");
      return;
    }

    if (isSignUp && !name) {
      showErrorModal("Por favor, informe seu nome.");
      return;
    }

    setLoading(true);
    try {
      console.log("[Auth Screen] Starting authentication...");
      
      if (isSignUp) {
        console.log("[Auth Screen] Signing up user:", email);
        await signUpWithEmail(email, password, name);
      } else {
        console.log("[Auth Screen] Signing in user:", email);
        await signInWithEmail(email, password);
      }

      console.log("[Auth Screen] ✅ Authentication successful");

      // 🔥 CRITICAL FIX: Determine and store user role immediately after login
      // This prevents the need to call /api/consultant/profile on every app load
      console.log("[Auth Screen] 🔍 Determining user role...");
      
      try {
        // Try to fetch consultant profile
        await apiGet("/api/consultant/profile", { suppressErrorLog: true });
        console.log("[Auth Screen] ✅ User is a CONSULTANT");
        await AsyncStorage.setItem("userRole", "consultant");
        router.replace("/(tabs)/(home)");
      } catch (error: any) {
        // If 404, user is a mother
        if (error.message?.includes("404") || error.message?.includes("Consultant profile not found")) {
          console.log("[Auth Screen] ✅ User is a MOTHER");
          await AsyncStorage.setItem("userRole", "mother");
          router.replace("/(tabs)/(home)/mother-dashboard");
        } else {
          // Unknown error, default to mother
          console.warn("[Auth Screen] ⚠️ Unknown error determining role, defaulting to mother:", error);
          await AsyncStorage.setItem("userRole", "mother");
          router.replace("/(tabs)/(home)/mother-dashboard");
        }
      }
    } catch (error: any) {
      console.error("[Auth Screen] ❌ Authentication failed:", error);
      showErrorModal(
        error.message || "Erro ao fazer login. Verifique suas credenciais."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: "https://images.unsplash.com/photo-1519689373023-dd07c7988603?w=1200&q=80" }}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={styles.container}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.logoContainer}>
                <Text style={styles.appName}>TodaNoite</Text>
                <Text style={styles.tagline}>
                  Noites tranquilas para toda a família
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.title}>
                  {isSignUp ? "Criar Conta" : "Entrar"}
                </Text>
                <Text style={styles.subtitle}>
                  {isSignUp
                    ? "Preencha os dados para criar sua conta"
                    : "Acesse sua conta para continuar"}
                </Text>

                {isSignUp && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Nome</Text>
                    <TextInput
                      style={[styles.input, nameFocused && styles.inputFocused]}
                      placeholder="Seu nome completo"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                    />
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    style={[styles.input, emailFocused && styles.inputFocused]}
                    placeholder="seu@email.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Senha</Text>
                  <TextInput
                    style={[styles.input, passwordFocused && styles.inputFocused]}
                    placeholder="Sua senha"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                </View>

                <LoadingButton
                  title={isSignUp ? "Criar Conta" : "Entrar"}
                  onPress={handleAuth}
                  loading={loading}
                  style={styles.button}
                  textStyle={styles.buttonText}
                />

                <Text style={styles.switchText}>
                  {isSignUp ? "Já tem uma conta? " : "Não tem uma conta? "}
                  <Text
                    style={styles.switchLink}
                    onPress={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? "Entrar" : "Criar conta"}
                  </Text>
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal
          visible={errorModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setErrorModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Erro</Text>
              <Text style={styles.modalMessage}>{errorMessage}</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setErrorModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}
