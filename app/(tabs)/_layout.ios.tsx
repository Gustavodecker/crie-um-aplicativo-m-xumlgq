
import React, { useEffect } from "react";
import { Redirect, Slot, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { View } from "react-native";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";

export default function TabLayout() {
  const { user, userRole } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!user || !userRole) {
      console.log("[TabLayout.ios] No user or role yet, skipping redirect");
      return;
    }

    const currentPath = segments.join("/");
    console.log("[TabLayout.ios] User role:", userRole, "Current path:", currentPath);

    if (userRole === "mother") {
      // Only redirect to dashboard if we're at the root tabs level, not navigating deeper
      const isAtMotherDashboard = currentPath.includes("mother-dashboard");
      const isNavigatingDeeper = currentPath.includes("mother-day-selection") ||
        currentPath.includes("mother-routine") ||
        currentPath.includes("mother-orientations") ||
        currentPath.includes("mother-evolution");

      if (!isAtMotherDashboard && !isNavigatingDeeper) {
        console.log("[TabLayout.ios] Redirecting mother to dashboard");
        router.replace("/(tabs)/(home)/mother-dashboard");
      }
    } else if (userRole === "consultant") {
      console.log("[TabLayout.ios] Consultant navigating to:", currentPath);
    } else {
      console.warn("[TabLayout.ios] Unknown user role:", userRole);
    }
  }, [user, userRole, segments]);

  // Redirect to auth if no user
  if (!user) {
    console.log("[TabLayout.ios] No user, redirecting to auth");
    return <Redirect href="/auth" />;
  }

  // Render mother layout (no tab bar)
  if (userRole === "mother") {
    console.log("[TabLayout.ios] Rendering mother layout (no tab bar)");
    return (
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    );
  }

  // Render consultant layout (with tab bar)
  console.log("[TabLayout.ios] Rendering consultant layout");
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
