
import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme, ActivityIndicator, View } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "auth",
};

// Simple navigation guard
function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Don't navigate while loading
    if (loading) {
      console.log("[RootLayout] ⏳ Still loading auth state...");
      return;
    }

    const inAuthGroup = segments[0] === "auth";
    const inChangePassword = segments[0] === "change-password";

    if (!user && !inAuthGroup) {
      // User not logged in, redirect to auth
      console.log("[RootLayout] 🚪 No user, redirecting to /auth");
      router.replace("/auth");
    } else if (user && user.requirePasswordChange && !inChangePassword) {
      // User needs to change password
      console.log("[RootLayout] 🔒 User must change password, redirecting to /change-password");
      router.replace("/change-password");
    } else if (user && !user.requirePasswordChange && inAuthGroup) {
      // User logged in and password is OK, redirect to app
      console.log("[RootLayout] ✅ User logged in, redirecting to /(tabs)");
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  // Show loading indicator while initializing
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FE" }}>
        <ActivityIndicator size="large" color="#6B4CE6" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: "#6B4CE6",
      background: "#F8F9FE",
      card: "#FFFFFF",
      text: "#1A1A2E",
      border: "#E5E7EB",
      notification: "#EF4444",
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "#9D7FEA",
      background: "#1A1A2E",
      card: "#2D2D44",
      text: "#FFFFFF",
      border: "#3D3D5C",
      notification: "#EF4444",
    },
  };
  
  return (
    <>
      <StatusBar style="auto" animated />
      <ThemeProvider
        value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}
      >
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <NavigationGuard>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="change-password" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
            </NavigationGuard>
            <SystemBars style="auto" />
          </GestureHandlerRootView>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
