
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { setBearerToken, clearAuthTokens, getBearerToken } from "@/lib/auth";
import { BACKEND_URL } from "@/utils/api";

/**
 * Build headers for Better Auth endpoints.
 * Better Auth requires an Origin header for CSRF protection on POST requests.
 * React Native mobile apps do NOT automatically send Origin headers like browsers do,
 * so we must add it manually. Without this, Better Auth returns 403 MISSING_OR_NULL_ORIGIN.
 */
function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Add Origin header so Better Auth CSRF check passes on mobile
    // Mobile apps don't send Origin automatically, causing 403 errors
    "Origin": BACKEND_URL,
    ...extra,
  };
  return headers;
}

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  userRole: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  registerMother: (email: string, password: string, inviteCode: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize auth - runs ONLY ONCE on mount
  // clearAuthTokens() is NOT called here automatically
  useEffect(() => {
    const initializeAuth = async () => {
      console.log("[Auth] 🔄 Initializing auth...");
      
      try {
        const token = await getBearerToken();
        
        if (!token) {
          console.log("[Auth] ℹ️ No token found, user not logged in");
          return;
        }
        
        console.log("[Auth] 🔑 Token found, validating session...");
        
        const response = await fetch(`${BACKEND_URL}/api/auth/get-session`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Origin": BACKEND_URL,
          },
        });
        
        // Only clear tokens if backend explicitly returns 401 (unauthorized)
        if (response.status === 401) {
          console.log("[Auth] ⚠️ Session unauthorized (401), clearing tokens");
          await clearAuthTokens();
          await AsyncStorage.removeItem("userRole");
          return;
        }
        
        if (!response.ok) {
          console.log("[Auth] ⚠️ Session validation failed:", response.status);
          // Don't clear tokens for other errors (network issues, 500, etc.)
          // User might still be logged in, just can't reach backend
          return;
        }
        
        const sessionData = await response.json();
        
        if (sessionData?.user) {
          console.log("[Auth] ✅ Session valid, user:", sessionData.user.email);
          setUser(sessionData.user as User);
          
          // Load userRole from storage
          const storedRole = await AsyncStorage.getItem("userRole");
          if (storedRole) {
            console.log("[Auth] ✅ Loaded userRole from storage:", storedRole);
            setUserRole(storedRole);
          } else {
            // Determine role by checking consultant profile AND mother baby
            console.log("[Auth] ℹ️ No userRole in storage, determining role...");
            await determineUserRole(token);
          }
        } else {
          console.log("[Auth] ⚠️ No user in session response");
          // Don't clear tokens - might be a backend issue
        }
        
      } catch (error: any) {
        console.error("[Auth] ❌ Error initializing auth:", error?.message || error);
        // Don't clear tokens on network errors - user might still be logged in
      } finally {
        // ALWAYS set loading to false
        console.log("[Auth] ✅ Auth initialization complete");
        setLoading(false);
      }
    };

    initializeAuth();
  }, []); // Empty dependency array - runs ONLY ONCE

  const determineUserRole = async (token: string) => {
    try {
      const consultantResponse = await fetch(`${BACKEND_URL}/api/consultant/profile`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Origin": BACKEND_URL,
        },
      });
      
      if (consultantResponse.ok) {
        console.log("[Auth] ✅ User is consultant");
        setUserRole("consultant");
        await AsyncStorage.setItem("userRole", "consultant");
      } else {
        // Not a consultant - check if they have a linked baby (mother)
        console.log("[Auth] 🔍 No consultant profile, checking if user is mother...");
        try {
          const babyResponse = await fetch(`${BACKEND_URL}/api/mother/baby`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Origin": BACKEND_URL,
            },
          });
          
          if (babyResponse.ok || babyResponse.status === 404) {
            console.log("[Auth] ✅ User is mother");
            setUserRole("mother");
            await AsyncStorage.setItem("userRole", "mother");
          } else {
            console.log("[Auth] ℹ️ Defaulting to mother role");
            setUserRole("mother");
            await AsyncStorage.setItem("userRole", "mother");
          }
        } catch (babyErr: any) {
          console.log("[Auth] ℹ️ Could not check baby, defaulting to mother role");
          setUserRole("mother");
          await AsyncStorage.setItem("userRole", "mother");
        }
      }
    } catch (roleErr: any) {
      console.log("[Auth] ℹ️ Could not determine role, defaulting to consultant");
      setUserRole("consultant");
      await AsyncStorage.setItem("userRole", "consultant");
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("[Auth] 🔐 Signing in with email:", email);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          email,
          password,
          rememberMe: true,
        }),
      });
      
      const responseText = await response.text();
      console.log("[Auth] 📥 Response status:", response.status);
      
      if (!response.ok) {
        console.error("[Auth] ❌ Login failed:", response.status, responseText);
        let errorMsg = "Erro ao fazer login";
        
        try {
          const errJson = JSON.parse(responseText);
          if (errJson.message) errorMsg = errJson.message;
          if (errJson.error) errorMsg = errJson.error;
          if (errJson.code === "INVALID_EMAIL_OR_PASSWORD") {
            errorMsg = "Email ou senha incorretos";
          }
        } catch (parseErr) {
          if (responseText && responseText.length > 0 && responseText.length < 200) {
            errorMsg = responseText;
          }
        }
        
        if (response.status === 401) {
          errorMsg = "Email ou senha incorretos";
        } else if (response.status === 404) {
          errorMsg = "Conta não encontrada. Verifique seu email ou crie uma nova conta.";
        } else if (response.status === 500) {
          errorMsg = "Erro ao fazer login. Verifique seu email e senha e tente novamente.";
        }
        
        throw new Error(errorMsg);
      }
      
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseErr) {
        console.error("[Auth] ❌ Failed to parse response as JSON");
        throw new Error("Resposta inválida do servidor");
      }
      
      console.log("[Auth] ✅ Login response received");
      
      let token: string | null = null;
      let user: User | null = null;
      
      if (responseData?.session?.token) {
        token = responseData.session.token;
      } else if (responseData?.token) {
        token = responseData.token;
      } else if (responseData?.data?.session?.token) {
        token = responseData.data.session.token;
      } else if (responseData?.data?.token) {
        token = responseData.data.token;
      }
      
      if (responseData?.user) {
        user = responseData.user as User;
      } else if (responseData?.data?.user) {
        user = responseData.data.user as User;
      }
      
      if (!token) {
        console.error("[Auth] ❌ No token in response!");
        throw new Error("Nenhum token recebido do servidor");
      }
      
      if (!user) {
        console.error("[Auth] ❌ No user in response!");
        throw new Error("Nenhum dado de usuário recebido");
      }
      
      // CRITICAL: Save token FIRST, then set user state
      console.log("[Auth] 💾 Saving token...");
      await setBearerToken(token);
      
      console.log("[Auth] ✅ Setting user:", user.email);
      setUser(user);
      
      // Determine role
      console.log("[Auth] 🔍 Determining user role...");
      await determineUserRole(token);
      
      console.log("[Auth] ✅ Login complete");
      
    } catch (error: any) {
      console.error("[Auth] ❌ Email sign in failed:", error?.message || error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("[Auth] 📝 Signing up with email:", email);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Auth] ❌ Signup failed:", response.status, errorText);
        let errorMsg = `Erro ao criar conta`;
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.message) errorMsg = errJson.message;
          if (errJson.error) errorMsg = errJson.error;
          if (errorText.toLowerCase().includes("already") || errorText.toLowerCase().includes("exists")) {
            errorMsg = "Este e-mail já está cadastrado. Faça login.";
          }
        } catch {}
        throw new Error(errorMsg);
      }
      
      const responseData = await response.json();
      console.log("[Auth] ✅ Signup response received");
      
      let token: string | null = null;
      let user: User | null = null;
      
      if (responseData?.session?.token) {
        token = responseData.session.token;
      } else if (responseData?.token) {
        token = responseData.token;
      } else if (responseData?.data?.session?.token) {
        token = responseData.data.session.token;
      } else if (responseData?.data?.token) {
        token = responseData.data.token;
      }
      
      if (responseData?.user) {
        user = responseData.user as User;
      } else if (responseData?.data?.user) {
        user = responseData.data.user as User;
      }
      
      if (!token) {
        console.error("[Auth] ❌ No token in response!");
        throw new Error("No token received from server");
      }
      
      if (!user) {
        console.warn("[Auth] ⚠️ No user in response");
        throw new Error("No user data received");
      }
      
      // CRITICAL: Save token FIRST, then set user state
      console.log("[Auth] 💾 Saving token...");
      await setBearerToken(token);
      
      console.log("[Auth] ✅ Setting user:", user.email);
      setUser(user);
      
      // Create consultant profile after signup
      console.log("[Auth] 📝 Creating consultant profile...");
      try {
        const profileResponse = await fetch(`${BACKEND_URL}/api/consultants/create-profile`, {
          method: "POST",
          headers: buildAuthHeaders({ "Authorization": `Bearer ${token}` }),
          body: JSON.stringify({
            name: name || email.split("@")[0],
          }),
        });
        
        if (profileResponse.ok) {
          console.log("[Auth] ✅ Consultant profile created");
        } else {
          console.warn("[Auth] ⚠️ Could not create consultant profile");
        }
      } catch (profileErr: any) {
        console.warn("[Auth] ⚠️ Error creating consultant profile:", profileErr?.message);
      }
      
      await AsyncStorage.setItem("userRole", "consultant");
      setUserRole("consultant");
      
      console.log("[Auth] ✅ Signup complete");
      
    } catch (error: any) {
      console.error("[Auth] ❌ Email sign up failed:", error?.message || error);
      throw error;
    }
  };

  const registerMother = async (email: string, password: string, inviteCode: string) => {
    try {
      console.log("[Auth] 📝 Registering mother with invite code");
      
      if (!inviteCode || inviteCode.trim().length === 0) {
        throw new Error("Código de convite é obrigatório");
      }
      if (!email || email.trim().length === 0) {
        throw new Error("Email é obrigatório");
      }
      if (!password || password.length < 6) {
        throw new Error("Senha deve ter pelo menos 6 caracteres");
      }

      console.log("[Auth] 📡 Calling /api/mother/register");
      
      const response = await fetch(`${BACKEND_URL}/api/mother/register`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          email: email.trim(),
          password: password,
          inviteCode: inviteCode.trim(),
        }),
      });
      
      const responseText = await response.text();
      let responseData: any = null;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = {};
      }
      
      if (!response.ok) {
        console.error("[Auth] ❌ Mother registration failed:", response.status, responseText);
        
        let errorMsg = "Erro ao criar conta";
        if (responseData?.error) errorMsg = responseData.error;
        if (responseData?.message) errorMsg = responseData.message;
        
        if (response.status === 404) {
          throw new Error("Código inválido. Verifique o código fornecido pela consultora.");
        }
        if (response.status === 409) {
          if (errorMsg.toLowerCase().includes("código") || errorMsg.toLowerCase().includes("utilizado")) {
            throw new Error("Este código já foi utilizado. Solicite um novo código à sua consultora.");
          }
          if (errorMsg.toLowerCase().includes("email") || errorMsg.toLowerCase().includes("já existe")) {
            throw new Error("EMAIL_ALREADY_EXISTS: Já existe uma conta com este email. Use a opção 'Já tenho conta' para fazer login.");
          }
          throw new Error(errorMsg);
        }
        throw new Error(errorMsg);
      }
      
      console.log("[Auth] ✅ Mother registration response received");
      
      const sessionToken = responseData?.token;
      const user = responseData?.user;
      
      if (!sessionToken) {
        console.error("[Auth] ❌ No session token in response!");
        throw new Error("Não foi possível criar sessão. Tente novamente.");
      }
      
      if (!user) {
        console.warn("[Auth] ⚠️ No user in response");
        throw new Error("Dados do usuário não recebidos");
      }
      
      // CRITICAL: Save token FIRST, then set user state
      console.log("[Auth] 💾 Saving session token...");
      await setBearerToken(sessionToken);
      
      console.log("[Auth] ✅ Setting user:", user.email);
      setUser(user);
      
      await AsyncStorage.setItem("userRole", "mother");
      setUserRole("mother");
      
      console.log("[Auth] ✅ Mother registration complete");
      
    } catch (error: any) {
      console.error("[Auth] ❌ Mother registration failed:", error?.message || error);
      throw error;
    }
  };

  const signOut = async () => {
    console.log("[Auth] 🚪 Signing out");
    
    // Clear local state immediately
    setUser(null);
    setUserRole(null);
    
    try {
      // Clear tokens and storage
      await Promise.all([
        clearAuthTokens(),
        AsyncStorage.removeItem("userRole").catch(() => {}),
        AsyncStorage.removeItem("motherBabyId").catch(() => {}),
      ]);
      console.log("[Auth] ✅ Local state and tokens cleared");
      
    } catch (error: any) {
      console.error("[Auth] ⚠️ Error during sign out:", error?.message || error);
    }
    
    console.log("[Auth] ✅ Sign out complete");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userRole,
        loading,
        setUser,
        signInWithEmail,
        signUpWithEmail,
        registerMother,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

// Export for upload state management
export function setUploadingState(uploading: boolean) {
  console.log("[Auth] Upload state:", uploading);
}
