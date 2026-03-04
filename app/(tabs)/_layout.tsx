
import React, { useEffect, useState, useRef } from "react";
import { Redirect, Slot, useRouter, useSegments } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { View, ActivityIndicator } from "react-native";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { colors } from "@/styles/commonStyles";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

      console.log("[Tab Layout] 🔍 Checking user role from AsyncStorage");

      // 🔥 CRITICAL FIX: Only use AsyncStorage, never call API
      // The role is set during login in auth.tsx
      try {
        const storedRole = await AsyncStorage.getItem("userRole");
        
        if (storedRole === "consultant" || storedRole === "mother") {
          console.log("[Tab Layout] ✅ User role from AsyncStorage:", storedRole);
          setUserRole(storedRole);
        } else {
          // No stored role - this shouldn't happen after login
          // Default to mother to be safe
          console.warn("[Tab Layout] ⚠️ No stored role found, defaulting to mother");
          setUserRole("mother");
          await AsyncStorage.setItem("userRole", "mother");
        }
      } catch (storageError) {
        console.error("[Tab Layout] ❌ Error reading AsyncStorage:", storageError);
        setUserRole("mother");
      } finally {
        setCheckingRole(false);
      }
    };

    checkRole();
  }, [user]);

  // Navigate mothers to their dashboard exactly once using router.replace
  useEffect(() => {
    if (userRole === "mother" && !hasRedirectedRef.current) {
      const currentPath = segments.join("/");
      const isAlreadyOnMotherDashboard = currentPath.includes("mother-dashboard");

      if (!isAlreadyOnMotherDashboard) {
        console.log("[Tab Layout] 🔄 Navigating mother to dashboard");
        hasRedirectedRef.current = true;
        router.replace("/(tabs)/(home)/mother-dashboard");
      } else {
        hasRedirectedRef.current = true;
      }
    }
  }, [userRole, segments, router]);

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
