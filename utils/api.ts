
import Constants from "expo-constants";
import { BEARER_TOKEN_KEY, setBearerToken as libSetBearerToken, getBearerToken as libGetBearerToken } from "@/lib/auth";

export { BEARER_TOKEN_KEY };

/**
 * In-memory token cache to avoid AsyncStorage latency on Android.
 * Android AsyncStorage reads can be slow or return null during cold starts,
 * causing authenticated requests to fire without a token even when the user
 * is logged in. We keep a module-level cache that is populated on first read
 * and invalidated whenever the token is written or cleared.
 */
let _cachedToken: string | null | undefined = undefined; // undefined = not yet loaded

/**
 * HARDCODED production backend URL — this is the source of truth.
 * Constants.expoConfig can be undefined or stale in Android AAB production builds,
 * so we never rely on it as the primary source. It is only used as an override
 * when explicitly set (e.g. for local dev overrides via app.config.js).
 *
 * CRITICAL: Do NOT change this to read from process.env or Constants first —
 * that pattern breaks Android AAB release builds where __DEV__ is false and
 * Constants.expoConfig may not be populated correctly.
 */
export const API_BASE_URL = "https://wge47dvbdvqm7g2vmsdnz45beh8s73xx.app.specular.dev";

/**
 * BACKEND_URL is always identical to API_BASE_URL.
 * We do NOT read from Constants.expoConfig — on Android AAB production builds
 * Constants.expoConfig can be stale, undefined, or contain a wrong value,
 * which would silently override the correct hardcoded URL and break requests.
 */
export const BACKEND_URL: string = API_BASE_URL;

console.log("[API] BACKEND_URL:", BACKEND_URL);

/**
 * Check if backend is properly configured
 */
export const isBackendConfigured = (): boolean => {
  return !!BACKEND_URL && BACKEND_URL.length > 0;
};

/**
 * Set bearer token to platform-specific storage AND update the in-memory cache.
 * Keeping the cache in sync here ensures that any subsequent apiCall within the
 * same JS turn (e.g. right after login) sees the token immediately on Android,
 * where AsyncStorage writes are async and a read issued too soon can return null.
 *
 * @param token - JWT token to store, or null to clear
 */
export const setBearerToken = async (token: string | null): Promise<void> => {
  _cachedToken = token || null;
  console.log("[API] 🔑 Token cache updated:", token ? `${token.substring(0, 20)}...` : "null");
  return libSetBearerToken(token || "");
};

/**
 * Get bearer token — returns the in-memory cache if already populated,
 * otherwise reads from AsyncStorage (and populates the cache for future calls).
 * This prevents Android AsyncStorage latency from causing unauthenticated requests
 * on cold starts or immediately after login.
 *
 * @returns Bearer token or null if not found
 */
export const getBearerToken = async (): Promise<string | null> => {
  if (_cachedToken !== undefined) {
    // Cache hit — skip AsyncStorage round-trip
    console.log("[API] 🔑 Token from cache:", _cachedToken ? `length=${_cachedToken.length}` : "null");
    return _cachedToken;
  }
  // Cache miss — read from storage and populate cache
  const token = await libGetBearerToken();
  _cachedToken = token;
  console.log("[API] 🔑 Token loaded from storage:", token ? `length=${token.length}` : "null");
  return token;
};

/**
 * Clear the in-memory token cache.
 * Must be called on sign-out so the next request does not use a stale token.
 */
export const clearTokenCache = (): void => {
  _cachedToken = undefined;
  console.log("[API] 🧹 Token cache cleared");
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

  // Debug log for Android URL resolution issues
  console.log("API URL FINAL:", url);

  if (!suppressErrorLog) {
    console.log("[API] 📡 Calling:", url, options?.method || "GET");
  }

  try {
    const fetchOptions: RequestInit = {
      ...options,
    };

    delete (fetchOptions as any).suppressErrorLog;

    // Get the token and add to headers
    const token = await getBearerToken();

    // Only add Content-Type header if there's a body
    if (options?.body) {
      fetchOptions.headers = {
        "Content-Type": "application/json",
        // Add Origin header so Better Auth CSRF check passes on mobile.
        // React Native apps don't send Origin automatically, causing 403 MISSING_OR_NULL_ORIGIN.
        "Origin": BACKEND_URL,
        ...options?.headers,
      };
    } else {
      fetchOptions.headers = {
        // Add Origin header for all requests (needed for Better Auth session validation)
        "Origin": BACKEND_URL,
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
        // Try common error message fields in order of preference
        errorMsg = errJson.message || errJson.error || errJson.detail || errJson.msg || errorMsg;
      } catch {
        // Response was not JSON — use raw text if short enough
        if (text && text.length < 200 && !text.trim().startsWith('<')) {
          errorMsg = text.trim();
        }
      }
      if (!suppressErrorLog) {
        console.error("[API] ❌ Error message:", errorMsg);
      }
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
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[API] ❌ Request failed:", msg);
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
  console.log("[API] apiPost →", `${BACKEND_URL}${endpoint}`);
  console.log("[API] apiPost body:", JSON.stringify(data));
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
