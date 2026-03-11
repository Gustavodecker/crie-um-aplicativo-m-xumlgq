
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "";

export const BEARER_TOKEN_KEY = "sleep-consultant_bearer_token";
export const BETTER_AUTH_SESSION_KEY = "sleep-consultant.session.token";

// 🔥 CRITICAL FIX: Use correct AsyncStorage methods (getItem, setItem, removeItem)
// AsyncStorage does NOT have getItemAsync, setItemAsync, removeItemAsync
const storage = {
  getItem: async (key: string) => {
    try {
      if (Platform.OS === "web") {
        const value = localStorage.getItem(key);
        console.log(`[Auth/Storage] getItem(${key}):`, value ? "EXISTS" : "NULL");
        return value;
      } else {
        // ✅ CORRECT: Use AsyncStorage.getItem() (returns Promise<string | null>)
        const value = await AsyncStorage.getItem(key);
        console.log(`[Auth/Storage] getItem(${key}):`, value ? "EXISTS" : "NULL");
        return value;
      }
    } catch (error) {
      console.error(`[Auth/Storage] Error reading ${key}:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === "web") {
        localStorage.setItem(key, value);
        console.log(`[Auth/Storage] setItem(${key}): SUCCESS`);
      } else {
        // ✅ CORRECT: Use AsyncStorage.setItem() (returns Promise<void>)
        await AsyncStorage.setItem(key, value);
        console.log(`[Auth/Storage] setItem(${key}): SUCCESS`);
      }
    } catch (error) {
      console.error(`[Auth/Storage] Error writing ${key}:`, error);
      throw error;
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === "web") {
        localStorage.removeItem(key);
        console.log(`[Auth/Storage] removeItem(${key}): SUCCESS`);
      } else {
        // ✅ CORRECT: Use AsyncStorage.removeItem() (returns Promise<void>)
        await AsyncStorage.removeItem(key);
        console.log(`[Auth/Storage] removeItem(${key}): SUCCESS`);
      }
    } catch (error) {
      console.error(`[Auth/Storage] Error deleting ${key}:`, error);
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
      localStorage.setItem(BETTER_AUTH_SESSION_KEY, token);
      console.log("[Auth/setBearerToken] ✅ Token saved to localStorage (both keys)");
      
      const saved = localStorage.getItem(BEARER_TOKEN_KEY);
      const savedBetterAuth = localStorage.getItem(BETTER_AUTH_SESSION_KEY);
      if (saved === token && savedBetterAuth === token) {
        console.log("[Auth/setBearerToken] ✅ Verification: Token correctly saved to both keys");
      } else {
        console.error("[Auth/setBearerToken] ❌ Verification FAILED: Token mismatch!");
        console.error("[Auth/setBearerToken] Our key:", saved === token);
        console.error("[Auth/setBearerToken] Better Auth key:", savedBetterAuth === token);
      }
    } else {
      // ✅ CORRECT: Use AsyncStorage.setItem() (returns Promise<void>)
      await AsyncStorage.setItem(BEARER_TOKEN_KEY, token);
      await AsyncStorage.setItem(BETTER_AUTH_SESSION_KEY, token);
      console.log("[Auth/setBearerToken] ✅ Token saved to AsyncStorage (both keys)");
      
      const saved = await AsyncStorage.getItem(BEARER_TOKEN_KEY);
      const savedBetterAuth = await AsyncStorage.getItem(BETTER_AUTH_SESSION_KEY);
      if (saved === token && savedBetterAuth === token) {
        console.log("[Auth/setBearerToken] ✅ Verification: Token correctly saved to both keys");
      } else {
        console.error("[Auth/setBearerToken] ❌ Verification FAILED: Token mismatch!");
        console.error("[Auth/setBearerToken] Our key:", saved === token);
        console.error("[Auth/setBearerToken] Better Auth key:", savedBetterAuth === token);
        throw new Error("Token verification failed - storage may be corrupted");
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
      let token = localStorage.getItem(BEARER_TOKEN_KEY);
      if (!token) {
        console.log("[Auth/getBearerToken] ⚠️ No token in our key, trying Better Auth key...");
        token = localStorage.getItem(BETTER_AUTH_SESSION_KEY);
        
        if (token) {
          console.log("[Auth/getBearerToken] ✅ Found token in Better Auth key, syncing to our key");
          localStorage.setItem(BEARER_TOKEN_KEY, token);
        }
      }
      
      if (token) {
        console.log("[Auth/getBearerToken] 🔑 Token from localStorage: EXISTS (length:", token.length, ")");
      } else {
        console.log("[Auth/getBearerToken] ⚠️ No token in localStorage (checked both keys)");
      }
      return token;
    } else {
      // ✅ CORRECT: Use AsyncStorage.getItem() (returns Promise<string | null>)
      let token = await AsyncStorage.getItem(BEARER_TOKEN_KEY);
      if (!token) {
        console.log("[Auth/getBearerToken] ⚠️ No token in our key, trying Better Auth key...");
        token = await AsyncStorage.getItem(BETTER_AUTH_SESSION_KEY);
        
        if (token) {
          console.log("[Auth/getBearerToken] ✅ Found token in Better Auth key, syncing to our key");
          await AsyncStorage.setItem(BEARER_TOKEN_KEY, token);
        }
      }
      
      if (token) {
        console.log("[Auth/getBearerToken] 🔑 Token from AsyncStorage: EXISTS (length:", token.length, ")");
      } else {
        console.log("[Auth/getBearerToken] ⚠️ No token in AsyncStorage (checked both keys)");
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
      localStorage.removeItem(BEARER_TOKEN_KEY);
      localStorage.removeItem(BETTER_AUTH_SESSION_KEY);
      
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sleep-consultant")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log("[Auth/clearAuthTokens] ✅ Cleared localStorage tokens (", keysToRemove.length, "keys)");
    } else {
      // ✅ CORRECT: Use AsyncStorage.removeItem() (returns Promise<void>)
      await AsyncStorage.removeItem(BEARER_TOKEN_KEY);
      await AsyncStorage.removeItem(BETTER_AUTH_SESSION_KEY);
      
      try {
        await AsyncStorage.removeItem("sleep-consultant.session");
      } catch (e) {
        // These might not exist, that's ok
      }
      
      console.log("[Auth/clearAuthTokens] ✅ Cleared AsyncStorage tokens");
    }
  } catch (error) {
    console.error("[Auth/clearAuthTokens] ⚠️ Error clearing tokens:", error);
  }
}

export { API_URL };
