
import React, { useEffect, useState, useRef } from "react";
import { Redirect, Slot, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { View, ActivityIndicator } from "react-native";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { colors } from "@/styles/commonStyles";
import { apiGet } from "@/utils/api";

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [checkingRole, setCheckingRole] = useState(true);
  const [userRole, setUserRole] = useState<"consultant" | "mother" | null>(null);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Reset redirect flag when user changes
    hasRedirectedRef.current = false;
    setUserRole(null);
    setCheckingRole(true);

    const checkRole = async () => {
      if (!user) {
        setCheckingRole(false);
        return;
      }

      console.log("[Tab Layout] Checking if user is consultant");

      // Try to fetch consultant profile - if it succeeds, user is a consultant
      // If it fails with 404, user is a mother
      try {
        await apiGet("/api/consultant/profile");
        console.log("[Tab Layout] User is a CONSULTANT");
        setUserRole("consultant");
      } catch (error: any) {
        // 404 means user is not a consultant, so they must be a mother
        if (
          error.message?.includes("404") ||
          error.message?.includes("Consultant profile not found")
        ) {
          console.log("[Tab Layout] User is a mother");
          setUserRole("mother");
        } else {
          console.error("[Tab Layout] Error checking role:", error);
          // On other errors, assume mother to be safe
          setUserRole("mother");
        }
      } finally {
        setCheckingRole(false);
      }
    };

    // Only check role once when user ID changes
    checkRole();
  }, [user?.id]); // Only re-run when user ID changes, not on every render

  // Navigate mothers to their dashboard exactly once using router.replace
  // This avoids the infinite redirect loop caused by <Redirect> in layout components
  useEffect(() => {
    if (userRole === "mother" && !hasRedirectedRef.current) {
      const currentPath = segments.join("/");
      const isAlreadyOnMotherDashboard = currentPath.includes("mother-dashboard");

      if (!isAlreadyOnMotherDashboard) {
        console.log("[Tab Layout] Navigating mother to dashboard (once)");
        hasRedirectedRef.current = true;
        router.replace("/(tabs)/(home)/mother-dashboard");
      } else {
        // Already on mother dashboard, mark as redirected to prevent future redirects
        hasRedirectedRef.current = true;
      }
    }
  }, [userRole, segments]);

  if (loading || checkingRole) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth" />;
  }

  // For mothers: render Slot without consultant tab bar
  // Navigation to mother-dashboard is handled by the useEffect above
  if (userRole === "mother") {
    return (
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    );
  }

  // Consultant tabs
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
