
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
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
  loading: boolean;
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
  fetchUser: () => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const isRefreshingRef = useRef(false);
  const userRef = useRef<User | null>(null);
  const lastValidationRef = useRef<number>(0);
  const VALIDATION_INTERVAL_MS = 5 * 60 * 1000;
  const isUploadingRef = useRef(false); // Track if user is uploading

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    console.log("[Auth] 🚀 AuthProvider mounted - initializing session");
    
    fetchUser();

    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[Auth] 🔗 Deep link received:", event.url);
      fetchUser();
    });

    const appStateSubscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        const now = Date.now();
        const timeSinceLastValidation = now - lastValidationRef.current;
        
        console.log("[Auth] 📱 App became active");
        
        // 🔥 CRITICAL FIX: Don't validate session if user is uploading
        if (isUploadingRef.current) {
          console.log("[Auth] ⏭️ Skipping validation - user is uploading");
          return;
        }
        
        if (userRef.current && !isRefreshingRef.current && timeSinceLastValidation > VALIDATION_INTERVAL_MS) {
          console.log("[Auth] 🔍 Triggering background session validation");
          validateSessionSilently();
        } else {
          console.log("[Auth] ⏭️ Skipping validation - user:", !!userRef.current, "refreshing:", isRefreshingRef.current, "timeSince:", Math.round(timeSinceLastValidation / 1000) + "s");
        }
      }
    });

    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  const validateSessionSilently = async () => {
    if (isRefreshingRef.current) {
      console.log("[Auth] ⏭️ Already refreshing, skipping validation");
      return;
    }

    // 🔥 CRITICAL FIX: Don't validate if user is uploading
    if (isUploadingRef.current) {
      console.log("[Auth] ⏭️ Skipping validation - user is uploading");
      return;
    }

    isRefreshingRef.current = true;
    lastValidationRef.current = Date.now();

    try {
      console.log("[Auth] 🔍 Validating session silently...");
      
      const token = await getBearerToken();
      if (!token) {
        console.log("[Auth] ⚠️ No token found during silent validation - user must re-login");
        setUser(null);
        userRef.current = null;
        return;
      }

      const sessionPromise = authClient.getSession();
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error("Session check timeout")), 10000)
      );
      
      const session = await Promise.race([sessionPromise, timeoutPromise]) as any;
      
      if (session?.data?.user) {
        console.log("[Auth] ✅ Silent validation: session still valid for", session.data.user.email);
        setUser(session.data.user as User);
        userRef.current = session.data.user as User;
        
        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
        }
      } else if (session?.data === null || session?.error) {
        console.log("[Auth] ⚠️ Silent validation: session explicitly invalid, clearing user");
        setUser(null);
        userRef.current = null;
        await clearAuthTokens();
      }
    } catch (error: any) {
      const errorMessage = error?.message?.toLowerCase() || '';
      console.error("[Auth] ⚠️ Silent validation error:", error?.message || error);
      
      if (errorMessage.includes('unauthorized') || errorMessage.includes('401') || errorMessage.includes('403')) {
        console.log("[Auth] 🚪 Session explicitly rejected (401/403), clearing user");
        setUser(null);
        userRef.current = null;
        await clearAuthTokens();
      } else {
        console.log("[Auth] 🌐 Transient error during validation, keeping user logged in");
      }
    } finally {
      isRefreshingRef.current = false;
    }
  };

  const fetchUser = async () => {
    try {
      setLoading(true);
      console.log("[Auth] 🔄 Fetching user session...");
      
      const existingToken = await getBearerToken();
      if (!existingToken) {
        console.log("[Auth] ⚠️ No token found in storage");
        setUser(null);
        userRef.current = null;
        setLoading(false);
        return;
      }

      console.log("[Auth] 🔑 Token exists in storage, fetching session...");
      
      let retries = 0;
      const maxRetries = 3;
      let session = null;
      let lastError: any = null;
      
      while (retries < maxRetries) {
        try {
          session = await authClient.getSession();
          console.log("[Auth] ✅ Session fetched successfully");
          lastError = null;
          break;
        } catch (error: any) {
          retries++;
          lastError = error;
          const errorMessage = error?.message || String(error);
          console.error(`[Auth] ⚠️ Session fetch attempt ${retries}/${maxRetries} failed:`, errorMessage);
          
          if (errorMessage.toLowerCase().includes('unauthorized') || 
              errorMessage.includes('401') || 
              errorMessage.includes('403')) {
            console.log("[Auth] 🚪 Auth error - not retrying");
            break;
          }
          
          if (retries < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retries - 1), 5000);
            console.log(`[Auth] ⏳ Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      if (session?.data?.user) {
        console.log("[Auth] ✅ User found in session:", session.data.user.email);
        setUser(session.data.user as User);
        userRef.current = session.data.user as User;
        
        if (session.data.session?.token) {
          const tokenPreview = session.data.session.token.substring(0, 20);
          console.log("[Auth] 🔑 Syncing token to storage (preview):", tokenPreview + "...");
          await setBearerToken(session.data.session.token);
          console.log("[Auth] ✅ Token synced successfully");
        } else {
          console.warn("[Auth] ⚠️ No token in session.data.session, using existing token");
        }
      } else if (lastError) {
        const errorMessage = lastError?.message?.toLowerCase() || '';
        if (errorMessage.includes('unauthorized') || errorMessage.includes('401') || errorMessage.includes('403')) {
          console.log("[Auth] 🚪 Session invalid (401/403), clearing user");
          setUser(null);
          userRef.current = null;
          await clearAuthTokens();
        } else {
          console.log("[Auth] 🌐 Network/temporary error, keeping user logged in (token exists)");
        }
      } else {
        console.log("[Auth] ❌ No user in session response - session expired");
        setUser(null);
        userRef.current = null;
        await clearAuthTokens();
      }
    } catch (error: any) {
      console.error("[Auth] ❌ Failed to fetch user:", error?.message || error);
      
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes('unauthorized') || errorMessage.includes('401') || errorMessage.includes('403')) {
        console.log("[Auth] 🚪 Session invalid (401/403), clearing user");
        setUser(null);
        userRef.current = null;
        await clearAuthTokens();
      } else {
        console.log("[Auth] 🌐 Network/temporary error, keeping user logged in if token exists");
        const token = await getBearerToken();
        if (!token) {
          console.log("[Auth] ⚠️ No token found, clearing user");
          setUser(null);
          userRef.current = null;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("[Auth] 🔐 Signing in with email:", email);
      
      const BACKEND_URL = await import("@/utils/api").then(m => m.BACKEND_URL);
      
      console.log("[Auth] 📡 Calling backend directly:", `${BACKEND_URL}/api/auth/sign-in/email`);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": BACKEND_URL, // Required by Better Auth for CORS validation
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
        throw new Error(`Login failed: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log("[Auth] ✅ Login response received");
      console.log("[Auth] 🔍 Response keys:", Object.keys(responseData));
      
      // Extract token from response
      let token: string | null = null;
      let user: User | null = null;
      
      // Try all possible token locations
      if (responseData?.session?.token) {
        token = responseData.session.token;
        console.log("[Auth] 🔑 Token found at session.token");
      } else if (responseData?.token) {
        token = responseData.token;
        console.log("[Auth] 🔑 Token found at token");
      } else if (responseData?.data?.session?.token) {
        token = responseData.data.session.token;
        console.log("[Auth] 🔑 Token found at data.session.token");
      } else if (responseData?.data?.token) {
        token = responseData.data.token;
        console.log("[Auth] 🔑 Token found at data.token");
      }
      
      // Try to extract user
      if (responseData?.user) {
        user = responseData.user as User;
        console.log("[Auth] 👤 User found at user");
      } else if (responseData?.data?.user) {
        user = responseData.data.user as User;
        console.log("[Auth] 👤 User found at data.user");
      }
      
      if (!token) {
        console.error("[Auth] ❌ CRITICAL: No token in response!");
        console.error("[Auth] 🔍 Full response:", JSON.stringify(responseData, null, 2));
        throw new Error("No token received from server");
      }
      
      // Save token IMMEDIATELY
      console.log("[Auth] 💾 Saving token to storage (length:", token.length, ")...");
      await setBearerToken(token);
      
      // Verify token was saved
      const savedToken = await getBearerToken();
      if (!savedToken || savedToken !== token) {
        console.error("[Auth] ❌ CRITICAL: Token not saved correctly!");
        throw new Error("Failed to save authentication token");
      }
      
      console.log("[Auth] ✅ Token saved and verified");
      
      // Set user directly from login response
      if (user) {
        setUser(user);
        userRef.current = user;
        console.log("[Auth] ✅ User set from login response:", user.email);
        console.log("[Auth] ✅ Login complete - user is now authenticated");
      } else {
        console.warn("[Auth] ⚠️ No user in login response, will fetch from session");
        await fetchUser();
      }
      
    } catch (error: any) {
      console.error("[Auth] ❌ Email sign in failed:", error?.message || error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("[Auth] 📝 Signing up with email:", email);
      
      const BACKEND_URL = await import("@/utils/api").then(m => m.BACKEND_URL);
      
      console.log("[Auth] 📡 Calling backend directly:", `${BACKEND_URL}/api/auth/sign-up/email`);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": BACKEND_URL, // Required by Better Auth for CORS validation
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
        throw new Error(`Signup failed: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log("[Auth] ✅ Signup response received");
      console.log("[Auth] 🔍 Response keys:", Object.keys(responseData));
      
      // Extract token from response
      let token: string | null = null;
      let user: User | null = null;
      
      // Try all possible token locations
      if (responseData?.session?.token) {
        token = responseData.session.token;
        console.log("[Auth] 🔑 Token found at session.token");
      } else if (responseData?.token) {
        token = responseData.token;
        console.log("[Auth] 🔑 Token found at token");
      } else if (responseData?.data?.session?.token) {
        token = responseData.data.session.token;
        console.log("[Auth] 🔑 Token found at data.session.token");
      } else if (responseData?.data?.token) {
        token = responseData.data.token;
        console.log("[Auth] 🔑 Token found at data.token");
      }
      
      // Try to extract user
      if (responseData?.user) {
        user = responseData.user as User;
        console.log("[Auth] 👤 User found at user");
      } else if (responseData?.data?.user) {
        user = responseData.data.user as User;
        console.log("[Auth] 👤 User found at data.user");
      }
      
      if (!token) {
        console.error("[Auth] ❌ CRITICAL: No token in response!");
        console.error("[Auth] 🔍 Full response:", JSON.stringify(responseData, null, 2));
        throw new Error("No token received from server");
      }
      
      // Save token IMMEDIATELY
      console.log("[Auth] 💾 Saving token to storage (length:", token.length, ")...");
      await setBearerToken(token);
      
      // Verify token was saved
      const savedToken = await getBearerToken();
      if (!savedToken || savedToken !== token) {
        console.error("[Auth] ❌ CRITICAL: Token not saved correctly!");
        throw new Error("Failed to save authentication token");
      }
      
      console.log("[Auth] ✅ Token saved and verified");
      
      // Set user directly from signup response
      if (user) {
        setUser(user);
        userRef.current = user;
        console.log("[Auth] ✅ User set from signup response:", user.email);
        console.log("[Auth] ✅ Signup complete - user is now authenticated");
      } else {
        console.warn("[Auth] ⚠️ No user in signup response, will fetch from session");
        await fetchUser();
      }
      
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
      
      console.log("[Auth] 📡 Calling /api/auth/sign-in/token endpoint");
      
      const response = await fetch(`${BACKEND_URL}/api/auth/sign-in/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": BACKEND_URL, // Required by Better Auth for CORS validation
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
        throw new Error(errorMsg);
      }
      
      const responseData = await response.json();
      console.log("[Auth] ✅ Token sign-in response received");
      console.log("[Auth] 🔍 Response keys:", Object.keys(responseData));
      
      // Extract session token from response
      let sessionToken: string | null = null;
      let user: User | null = null;
      
      if (responseData?.session?.token) {
        sessionToken = responseData.session.token;
        console.log("[Auth] 🔑 Session token found at session.token");
      } else if (responseData?.token) {
        sessionToken = responseData.token;
        console.log("[Auth] 🔑 Session token found at token");
      }
      
      if (responseData?.user) {
        user = responseData.user as User;
        console.log("[Auth] 👤 User found at user");
      }
      
      if (!sessionToken) {
        console.error("[Auth] ❌ CRITICAL: No session token in response!");
        console.error("[Auth] 🔍 Full response:", JSON.stringify(responseData, null, 2));
        throw new Error("No session token received from server");
      }
      
      // Save the session token (NOT the baby token)
      console.log("[Auth] 💾 Saving session token to storage (length:", sessionToken.length, ")...");
      await setBearerToken(sessionToken);
      
      // Verify token was saved
      const savedToken = await getBearerToken();
      if (!savedToken || savedToken !== sessionToken) {
        console.error("[Auth] ❌ CRITICAL: Session token not saved correctly!");
        throw new Error("Failed to save authentication token");
      }
      
      console.log("[Auth] ✅ Session token saved and verified");
      
      // Set user directly from response
      if (user) {
        setUser(user);
        userRef.current = user;
        // Mark user as mother role in AsyncStorage for tab layout routing
        await AsyncStorage.setItem("userRole", "mother");
        console.log("[Auth] ✅ User set from token sign-in response:", user.email);
        console.log("[Auth] ✅ Token sign in complete");
      } else {
        console.warn("[Auth] ⚠️ No user in token sign-in response, will fetch from session");
        await fetchUser();
      }
      
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
      
      console.log("[Auth] 📡 Calling /api/auth/create-account-with-token endpoint");
      
      const response = await fetch(`${BACKEND_URL}/api/auth/create-account-with-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": BACKEND_URL, // Required by Better Auth for CORS validation
        },
        body: JSON.stringify({
          token: babyToken.trim(),
          name: name.trim(),
          password,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Auth] ❌ Create account with token failed:", response.status, errorText);
        
        let errorMsg = "Erro ao criar conta";
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.error) errorMsg = errJson.error;
        } catch {}
        
        if (response.status === 404) {
          throw new Error("Token não encontrado. Verifique com sua consultora.");
        }
        if (response.status === 409) {
          throw new Error("Já existe uma conta com este token. Use a opção de login.");
        }
        throw new Error(errorMsg);
      }
      
      const responseData = await response.json();
      console.log("[Auth] ✅ Create account with token response received");
      
      // Extract session token from response
      let sessionToken: string | null = null;
      let user: User | null = null;
      
      if (responseData?.session?.token) {
        sessionToken = responseData.session.token;
        console.log("[Auth] 🔑 Session token found at session.token");
      } else if (responseData?.token) {
        sessionToken = responseData.token;
        console.log("[Auth] 🔑 Session token found at token");
      }
      
      if (responseData?.user) {
        user = responseData.user as User;
        console.log("[Auth] 👤 User found at user");
      }
      
      if (!sessionToken) {
        console.error("[Auth] ❌ CRITICAL: No session token in response!");
        throw new Error("No session token received from server");
      }
      
      // Save the session token
      console.log("[Auth] 💾 Saving session token to storage...");
      await setBearerToken(sessionToken);
      
      const savedToken = await getBearerToken();
      if (!savedToken || savedToken !== sessionToken) {
        console.error("[Auth] ❌ CRITICAL: Session token not saved correctly!");
        throw new Error("Failed to save authentication token");
      }
      
      console.log("[Auth] ✅ Session token saved and verified");
      
      if (user) {
        setUser(user);
        userRef.current = user;
        // Mark user as mother role in AsyncStorage for tab layout routing
        await AsyncStorage.setItem("userRole", "mother");
        console.log("[Auth] ✅ User set from create account response:", user.email);
        console.log("[Auth] ✅ Create account with token complete");
      } else {
        console.warn("[Auth] ⚠️ No user in create account response, will fetch from session");
        await fetchUser();
      }
      
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
      
      const response = await fetch(`${BACKEND_URL}/api/auth/validate-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": BACKEND_URL, // Required by Better Auth for CORS validation
        },
        body: JSON.stringify({ token: babyToken.trim() }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Auth] ❌ Token validation failed:", response.status, errorText);
        return { valid: false };
      }
      
      const data = await response.json();
      console.log("[Auth] ✅ Token validation result:", data);
      return data;
    } catch (error: any) {
      console.error("[Auth] ❌ Token validation error:", error?.message || error);
      return { valid: false };
    }
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    try {
      console.log("[Auth] 🔗 Signing in with", provider);
      
      if (Platform.OS === "web") {
        const token = await openOAuthPopup(provider);
        await setBearerToken(token);
        await fetchUser();
      } else {
        const callbackURL = Linking.createURL("/");
        console.log("[Auth] 📱 Using callback URL:", callbackURL);
        
        await authClient.signIn.social({
          provider,
          callbackURL,
        });
        
        await fetchUser();
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
    console.log("[Auth] 🚪 Signing out - clearing local state immediately");
    setUser(null);
    userRef.current = null;
    
    try {
      await Promise.all([
        clearAuthTokens(),
        AsyncStorage.removeItem("userRole").catch(() => {}),
        AsyncStorage.removeItem("motherBabyId").catch(() => {}),
      ]);
      console.log("[Auth] ✅ Local state and tokens cleared");
      
      authClient.signOut().then(() => {
        console.log("[Auth] ✅ Backend sign out successful");
      }).catch((error: any) => {
        console.error("[Auth] ⚠️ Backend sign out failed (non-critical):", error?.message || error);
      });
      
    } catch (error: any) {
      console.error("[Auth] ⚠️ Error during sign out cleanup:", error?.message || error);
    }
    
    console.log("[Auth] ✅ Sign out complete");
  };

  // 🔥 NEW: Export function to pause/resume session validation during uploads
  const setUploadingState = (isUploading: boolean) => {
    console.log("[Auth] 📤 Upload state changed:", isUploading);
    isUploadingRef.current = isUploading;
  };

  // Expose setUploadingState via context (we'll add it to the context type)
  (AuthContext as any)._setUploadingState = setUploadingState;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithToken,
        createAccountWithToken,
        validateBabyToken,
        signInWithGoogle,
        signInWithApple,
        signInWithGitHub,
        signOut,
        fetchUser,
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

// 🔥 NEW: Export helper to pause session validation during uploads
export function setUploadingState(isUploading: boolean) {
  const setFn = (AuthContext as any)._setUploadingState;
  if (setFn) {
    setFn(isUploading);
  }
}
