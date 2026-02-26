
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
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { apiGet } from "@/utils/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Baby {
  id: string;
  name: string;
}

interface ReportDay {
  date: string;
  daytimeSleep: number;
  nighttimeSleep: number;
  netNighttimeSleep: number;
  total24h: number;
  indicator: "green" | "yellow" | "red";
}

interface Report {
  babyId: string;
  startDate: string;
  endDate: string;
  totalNaps: number;
  totalNapDuration: number;
  totalDaytimeSleep: number;
  totalNighttimeSleep: number;
  totalNetNighttimeSleep: number;
  totalSleepIn24h: number;
  weeklyAverage: number;
  dailyEvolution: ReportDay[];
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function minutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}m`;
}

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function getIndicatorColor(indicator: string) {
  if (indicator === "green") return colors.success || "#4CAF50";
  if (indicator === "yellow") return colors.warning || "#FFC107";
  return colors.error || "#F44336";
}

function getIndicatorText(indicator: string) {
  if (indicator === "green") return "Ótimo";
  if (indicator === "yellow") return "Bom";
  return "Atenção";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MotherEvolutionScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [baby, setBaby] = useState<Baby | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    console.log("[Mother Evolution] Loading data");
    try {
      // Load baby data
      const babyData = await apiGet<Baby>("/api/mother/baby");
      console.log("[Mother Evolution] Baby loaded:", babyData.name);
      setBaby(babyData);

      // Load report (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 6); // Last 7 days

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const reportData = await apiGet<Report>(
        `/api/reports/baby/${babyData.id}?startDate=${startDateStr}&endDate=${endDateStr}`
      );
      console.log("[Mother Evolution] Report loaded");
      setReport(reportData);
    } catch (error: any) {
      console.error("[Mother Evolution] Error loading data:", error);
      setError(error.message || "Erro ao carregar evolução");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !baby) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ 
          headerShown: true, 
          title: "Evolução",
          headerBackTitle: "Voltar",
        }} />
        <View style={styles.errorContainer}>
          <IconSymbol 
            ios_icon_name="exclamationmark.triangle.fill" 
            android_material_icon_name="warning" 
            size={64} 
            color={colors.error} 
          />
          <Text style={styles.errorTitle}>Ops!</Text>
          <Text style={styles.errorText}>
            {error || "Não foi possível carregar a evolução"}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const weeklyAverageText = report ? minutesToHM(Math.round(report.weeklyAverage)) : "--";
  const hasData = report && report.dailyEvolution.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: "Evolução",
        headerBackTitle: "Voltar",
      }} />
      
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
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <IconSymbol 
            ios_icon_name="chart.line.uptrend.xyaxis" 
            android_material_icon_name="trending-up" 
            size={32} 
            color={colors.success} 
          />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Evolução do Sono</Text>
            <Text style={styles.headerSubtitle}>
              Últimos 7 dias
            </Text>
          </View>
        </View>

        {/* Weekly Average */}
        {hasData && (
          <View style={styles.averageCard}>
            <Text style={styles.averageLabel}>Média Semanal</Text>
            <Text style={styles.averageValue}>{weeklyAverageText}</Text>
            <Text style={styles.averageSubtext}>de sono total em 24h</Text>
          </View>
        )}

        {/* Daily Evolution */}
        {hasData ? (
          <View style={styles.evolutionSection}>
            <Text style={styles.sectionTitle}>Evolução Diária</Text>
            
            {report.dailyEvolution.map((day, index) => {
              const dateText = formatDateToBR(day.date);
              const daytimeText = minutesToHM(day.daytimeSleep);
              const nighttimeText = minutesToHM(day.netNighttimeSleep);
              const totalText = minutesToHM(day.total24h);
              const indicatorColor = getIndicatorColor(day.indicator);
              const indicatorText = getIndicatorText(day.indicator);

              return (
                <View key={day.date} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayHeaderLeft}>
                      <Text style={styles.dayDate}>{dateText}</Text>
                      <View style={[styles.indicatorBadge, { backgroundColor: indicatorColor }]}>
                        <Text style={styles.indicatorText}>{indicatorText}</Text>
                      </View>
                    </View>
                    <Text style={styles.dayTotal}>{totalText}</Text>
                  </View>

                  <View style={styles.dayDetails}>
                    <View style={styles.dayDetailItem}>
                      <IconSymbol 
                        ios_icon_name="sun.max.fill" 
                        android_material_icon_name="wb-sunny" 
                        size={20} 
                        color={colors.secondary} 
                      />
                      <Text style={styles.dayDetailLabel}>Diurno</Text>
                      <Text style={styles.dayDetailValue}>{daytimeText}</Text>
                    </View>

                    <View style={styles.dayDetailItem}>
                      <IconSymbol 
                        ios_icon_name="moon.stars.fill" 
                        android_material_icon_name="nights-stay" 
                        size={20} 
                        color={colors.primary} 
                      />
                      <Text style={styles.dayDetailLabel}>Noturno</Text>
                      <Text style={styles.dayDetailValue}>{nighttimeText}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <IconSymbol 
              ios_icon_name="chart.bar" 
              android_material_icon_name="bar-chart" 
              size={64} 
              color={colors.textSecondary} 
            />
            <Text style={styles.emptyStateTitle}>
              Sem dados ainda
            </Text>
            <Text style={styles.emptyStateText}>
              Registre a rotina diariamente para acompanhar a evolução do sono do seu bebê.
            </Text>
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <IconSymbol 
            ios_icon_name="info.circle.fill" 
            android_material_icon_name="info" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={styles.infoText}>
            A evolução mostra o progresso do sono ao longo dos dias. Cores indicam a qualidade: verde (ótimo), amarelo (bom), vermelho (atenção).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  errorTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  retryButtonText: {
    ...typography.button,
    color: "#FFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  averageCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  averageLabel: {
    ...typography.body,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: spacing.xs,
  },
  averageValue: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: spacing.xs,
  },
  averageSubtext: {
    ...typography.caption,
    color: "rgba(255, 255, 255, 0.7)",
  },
  evolutionSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  dayHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dayDate: {
    ...typography.h4,
  },
  indicatorBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  indicatorText: {
    ...typography.caption,
    color: "#FFF",
    fontWeight: "600",
    fontSize: 11,
  },
  dayTotal: {
    ...typography.h3,
    color: colors.primary,
  },
  dayDetails: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dayDetailItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  dayDetailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  dayDetailValue: {
    ...typography.body,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyStateTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
