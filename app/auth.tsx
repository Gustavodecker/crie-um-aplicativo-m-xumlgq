
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const { signInWithEmail, signUpWithEmail, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      console.log("[Auth Screen] ✅ User authenticated, redirecting...");
      router.replace("/(tabs)/(home)");
    }
  }, [user]);

  const handleAuth = async () => {
    setErrorMessage("");
    
    if (!email || !password) {
      setErrorMessage("Por favor, preencha todos os campos");
      return;
    }

    if (isSignUp && !name) {
      setErrorMessage("Por favor, informe seu nome");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);
    console.log("[Auth Screen] Starting authentication...");
    console.log("[Auth Screen] Mode:", isSignUp ? "Sign Up" : "Sign In");
    console.log("[Auth Screen] Email:", email);

    try {
      if (isSignUp) {
        console.log("[Auth Screen] Signing up user:", email);
        await signUpWithEmail(email, password, name);
        console.log("[Auth Screen] ✅ Sign up successful");
      } else {
        console.log("[Auth Screen] Signing in user:", email);
        await signInWithEmail(email, password);
        console.log("[Auth Screen] ✅ Sign in successful");
      }
      
      console.log("[Auth Screen] ✅ Authentication successful");
    } catch (error: any) {
      console.error("[Auth Screen] ❌ Authentication failed:", error);
      console.error("[Auth Screen] ❌ Error message:", error?.message);
      console.error("[Auth Screen] ❌ Error stack:", error?.stack);
      
      const errorMsg = error?.message || "Erro ao autenticar. Tente novamente.";
      setErrorMessage(errorMsg);
      
      // Show alert for critical errors
      if (Platform.OS !== "web") {
        Alert.alert(
          "Erro de Autenticação",
          errorMsg,
          [{ text: "OK" }]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setErrorMessage("");
  };

  const modeText = isSignUp ? "Cadastrar" : "Entrar";
  const switchModeText = isSignUp
    ? "Já tem uma conta? Entrar"
    : "Não tem uma conta? Cadastrar";

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
            <Text style={styles.title}>Consultoria de Sono Infantil</Text>
            <Text style={styles.subtitle}>
              {isSignUp ? "Crie sua conta" : "Entre na sua conta"}
            </Text>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {isSignUp && (
              <TextInput
                style={styles.input}
                placeholder="Nome completo"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <TextInput
              style={styles.input}
              placeholder="Senha (mínimo 6 caracteres)"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{modeText}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={toggleMode}
              disabled={loading}
            >
              <Text style={styles.switchButtonText}>{switchModeText}</Text>
            </TouchableOpacity>

            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>
                📱 Plataforma: {Platform.OS}
              </Text>
              <Text style={styles.debugText}>
                🔧 Ambiente: {__DEV__ ? "Desenvolvimento" : "Produção"}
              </Text>
              <Text style={styles.debugText}>
                📍 Versão: 1.0.0
              </Text>
            </View>
          </View>
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
    justifyContent: "center",
    padding: spacing.lg,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  errorContainer: {
    backgroundColor: "#fee",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#fcc",
  },
  errorText: {
    color: "#c00",
    fontSize: 14,
    textAlign: "center",
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  switchButton: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  switchButtonText: {
    color: colors.primary,
    fontSize: 14,
  },
  debugInfo: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debugText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
});
