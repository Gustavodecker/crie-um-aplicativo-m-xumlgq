
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
import { apiPost } from "@/utils/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

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
        console.log("Attempting sign in with email:", email);
        await signInWithEmail(email, password);
        console.log("Sign in successful, navigating to home");
        router.replace("/(tabs)/(home)");
      } else {
        console.log("Attempting sign up with email:", email, "role:", role);
        await signUpWithEmail(email, password, name);
        
        if (role === "consultant") {
          console.log("[API] Initializing consultant profile");
          try {
            await apiPost("/api/init/consultant", { name });
          } catch (initErr) {
            console.warn("[API] Consultant init error (may already exist):", initErr);
          }
        } else if (role === "mother" && babyToken) {
          console.log("[API] Linking mother to baby with token:", babyToken);
          try {
            const response = await apiPost<{ id: string }>("/api/init/mother", { token: babyToken.toUpperCase() });
            console.log("[API] Mother linked successfully, baby ID:", response.id);
            await AsyncStorage.setItem("motherBabyId", response.id);
          } catch (initErr: any) {
            console.error("[API] Mother init error:", initErr);
            showErrorModal(initErr.message || "Erro ao vincular bebê. Verifique o código.");
            setLoading(false);
            return;
          }
        }
        console.log("Sign up successful, navigating to home");
        router.replace("/(tabs)/(home)");
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
          colors={["rgba(47, 62, 70, 0.85)", "rgba(47, 62, 70, 0.92)"]}
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
                  <Text style={styles.appName}>NanaLeve</Text>
                  <Text style={styles.tagline}>
                    Leveza e ciência para noites mais tranquilas
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
    backgroundColor: "#2F3E46",
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
    paddingHorizontal: 24,
    paddingTop: height * 0.08,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 48,
  },
  appName: {
    fontSize: 48,
    fontWeight: "300",
    color: "#FFFFFF",
    letterSpacing: 2,
    marginBottom: 12,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-light",
  },
  tagline: {
    fontSize: 16,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.85)",
    textAlign: "center",
    letterSpacing: 0.5,
    lineHeight: 24,
    maxWidth: 320,
  },
  loginCard: {
    backgroundColor: "#F7F9F9",
    borderRadius: 20,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#2F3E46",
    marginBottom: 28,
    textAlign: "center",
  },
  roleContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2F3E46",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  roleButtons: {
    flexDirection: "row",
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  roleButtonActive: {
    borderColor: "#4F6D7A",
    backgroundColor: "#4F6D7A",
  },
  roleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  roleButtonTextActive: {
    color: "#FFFFFF",
  },
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    color: "#2F3E46",
  },
  tokenInput: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 6,
    textAlign: "center",
  },
  hint: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 6,
    fontStyle: "italic",
  },
  button: {
    backgroundColor: "#4F6D7A",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#4F6D7A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  switchContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  switchText: {
    fontSize: 14,
    color: "#6B7280",
  },
  switchLink: {
    color: "#4F6D7A",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2F3E46",
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 24,
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: "#4F6D7A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
