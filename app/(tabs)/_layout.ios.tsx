
import React, { useEffect, useState, useRef } from "react";
import { Redirect, Slot, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { View, ActivityIndicator } from "react-native";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { colors } from "@/styles/commonStyles";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "@/utils/api";

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [checkingRole, setCheckingRole] = useState(true);
  const [userRole, setUserRole] = useState<"consultant" | "mother" | null>(null);
  const hasRedirectedRef = useRef(false);
  const roleCheckAttemptRef = useRef(0);

  // Reset state when user changes
  useEffect(() => {
    console.log("[Tab Layout] 👤 User state changed:", user ? user.email : "null");
    hasRedirectedRef.current = false;
    roleCheckAttemptRef.current = 0;
    setUserRole(null);
    setCheckingRole(true);
  }, [user]);

  // Check user role
  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        console.log("[Tab Layout] ⚠️ No user, clearing role");
        setCheckingRole(false);
        setUserRole(null);
        return;
      }

      roleCheckAttemptRef.current += 1;
      console.log("[Tab Layout] 🔍 Checking user role for:", user.email, "(attempt", roleCheckAttemptRef.current, ")");

      try {
        // First, try to get stored role
        const storedRole = await AsyncStorage.getItem("userRole");
        
        if (storedRole === "consultant" || storedRole === "mother") {
          console.log("[Tab Layout] ✅ User role from AsyncStorage:", storedRole);
          setUserRole(storedRole);
          setCheckingRole(false);
          return;
        }
        
        console.log("[Tab Layout] ⚠️ No stored role found, determining from API...");
        
        // Try to fetch consultant profile to determine role
        try {
          const profile = await apiGet("/api/consultant/profile", { suppressErrorLog: true });
          console.log("[Tab Layout] ✅ User is a CONSULTANT (determined from API)");
          await AsyncStorage.setItem("userRole", "consultant");
          setUserRole("consultant");
        } catch (apiError: any) {
          console.log("[Tab Layout] ✅ User is a MOTHER (determined from API)");
          await AsyncStorage.setItem("userRole", "mother");
          setUserRole("mother");
        }
      } catch (storageError) {
        console.error("[Tab Layout] ❌ Error reading AsyncStorage:", storageError);
        // Default to mother if we can't determine
        setUserRole("mother");
      } finally {
        setCheckingRole(false);
      }
    };

    if (user && checkingRole) {
      checkRole();
    }
  }, [user, checkingRole]);

  // Handle navigation after role is determined
  useEffect(() => {
    if (!userRole || hasRedirectedRef.current || loading || checkingRole) {
      return;
    }

    const currentPath = segments.join("/");
    console.log("[Tab Layout] 📍 Current path:", currentPath, "| User role:", userRole);

    if (userRole === "mother") {
      const isAlreadyOnMotherDashboard = currentPath.includes("mother-dashboard");

      if (!isAlreadyOnMotherDashboard) {
        console.log("[Tab Layout] 🔄 Navigating mother to dashboard");
        hasRedirectedRef.current = true;
        router.replace("/(tabs)/(home)/mother-dashboard");
      } else {
        console.log("[Tab Layout] ✅ Mother already on dashboard");
        hasRedirectedRef.current = true;
      }
    } else if (userRole === "consultant") {
      const isOnAuthScreen = currentPath.includes("auth");
      const isOnConsultantHome = currentPath === "(tabs)/(home)" || currentPath === "(tabs)/(home)/index";
      
      if (isOnAuthScreen) {
        console.log("[Tab Layout] 🔄 Navigating consultant from auth to home");
        hasRedirectedRef.current = true;
        router.replace("/(tabs)/(home)");
      } else if (!isOnConsultantHome) {
        console.log("[Tab Layout] ✅ Consultant on valid screen:", currentPath);
        hasRedirectedRef.current = true;
      } else {
        console.log("[Tab Layout] ✅ Consultant already on home");
        hasRedirectedRef.current = true;
      }
    }
  }, [userRole, segments, router, loading, checkingRole]);

  // Show loading state
  if (loading || checkingRole) {
    console.log("[Tab Layout] ⏳ Loading... (loading:", loading, "checkingRole:", checkingRole, ")");
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

  // Redirect to auth if no user
  if (!user) {
    console.log("[Tab Layout] 🚪 No user, redirecting to auth");
    return <Redirect href="/auth" />;
  }

  // Render mother layout (no tab bar)
  if (userRole === "mother") {
    console.log("[Tab Layout] 👩 Rendering mother layout (no tab bar)");
    return (
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    );
  }

  // Render consultant layout (with tab bar)
  console.log("[Tab Layout] 👔 Rendering consultant layout (with tab bar)");
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
