
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { authClient, setBearerToken, clearAuthTokens, getBearerToken } from "@/lib/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  signInWithToken: (token: string) => Promise<void>;
  createAccountWithToken: (token: string, name: string, password: string) => Promise<void>;
  validateBabyToken: (token: string) => Promise<{
    valid: boolean;
    babyId?: string;
    babyName?: string;
    motherEmail?: string;
    consultantName?: string;
    accountExists?: boolean;
  }>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function openOAuthPopup(provider: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popupUrl = `${window.location.origin}/auth-popup?provider=${provider}`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup. Please allow popups."));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth-success" && event.data?.token) {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve(event.data.token);
      } else if (event.data?.type === "oauth-error") {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize auth - runs ONLY ONCE on mount
  useEffect(() => {
    const initializeAuth = async () => {
      console.log("[Auth] 🔄 Initializing auth...");
      
      try {
        const token = await getBearerToken();
        
        if (!token) {
          console.log("[Auth] ℹ️ No token found, user not logged in");
          return;
        }
        
        console.log("[Auth] 🔑 Token found, fetching session...");
        
        const BACKEND_URL = await import("@/utils/api").then(m => m.BACKEND_URL);
        
        const response = await fetch(`${BACKEND_URL}/api/auth/get-session`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Origin": BACKEND_URL,
          },
        });
        
        if (!response.ok) {
          console.log("[Auth] ⚠️ Session invalid, clearing token");
          await clearAuthTokens();
          await AsyncStorage.removeItem("userRole");
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
            // Try to determine role by checking if consultant profile exists
            console.log("[Auth] ℹ️ No userRole in storage, checking consultant profile...");
            try {
              const profileResponse = await fetch(`${BACKEND_URL}/api/consultant/profile`, {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "Origin": BACKEND_URL,
                },
              });
              
              if (profileResponse.ok) {
                console.log("[Auth] ✅ User is consultant");
                setUserRole("consultant");
                await AsyncStorage.setItem("userRole", "consultant");
              } else {
                console.log("[Auth] ✅ User is mother");
                setUserRole("mother");
                await AsyncStorage.setItem("userRole", "mother");
              }
            } catch (roleErr) {
              console.log("[Auth] ℹ️ Could not determine role, defaulting to consultant");
              setUserRole("consultant");
              await AsyncStorage.setItem("userRole", "consultant");
            }
          }
        } else {
          console.log("[Auth] ⚠️ No user in session, clearing token");
          await clearAuthTokens();
          await AsyncStorage.removeItem("userRole");
        }
        
      } catch (error: any) {
        console.error("[Auth] ❌ Error initializing auth:", error?.message || error);
        await clearAuthTokens();
        await AsyncStorage.removeItem("userRole");
      } finally {
        // ALWAYS set loading to false
        console.log("[Auth] ✅ Auth initialization complete");
        setLoading(false);
      }
    };

    initializeAuth();
  }, []); // Empty dependency array - runs ONLY ONCE

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("[Auth] 🔐 Signing in with email:", email);
      
      const BACKEND_URL = await import("@/utils/api").then(m => m.BACKEND_URL);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": BACKEND_URL,
        },
        body: JSON.stringify({
          email,
          password,
          rememberMe: true,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Auth] ❌ Login failed:", response.status, errorText);
        let errorMsg = "Erro ao fazer login";
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.message) errorMsg = errJson.message;
          if (errJson.error) errorMsg = errJson.error;
        } catch {}
        throw new Error(errorMsg);
      }
      
      const responseData = await response.json();
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
        throw new Error("No token received from server");
      }
      
      console.log("[Auth] 💾 Saving token...");
      await setBearerToken(token);
      
      if (user) {
        console.log("[Auth] ✅ Setting user:", user.email);
        setUser(user);
        
        // Determine role by checking if consultant profile exists
        console.log("[Auth] 🔍 Determining user role...");
        try {
          const profileResponse = await fetch(`${BACKEND_URL}/api/consultant/profile`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Origin": BACKEND_URL,
            },
          });
          
          if (profileResponse.ok) {
            console.log("[Auth] ✅ User is consultant");
            setUserRole("consultant");
            await AsyncStorage.setItem("userRole", "consultant");
          } else {
            console.log("[Auth] ✅ User is mother");
            setUserRole("mother");
            await AsyncStorage.setItem("userRole", "mother");
          }
        } catch (roleErr) {
          console.log("[Auth] ℹ️ Could not determine role, defaulting to consultant");
          setUserRole("consultant");
          await AsyncStorage.setItem("userRole", "consultant");
        }
      } else {
        console.warn("[Auth] ⚠️ No user in response");
        throw new Error("No user data received");
      }
      
      console.log("[Auth] ✅ Login complete - user state updated");
      
    } catch (error: any) {
      console.error("[Auth] ❌ Email sign in failed:", error?.message || error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("[Auth] 📝 Signing up with email:", email);
      
      const BACKEND_URL = await import("@/utils/api").then(m => m.BACKEND_URL);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": BACKEND_URL,
        },
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
      
      console.log("[Auth] 💾 Saving token...");
      await setBearerToken(token);
      
      if (user) {
        console.log("[Auth] ✅ Setting user:", user.email);
        setUser(user);
        
        // Create consultant profile after signup
        console.log("[Auth] 📝 Creating consultant profile...");
        try {
          const profileResponse = await fetch(`${BACKEND_URL}/api/consultants/create-profile`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
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
      } else {
        console.warn("[Auth] ⚠️ No user in response");
        throw new Error("No user data received");
      }
      
      console.log("[Auth] ✅ Signup complete - user state updated");
      
    } catch (error: any) {
      console.error("[Auth] ❌ Email sign up failed:", error?.message || error);
      throw error;
    }
  };

  const signInWithToken = async (babyToken: string) => {
    try {
      console.log("[Auth] 🎫 Signing in with baby token");
      
      if (!babyToken || babyToken.trim().length === 0) {
        throw new Error("Token inválido");
      }

      const BACKEND_URL = await import("@/utils/api").then(m => m.BACKEND_URL);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": BACKEND_URL,
        },
        body: JSON.stringify({
          token: babyToken.trim(),
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Auth] ❌ Token sign-in failed:", response.status, errorText);
        
        let errorMsg = "Token inválido ou expirado";
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.error) errorMsg = errJson.error;
        } catch {}
        
        if (response.status === 404) {
          throw new Error("Token não encontrado. Verifique com sua consultora.");
        }
        if (response.status === 400) {
          throw new Error("Conta não encontrada para este token. Por favor, crie uma conta primeiro.");
        }
        throw new Error(errorMsg);
      }
      
      const responseData = await response.json();
      console.log("[Auth] ✅ Token sign-in response received");
      
      let sessionToken: string | null = null;
      let user: User | null = null;
      
      if (responseData?.session?.token) {
        sessionToken = responseData.session.token;
      } else if (responseData?.token) {
        sessionToken = responseData.token;
      } else if (responseData?.data?.session?.token) {
        sessionToken = responseData.data.session.token;
      }
      
      if (responseData?.user) {
        user = responseData.user as User;
      } else if (responseData?.data?.user) {
        user = responseData.data.user as User;
      }
      
      if (!sessionToken) {
        console.error("[Auth] ❌ No session token in response!");
        throw new Error("Não foi possível criar sessão. Tente novamente.");
      }
      
      console.log("[Auth] 💾 Saving session token...");
      await setBearerToken(sessionToken);
      
      if (user) {
        console.log("[Auth] ✅ Setting user:", user.email);
        setUser(user);
        await AsyncStorage.setItem("userRole", "mother");
        setUserRole("mother");
      } else {
        console.warn("[Auth] ⚠️ No user in response");
        throw new Error("No user data received");
      }
      
      console.log("[Auth] ✅ Token sign in complete - user state updated");
      
    } catch (error: any) {
      console.error("[Auth] ❌ Token sign in failed:", error?.message || error);
      throw error;
    }
  };

  const createAccountWithToken = async (babyToken: string, name: string, password: string) => {
    try {
      console.log("[Auth] 📝 Creating account with baby token");
      
      if (!babyToken || babyToken.trim().length === 0) {
        throw new Error("Token inválido");
      }
      if (!name || name.trim().length === 0) {
        throw new Error("Nome é obrigatório");
      }
      if (!password || password.length < 6) {
        throw new Error("Senha deve ter pelo menos 6 caracteres");
      }

      const BACKEND_URL = await import("@/utils/api").then(m => m.BACKEND_URL);

      console.log("[Auth] 📡 Calling /api/mothers/create-account-with-token with token:", babyToken.trim());
      
      const response = await fetch(`${BACKEND_URL}/api/mothers/create-account-with-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": BACKEND_URL,
        },
        body: JSON.stringify({
          token: babyToken.trim(),
          name: name.trim(),
          password,
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
        console.error("[Auth] ❌ Create account with token failed:", response.status, responseText);
        
        let errorMsg = "Erro ao criar conta";
        if (responseData?.error) errorMsg = responseData.error;
        
        if (response.status === 404) {
          throw new Error("Token não encontrado. Verifique com sua consultora.");
        }
        if (response.status === 409) {
          throw new Error("Já existe uma conta com este token. Use a opção de login.");
        }
        throw new Error(errorMsg);
      }
      
      console.log("[Auth] ✅ Create account with token response received");
      
      let sessionToken: string | null = null;
      let user: User | null = null;
      
      if (responseData?.session?.token) {
        sessionToken = responseData.session.token;
      } else if (responseData?.token) {
        sessionToken = responseData.token;
      } else if (responseData?.data?.session?.token) {
        sessionToken = responseData.data.session.token;
      }
      
      if (responseData?.user) {
        user = responseData.user as User;
      } else if (responseData?.data?.user) {
        user = responseData.data.user as User;
      }
      
      if (!sessionToken) {
        console.error("[Auth] ❌ No session token in response!");
        throw new Error("Não foi possível criar sessão. Tente novamente.");
      }
      
      console.log("[Auth] 💾 Saving session token...");
      await setBearerToken(sessionToken);
      
      if (user) {
        console.log("[Auth] ✅ Setting user:", user.email);
        setUser(user);
        await AsyncStorage.setItem("userRole", "mother");
        setUserRole("mother");
      } else {
        console.warn("[Auth] ⚠️ No user in response");
        throw new Error("No user data received");
      }
      
      console.log("[Auth] ✅ Create account complete - user state updated");
      
    } catch (error: any) {
      console.error("[Auth] ❌ Create account with token failed:", error?.message || error);
      throw error;
    }
  };

  const validateBabyToken = async (babyToken: string): Promise<{
    valid: boolean;
    babyId?: string;
    babyName?: string;
    motherEmail?: string;
    consultantName?: string;
    accountExists?: boolean;
  }> => {
    try {
      console.log("[Auth] 🔍 Validating baby token");
      
      const BACKEND_URL = await import("@/utils/api").then(m => m.BACKEND_URL);
      
      const response = await fetch(`${BACKEND_URL}/api/mothers/validate-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": BACKEND_URL,
        },
        body: JSON.stringify({ token: babyToken.trim() }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Auth] ❌ Token validation failed:", response.status, errorText);
        
        if (response.status === 404) {
          return { valid: false };
        }
        
        let errorMsg = "Token inválido";
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.error) errorMsg = errJson.error;
        } catch {}
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      console.log("[Auth] ✅ Token validation result:", data);
      return data;
    } catch (error: any) {
      console.error("[Auth] ❌ Token validation error:", error?.message || error);
      throw error;
    }
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    try {
      console.log("[Auth] 🔗 Signing in with", provider);
      
      if (Platform.OS === "web") {
        const token = await openOAuthPopup(provider);
        await setBearerToken(token);
        
        // Fetch user from session after OAuth
        const session = await authClient.getSession();
        if (session?.data?.user) {
          setUser(session.data.user as User);
        }
      } else {
        const callbackURL = Linking.createURL("/");
        console.log("[Auth] 📱 Using callback URL:", callbackURL);
        
        await authClient.signIn.social({
          provider,
          callbackURL,
        });
        
        // Fetch user from session after OAuth
        const session = await authClient.getSession();
        if (session?.data?.user) {
          setUser(session.data.user as User);
        }
      }
      
      console.log("[Auth] ✅ Social sign in complete");
    } catch (error: any) {
      console.error(`[Auth] ❌ ${provider} sign in failed:`, error?.message || error);
      throw error;
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");
  const signInWithApple = () => signInWithSocial("apple");
  const signInWithGitHub = () => signInWithSocial("github");

  const signOut = async () => {
    console.log("[Auth] 🚪 Signing out");
    setUser(null);
    setUserRole(null);
    
    try {
      await Promise.all([
        clearAuthTokens(),
        AsyncStorage.removeItem("userRole").catch(() => {}),
        AsyncStorage.removeItem("motherBabyId").catch(() => {}),
      ]);
      console.log("[Auth] ✅ Local state cleared");
      
      authClient.signOut().catch((error: any) => {
        console.error("[Auth] ⚠️ Backend sign out failed:", error?.message || error);
      });
      
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
        signInWithToken,
        createAccountWithToken,
        validateBabyToken,
        signInWithGoogle,
        signInWithApple,
        signInWithGitHub,
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
