
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BEARER_TOKEN_KEY, setBearerToken as libSetBearerToken } from "@/lib/auth";

export { BEARER_TOKEN_KEY };

/**
 * Backend URL is configured in app.json under expo.extra.backendUrl
 * It is set automatically when the backend is deployed
 */
export const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || "";

/**
 * Check if backend is properly configured
 */
export const isBackendConfigured = (): boolean => {
  return !!BACKEND_URL && BACKEND_URL.length > 0;
};

/**
 * Set bearer token to platform-specific storage
 * Web: localStorage
 * Native: AsyncStorage
 *
 * @param token - JWT token to store
 */
export const setBearerToken = async (token: string | null): Promise<void> => {
  return libSetBearerToken(token || "");
};

/**
 * Get bearer token from platform-specific storage
 * Web: localStorage
 * Native: AsyncStorage
 *
 * @returns Bearer token or null if not found
 */
export const getBearerToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === "web") {
      const token = localStorage.getItem(BEARER_TOKEN_KEY);
      if (token) {
        console.log("[API] 🔑 Token from localStorage: EXISTS (length:", token.length, ")");
      } else {
        console.log("[API] ⚠️ No token in localStorage");
      }
      return token;
    } else {
      // ✅ CORRECT: Use AsyncStorage.getItem() (returns Promise<string | null>)
      const token = await AsyncStorage.getItem(BEARER_TOKEN_KEY);
      if (token) {
        console.log("[API] 🔑 Token from AsyncStorage: EXISTS (length:", token.length, ")");
      } else {
        console.log("[API] ⚠️ No token in AsyncStorage");
      }
      return token;
    }
  } catch (error) {
    console.error("[API] ❌ Error retrieving bearer token:", error);
    return null;
  }
};

interface ApiCallOptions extends RequestInit {
  suppressErrorLog?: boolean;
}

/**
 * Generic API call helper with error handling
 *
 * @param endpoint - API endpoint path (e.g., '/users', '/auth/login')
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response
 * @throws Error if backend is not configured or request fails
 */
export const apiCall = async <T = any>(
  endpoint: string,
  options?: ApiCallOptions
): Promise<T> => {
  if (!isBackendConfigured()) {
    throw new Error("Backend URL not configured. Please rebuild the app.");
  }

  const url = `${BACKEND_URL}${endpoint}`;
  const suppressErrorLog = options?.suppressErrorLog || false;
  
  if (!suppressErrorLog) {
    console.log("[API] 📡 Calling:", url, options?.method || "GET");
  }

  try {
    const fetchOptions: RequestInit = {
      ...options,
    };

    delete (fetchOptions as any).suppressErrorLog;

    // 🔥 CRITICAL: Always get the token and add to headers
    const token = await getBearerToken();

    // Only add Content-Type header if there's a body
    if (options?.body) {
      fetchOptions.headers = {
        "Content-Type": "application/json",
        ...options?.headers,
      };
    } else {
      fetchOptions.headers = {
        ...options?.headers,
      };
    }

    // Add Authorization header if we have a token
    if (token) {
      if (!suppressErrorLog) {
        console.log("[API] ✅ Adding Authorization header with token");
      }
      fetchOptions.headers = {
        ...fetchOptions.headers,
        Authorization: `Bearer ${token}`,
      };
    } else {
      if (!suppressErrorLog) {
        console.warn("[API] ⚠️ No token available - request will be unauthenticated");
      }
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      
      if (!suppressErrorLog) {
        console.error("[API] ❌ Error response:", response.status, text);
      }
      
      let errorMsg = `API error: ${response.status}`;
      try {
        const errJson = JSON.parse(text);
        if (errJson.error) errorMsg = errJson.error;
      } catch {}
      throw new Error(errorMsg);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      if (!suppressErrorLog) {
        console.log("[API] ✅ Success: 204 No Content");
      }
      return {} as T;
    }

    const data = await response.json();
    if (!suppressErrorLog) {
      console.log("[API] ✅ Success:", data);
    }
    return data;
  } catch (error) {
    if (!suppressErrorLog) {
      console.error("[API] ❌ Request failed:", error);
    }
    throw error;
  }
};

/**
 * GET request helper
 */
export const apiGet = async <T = any>(
  endpoint: string,
  options?: { suppressErrorLog?: boolean }
): Promise<T> => {
  return apiCall<T>(endpoint, { method: "GET", ...options });
};

/**
 * POST request helper
 */
export const apiPost = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * PUT request helper
 */
export const apiPut = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

/**
 * PATCH request helper
 */
export const apiPatch = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

/**
 * DELETE request helper
 * CRITICAL: Does not send Content-Type header (DELETE requests without body should not have it)
 */
export const apiDelete = async <T = any>(endpoint: string): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "DELETE",
  });
};

/**
 * Authenticated API call helper
 * Automatically retrieves bearer token from storage and adds to Authorization header
 *
 * @param endpoint - API endpoint path
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response
 * @throws Error if token not found or request fails
 */
export const authenticatedApiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  const token = await getBearerToken();

  if (!token) {
    throw new Error("Authentication token not found. Please sign in.");
  }

  return apiCall<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
};

/**
 * Authenticated GET request
 */
export const authenticatedGet = async <T = any>(endpoint: string): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, { method: "GET" });
};

/**
 * Authenticated POST request
 */
export const authenticatedPost = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated PUT request
 */
export const authenticatedPut = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated PATCH request
 */
export const authenticatedPatch = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated DELETE request
 * CRITICAL: Does not send Content-Type header (DELETE requests without body should not have it)
 */
export const authenticatedDelete = async <T = any>(endpoint: string): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "DELETE",
  });
};
