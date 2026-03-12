
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
  createAccountWithToken: (token: string, email: string, password: string) => Promise<void>;
  validateBabyToken: (token: string) => Promise<{
    valid: boolean;
    babyName?: string;
    consultantName?: string;
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
        
        const BACKEND_URL = await import("@/utils/api").then(m => m.BACKEND_URL);
        
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
          console.log("[Auth] ✅ Session valid, user:", sessionData.user.email, "id:", sessionData.user.id);
          setUser(sessionData.user as User);
          
          // Load userRole from storage
          const storedRole = await AsyncStorage.getItem("userRole");
          if (storedRole) {
            console.log("[Auth] ✅ Loaded userRole from storage:", storedRole);
            setUserRole(storedRole);
          } else {
            // Determine role by checking consultant profile AND mother baby
            console.log("[Auth] ℹ️ No userRole in storage, determining role...");
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
                  
                  if (babyResponse.ok) {
                    console.log("[Auth] ✅ User is mother (has linked baby)");
                    setUserRole("mother");
                    await AsyncStorage.setItem("userRole", "mother");
                  } else {
                    // Default to mother if no consultant profile found
                    console.log("[Auth] ℹ️ No baby linked, defaulting to mother role");
                    setUserRole("mother");
                    await AsyncStorage.setItem("userRole", "mother");
                  }
                } catch (babyErr) {
                  console.log("[Auth] ℹ️ Could not check baby, defaulting to mother role");
                  setUserRole("mother");
                  await AsyncStorage.setItem("userRole", "mother");
                }
              }
            } catch (roleErr) {
              console.log("[Auth] ℹ️ Could not determine role, defaulting to consultant");
              setUserRole("consultant");
              await AsyncStorage.setItem("userRole", "consultant");
            }
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
      
      if (!user) {
        console.warn("[Auth] ⚠️ No user in response");
        throw new Error("No user data received");
      }
      
      // CRITICAL: Save token FIRST, then set user state
      console.log("[Auth] 💾 Saving token...");
      await setBearerToken(token);
      
      console.log("[Auth] ✅ Setting user:", user.email, "id:", user.id);
      setUser(user);
      
      // Determine role by checking BOTH consultant profile AND mother baby
      console.log("[Auth] 🔍 Determining user role...");
      try {
        const consultantResponse = await fetch(`${BACKEND_URL}/api/consultant/profile`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Origin": BACKEND_URL,
          },
        });
        
        if (consultantResponse.ok) {
          console.log("[Auth] ✅ User is consultant (has consultant profile)");
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
            
            if (babyResponse.ok) {
              console.log("[Auth] ✅ User is mother (has linked baby)");
              setUserRole("mother");
              await AsyncStorage.setItem("userRole", "mother");
            } else if (babyResponse.status === 404) {
              console.log("[Auth] ⚠️ No baby linked to this account (404) - setting role as mother");
              setUserRole("mother");
              await AsyncStorage.setItem("userRole", "mother");
            } else {
              console.log("[Auth] ℹ️ Could not determine role from baby check, defaulting to mother");
              setUserRole("mother");
              await AsyncStorage.setItem("userRole", "mother");
            }
          } catch (babyErr) {
            console.log("[Auth] ℹ️ Could not check baby, defaulting to mother role");
            setUserRole("mother");
            await AsyncStorage.setItem("userRole", "mother");
          }
        }
      } catch (roleErr) {
        console.log("[Auth] ℹ️ Could not determine role, defaulting to consultant");
        setUserRole("consultant");
        await AsyncStorage.setItem("userRole", "consultant");
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
      
      console.log("[Auth] ✅ Signup complete - user state updated");
      
    } catch (error: any) {
      console.error("[Auth] ❌ Email sign up failed:", error?.message || error);
      throw error;
    }
  };

  const createAccountWithToken = async (babyToken: string, email: string, password: string) => {
    try {
      console.log("[Auth] 📝 Creating account with baby token");
      
      if (!babyToken || babyToken.trim().length === 0) {
        throw new Error("Token inválido");
      }
      if (!email || email.trim().length === 0) {
        throw new Error("Email é obrigatório");
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
          email: email.trim(),
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
          throw new Error("Já existe uma conta com este email. Use a opção de login.");
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
      
      if (!user) {
        console.warn("[Auth] ⚠️ No user in response");
        throw new Error("No user data received");
      }
      
      // CRITICAL: Save token FIRST, then set user state
      console.log("[Auth] 💾 Saving session token...");
      await setBearerToken(sessionToken);
      
      console.log("[Auth] ✅ Setting user:", user.email, "id:", user.id);
      setUser(user);
      
      await AsyncStorage.setItem("userRole", "mother");
      setUserRole("mother");
      
      console.log("[Auth] ✅ Create account complete - user state updated");
      
    } catch (error: any) {
      console.error("[Auth] ❌ Create account with token failed:", error?.message || error);
      throw error;
    }
  };

  const validateBabyToken = async (babyToken: string): Promise<{
    valid: boolean;
    babyName?: string;
    consultantName?: string;
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
      return {
        valid: data.valid,
        babyName: data.babyName,
        consultantName: data.consultantName,
      };
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
      
      // Try to sign out from backend (non-blocking)
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

/**
 * Helper to check if a user is a mother by verifying they have a linked baby.
 * Returns true if the user has a linked baby, false otherwise.
 */
export async function checkIfMother(token: string, backendUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${backendUrl}/api/mother/baby`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Origin": backendUrl,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
