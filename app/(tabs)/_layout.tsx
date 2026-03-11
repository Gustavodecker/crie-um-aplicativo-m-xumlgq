
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Redirect, Slot, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { View, ActivityIndicator, Text } from "react-native";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { colors } from "@/styles/commonStyles";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "@/utils/api";

type UserRole = "consultant" | "mother";

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const roleCheckAttemptRef = useRef(0);
  const hasRedirectedRef = useRef(false);

  // Reset state when user changes (login/logout)
  useEffect(() => {
    console.log("[Tab Layout] 👤 User state changed:", user ? user.email : "null");
    
    // Reset all flags and state when user changes
    hasRedirectedRef.current = false;
    roleCheckAttemptRef.current = 0;
    
    if (!user) {
      setUserRole(null);
      setCheckingRole(false);
    } else {
      // User just logged in - clear role to force re-determination
      setUserRole(null);
      setCheckingRole(true);
    }
  }, [user]);

  // Check user role
  const checkRole = useCallback(async () => {
    if (!user) {
      console.log("[Tab Layout] ⚠️ No user, clearing role");
      setCheckingRole(false);
      setUserRole(null);
      return;
    }

    roleCheckAttemptRef.current += 1;
    console.log("[Tab Layout] 🔍 Checking user role for:", user.email, "(attempt", roleCheckAttemptRef.current, ")");

    try {
      // First, try to get stored role from AsyncStorage
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
        await apiGet("/api/consultant/profile");
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
  }, [user]);

  useEffect(() => {
    if (user && checkingRole) {
      checkRole();
    }
  }, [user, checkingRole, checkRole]);

  // 🔥 CRITICAL FIX: Navigate immediately when role is determined
  useEffect(() => {
    // Wait until we have all the information we need
    if (!user || !userRole || loading || checkingRole) {
      console.log("[Tab Layout] ⏳ Waiting... (user:", !!user, "userRole:", userRole, "loading:", loading, "checkingRole:", checkingRole, ")");
      return;
    }

    // Prevent multiple redirects for the same login session
    if (hasRedirectedRef.current) {
      console.log("[Tab Layout] ⏭️ Already redirected for this session");
      return;
    }

    const currentPath = segments.join("/");
    console.log("[Tab Layout] 📍 Current path:", currentPath, "| User role:", userRole);

    // Navigate based on role
    if (userRole === "mother") {
      const targetPath = "/(tabs)/(home)/mother-dashboard";
      console.log("[Tab Layout] 🔄 Navigating mother to dashboard NOW");
      hasRedirectedRef.current = true;
      router.replace(targetPath);
    } else if (userRole === "consultant") {
      const targetPath = "/(tabs)/(home)";
      console.log("[Tab Layout] 🔄 Navigating consultant to home NOW");
      hasRedirectedRef.current = true;
      router.replace(targetPath);
    }
  }, [user, userRole, loading, checkingRole, segments, router]);

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
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Carregando...</Text>
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
