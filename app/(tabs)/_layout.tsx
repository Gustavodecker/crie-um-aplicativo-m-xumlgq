
import React, { useEffect, useState, useCallback } from "react";
import { Redirect, Slot, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { View, ActivityIndicator, Text } from "react-native";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { colors } from "@/styles/commonStyles";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "@/utils/api";

type UserRole = "consultant" | "mother";

export default function TabLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine user role
  const determineRole = useCallback(async () => {
    if (!user) {
      console.log("[Tab Layout] ⚠️ No user");
      setUserRole(null);
      setLoading(false);
      return;
    }

    console.log("[Tab Layout] 🔍 Determining user role for:", user.email);

    try {
      // Check stored role first
      const storedRole = await AsyncStorage.getItem("userRole");
      
      if (storedRole === "consultant" || storedRole === "mother") {
        console.log("[Tab Layout] ✅ User role from storage:", storedRole);
        setUserRole(storedRole);
        setLoading(false);
        
        // Navigate based on role
        if (storedRole === "mother") {
          router.replace("/(tabs)/(home)/mother-dashboard");
        } else {
          router.replace("/(tabs)/(home)");
        }
        return;
      }
      
      console.log("[Tab Layout] ⚠️ No stored role, determining from API...");
      
      // Try to fetch consultant profile
      try {
        await apiGet("/api/consultant/profile");
        console.log("[Tab Layout] ✅ User is CONSULTANT");
        await AsyncStorage.setItem("userRole", "consultant");
        setUserRole("consultant");
        router.replace("/(tabs)/(home)");
      } catch (apiError: any) {
        console.log("[Tab Layout] ✅ User is MOTHER");
        await AsyncStorage.setItem("userRole", "mother");
        setUserRole("mother");
        router.replace("/(tabs)/(home)/mother-dashboard");
      }
    } catch (error) {
      console.error("[Tab Layout] ❌ Error determining role:", error);
      setUserRole("mother");
      router.replace("/(tabs)/(home)/mother-dashboard");
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    determineRole();
  }, [determineRole]);

  // Show loading
  if (loading) {
    console.log("[Tab Layout] ⏳ Loading...");
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
    console.log("[Tab Layout] 👩 Rendering mother layout");
    return (
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    );
  }

  // Render consultant layout (with tab bar)
  console.log("[Tab Layout] 👔 Rendering consultant layout");
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
