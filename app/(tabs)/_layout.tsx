
import React, { useEffect } from "react";
import { Redirect, Stack, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { View } from "react-native";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { colors } from "@/styles/commonStyles";

export default function TabLayout() {
  const { user, userRole } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!user) {
      console.log("[TabLayout] No user, will redirect to auth");
      return;
    }

    // CRITICAL: If the user must change their password, do NOT redirect inside tabs.
    // NavigationGuard in _layout.tsx owns this redirect — TabLayout must stay out of the way.
    if (user.requirePasswordChange) {
      console.log("[TabLayout] requirePasswordChange=true — skipping tab redirect, NavigationGuard will handle it");
      return;
    }

    const currentPath = segments.join("/");

    console.log("[TabLayout] User role:", userRole, "Current path:", currentPath);

    if (userRole === "mother") {
      // Only redirect to dashboard if not already navigating within mother screens
      const isAtMotherDashboard = currentPath.includes("mother-dashboard");
      const isNavigatingDeeper =
        currentPath.includes("mother-day-selection") ||
        currentPath.includes("mother-routine") ||
        currentPath.includes("mother-orientations") ||
        currentPath.includes("mother-evolution");

      if (!isAtMotherDashboard && !isNavigatingDeeper) {
        console.log("[TabLayout] Redirecting mother to dashboard");
        router.replace("/(tabs)/(home)/mother-dashboard");
      }
    } else if (userRole === "consultant") {
      // Consultant can navigate freely within tabs
      console.log("[TabLayout] Consultant navigating to:", currentPath);
    } else {
      console.warn("[TabLayout] Unknown user role:", userRole, "- defaulting to consultant behavior");
    }
  }, [user, userRole, segments, router]);

  // Redirect to auth if no user
  if (!user) {
    console.log("[TabLayout] No user, redirecting to auth");
    return <Redirect href="/auth" />;
  }

  // Render mother layout — must use Stack (not Slot) so router.push() works
  if (userRole === "mother") {
    console.log("[TabLayout] Rendering mother layout (Stack)");
    return (
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(home)" options={{ headerShown: false }} />
      </Stack>
    );
  }

  // Render consultant layout (with tab bar)
  console.log("[TabLayout] Rendering consultant layout");
  const tabs: TabBarItem[] = [
    {
      name: "Bebês",
      route: "/(tabs)/(home)",
      ios_icon_name: "person.2.fill",
      android_material_icon_name: "child-care",
    },
    {
      name: "Perfil",
      route: "/(tabs)/profile",
      ios_icon_name: "person.circle.fill",
      android_material_icon_name: "person",
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(home)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </View>
  );
}
