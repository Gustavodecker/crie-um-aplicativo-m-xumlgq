
import React, { useEffect } from "react";
import { Redirect, Slot, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { View } from "react-native";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";

export default function TabLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!user) {
      console.log("[TabLayout] No user, will redirect to auth");
      return;
    }

    // User object must contain role property
    const userRole = (user as any).role;
    const currentPath = segments.join("/");

    console.log("[TabLayout] User role:", userRole, "Current path:", currentPath);

    if (userRole === "mother") {
      // Redirect to mother dashboard if not already there
      if (!currentPath.startsWith("(tabs)/(home)/mother-dashboard")) {
        console.log("[TabLayout] Redirecting mother to dashboard");
        router.replace("/(tabs)/(home)/mother-dashboard");
      }
    } else if (userRole === "consultant") {
      // Redirect to consultant dashboard if not already there
      if (!currentPath.startsWith("(tabs)/(home)/index") && !currentPath.startsWith("(tabs)/(home)") && !currentPath.includes("profile")) {
        console.log("[TabLayout] Redirecting consultant to dashboard");
        router.replace("/(tabs)/(home)");
      }
    } else {
      console.warn("[TabLayout] Unknown user role:", userRole);
      // Fallback to home
      if (!currentPath.startsWith("(tabs)/(home)/")) {
        router.replace("/(tabs)/(home)/");
      }
    }
  }, [user, segments]);

  // Redirect to auth if no user
  if (!user) {
    console.log("[TabLayout] No user, redirecting to auth");
    return <Redirect href="/auth" />;
  }

  // Get user role
  const userRole = (user as any).role;

  // Render mother layout (no tab bar)
  if (userRole === "mother") {
    console.log("[TabLayout] Rendering mother layout");
    return (
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
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
      <Slot />
      <FloatingTabBar tabs={tabs} />
    </View>
  );
}
