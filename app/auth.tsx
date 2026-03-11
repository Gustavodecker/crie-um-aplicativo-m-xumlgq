
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

type MotherStep = "choose" | "login" | "token-validate" | "token-create-account";
type ConsultantStep = "login" | "register";

export default function AuthScreen() {
  const [activeTab, setActiveTab] = useState<"mother" | "consultant">("consultant");
  const [motherStep, setMotherStep] = useState<MotherStep>("choose");
  const [consultantStep, setConsultantStep] = useState<ConsultantStep>("login");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [babyToken, setBabyToken] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [tokenValidationResult, setTokenValidationResult] = useState<{
    babyName?: string;
    consultantName?: string;
    accountExists?: boolean;
  } | null>(null);
  
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithToken, createAccountWithToken, validateBabyToken } = useAuth();

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
      setError(err?.message || "Erro ao fazer login");
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
      setError(err?.message || "Erro ao criar conta");
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
      setError(err?.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleValidateToken = async () => {
    if (!babyToken.trim()) {
      setError("Por favor, insira o token");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      console.log("Validating baby token");
      const result = await validateBabyToken(babyToken);
      
      if (!result.valid) {
        setError("Token inválido. Verifique com sua consultora.");
        setLoading(false);
        return;
      }
      
      console.log("Token validation result:", result);
      setTokenValidationResult(result);
      
      if (result.accountExists) {
        setError("Já existe uma conta com este token. Use a opção 'Já tenho conta' para fazer login com email e senha.");
        setLoading(false);
        return;
      } else {
        setMotherStep("token-create-account");
      }
    } catch (err: any) {
      console.error("Token validation error:", err);
      setError(err?.message || "Erro ao validar token");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!name.trim() || !password) {
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
      console.log("Creating mother account with token");
      await createAccountWithToken(babyToken, name, password);
      console.log("Mother account created successfully");
      router.replace("/(tabs)");
    } catch (err: any) {
      console.error("Create account error:", err);
      setError(err?.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const handleResetMotherFlow = () => {
    setMotherStep("choose");
    setBabyToken("");
    setEmail("");
    setName("");
    setPassword("");
    setError("");
    setTokenValidationResult(null);
  };

  const handleResetConsultantFlow = () => {
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
                  handleResetConsultantFlow();
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
                  handleResetMotherFlow();
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
                        handleResetConsultantFlow();
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
                        handleResetConsultantFlow();
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
                {motherStep === "choose" ? (
                  <>
                    <Text style={styles.instructionText}>
                      Como você deseja acessar?
                    </Text>

                    <TouchableOpacity
                      style={styles.choiceButton}
                      onPress={() => {
                        console.log("Mother chose: Already have account");
                        setMotherStep("login");
                      }}
                    >
                      <View style={styles.choiceIconContainer}>
                        <IconSymbol
                          ios_icon_name="person.circle.fill"
                          android_material_icon_name="account-circle"
                          size={32}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.choiceTextContainer}>
                        <Text style={styles.choiceTitle}>Já tenho conta</Text>
                        <Text style={styles.choiceSubtitle}>Entrar com email e senha</Text>
                      </View>
                      <IconSymbol
                        ios_icon_name="chevron.right"
                        android_material_icon_name="chevron-right"
                        size={24}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.choiceButton}
                      onPress={() => {
                        console.log("Mother chose: First access with token");
                        setMotherStep("token-validate");
                      }}
                    >
                      <View style={styles.choiceIconContainer}>
                        <IconSymbol
                          ios_icon_name="key.fill"
                          android_material_icon_name="vpn-key"
                          size={32}
                          color={colors.secondary}
                        />
                      </View>
                      <View style={styles.choiceTextContainer}>
                        <Text style={styles.choiceTitle}>Primeiro acesso</Text>
                        <Text style={styles.choiceSubtitle}>Tenho um token da consultora</Text>
                      </View>
                      <IconSymbol
                        ios_icon_name="chevron.right"
                        android_material_icon_name="chevron-right"
                        size={24}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </>
                ) : motherStep === "login" ? (
                  <>
                    <Text style={styles.instructionText}>
                      Entre com seu email e senha
                    </Text>

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

                    <TouchableOpacity
                      style={styles.linkButton}
                      onPress={handleResetMotherFlow}
                      disabled={loading}
                    >
                      <Text style={styles.linkText}>Voltar</Text>
                    </TouchableOpacity>
                  </>
                ) : motherStep === "token-validate" ? (
                  <>
                    <Text style={styles.instructionText}>
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
                        <Text style={styles.buttonText}>Validar Token</Text>
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
                    <View style={styles.welcomeBox}>
                      <Text style={styles.welcomeText}>
                        Olá! Você foi cadastrada pela consultora{" "}
                        <Text style={styles.welcomeBold}>{tokenValidationResult?.consultantName}</Text>
                      </Text>
                      <Text style={styles.welcomeText}>
                        Bebê: <Text style={styles.welcomeBold}>{tokenValidationResult?.babyName}</Text>
                      </Text>
                    </View>

                    <Text style={styles.instructionText}>Crie sua conta para acessar</Text>

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
                        value={name}
                        onChangeText={setName}
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
                        placeholder="Crie uma senha (mínimo 6 caracteres)"
                        placeholderTextColor={colors.textSecondary}
                        value={password}
                        onChangeText={setPassword}
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
  welcomeBox: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  welcomeText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  welcomeBold: {
    fontWeight: "bold",
    color: colors.text,
  },
  choiceButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  choiceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceTextContainer: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2,
  },
  choiceSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
