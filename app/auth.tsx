
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
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { colors, spacing, borderRadius, typography, shadows } from "@/styles/commonStyles";

type MotherStep = "token" | "create-account" | "sign-in";
type ConsultantStep = "login" | "register";

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, validateBabyToken, createAccountWithToken, signInWithToken } = useAuth();
  const router = useRouter();

  // Consultant state
  const [consultantStep, setConsultantStep] = useState<ConsultantStep>("login");
  const [consultantEmail, setConsultantEmail] = useState("");
  const [consultantPassword, setConsultantPassword] = useState("");
  const [consultantName, setConsultantName] = useState("");

  // Mother state
  const [motherStep, setMotherStep] = useState<MotherStep>("token");
  const [babyToken, setBabyToken] = useState("");
  const [motherName, setMotherName] = useState("");
  const [motherPassword, setMotherPassword] = useState("");
  const [validatedEmail, setValidatedEmail] = useState("");
  const [validatedBabyName, setValidatedBabyName] = useState("");
  const [accountExists, setAccountExists] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"consultant" | "mother">("consultant");

  const handleConsultantLogin = async () => {
    if (!consultantEmail || !consultantPassword) {
      setError("Por favor, preencha todos os campos");
      return;
    }

    setError("");
    setLoading(true);

    try {
      console.log("User tapped Consultant Login button");
      console.log("Attempting consultant login with email:", consultantEmail);
      await signInWithEmail(consultantEmail, consultantPassword);
      console.log("Consultant login successful");
      // Navigation will be handled by AuthContext + TabLayout
    } catch (err: any) {
      console.error("Consultant login error:", err);
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleConsultantRegister = async () => {
    if (!consultantEmail || !consultantPassword || !consultantName) {
      setError("Por favor, preencha todos os campos");
      return;
    }

    if (consultantPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setError("");
    setLoading(true);

    try {
      console.log("User tapped Consultant Register button");
      console.log("Attempting consultant registration with email:", consultantEmail);
      await signUpWithEmail(consultantEmail, consultantPassword, consultantName);
      console.log("Consultant registration successful");
      // Navigation will be handled by AuthContext + TabLayout
    } catch (err: any) {
      console.error("Consultant registration error:", err);
      setError(err.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const handleValidateToken = async () => {
    if (!babyToken || babyToken.trim().length === 0) {
      setError("Por favor, insira o token do bebê");
      return;
    }

    setError("");
    setLoading(true);

    try {
      console.log("User tapped Validate Token button");
      console.log("Validating baby token:", babyToken.substring(0, 4) + "...");
      const result = await validateBabyToken(babyToken.trim());
      
      if (!result.valid) {
        setError("Token inválido. Verifique com sua consultora.");
        setLoading(false);
        return;
      }

      console.log("Token validation successful");
      setValidatedEmail(result.motherEmail || "");
      setValidatedBabyName(result.babyName || "");
      setAccountExists(result.accountExists || false);

      if (result.accountExists) {
        console.log("Account exists - showing sign-in form");
        setMotherStep("sign-in");
      } else {
        console.log("Account does not exist - showing create-account form");
        setMotherStep("create-account");
      }
    } catch (err: any) {
      console.error("Token validation error:", err);
      setError(err.message || "Erro ao validar token");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!motherName || !motherPassword) {
      setError("Por favor, preencha todos os campos");
      return;
    }

    if (motherPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setError("");
    setLoading(true);

    try {
      console.log("User tapped Create Account button");
      console.log("Creating mother account with token");
      await createAccountWithToken(babyToken.trim(), motherName, motherPassword);
      console.log("Mother account created successfully");
      // Navigation will be handled by AuthContext + TabLayout
    } catch (err: any) {
      console.error("Create account error:", err);
      setError(err.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const handleMotherSignIn = async () => {
    if (!motherPassword) {
      setError("Por favor, insira sua senha");
      return;
    }

    setError("");
    setLoading(true);

    try {
      console.log("User tapped Mother Sign In button");
      console.log("Signing in mother with email:", validatedEmail);
      await signInWithEmail(validatedEmail, motherPassword);
      console.log("Mother sign-in successful");
      // Navigation will be handled by AuthContext + TabLayout
    } catch (err: any) {
      console.error("Mother sign-in error:", err);
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleResetMotherFlow = () => {
    console.log("User tapped Reset Mother Flow");
    setMotherStep("token");
    setBabyToken("");
    setMotherName("");
    setMotherPassword("");
    setValidatedEmail("");
    setValidatedBabyName("");
    setAccountExists(false);
    setError("");
  };

  const handleResetConsultantFlow = () => {
    console.log("User tapped Reset Consultant Flow");
    setConsultantStep("login");
    setConsultantEmail("");
    setConsultantPassword("");
    setConsultantName("");
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
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Consultoria de Sono</Text>
              <Text style={styles.subtitle}>Bem-vindo de volta</Text>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === "consultant" && styles.tabActive]}
                onPress={() => {
                  console.log("User switched to Consultant tab");
                  setActiveTab("consultant");
                  setError("");
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
                }}
              >
                <Text style={[styles.tabText, activeTab === "mother" && styles.tabTextActive]}>
                  Mãe
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <IconSymbol
                  ios_icon_name="exclamationmark.triangle.fill"
                  android_material_icon_name="warning"
                  size={20}
                  color="#EF4444"
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Consultant Tab Content */}
            {activeTab === "consultant" && (
              <View style={styles.formContainer}>
                {consultantStep === "login" ? (
                  <>
                    <Text style={styles.formTitle}>Login da Consultora</Text>
                    
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
                        value={consultantEmail}
                        onChangeText={setConsultantEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
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
                        value={consultantPassword}
                        onChangeText={setConsultantPassword}
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
                        console.log("User tapped Switch to Register");
                        setConsultantStep("register");
                        setError("");
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.linkText}>Não tem conta? Cadastre-se</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.formTitle}>Cadastro da Consultora</Text>
                    
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
                        value={consultantName}
                        onChangeText={setConsultantName}
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
                        value={consultantEmail}
                        onChangeText={setConsultantEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
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
                        value={consultantPassword}
                        onChangeText={setConsultantPassword}
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
                        <Text style={styles.buttonText}>Cadastrar</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.linkButton}
                      onPress={() => {
                        console.log("User tapped Switch to Login");
                        setConsultantStep("login");
                        setError("");
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.linkText}>Já tem conta? Faça login</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* Mother Tab Content */}
            {activeTab === "mother" && (
              <View style={styles.formContainer}>
                {motherStep === "token" ? (
                  <>
                    <Text style={styles.formTitle}>Acesso da Mãe</Text>
                    <Text style={styles.formDescription}>
                      Insira o token fornecido pela sua consultora
                    </Text>
                    
                    <View style={styles.inputContainer}>
                      <IconSymbol
                        ios_icon_name="key.fill"
                        android_material_icon_name="vpn-key"
                        size={20}
                        color={colors.textSecondary}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Token do bebê"
                        placeholderTextColor={colors.textSecondary}
                        value={babyToken}
                        onChangeText={setBabyToken}
                        autoCapitalize="characters"
                        editable={!loading}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.button, loading && styles.buttonDisabled]}
                      onPress={handleValidateToken}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.buttonText}>Continuar</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : motherStep === "create-account" ? (
                  <>
                    <Text style={styles.formTitle}>Criar Conta</Text>
                    <Text style={styles.formDescription}>
                      Bebê: {validatedBabyName}
                      {"\n"}E-mail: {validatedEmail}
                    </Text>
                    
                    <View style={styles.inputContainer}>
                      <IconSymbol
                        ios_icon_name="person.fill"
                        android_material_icon_name="person"
                        size={20}
                        color={colors.textSecondary}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Seu nome"
                        placeholderTextColor={colors.textSecondary}
                        value={motherName}
                        onChangeText={setMotherName}
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
                        value={motherPassword}
                        onChangeText={setMotherPassword}
                        secureTextEntry
                        editable={!loading}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.button, loading && styles.buttonDisabled]}
                      onPress={handleCreateAccount}
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
                      onPress={handleResetMotherFlow}
                      disabled={loading}
                    >
                      <Text style={styles.linkText}>Voltar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.formTitle}>Login</Text>
                    <Text style={styles.formDescription}>
                      Bebê: {validatedBabyName}
                      {"\n"}E-mail: {validatedEmail}
                    </Text>
                    
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
                        value={motherPassword}
                        onChangeText={setMotherPassword}
                        secureTextEntry
                        editable={!loading}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.button, loading && styles.buttonDisabled]}
                      onPress={handleMotherSignIn}
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
                      onPress={handleResetMotherFlow}
                      disabled={loading}
                    >
                      <Text style={styles.linkText}>Voltar</Text>
                    </TouchableOpacity>
                  </>
                )}
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
    padding: spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.lg,
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
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#DC2626",
  },
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  formDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingLeft: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginTop: spacing.md,
    ...shadows.small,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  linkButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  linkText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "500",
  },
});
