
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
import { colors, spacing, borderRadius, typography, shadows } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useAuth } from "@/contexts/AuthContext";

type AuthStep = "login" | "register";

export default function AuthScreen() {
  const [activeTab, setActiveTab] = useState<"mother" | "consultant">("consultant");
  const [consultantStep, setConsultantStep] = useState<AuthStep>("login");
  const [motherStep, setMotherStep] = useState<AuthStep>("login");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail } = useAuth();

  const handleConsultantLogin = async () => {
    if (!email || !password) {
      setError("Por favor, preencha todos os campos");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      console.log("Attempting consultant login with email:", email);
      await signInWithEmail(email, password);
      console.log("Consultant login successful");
      router.replace("/(tabs)");
    } catch (err: any) {
      console.error("Consultant login error:", err);
      const errorMessage = err?.message || "Erro ao fazer login";
      console.error("Error message:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConsultantRegister = async () => {
    if (!email || !password || !name) {
      setError("Por favor, preencha todos os campos");
      return;
    }
    
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      console.log("Attempting consultant registration with email:", email);
      await signUpWithEmail(email, password, name);
      console.log("Consultant registration successful");
      router.replace("/(tabs)");
    } catch (err: any) {
      console.error("Consultant registration error:", err);
      const errorMessage = err?.message || "Erro ao criar conta";
      console.error("Error message:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleMotherLogin = async () => {
    if (!email || !password) {
      setError("Por favor, preencha todos os campos");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      console.log("Attempting mother login with email:", email);
      await signInWithEmail(email, password);
      console.log("Mother login successful");
      router.replace("/(tabs)");
    } catch (err: any) {
      console.error("Mother login error:", err);
      const errorMessage = err?.message || "Erro ao fazer login";
      console.error("Error message:", errorMessage);
      
      // Provide helpful message for common errors
      if (errorMessage.toLowerCase().includes("invalid") || 
          errorMessage.toLowerCase().includes("credentials") || 
          errorMessage.toLowerCase().includes("password") ||
          errorMessage.toLowerCase().includes("incorretos")) {
        setError("Email ou senha incorretos. Verifique seus dados e tente novamente.");
      } else if (errorMessage.toLowerCase().includes("not found") || 
                 errorMessage.toLowerCase().includes("user") ||
                 errorMessage.toLowerCase().includes("não encontrada")) {
        setError("Conta não encontrada. Solicite à sua consultora que crie sua conta.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetFlow = () => {
    setEmail("");
    setPassword("");
    setName("");
    setError("");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>Bem-vinda!</Text>
              <Text style={styles.subtitle}>Consultoria de Sono Infantil</Text>
            </View>

            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === "consultant" && styles.tabActive]}
                onPress={() => {
                  console.log("User switched to Consultant tab");
                  setActiveTab("consultant");
                  setError("");
                  handleResetFlow();
                }}
              >
                <Text style={[styles.tabText, activeTab === "consultant" && styles.tabTextActive]}>
                  Consultora
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === "mother" && styles.tabActive]}
                onPress={() => {
                  console.log("User switched to Mother tab");
                  setActiveTab("mother");
                  setError("");
                  handleResetFlow();
                }}
              >
                <Text style={[styles.tabText, activeTab === "mother" && styles.tabTextActive]}>
                  Mãe
                </Text>
              </TouchableOpacity>
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

            {activeTab === "consultant" ? (
              <View style={styles.form}>
                {consultantStep === "login" ? (
                  <>
                    <View style={styles.inputContainer}>
                      <IconSymbol
                        ios_icon_name="envelope.fill"
                        android_material_icon_name="email"
                        size={20}
                        color={colors.textSecondary}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="E-mail"
                        placeholderTextColor={colors.textSecondary}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!loading}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <IconSymbol
                        ios_icon_name="lock.fill"
                        android_material_icon_name="lock"
                        size={20}
                        color={colors.textSecondary}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Senha"
                        placeholderTextColor={colors.textSecondary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        editable={!loading}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.button, loading && styles.buttonDisabled]}
                      onPress={handleConsultantLogin}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.buttonText}>Entrar</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.linkButton}
                      onPress={() => {
                        setConsultantStep("register");
                        handleResetFlow();
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.linkText}>Não tem conta? Cadastre-se</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <IconSymbol
                        ios_icon_name="person.fill"
                        android_material_icon_name="person"
                        size={20}
                        color={colors.textSecondary}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Nome completo"
                        placeholderTextColor={colors.textSecondary}
                        value={name}
                        onChangeText={setName}
                        editable={!loading}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <IconSymbol
                        ios_icon_name="envelope.fill"
                        android_material_icon_name="email"
                        size={20}
                        color={colors.textSecondary}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="E-mail"
                        placeholderTextColor={colors.textSecondary}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!loading}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <IconSymbol
                        ios_icon_name="lock.fill"
                        android_material_icon_name="lock"
                        size={20}
                        color={colors.textSecondary}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Senha (mínimo 6 caracteres)"
                        placeholderTextColor={colors.textSecondary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        editable={!loading}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.button, loading && styles.buttonDisabled]}
                      onPress={handleConsultantRegister}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.buttonText}>Criar Conta</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.linkButton}
                      onPress={() => {
                        setConsultantStep("login");
                        handleResetFlow();
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.linkText}>Já tem conta? Faça login</Text>
                    </TouchableOpacity>
                  </>
                )}
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
                    placeholder="E-mail"
                    placeholderTextColor={colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <IconSymbol
                    ios_icon_name="lock.fill"
                    android_material_icon_name="lock"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Senha"
                    placeholderTextColor={colors.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleMotherLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Entrar</Text>
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
                    Sua conta é criada pela consultora. Você receberá um email com instruções para criar sua senha no primeiro acesso.
                  </Text>
                </View>
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
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: borderRadius.md,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: "#FFFFFF",
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
  instructionText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary + "15",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});
