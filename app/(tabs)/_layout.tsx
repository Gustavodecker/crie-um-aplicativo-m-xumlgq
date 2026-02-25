
import React, { useEffect, useState } from "react";
import { Redirect, Slot } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { View, ActivityIndicator } from "react-native";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { colors } from "@/styles/commonStyles";
import { apiGet } from "@/utils/api";
import { useRouter } from "expo-router";

export default function TabLayout() {
  const { user, loading } = useAuth();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isMother, setIsMother] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setCheckingRole(false);
        return;
      }

      try {
        console.log("[Tab Layout] Checking if user is consultant");
        await apiGet("/api/consultant/profile");
        console.log("[Tab Layout] User is a consultant");
        setIsMother(false);
      } catch (error) {
        console.log("[Tab Layout] User is a mother");
        setIsMother(true);
      } finally {
        setCheckingRole(false);
      }
    };
    checkRole();
  }, [user]);

  if (loading || checkingRole) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth" />;
  }

  // Redirect mothers to their dashboard if they try to access consultant areas
  if (isMother) {
    return <Redirect href="/(tabs)/(home)/mother-dashboard" />;
  }

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
