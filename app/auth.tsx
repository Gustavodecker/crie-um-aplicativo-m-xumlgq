
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
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingButton } from "@/components/LoadingButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { apiPost } from "@/utils/api";

type UserRole = "consultant" | "mother";

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [babyId, setBabyId] = useState("");
  const [role, setRole] = useState<UserRole>("consultant");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, fetchUser } = useAuth();

  const showErrorModal = (msg: string) => {
    setErrorMessage(msg);
    setShowError(true);
  };

  const handleAuth = async () => {
    console.log("User tapped auth button", { isLogin, email, role });
    if (!email || !password || (!isLogin && !name)) {
      showErrorModal("Por favor, preencha todos os campos");
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
        // Register user via Better Auth with role in metadata
        await signUpWithEmail(email, password, name);
        // After signup, initialize profile based on role
        if (role === "consultant") {
          // Initialize consultant profile
          console.log("[API] Initializing consultant profile");
          try {
            await apiPost("/api/init/consultant", { name });
          } catch (initErr) {
            console.warn("[API] Consultant init error (may already exist):", initErr);
          }
        } else if (role === "mother" && babyId) {
          // Link mother to baby
          console.log("[API] Linking mother to baby:", babyId);
          try {
            await apiPost("/api/init/mother", { babyId });
          } catch (initErr) {
            console.warn("[API] Mother init error:", initErr);
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.icon}>😴</Text>
              <Text style={styles.title}>Consultoria do Sono</Text>
            </View>
            
            <Text style={styles.subtitle}>
              {isLogin ? "Entre para continuar" : "Crie sua conta"}
            </Text>

            {!isLogin && (
              <>
                <View style={styles.roleContainer}>
                  <Text style={styles.roleLabel}>Tipo de conta:</Text>
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

                <TextInput
                  style={styles.input}
                  placeholder="Nome completo"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  placeholderTextColor={colors.textSecondary}
                />

                {role === "mother" && (
                  <TextInput
                    style={styles.input}
                    placeholder="ID do bebê (fornecido pela consultora)"
                    value={babyId}
                    onChangeText={setBabyId}
                    autoCapitalize="none"
                    placeholderTextColor={colors.textSecondary}
                  />
                )}
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.textSecondary}
            />

            <TextInput
              style={styles.input}
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={colors.textSecondary}
            />

            <LoadingButton
              title={isLogin ? "Entrar" : "Criar Conta"}
              onPress={handleAuth}
              loading={loading}
              style={styles.button}
            />

            <Text style={styles.switchText}>
              {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
              <Text
                style={styles.switchLink}
                onPress={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "Criar Conta" : "Entrar"}
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showError}
        transparent
        animationType="fade"
        onRequestClose={() => setShowError(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Erro</Text>
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
    </SafeAreaView>
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
    justifyContent: "center",
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
    textAlign: "center",
  },
  roleContainer: {
    marginBottom: 24,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  roleButtons: {
    flexDirection: "row",
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  roleButtonTextActive: {
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  button: {
    marginTop: 8,
  },
  switchText: {
    textAlign: "center",
    marginTop: 24,
    fontSize: 14,
    color: colors.textSecondary,
  },
  switchLink: {
    color: colors.primary,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
