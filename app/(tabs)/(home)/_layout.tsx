
import React, { useEffect, useState, useCallback } from "react";
import { Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { colors } from "@/styles/commonStyles";
import { apiGet } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

interface ConsultantProfile {
  id: string;
  userId: string;
  name: string;
  photo: string | null;
  professionalTitle: string | null;
  description: string | null;
}

interface Baby {
  id: string;
  name: string;
  birthDate: string;
  motherName: string;
  motherPhone: string;
  motherEmail: string;
  ageMonths: number;
  ageDays: number;
  photo?: string | null;
  activeContract: any | null;
  archived?: boolean;
}

export default function HomeLayout() {
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [consultantProfile, setConsultantProfile] = useState<ConsultantProfile | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);

  const loadConsultantData = useCallback(async () => {
    if (userRole !== "consultant") {
      console.log("[HomeLayout] User is not consultant, skipping data load");
      setLoading(false);
      return;
    }

    try {
      console.log("[HomeLayout] Loading consultant profile and babies");

      const [profileData, babiesData] = await Promise.all([
        apiGet<ConsultantProfile>("/api/consultant/profile"),
        apiGet<Baby[]>("/api/consultant/babies"),
      ]);

      console.log("[HomeLayout] Consultant data loaded successfully");
      setConsultantProfile(profileData);
      setBabies(babiesData);
    } catch (error) {
      console.error("[HomeLayout] Error loading consultant data:", error);
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    loadConsultantData();
  }, [loadConsultantData]);

  if (loading && userRole === "consultant") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="mother-dashboard" options={{ headerShown: false }} />
      <Stack.Screen
        name="mother-day-selection"
        options={{
          headerShown: true,
          title: "Selecionar Dia",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen
        name="mother-routine"
        options={{
          headerShown: true,
          title: "Registrar Rotina",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen
        name="mother-orientations"
        options={{
          headerShown: true,
          title: "Orientações",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen
        name="mother-evolution"
        options={{
          headerShown: true,
          title: "Evolução",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen name="consultant-dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="acompanhamento" options={{ headerShown: false }} />
      <Stack.Screen name="reports-landscape" options={{ headerShown: false }} />
    </Stack>
  );
}
