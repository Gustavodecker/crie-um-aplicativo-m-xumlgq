
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const BEARER_TOKEN_KEY = "sleep-consultant_bearer_token";

/**
 * Platform-agnostic storage abstraction
 * Web: localStorage
 * Native: AsyncStorage
 */
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web") {
        const value = localStorage.getItem(key);
        return value;
      } else {
        const value = await AsyncStorage.getItem(key);
        return value;
      }
    } catch (error) {
      console.error(`[Storage] Error reading ${key}:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        localStorage.setItem(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`[Storage] Error writing ${key}:`, error);
      throw error;
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`[Storage] Error deleting ${key}:`, error);
    }
  },
};

/**
 * Save Bearer token to storage
 * ONLY stores in sleep-consultant_bearer_token
 * Does NOT use Better Auth keys
 */
export async function setBearerToken(token: string): Promise<void> {
  if (!token) {
    console.error("[Auth] ❌ Attempted to save empty token");
    return;
  }

  const tokenPreview = token.substring(0, 20);
  console.log("[Auth] 💾 Saving token (preview):", tokenPreview + "...");
  
  try {
    await storage.setItem(BEARER_TOKEN_KEY, token);
    console.log("[Auth] ✅ Token saved successfully");
    
    // Verify token was saved
    const saved = await storage.getItem(BEARER_TOKEN_KEY);
    if (saved === token) {
      console.log("[Auth] ✅ Token verification: SUCCESS");
    } else {
      console.error("[Auth] ❌ Token verification: FAILED");
      throw new Error("Token verification failed - storage may be corrupted");
    }
  } catch (error) {
    console.error("[Auth] ❌ Error saving token:", error);
    throw error;
  }
}

/**
 * Get Bearer token from storage
 * ONLY reads from sleep-consultant_bearer_token
 * Does NOT check Better Auth keys
 */
export async function getBearerToken(): Promise<string | null> {
  try {
    const token = await storage.getItem(BEARER_TOKEN_KEY);
    
    if (token) {
      console.log("[Auth] 🔑 Token found (length:", token.length, ")");
    } else {
      console.log("[Auth] ⚠️ No token in storage");
    }
    
    return token;
  } catch (error) {
    console.error("[Auth] ❌ Error retrieving token:", error);
    return null;
  }
}

/**
 * Clear all authentication tokens
 * CRITICAL: Only call this on:
 * 1. Manual logout
 * 2. Explicit 401 from backend
 * 
 * DO NOT call automatically during initialization
 */
export async function clearAuthTokens(): Promise<void> {
  console.log("[Auth] 🧹 Clearing auth tokens");
  
  try {
    // Remove our Bearer token
    await storage.removeItem(BEARER_TOKEN_KEY);
    
    // Remove any Better Auth remnants (cleanup from old implementation)
    if (Platform.OS === "web") {
      // Clean up any Better Auth keys in localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sleep-consultant") || key.includes("better-auth"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log("[Auth] ✅ Cleared localStorage tokens (", keysToRemove.length, "keys)");
    } else {
      // Clean up AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => 
        key.startsWith("sleep-consultant") || key.includes("better-auth")
      );
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
      console.log("[Auth] ✅ Cleared AsyncStorage tokens (", keysToRemove.length, "keys)");
    }
  } catch (error) {
    console.error("[Auth] ⚠️ Error clearing tokens:", error);
  }
}
