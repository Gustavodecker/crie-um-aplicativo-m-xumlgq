
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
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    }
  : SecureStore;

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
  const tokenPreview = token.substring(0, 30);
  console.log("[Auth/setBearerToken] 💾 Saving token (preview):", tokenPreview + "...");
  
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
}

export async function clearAuthTokens() {
  if (Platform.OS === "web") {
    localStorage.removeItem(BEARER_TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
  }
}

export { API_URL };
