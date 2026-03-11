
import React, { useEffect, useState, useRef } from "react";
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
  const [checkingRole, setCheckingRole] = useState(true);
  const hasCheckedRef = useRef(false);

  // Determine user role ONCE when user becomes available
  useEffect(() => {
    // If no user, clear role and stop checking
    if (!user) {
      console.log("[Tab Layout] ⚠️ No user");
      setUserRole(null);
      setCheckingRole(false);
      hasCheckedRef.current = false;
      return;
    }

    // If we already checked for this user, don't check again
    if (hasCheckedRef.current) {
      console.log("[Tab Layout] ⏭️ Already checked role for this user");
      return;
    }

    // Mark that we're checking
    hasCheckedRef.current = true;
    console.log("[Tab Layout] 🔍 Determining user role for:", user.email);

    const determineRole = async () => {
      try {
        // Check stored role first
        const storedRole = await AsyncStorage.getItem("userRole");
        
        if (storedRole === "consultant" || storedRole === "mother") {
          console.log("[Tab Layout] ✅ User role from storage:", storedRole);
          setUserRole(storedRole);
          setCheckingRole(false);
          
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
          setCheckingRole(false);
          router.replace("/(tabs)/(home)");
        } catch (apiError: any) {
          console.log("[Tab Layout] ✅ User is MOTHER");
          await AsyncStorage.setItem("userRole", "mother");
          setUserRole("mother");
          setCheckingRole(false);
          router.replace("/(tabs)/(home)/mother-dashboard");
        }
      } catch (error) {
        console.error("[Tab Layout] ❌ Error determining role:", error);
        // Default to mother on error
        setUserRole("mother");
        setCheckingRole(false);
        router.replace("/(tabs)/(home)/mother-dashboard");
      }
    };

    determineRole();
  }, [user]); // Only depend on user

  // Show loading
  if (checkingRole) {
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
