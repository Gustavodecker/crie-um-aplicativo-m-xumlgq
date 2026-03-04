
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { colors, spacing, borderRadius, typography, shadows } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { apiGet } from "@/utils/api";

interface Baby {
  id: string;
  name: string;
  activeContract: {
    id: string;
    startDate: string;
    durationDays: number;
    status: string;
  } | null;
}

interface DayInfo {
  date: string;
  dayNumber: number;
  dayOfWeek: string;
  hasRoutine: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  headerTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  contractInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  contractInfoText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.lg,
  },
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadows.sm,
  },
  dayCardToday: {
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.md,
  },
  dayCardPast: {
    opacity: 0.7,
  },
  dayCardFuture: {
    opacity: 0.5,
  },
  dayCardLeft: {
    flex: 1,
  },
  dayNumber: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  dayDate: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  dayOfWeek: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dayCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundAlt,
  },
  statusBadgeComplete: {
    backgroundColor: colors.success,
  },
  statusBadgeText: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  statusBadgeTextComplete: {
    color: "#FFF",
  },
  todayBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  todayBadgeText: {
    ...typography.caption,
    fontWeight: "600",
    color: "#FFF",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyStateIcon: {
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    ...typography.h3,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    paddingHorizontal: spacing.xl,
  },
  legendCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadows.sm,
  },
  legendTitle: {
    ...typography.h4,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  legendIcon: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  legendText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

function getDayOfWeek(dateString: string): string {
  const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const date = new Date(dateString + "T00:00:00");
  return days[date.getDay()];
}

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export default function MotherDaySelectionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [baby, setBaby] = useState<Baby | null>(null);
  const [days, setDays] = useState<DayInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    console.log("[Mother Day Selection] Loading data");
    try {
      // Load baby data
      const babyData = await apiGet<Baby>("/api/mother/baby");
      setBaby(babyData);

      if (!babyData.activeContract) {
        setError("Nenhum contrato ativo encontrado");
        setLoading(false);
        return;
      }

      // Calculate all contract days
      const startDate = new Date(babyData.activeContract.startDate + "T00:00:00");
      const durationDays = babyData.activeContract.durationDays;
      const today = new Date().toISOString().split("T")[0];

      // Load existing routines
      const routines = await apiGet<any[]>(`/api/routines/baby/${babyData.id}`);
      const routineDates = new Set(routines.map((r: any) => r.date));

      // Generate day info for each contract day
      const daysList: DayInfo[] = [];
      for (let i = 0; i < durationDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateString = currentDate.toISOString().split("T")[0];

        daysList.push({
          date: dateString,
          dayNumber: i + 1,
          dayOfWeek: getDayOfWeek(dateString),
          hasRoutine: routineDates.has(dateString),
          isToday: dateString === today,
          isPast: dateString < today,
          isFuture: dateString > today,
        });
      }

      setDays(daysList);
      console.log(`[Mother Day Selection] Loaded ${daysList.length} days`);
    } catch (err: any) {
      console.error("[Mother Day Selection] Error loading data:", err);
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectDay = (day: DayInfo) => {
    console.log(`[Mother Day Selection] Selected day: ${day.date}`);
    router.push({
      pathname: "/(tabs)/(home)/mother-routine",
      params: { date: day.date },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando dias...</Text>
      </View>
    );
  }

  if (error || !baby) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Selecionar Dia",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={64}
              color={colors.error}
            />
          </View>
          <Text style={styles.emptyStateTitle}>Erro</Text>
          <Text style={styles.emptyStateText}>
            {error || "Não foi possível carregar os dados"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const contractStartText = formatDateToBR(baby.activeContract!.startDate);
  const contractDaysText = `${baby.activeContract!.durationDays} ${baby.activeContract!.durationDays === 1 ? "dia" : "dias"}`;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Selecionar Dia",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Escolha o Dia</Text>
          <Text style={styles.headerSubtitle}>
            Selecione o dia para registrar a rotina de sono
          </Text>
          <View style={styles.contractInfo}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.contractInfoText}>
              Contrato: {contractStartText} • {contractDaysText}
            </Text>
          </View>
        </View>

        {/* Days List */}
        <Text style={styles.sectionTitle}>Dias do Contrato</Text>
        {days.map((day) => (
          <TouchableOpacity
            key={day.date}
            style={[
              styles.dayCard,
              day.isToday && styles.dayCardToday,
              day.isPast && !day.isToday && styles.dayCardPast,
              day.isFuture && styles.dayCardFuture,
            ]}
            onPress={() => handleSelectDay(day)}
          >
            <View style={styles.dayCardLeft}>
              <Text style={styles.dayNumber}>Dia {day.dayNumber}</Text>
              <Text style={styles.dayDate}>{formatDateToBR(day.date)}</Text>
              <Text style={styles.dayOfWeek}>{day.dayOfWeek}</Text>
            </View>
            <View style={styles.dayCardRight}>
              {day.isToday && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>Hoje</Text>
                </View>
              )}
              {day.hasRoutine && (
                <View style={[styles.statusBadge, styles.statusBadgeComplete]}>
                  <Text style={[styles.statusBadgeText, styles.statusBadgeTextComplete]}>
                    ✓ Preenchido
                  </Text>
                </View>
              )}
              {!day.hasRoutine && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>Pendente</Text>
                </View>
              )}
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={24}
                color={colors.primary}
              />
            </View>
          </TouchableOpacity>
        ))}

        {/* Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Legenda</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendIcon, { backgroundColor: colors.success }]}>
              <IconSymbol
                ios_icon_name="checkmark"
                android_material_icon_name="check"
                size={16}
                color="#FFF"
              />
            </View>
            <Text style={styles.legendText}>Dia com rotina preenchida</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendIcon, { backgroundColor: colors.primary }]}>
              <IconSymbol
                ios_icon_name="star.fill"
                android_material_icon_name="star"
                size={16}
                color="#FFF"
              />
            </View>
            <Text style={styles.legendText}>Dia de hoje</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendIcon, { backgroundColor: colors.backgroundAlt }]}>
              <IconSymbol
                ios_icon_name="circle"
                android_material_icon_name="circle"
                size={16}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.legendText}>Dia pendente</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}Good, the iOS version just re-exports the base file. Now let me create the iOS version for the day selection screen:

<write file="app/(tabs)/(home)/mother-day-selection.ios.tsx">
export { default } from './mother-day-selection';
