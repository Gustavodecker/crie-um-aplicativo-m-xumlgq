
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "";

export const BEARER_TOKEN_KEY = "sleep-consultant_bearer_token";

// Platform-specific storage: localStorage for web, SecureStore for native
const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => {
        try {
          return localStorage.getItem(key);
        } catch (error) {
          console.error("[Auth/Storage] Error reading from localStorage:", error);
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.error("[Auth/Storage] Error writing to localStorage:", error);
        }
      },
      deleteItem: (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error("[Auth/Storage] Error deleting from localStorage:", error);
        }
      },
    }
  : {
      getItem: async (key: string) => {
        try {
          return await SecureStore.getItemAsync(key);
        } catch (error) {
          console.error("[Auth/Storage] Error reading from SecureStore:", error);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          await SecureStore.setItemAsync(key, value);
        } catch (error) {
          console.error("[Auth/Storage] Error writing to SecureStore:", error);
        }
      },
      deleteItem: async (key: string) => {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (error) {
          console.error("[Auth/Storage] Error deleting from SecureStore:", error);
        }
      },
    };

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "sleep-consultant",
      storagePrefix: "sleep-consultant",
      storage,
    }),
  ],
});

export async function setBearerToken(token: string) {
  if (!token) {
    console.error("[Auth/setBearerToken] ❌ Attempted to save empty token");
    return;
  }

  const tokenPreview = token.substring(0, 20);
  console.log("[Auth/setBearerToken] 💾 Saving token (preview):", tokenPreview + "...");
  
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(BEARER_TOKEN_KEY, token);
      console.log("[Auth/setBearerToken] ✅ Token saved to localStorage");
      
      // Verify it was saved
      const saved = localStorage.getItem(BEARER_TOKEN_KEY);
      if (saved === token) {
        console.log("[Auth/setBearerToken] ✅ Verification: Token correctly saved");
      } else {
        console.error("[Auth/setBearerToken] ❌ Verification FAILED: Token mismatch!");
      }
    } else {
      await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
      console.log("[Auth/setBearerToken] ✅ Token saved to SecureStore");
      
      // Verify it was saved
      const saved = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
      if (saved === token) {
        console.log("[Auth/setBearerToken] ✅ Verification: Token correctly saved");
      } else {
        console.error("[Auth/setBearerToken] ❌ Verification FAILED: Token mismatch!");
      }
    }
  } catch (error) {
    console.error("[Auth/setBearerToken] ❌ Error saving token:", error);
    throw error;
  }
}

export async function getBearerToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      const token = localStorage.getItem(BEARER_TOKEN_KEY);
      if (token) {
        console.log("[Auth/getBearerToken] 🔑 Token from localStorage: EXISTS (length:", token.length, ")");
      } else {
        console.log("[Auth/getBearerToken] ⚠️ No token in localStorage");
      }
      return token;
    } else {
      const token = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
      if (token) {
        console.log("[Auth/getBearerToken] 🔑 Token from SecureStore: EXISTS (length:", token.length, ")");
      } else {
        console.log("[Auth/getBearerToken] ⚠️ No token in SecureStore");
      }
      return token;
    }
  } catch (error) {
    console.error("[Auth/getBearerToken] ❌ Error retrieving token:", error);
    return null;
  }
}

export async function clearAuthTokens() {
  console.log("[Auth/clearAuthTokens] 🧹 Clearing all auth tokens");
  try {
    if (Platform.OS === "web") {
      // Clear both our token and Better Auth's tokens
      localStorage.removeItem(BEARER_TOKEN_KEY);
      
      // Clear all Better Auth related keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sleep-consultant")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log("[Auth/clearAuthTokens] ✅ Cleared localStorage tokens");
    } else {
      // Clear our token
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
      
      // Clear Better Auth tokens
      try {
        await SecureStore.deleteItemAsync("sleep-consultant.session.token");
        await SecureStore.deleteItemAsync("sleep-consultant.session");
      } catch (e) {
        // These might not exist, that's ok
      }
      
      console.log("[Auth/clearAuthTokens] ✅ Cleared SecureStore tokens");
    }
  } catch (error) {
    console.error("[Auth/clearAuthTokens] ⚠️ Error clearing tokens:", error);
    // Don't throw - clearing tokens should always succeed
  }
}

export { API_URL };
