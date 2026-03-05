
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
  // Use refs to prevent stale closures in AppState listener
  const isRefreshingRef = useRef(false);
  const userRef = useRef<User | null>(null);
  // Track last validation time to avoid too-frequent checks
  const lastValidationRef = useRef<number>(0);
  // Minimum interval between background validations: 5 minutes
  const VALIDATION_INTERVAL_MS = 5 * 60 * 1000;

  // Keep userRef in sync with user state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    console.log("[Auth] 🚀 AuthProvider mounted - initializing session");
    
    // Initial session check on mount
    fetchUser();

    // Listen for deep links (e.g. from social auth redirects)
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[Auth] 🔗 Deep link received:", event.url);
      fetchUser();
    });

    // 🔥 CRITICAL FIX: Use refs to avoid stale closure bug in AppState listener
    // Previously, `user` and `isRefreshing` were captured at mount time (always null/false)
    // Now we use refs which always reflect the current value
    const appStateSubscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        const now = Date.now();
        const timeSinceLastValidation = now - lastValidationRef.current;
        
        console.log("[Auth] 📱 App became active");
        
        // Only validate if:
        // 1. We have a user (using ref to avoid stale closure)
        // 2. We're not already refreshing
        // 3. Enough time has passed since last validation (5 min throttle)
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

  // 🔥 CRITICAL FIX: Silent session validation that NEVER clears user on network errors
  // Only clears on explicit 401/403 responses (truly invalid sessions)
  const validateSessionSilently = async () => {
    if (isRefreshingRef.current) {
      console.log("[Auth] ⏭️ Already refreshing, skipping validation");
      return;
    }

    isRefreshingRef.current = true;
    lastValidationRef.current = Date.now();

    try {
      console.log("[Auth] 🔍 Validating session silently...");
      
      // Check if we have a token first
      const token = await getBearerToken();
      if (!token) {
        console.log("[Auth] ⚠️ No token found during silent validation - user must re-login");
        setUser(null);
        userRef.current = null;
        return;
      }

      // Try to get session from Better Auth with a timeout
      const sessionPromise = authClient.getSession();
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error("Session check timeout")), 10000)
      );
      
      const session = await Promise.race([sessionPromise, timeoutPromise]) as any;
      
      if (session?.data?.user) {
        console.log("[Auth] ✅ Silent validation: session still valid for", session.data.user.email);
        setUser(session.data.user as User);
        userRef.current = session.data.user as User;
        
        // Sync token if available
        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
        }
      } else if (session?.data === null || session?.error) {
        // Explicit null data or error from server means session is truly invalid
        console.log("[Auth] ⚠️ Silent validation: session explicitly invalid, clearing user");
        setUser(null);
        userRef.current = null;
        await clearAuthTokens();
      }
      // If session is undefined/unexpected, keep user logged in (network issue)
    } catch (error: any) {
      const errorMessage = error?.message?.toLowerCase() || '';
      console.error("[Auth] ⚠️ Silent validation error:", error?.message || error);
      
      // 🔥 CRITICAL: Only clear user on explicit auth errors (401/403)
      // NEVER clear on network errors, timeouts, or other transient failures
      if (errorMessage.includes('unauthorized') || errorMessage.includes('401') || errorMessage.includes('403')) {
        console.log("[Auth] 🚪 Session explicitly rejected (401/403), clearing user");
        setUser(null);
        userRef.current = null;
        await clearAuthTokens();
      } else {
        // Network error, timeout, server error - keep user logged in
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
      
      // Check if we have a token first
      const existingToken = await getBearerToken();
      if (!existingToken) {
        console.log("[Auth] ⚠️ No token found in storage");
        setUser(null);
        userRef.current = null;
        setLoading(false);
        return;
      }

      console.log("[Auth] 🔑 Token exists in storage, fetching session...");
      
      // 🔥 CRITICAL FIX: Add retry logic with exponential backoff for network resilience
      let retries = 0;
      const maxRetries = 3;
      let session = null;
      let lastError: any = null;
      
      while (retries < maxRetries) {
        try {
          session = await authClient.getSession();
          console.log("[Auth] ✅ Session fetched successfully");
          lastError = null;
          break; // Success, exit retry loop
        } catch (error: any) {
          retries++;
          lastError = error;
          const errorMessage = error?.message || String(error);
          console.error(`[Auth] ⚠️ Session fetch attempt ${retries}/${maxRetries} failed:`, errorMessage);
          
          // Don't retry on explicit auth errors
          if (errorMessage.toLowerCase().includes('unauthorized') || 
              errorMessage.includes('401') || 
              errorMessage.includes('403')) {
            console.log("[Auth] 🚪 Auth error - not retrying");
            break;
          }
          
          if (retries < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retries - 1), 5000); // Exponential backoff: 1s, 2s, 4s
            console.log(`[Auth] ⏳ Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      if (session?.data?.user) {
        console.log("[Auth] ✅ User found in session:", session.data.user.email);
        setUser(session.data.user as User);
        userRef.current = session.data.user as User;
        
        // 🔥 CRITICAL: Ensure token is synced to storage
        if (session.data.session?.token) {
          const tokenPreview = session.data.session.token.substring(0, 20);
          console.log("[Auth] 🔑 Syncing token to storage (preview):", tokenPreview + "...");
          await setBearerToken(session.data.session.token);
          console.log("[Auth] ✅ Token synced successfully");
        } else {
          console.warn("[Auth] ⚠️ No token in session.data.session, using existing token");
          // Keep using the existing token - it's already in storage
        }
      } else if (lastError) {
        // We had errors during all retries
        const errorMessage = lastError?.message?.toLowerCase() || '';
        if (errorMessage.includes('unauthorized') || errorMessage.includes('401') || errorMessage.includes('403')) {
          console.log("[Auth] 🚪 Session invalid (401/403), clearing user");
          setUser(null);
          userRef.current = null;
          await clearAuthTokens();
        } else {
          // Network/transient error - keep user logged in with existing token
          console.log("[Auth] 🌐 Network/temporary error, keeping user logged in (token exists)");
          // Don't clear user - they have a valid token, just can't reach server right now
        }
      } else {
        // Session returned but no user data - session is truly expired
        console.log("[Auth] ❌ No user in session response - session expired");
        setUser(null);
        userRef.current = null;
        await clearAuthTokens();
      }
    } catch (error: any) {
      console.error("[Auth] ❌ Failed to fetch user:", error?.message || error);
      
      // 🔥 CRITICAL FIX: Only clear user on explicit auth errors, not network errors
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes('unauthorized') || errorMessage.includes('401') || errorMessage.includes('403')) {
        console.log("[Auth] 🚪 Session invalid (401/403), clearing user");
        setUser(null);
        userRef.current = null;
        await clearAuthTokens();
      } else {
        console.log("[Auth] 🌐 Network/temporary error, keeping user logged in if token exists");
        // Keep user logged in if we have a token - they can retry
        const token = await getBearerToken();
        if (!token) {
          console.log("[Auth] ⚠️ No token found, clearing user");
          setUser(null);
          userRef.current = null;
        }
        // If token exists, keep user state as-is (don't clear)
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("[Auth] 🔐 Signing in with email:", email);
      
      const signInResponse = await authClient.signIn.email({ 
        email, 
        password,
        // 🔥 CRITICAL: Request a long-lived session
        rememberMe: true
      });
      
      console.log("[Auth] ✅ Sign in response received");
      
      // 🔥 CRITICAL DEBUG: Log the ENTIRE response structure to see where the token is
      console.log("[Auth] 🔍 FULL Response:", JSON.stringify(signInResponse, null, 2));
      
      // 🔥 CRITICAL FIX: Extract token from multiple possible locations in the response
      const responseData = signInResponse as any;
      let extractedToken: string | null = null;
      let extractedUser: User | null = null;
      
      // Try different possible token locations
      if (responseData?.data?.session?.token) {
        extractedToken = responseData.data.session.token;
        console.log("[Auth] 🔑 Token found at data.session.token");
      } else if (responseData?.session?.token) {
        extractedToken = responseData.session.token;
        console.log("[Auth] 🔑 Token found at session.token");
      } else if (responseData?.token) {
        extractedToken = responseData.token;
        console.log("[Auth] 🔑 Token found at token");
      } else if (responseData?.data?.token) {
        extractedToken = responseData.data.token;
        console.log("[Auth] 🔑 Token found at data.token");
      }
      
      // Try to extract user
      if (responseData?.data?.user) {
        extractedUser = responseData.data.user as User;
        console.log("[Auth] 👤 User found at data.user");
      } else if (responseData?.user) {
        extractedUser = responseData.user as User;
        console.log("[Auth] 👤 User found at user");
      }
      
      // If we found a token, save it immediately
      if (extractedToken) {
        console.log("[Auth] 💾 Saving extracted token (length:", extractedToken.length, ")...");
        await setBearerToken(extractedToken);
        console.log("[Auth] ✅ Token saved successfully");
        
        // Also set user if available
        if (extractedUser) {
          setUser(extractedUser);
          userRef.current = extractedUser;
          console.log("[Auth] ✅ User set from response:", extractedUser.email);
        }
      } else {
        console.warn("[Auth] ⚠️ No token found in sign-in response!");
        console.warn("[Auth] 🔍 Response keys:", Object.keys(responseData || {}));
        if (responseData?.data) {
          console.warn("[Auth] 🔍 data keys:", Object.keys(responseData.data || {}));
        }
      }
      
      // Always fetch user to ensure everything is in sync
      console.log("[Auth] 🔄 Fetching user to verify session...");
      await fetchUser();
      
      // Verify token was synced
      const token = await getBearerToken();
      if (!token) {
        console.error("[Auth] ❌ CRITICAL: Token not synced after login!");
        throw new Error("Authentication failed - token not saved");
      }
      
      console.log("[Auth] ✅ Login complete, token verified (length:", token.length, ")");
    } catch (error: any) {
      console.error("[Auth] ❌ Email sign in failed:", error?.message || error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("[Auth] 📝 Signing up with email:", email);
      
      const signUpResponse = await authClient.signUp.email({
        email,
        password,
        name,
      });
      
      console.log("[Auth] ✅ Sign up response received");
      
      // 🔥 CRITICAL DEBUG: Log the ENTIRE response structure
      console.log("[Auth] 🔍 FULL Response:", JSON.stringify(signUpResponse, null, 2));
      
      // 🔥 CRITICAL FIX: Extract token from multiple possible locations in the response
      const responseData = signUpResponse as any;
      let extractedToken: string | null = null;
      let extractedUser: User | null = null;
      
      // Try different possible token locations
      if (responseData?.data?.session?.token) {
        extractedToken = responseData.data.session.token;
        console.log("[Auth] 🔑 Token found at data.session.token");
      } else if (responseData?.session?.token) {
        extractedToken = responseData.session.token;
        console.log("[Auth] 🔑 Token found at session.token");
      } else if (responseData?.token) {
        extractedToken = responseData.token;
        console.log("[Auth] 🔑 Token found at token");
      } else if (responseData?.data?.token) {
        extractedToken = responseData.data.token;
        console.log("[Auth] 🔑 Token found at data.token");
      }
      
      // Try to extract user
      if (responseData?.data?.user) {
        extractedUser = responseData.data.user as User;
        console.log("[Auth] 👤 User found at data.user");
      } else if (responseData?.user) {
        extractedUser = responseData.user as User;
        console.log("[Auth] 👤 User found at user");
      }
      
      // If we found a token, save it immediately
      if (extractedToken) {
        console.log("[Auth] 💾 Saving extracted token (length:", extractedToken.length, ")...");
        await setBearerToken(extractedToken);
        console.log("[Auth] ✅ Token saved successfully");
        
        // Also set user if available
        if (extractedUser) {
          setUser(extractedUser);
          userRef.current = extractedUser;
          console.log("[Auth] ✅ User set from response:", extractedUser.email);
        }
      } else {
        console.warn("[Auth] ⚠️ No token found in sign-up response!");
        console.warn("[Auth] 🔍 Response keys:", Object.keys(responseData || {}));
        if (responseData?.data) {
          console.warn("[Auth] 🔍 data keys:", Object.keys(responseData.data || {}));
        }
      }
      
      // Always fetch user to ensure everything is in sync
      console.log("[Auth] 🔄 Fetching user to verify session...");
      await fetchUser();
      
      // Verify token was synced
      const token = await getBearerToken();
      if (!token) {
        console.error("[Auth] ❌ CRITICAL: Token not synced after signup!");
        throw new Error("Registration failed - token not saved");
      }
      
      console.log("[Auth] ✅ Signup complete, token verified (length:", token.length, ")");
    } catch (error: any) {
      console.error("[Auth] ❌ Email sign up failed:", error?.message || error);
      throw error;
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
        // Native: Use expo-linking to generate a proper deep link
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
    // 🔥 CRITICAL FIX: Clear local state IMMEDIATELY before any async operations
    // This ensures the UI responds instantly and the user is never stuck
    console.log("[Auth] 🚪 Signing out - clearing local state immediately");
    setUser(null);
    userRef.current = null;
    
    try {
      // Clear tokens and storage in parallel
      await Promise.all([
        clearAuthTokens(),
        AsyncStorage.removeItem("userRole").catch(() => {}),
        AsyncStorage.removeItem("motherBabyId").catch(() => {}),
      ]);
      console.log("[Auth] ✅ Local state and tokens cleared");
      
      // Try to call backend logout (non-critical - don't block on it)
      authClient.signOut().then(() => {
        console.log("[Auth] ✅ Backend sign out successful");
      }).catch((error: any) => {
        console.error("[Auth] ⚠️ Backend sign out failed (non-critical):", error?.message || error);
      });
      
    } catch (error: any) {
      console.error("[Auth] ⚠️ Error during sign out cleanup:", error?.message || error);
      // Even if cleanup fails, user is already cleared from state
    }
    
    console.log("[Auth] ✅ Sign out complete");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
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
