
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { authClient, setBearerToken, clearAuthTokens } from "@/lib/auth";
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

  useEffect(() => {
    // 🔥 CRITICAL FIX: Only fetch user on mount, no polling
    // Polling was causing unnecessary API calls that could invalidate the session
    console.log("[Auth] Initial user session check on mount");
    fetchUser();

    // Listen for deep links (e.g. from social auth redirects)
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[Auth] Deep link received, refreshing user session");
      fetchUser();
    });

    // 🔥 REMOVED: Polling interval that was causing session issues
    // Sessions should remain valid until explicitly logged out or token expires

    return () => {
      subscription.remove();
    };
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      console.log("[Auth] 🔄 Fetching user session...");
      
      // 🔥 CRITICAL FIX: Add retry logic with exponential backoff
      let retries = 0;
      const maxRetries = 3;
      let session = null;
      
      while (retries < maxRetries) {
        try {
          session = await authClient.getSession();
          break; // Success, exit retry loop
        } catch (error: any) {
          retries++;
          if (retries < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retries - 1), 5000); // Exponential backoff: 1s, 2s, 4s
            console.log(`[Auth] ⚠️ Session fetch failed (attempt ${retries}/${maxRetries}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error("[Auth] ❌ Failed to fetch session after", maxRetries, "attempts:", error);
            throw error;
          }
        }
      }
      
      console.log("[Auth] 📦 Session response:", JSON.stringify(session, null, 2));
      
      if (session?.data?.user) {
        console.log("[Auth] ✅ User found in session:", session.data.user.email);
        setUser(session.data.user as User);
        
        // 🔥 CRITICAL: Sync token to SecureStore for utils/api.ts
        if (session.data.session?.token) {
          const tokenPreview = session.data.session.token.substring(0, 30);
          console.log("[Auth] 🔑 Token found in session (preview):", tokenPreview + "...");
          console.log("[Auth] 💾 Syncing token to SecureStore...");
          await setBearerToken(session.data.session.token);
          console.log("[Auth] ✅ Token synced successfully to SecureStore");
        } else {
          console.warn("[Auth] ⚠️ No token found in session.data.session");
          console.log("[Auth] 🔍 Full session.data structure:", JSON.stringify(session.data, null, 2));
        }
      } else {
        console.log("[Auth] ❌ No user in session, clearing tokens");
        setUser(null);
        await clearAuthTokens();
      }
    } catch (error) {
      console.error("[Auth] ❌ Failed to fetch user:", error);
      // 🔥 CRITICAL FIX: Don't clear user on fetch error
      // Only clear if we explicitly know the session is invalid
      // This prevents logout on temporary network issues
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as any).message?.toLowerCase() || '';
        if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
          console.log("[Auth] Session is invalid (401), clearing user");
          setUser(null);
          await clearAuthTokens();
        } else {
          console.log("[Auth] Network/temporary error, keeping user logged in");
          // Keep user logged in on network errors
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("[Auth] 🔐 Signing in with email:", email);
      const signInResponse = await authClient.signIn.email({ email, password });
      console.log("[Auth] 📬 Sign in response:", JSON.stringify(signInResponse, null, 2));
      console.log("[Auth] ✅ Sign in successful, fetching user and syncing token...");
      
      // 🔥 CRITICAL: Fetch user immediately to sync token
      await fetchUser();
      console.log("[Auth] ✅ User fetched and token synced");
    } catch (error) {
      console.error("[Auth] ❌ Email sign in failed:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("[Auth] Signing up with email:", email);
      await authClient.signUp.email({
        email,
        password,
        name,
      });
      console.log("[Auth] Sign up successful, fetching user and syncing token...");
      
      // 🔥 CRITICAL: Fetch user immediately to sync token
      await fetchUser();
      console.log("[Auth] User fetched and token synced");
    } catch (error) {
      console.error("[Auth] Email sign up failed:", error);
      throw error;
    }
  };

  const signInWithSocial = async (provider: "google" | "apple" | "github") => {
    try {
      if (Platform.OS === "web") {
        const token = await openOAuthPopup(provider);
        await setBearerToken(token);
        await fetchUser();
      } else {
        // Native: Use expo-linking to generate a proper deep link
        const callbackURL = Linking.createURL("/");
        await authClient.signIn.social({
          provider,
          callbackURL,
        });
        await fetchUser();
      }
    } catch (error) {
      console.error(`${provider} sign in failed:`, error);
      throw error;
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");
  const signInWithApple = () => signInWithSocial("apple");
  const signInWithGitHub = () => signInWithSocial("github");

  const signOut = async () => {
    try {
      console.log("[Auth] 🚪 Signing out...");
      
      // 🔥 CRITICAL FIX: Always clear local state first
      // This ensures the user is logged out locally even if the API call fails
      console.log("[Auth] Clearing local state and tokens");
      setUser(null);
      await clearAuthTokens();
      
      // 🔥 CRITICAL: Clear stored user role and baby ID on logout
      try {
        await AsyncStorage.removeItem("userRole");
        await AsyncStorage.removeItem("motherBabyId");
        console.log("[Auth] ✅ Cleared stored user role and baby ID");
      } catch (storageError) {
        console.error("[Auth] Error clearing AsyncStorage:", storageError);
      }
      
      // Try to call backend logout, but don't fail if it errors
      try {
        await authClient.signOut();
        console.log("[Auth] ✅ Backend sign out successful");
      } catch (error) {
        console.error("[Auth] ⚠️ Backend sign out failed (non-critical):", error);
        // Continue anyway - local logout is what matters
      }
      
      console.log("[Auth] ✅ Sign out complete");
    } catch (error) {
      console.error("[Auth] ❌ Sign out error:", error);
      // Even if there's an error, ensure local state is cleared
      setUser(null);
      await clearAuthTokens();
      try {
        await AsyncStorage.removeItem("userRole");
        await AsyncStorage.removeItem("motherBabyId");
      } catch {}
    }
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
