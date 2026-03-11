
import React, { useState } from "react";
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
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, typography, shadows } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useAuth } from "@/contexts/AuthContext";

// Mother flow steps
type MotherStep = "token" | "create-account" | "sign-in";

// Consultant flow steps
type ConsultantStep = "login" | "register";

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithToken, createAccountWithToken, validateBabyToken, loading: authLoading } = useAuth();
  
  const [mode, setMode] = useState<"consultant" | "mother">("consultant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Consultant registration
  const [consultantStep, setConsultantStep] = useState<ConsultantStep>("login");
  const [consultantName, setConsultantName] = useState("");
  const [consultantPasswordConfirm, setConsultantPasswordConfirm] = useState("");

  // Mother multi-step flow
  const [motherStep, setMotherStep] = useState<MotherStep>("token");
  const [validatedTokenInfo, setValidatedTokenInfo] = useState<{
    babyName?: string;
    motherEmail?: string;
    consultantName?: string;
    accountExists?: boolean;
  } | null>(null);
  const [motherName, setMotherName] = useState("");
  const [motherPassword, setMotherPassword] = useState("");
  const [motherPasswordConfirm, setMotherPasswordConfirm] = useState("");
  const [motherSignInPassword, setMotherSignInPassword] = useState("");

  const handleConsultantLogin = async () => {
    console.log("User tapped Consultant Login button");
    setError("");

    if (!email.trim()) {
      setError("Por favor, informe seu e-mail");
      return;
    }

    if (!password.trim()) {
      setError("Por favor, informe sua senha");
      return;
    }

    try {
      setLoading(true);
      console.log("Attempting consultant login with email:", email);
      await signInWithEmail(email, password);
      console.log("Consultant login successful");
      // Navigation will be handled by AuthContext
    } catch (err: any) {
      console.error("Consultant login error:", err);
      setError(err.message || "Erro ao fazer login. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  const handleConsultantRegister = async () => {
    console.log("User tapped Consultant Register button");
    setError("");

    if (!consultantName.trim()) {
      setError("Por favor, informe seu nome");
      return;
    }

    if (!email.trim()) {
      setError("Por favor, informe seu e-mail");
      return;
    }

    if (!password.trim() || password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (password !== consultantPasswordConfirm) {
      setError("As senhas não coincidem");
      return;
    }

    try {
      setLoading(true);
      console.log("Attempting consultant registration with email:", email);
      await signUpWithEmail(email, password, consultantName.trim());
      console.log("Consultant registration successful");
      // Navigation will be handled by AuthContext
    } catch (err: any) {
      console.error("Consultant registration error:", err);
      setError(err.message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidateToken = async () => {
    console.log("User tapped Validate Token button");
    setError("");

    if (!token.trim()) {
      setError("Por favor, informe o token fornecido pela consultora");
      return;
    }

    try {
      setLoading(true);
      console.log("[Auth] Validating baby token...");
      
      const result = await validateBabyToken(token.trim());
      
      if (!result.valid) {
        setError("Token inválido. Verifique com sua consultora.");
        return;
      }
      
      console.log("[Auth] Token valid, accountExists:", result.accountExists);
      setValidatedTokenInfo({
        babyName: result.babyName,
        motherEmail: result.motherEmail,
        consultantName: result.consultantName,
        accountExists: result.accountExists,
      });
      
      if (result.accountExists) {
        // Account already exists - go to sign-in step
        setMotherStep("sign-in");
      } else {
        // New account - go to create account step
        setMotherStep("create-account");
      }
    } catch (err: any) {
      console.error("Token validation error:", err);
      const errMsg = err.message || "Erro ao validar token. Tente novamente.";
      // Check for common error patterns
      if (errMsg.toLowerCase().includes("not found") || errMsg.toLowerCase().includes("não encontrado")) {
        setError("Token não encontrado. Verifique com sua consultora.");
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    console.log("User tapped Create Account button");
    setError("");

    if (!motherName.trim()) {
      setError("Por favor, informe seu nome");
      return;
    }

    if (!motherPassword.trim() || motherPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (motherPassword !== motherPasswordConfirm) {
      setError("As senhas não coincidem");
      return;
    }

    try {
      setLoading(true);
      console.log("Creating mother account with token");
      await createAccountWithToken(token.trim(), motherName.trim(), motherPassword);
      console.log("Mother account created and signed in successfully");
      // Navigation will be handled by AuthContext
    } catch (err: any) {
      console.error("Create account error:", err);
      if (err.message?.includes("Já existe uma conta")) {
        // Account already exists, switch to sign-in
        setMotherStep("sign-in");
        setError("Conta já existe. Por favor, faça login.");
      } else {
        setError(err.message || "Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMotherSignIn = async () => {
    console.log("User tapped Mother Sign In button");
    setError("");

    if (!motherSignInPassword.trim()) {
      setError("Por favor, informe sua senha");
      return;
    }

    if (!validatedTokenInfo?.motherEmail) {
      setError("Erro: e-mail da mãe não encontrado. Tente validar o token novamente.");
      return;
    }

    try {
      setLoading(true);
      
      // Sign in with email/password using the mother's email from the validated token
      console.log("Attempting mother sign in with email:", validatedTokenInfo.motherEmail);
      await signInWithEmail(validatedTokenInfo.motherEmail, motherSignInPassword);
      console.log("Mother sign in successful");
      // Navigation will be handled by AuthContext
    } catch (err: any) {
      console.error("Mother sign in error:", err);
      setError(err.message || "Senha incorreta. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetMotherFlow = () => {
    setMotherStep("token");
    setValidatedTokenInfo(null);
    setMotherName("");
    setMotherPassword("");
    setMotherPasswordConfirm("");
    setMotherSignInPassword("");
    setError("");
  };

  const handleResetConsultantFlow = () => {
    setConsultantStep("login");
    setConsultantName("");
    setEmail("");
    setPassword("");
    setConsultantPasswordConfirm("");
    setError("");
  };

  const isConsultantMode = mode === "consultant";
  const isMotherMode = mode === "mother";

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <IconSymbol
              ios_icon_name="moon.stars.fill"
              android_material_icon_name="bedtime"
              size={64}
              color={colors.primary}
            />
            <Text style={styles.title}>Consultoria de Sono</Text>
            <Text style={styles.subtitle}>Bem-vindo de volta</Text>
          </View>

          {/* Mode Selector */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                isConsultantMode && styles.modeButtonActive,
              ]}
              onPress={() => {
                setMode("consultant");
                setError("");
                handleResetMotherFlow();
                handleResetConsultantFlow();
              }}
            >
              <IconSymbol
                ios_icon_name="person.badge.key.fill"
                android_material_icon_name="admin-panel-settings"
                size={24}
                color={isConsultantMode ? "#FFF" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  isConsultantMode && styles.modeButtonTextActive,
                ]}
              >
                Consultora
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                isMotherMode && styles.modeButtonActive,
              ]}
              onPress={() => {
                setMode("mother");
                setError("");
                handleResetConsultantFlow();
              }}
            >
              <IconSymbol
                ios_icon_name="heart.fill"
                android_material_icon_name="favorite"
                size={24}
                color={isMotherMode ? "#FFF" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  isMotherMode && styles.modeButtonTextActive,
                ]}
              >
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
                color={colors.error}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Consultant Login Form */}
          {isConsultantMode && consultantStep === "login" && (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleConsultantLogin}
                disabled={loading || authLoading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="arrow.right.circle.fill"
                      android_material_icon_name="login"
                      size={24}
                      color="#FFF"
                    />
                    <Text style={styles.loginButtonText}>Entrar como Consultora</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryLink}
                onPress={() => {
                  setConsultantStep("register");
                  setError("");
                }}
              >
                <Text style={styles.secondaryLinkText}>
                  Não tem conta? <Text style={styles.secondaryLinkTextBold}>Cadastre-se</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Consultant Registration Form */}
          {isConsultantMode && consultantStep === "register" && (
            <View style={styles.form}>
              <Text style={styles.stepTitle}>Criar conta de Consultora</Text>
              <Text style={styles.stepSubtitle}>
                Preencha os dados abaixo para criar sua conta profissional.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome Completo</Text>
                <TextInput
                  style={styles.input}
                  value={consultantName}
                  onChangeText={setConsultantName}
                  placeholder="Seu nome completo"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Criar Senha</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmar Senha</Text>
                <TextInput
                  style={styles.input}
                  value={consultantPasswordConfirm}
                  onChangeText={setConsultantPasswordConfirm}
                  placeholder="Repita a senha"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleConsultantRegister}
                disabled={loading || authLoading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="person.badge.plus"
                      android_material_icon_name="person-add"
                      size={24}
                      color="#FFF"
                    />
                    <Text style={styles.loginButtonText}>Criar Conta</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => {
                  setConsultantStep("login");
                  setError("");
                }}
              >
                <IconSymbol
                  ios_icon_name="arrow.left"
                  android_material_icon_name="arrow-back"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.backLinkText}>Já tem conta? Faça login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Mother Login - Step 1: Token Entry */}
          {isMotherMode && motherStep === "token" && (
            <View style={styles.form}>
              <View style={styles.infoBox}>
                <IconSymbol
                  ios_icon_name="info.circle.fill"
                  android_material_icon_name="info"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.infoText}>
                  Sua consultora forneceu um token de acesso único. Digite-o abaixo para acessar a rotina do seu bebê.
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Token de Acesso</Text>
                <TextInput
                  style={[styles.input, styles.tokenInput]}
                  value={token}
                  onChangeText={setToken}
                  placeholder="Digite o token fornecido"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleValidateToken}
                disabled={loading || authLoading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="arrow.right.circle.fill"
                      android_material_icon_name="login"
                      size={24}
                      color="#FFF"
                    />
                    <Text style={styles.loginButtonText}>Continuar</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.helpBox}>
                <IconSymbol
                  ios_icon_name="questionmark.circle"
                  android_material_icon_name="help"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={styles.helpText}>
                  Não recebeu o token? Entre em contato com sua consultora.
                </Text>
              </View>
            </View>
          )}

          {/* Mother Login - Step 2a: Create Account (new mother) */}
          {isMotherMode && motherStep === "create-account" && validatedTokenInfo && (
            <View style={styles.form}>
              <View style={styles.successBox}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={20}
                  color={colors.success}
                />
                <View style={styles.successTextContainer}>
                  <Text style={styles.successTitle}>Token válido! 🎉</Text>
                  {validatedTokenInfo.babyName && (
                    <Text style={styles.successText}>Bebê: {validatedTokenInfo.babyName}</Text>
                  )}
                  {validatedTokenInfo.consultantName && (
                    <Text style={styles.successText}>Consultora: {validatedTokenInfo.consultantName}</Text>
                  )}
                </View>
              </View>

              <Text style={styles.stepTitle}>Criar sua conta</Text>
              <Text style={styles.stepSubtitle}>
                Crie uma senha para acessar o app sempre que precisar.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Seu Nome</Text>
                <TextInput
                  style={styles.input}
                  value={motherName}
                  onChangeText={setMotherName}
                  placeholder="Seu nome completo"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Criar Senha</Text>
                <TextInput
                  style={styles.input}
                  value={motherPassword}
                  onChangeText={setMotherPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmar Senha</Text>
                <TextInput
                  style={styles.input}
                  value={motherPasswordConfirm}
                  onChangeText={setMotherPasswordConfirm}
                  placeholder="Repita a senha"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleCreateAccount}
                disabled={loading || authLoading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="person.badge.plus"
                      android_material_icon_name="person-add"
                      size={24}
                      color="#FFF"
                    />
                    <Text style={styles.loginButtonText}>Criar Conta e Entrar</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.backLink} onPress={handleResetMotherFlow}>
                <IconSymbol
                  ios_icon_name="arrow.left"
                  android_material_icon_name="arrow-back"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.backLinkText}>Voltar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Mother Login - Step 2b: Sign In (existing account) */}
          {isMotherMode && motherStep === "sign-in" && validatedTokenInfo && (
            <View style={styles.form}>
              <View style={styles.successBox}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={20}
                  color={colors.success}
                />
                <View style={styles.successTextContainer}>
                  <Text style={styles.successTitle}>Token válido! ✅</Text>
                  {validatedTokenInfo.babyName && (
                    <Text style={styles.successText}>Bebê: {validatedTokenInfo.babyName}</Text>
                  )}
                  {validatedTokenInfo.motherEmail && (
                    <Text style={styles.successText}>Conta: {validatedTokenInfo.motherEmail}</Text>
                  )}
                </View>
              </View>

              <Text style={styles.stepTitle}>Bem-vinda de volta!</Text>
              <Text style={styles.stepSubtitle}>
                Sua conta já está configurada. Informe sua senha para entrar.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  style={styles.input}
                  value={motherSignInPassword}
                  onChangeText={setMotherSignInPassword}
                  placeholder="Sua senha"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleMotherSignIn}
                disabled={loading || authLoading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="arrow.right.circle.fill"
                      android_material_icon_name="login"
                      size={24}
                      color="#FFF"
                    />
                    <Text style={styles.loginButtonText}>Entrar</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.backLink} onPress={handleResetMotherFlow}>
                <IconSymbol
                  ios_icon_name="arrow.left"
                  android_material_icon_name="arrow-back"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.backLinkText}>Usar outro token</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: spacing.xl,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxxl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modeSelector: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  modeButtonTextActive: {
    color: "#FFF",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error + "15",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error + "40",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: colors.error,
  },
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    ...shadows.sm,
  },
  tokenInput: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 18,
    letterSpacing: 2,
    textAlign: "center",
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.md,
    ...shadows.lg,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: colors.primary + "15",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  helpBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  helpText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.success + "15",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success + "40",
  },
  successTextContainer: {
    flex: 1,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.success,
    marginBottom: spacing.xs,
  },
  successText: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  backLinkText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  secondaryLink: {
    alignItems: "center",
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  secondaryLinkText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  secondaryLinkTextBold: {
    fontWeight: "700",
    color: colors.primary,
  },
});
