
import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingButton } from "@/components/LoadingButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiPost, apiGet } from "@/utils/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography, spacing, shadows } from "@/styles/commonStyles";

type UserRole = "consultant" | "mother";

const { width, height } = Dimensions.get("window");

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [babyToken, setBabyToken] = useState("");
  const [role, setRole] = useState<UserRole>("consultant");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail } = useAuth();

  const showErrorModal = (msg: string) => {
    console.log("Showing error modal:", msg);
    setErrorMessage(msg);
    setShowError(true);
  };

  const handleAuth = async () => {
    console.log("User tapped auth button", { isLogin, email, role });
    if (!email || !password || (!isLogin && !name)) {
      showErrorModal("Por favor, preencha todos os campos");
      return;
    }

    if (!isLogin && role === "mother" && !babyToken) {
      showErrorModal("Por favor, insira o código do bebê fornecido pela consultora");
      return;
    }

    if (!isLogin && role === "mother" && babyToken.length !== 4) {
      showErrorModal("O código do bebê deve ter 4 caracteres");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        console.log("🔐 [Login] Attempting sign in with email:", email);
        
        // 🔥 CRITICAL: Wait for sign in to complete AND token to sync
        await signInWithEmail(email, password);
        console.log("✅ [Login] Sign in successful, token synced. Checking user role...");
        
        // Add a delay to ensure token is fully written to storage
        console.log("⏳ [Login] Waiting 300ms for token to persist...");
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log("✅ [Login] Wait complete, proceeding to role check");
        
        // Check user role after login
        let userRole: UserRole = "mother"; // Default to mother
        try {
          console.log("🔍 [Login] Checking if user is consultant by calling /api/consultant/profile...");
          await apiGet("/api/consultant/profile");
          userRole = "consultant";
          console.log("✅ [Login] USER ROLE: consultant");
        } catch (error: any) {
          console.log("❌ [Login] Consultant profile check failed:", error.message);
          console.log("✅ [Login] USER ROLE: mother (consultant profile not found)");
          userRole = "mother";
        }
        
        // 🔥 CRITICAL: Store user role in AsyncStorage to avoid future API calls
        await AsyncStorage.setItem("userRole", userRole);
        console.log("💾 [Login] User role stored in AsyncStorage:", userRole);
        
        // Redirect based on role
        if (userRole === "mother") {
          console.log("🚀 [Login] Redirecting to mother dashboard");
          router.replace("/(tabs)/(home)/mother-dashboard");
        } else {
          console.log("🚀 [Login] Redirecting to consultant dashboard (home)");
          router.replace("/(tabs)/(home)");
        }
      } else {
        console.log("Attempting sign up with email:", email, "role:", role);
        
        // 🔥 CRITICAL: Wait for sign up to complete AND token to sync
        await signUpWithEmail(email, password, name);
        console.log("Sign up successful, token synced.");
        
        // Add a delay to ensure token is fully written to storage
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (role === "consultant") {
          console.log("[API] Initializing consultant profile");
          try {
            await apiPost("/api/init/consultant", { name });
            console.log("[Auth] USER ROLE: consultant");
          } catch (initErr) {
            console.warn("[API] Consultant init error (may already exist):", initErr);
          }
          
          // 🔥 CRITICAL: Store user role in AsyncStorage
          await AsyncStorage.setItem("userRole", "consultant");
          console.log("[Auth] User role stored in AsyncStorage: consultant");
          
          console.log("Redirecting to consultant dashboard (home)");
          router.replace("/(tabs)/(home)");
        } else if (role === "mother" && babyToken) {
          console.log("[API] Linking mother to baby with token:", babyToken);
          try {
            const response = await apiPost<{ id: string }>("/api/init/mother", { token: babyToken.toUpperCase() });
            console.log("[API] Mother linked successfully, baby ID:", response.id);
            await AsyncStorage.setItem("motherBabyId", response.id);
            console.log("[Auth] USER ROLE: mother");
          } catch (initErr: any) {
            console.error("[API] Mother init error:", initErr);
            showErrorModal(initErr.message || "Erro ao vincular bebê. Verifique o código.");
            setLoading(false);
            return;
          }
          
          // 🔥 CRITICAL: Store user role in AsyncStorage
          await AsyncStorage.setItem("userRole", "mother");
          console.log("[Auth] User role stored in AsyncStorage: mother");
          
          console.log("Redirecting to mother dashboard");
          router.replace("/(tabs)/(home)/mother-dashboard");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      showErrorModal(error.message || "Falha na autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1519689373023-dd07c7988603?w=1200&q=80" }}
        style={styles.heroBackground}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(47, 62, 70, 0.88)", "rgba(47, 62, 70, 0.94)"]}
          style={styles.overlay}
        >
          <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardView}
            >
              <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.headerSection}>
                  <Text style={styles.appName}>TodaNoite</Text>
                  <Text style={styles.tagline}>
                    Noites tranquilas para toda a família
                  </Text>
                </View>

                <View style={styles.loginCard}>
                  <Text style={styles.cardTitle}>
                    {isLogin ? "Bem-vindo de volta" : "Criar conta"}
                  </Text>

                  {!isLogin && (
                    <>
                      <View style={styles.roleContainer}>
                        <Text style={styles.label}>Tipo de conta</Text>
                        <View style={styles.roleButtons}>
                          <TouchableOpacity
                            style={[
                              styles.roleButton,
                              role === "consultant" && styles.roleButtonActive,
                            ]}
                            onPress={() => setRole("consultant")}
                          >
                            <Text
                              style={[
                                styles.roleButtonText,
                                role === "consultant" && styles.roleButtonTextActive,
                              ]}
                            >
                              Consultora
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.roleButton,
                              role === "mother" && styles.roleButtonActive,
                            ]}
                            onPress={() => setRole("mother")}
                          >
                            <Text
                              style={[
                                styles.roleButtonText,
                                role === "mother" && styles.roleButtonTextActive,
                              ]}
                            >
                              Mãe
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nome completo</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Digite seu nome"
                          value={name}
                          onChangeText={setName}
                          autoCapitalize="words"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>

                      {role === "mother" && (
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Código do bebê</Text>
                          <TextInput
                            style={[styles.input, styles.tokenInput]}
                            placeholder="XXXX"
                            value={babyToken}
                            onChangeText={(text) => setBabyToken(text.toUpperCase())}
                            autoCapitalize="characters"
                            maxLength={4}
                            placeholderTextColor="#9CA3AF"
                          />
                          <Text style={styles.hint}>
                            Código fornecido pela consultora
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>E-mail</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="seu@email.com"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Senha</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <LoadingButton
                    title={isLogin ? "Entrar" : "Criar Conta"}
                    onPress={handleAuth}
                    loading={loading}
                    style={styles.button}
                  />

                  <TouchableOpacity
                    onPress={() => setIsLogin(!isLogin)}
                    style={styles.switchContainer}
                  >
                    <Text style={styles.switchText}>
                      {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
                      <Text style={styles.switchLink}>
                        {isLogin ? "Criar Conta" : "Entrar"}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>

      <Modal
        visible={showError}
        transparent
        animationType="fade"
        onRequestClose={() => setShowError(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Atenção</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowError(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.text,
  },
  heroBackground: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: height * 0.08,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 56,
  },
  appName: {
    fontSize: 52,
    fontWeight: "300",
    color: "#FFFFFF",
    letterSpacing: 3,
    marginBottom: spacing.lg,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-light",
  },
  tagline: {
    ...typography.subtitle2,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    letterSpacing: 0.5,
    maxWidth: 340,
  },
  loginCard: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: spacing.xxxl,
    ...shadows.xl,
  },
  cardTitle: {
    ...typography.h2,
    marginBottom: spacing.xxxl,
    textAlign: "center",
  },
  roleContainer: {
    marginBottom: spacing.xxl,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.md,
  },
  roleButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  roleButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
  },
  roleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  roleButtonText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  roleButtonTextActive: {
    color: "#FFFFFF",
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    ...typography.body1,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tokenInput: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: 8,
    textAlign: "center",
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.sm,
    fontStyle: "italic",
  },
  button: {
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  switchContainer: {
    marginTop: spacing.xxl,
    alignItems: "center",
  },
  switchText: {
    ...typography.body2,
  },
  switchLink: {
    color: colors.primary,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(47, 62, 70, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: spacing.xxxl,
    width: "100%",
    maxWidth: 420,
    ...shadows.xl,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  modalMessage: {
    ...typography.body1,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadows.sm,
  },
  modalButtonText: {
    ...typography.label,
    fontSize: 16,
    color: "#FFFFFF",
  },
});
