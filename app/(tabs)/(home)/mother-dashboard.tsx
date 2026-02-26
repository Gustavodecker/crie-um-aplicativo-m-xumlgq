
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { ConsultantProfileCard } from "@/components/ConsultantProfileCard";
import { apiGet } from "@/utils/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Baby {
  id: string;
  name: string;
  birthDate: string;
  motherName: string;
  ageMonths: number;
  ageDays: number;
  photo?: string | null;
  activeContract: any | null;
}

interface TodayRoutine {
  id: string;
  date: string;
  wakeUpTime: string | null;
  napsCount: number;
  daytimeSleepMinutes: number;
  nightSleepMinutes: number;
}

interface LastOrientation {
  id: string;
  date: string;
  orientationText: string;
}

interface ConsultantProfile {
  id: string;
  name: string;
  photo: string | null;
  professionalTitle?: string | null;
  description?: string | null;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function minutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}m`;
}

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function resolveImageSource(source: string | number | undefined): { uri: string } | number {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as number;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MotherDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [baby, setBaby] = useState<Baby | null>(null);
  const [todayRoutine, setTodayRoutine] = useState<TodayRoutine | null>(null);
  const [lastOrientation, setLastOrientation] = useState<LastOrientation | null>(null);
  const [consultant, setConsultant] = useState<ConsultantProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    console.log("[Mother Dashboard] Loading dashboard data");
    try {
      // Load baby data
      const babyData = await apiGet<Baby>("/api/mother/baby");
      console.log("[Mother Dashboard] Baby loaded:", babyData.name);
      setBaby(babyData);

      // Load today's routine summary (only if there's an active contract)
      if (babyData.activeContract) {
        const today = new Date().toISOString().split("T")[0];
        try {
          const routines = await apiGet<any[]>(`/api/routines/baby/${babyData.id}`);
          const todayRoutineData = routines.find(r => r.date === today);
          
          if (todayRoutineData) {
            // Calculate summary
            const napsCount = todayRoutineData.naps?.length || 0;
            const daytimeSleepMinutes = (todayRoutineData.naps || []).reduce((sum: number, nap: any) => {
              if (nap.fellAsleepTime && nap.wakeUpTime) {
                const [sh, sm] = nap.fellAsleepTime.split(":").map(Number);
                const [eh, em] = nap.wakeUpTime.split(":").map(Number);
                let diff = (eh * 60 + em) - (sh * 60 + sm);
                if (diff < 0) diff += 24 * 60;
                return sum + diff;
              }
              return sum;
            }, 0);

            let nightSleepMinutes = 0;
            if (todayRoutineData.nightSleep?.fellAsleepTime && todayRoutineData.nightSleep?.finalWakeTime) {
              const [sh, sm] = todayRoutineData.nightSleep.fellAsleepTime.split(":").map(Number);
              const [eh, em] = todayRoutineData.nightSleep.finalWakeTime.split(":").map(Number);
              let diff = (eh * 60 + em) - (sh * 60 + sm);
              if (diff < 0) diff += 24 * 60;
              nightSleepMinutes = diff;

              // Subtract wakings
              if (todayRoutineData.nightSleep.wakings) {
                todayRoutineData.nightSleep.wakings.forEach((w: any) => {
                  const [wsh, wsm] = w.startTime.split(":").map(Number);
                  const [weh, wem] = w.endTime.split(":").map(Number);
                  let wdiff = (weh * 60 + wem) - (wsh * 60 + wsm);
                  if (wdiff < 0) wdiff += 24 * 60;
                  nightSleepMinutes -= wdiff;
                });
              }
            }

            setTodayRoutine({
              id: todayRoutineData.id,
              date: todayRoutineData.date,
              wakeUpTime: todayRoutineData.wakeUpTime,
              napsCount,
              daytimeSleepMinutes,
              nightSleepMinutes,
            });
          }
        } catch (err) {
          console.log("[Mother Dashboard] No routine data for today");
        }
      }

      // Load last orientation
      try {
        const orientations = await apiGet<LastOrientation[]>(`/api/orientations/baby/${babyData.id}`);
        if (orientations.length > 0) {
          const sorted = orientations.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          setLastOrientation(sorted[0]);
        }
      } catch (err) {
        console.log("[Mother Dashboard] No orientations found");
      }

      // Load consultant profile using the NEW endpoint for mothers
      try {
        console.log("[Mother Dashboard] Fetching consultant profile via /api/mother/consultant");
        const consultantData = await apiGet<ConsultantProfile>("/api/mother/consultant");
        console.log("[Mother Dashboard] Consultant profile loaded:", consultantData.name);
        setConsultant(consultantData);
      } catch (err) {
        console.log("[Mother Dashboard] Could not load consultant profile:", err);
      }

    } catch (error: any) {
      console.error("[Mother Dashboard] Error loading dashboard:", error);
      setError(error.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
          title: "Início", 
          headerStyle: { backgroundColor: colors.background }, 
          headerTintColor: colors.text 
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
            {error || "Não foi possível carregar os dados"}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDashboard}>
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ageText = `${baby.ageMonths} ${baby.ageMonths === 1 ? "mês" : "meses"}`;
  const ageDaysText = baby.ageDays > 0 ? ` e ${baby.ageDays} ${baby.ageDays === 1 ? "dia" : "dias"}` : "";
  const hasActiveContract = baby.activeContract !== null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: "Início", 
        headerStyle: { backgroundColor: colors.background }, 
        headerTintColor: colors.text 
      }} />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => { 
              setRefreshing(true); 
              loadDashboard(); 
            }} 
          />
        }
      >
        {/* Consultant Profile Card */}
        {consultant && (
          <ConsultantProfileCard
            name={consultant.name}
            professionalTitle={consultant.professionalTitle || undefined}
            description={consultant.description || undefined}
            photoUrl={consultant.photo || undefined}
            isConsultant={false}
          />
        )}

        {/* Welcome Header */}
        <View style={styles.welcomeSection}>
          <Text style={styles.greeting}>Olá, {baby.motherName}! 👋</Text>
          <Text style={styles.subtitle}>Acompanhe a rotina de sono do seu bebê</Text>
        </View>

        {/* Baby Card */}
        <View style={styles.babyCard}>
          <View style={styles.babyCardHeader}>
            <View style={styles.babyIconContainer}>
              {baby.photo ? (
                <Image 
                  source={resolveImageSource(baby.photo)} 
                  style={styles.babyPhoto} 
                />
              ) : (
                <View style={styles.babyIconPlaceholder}>
                  <IconSymbol 
                    ios_icon_name="person.fill" 
                    android_material_icon_name="child-care" 
                    size={32} 
                    color={colors.primary} 
                  />
                </View>
              )}
            </View>
            <View style={styles.babyInfo}>
              <Text style={styles.babyName}>{baby.name}</Text>
              <Text style={styles.babyAge}>{ageText}{ageDaysText}</Text>
            </View>
          </View>
        </View>

        {/* No Contract Warning */}
        {!hasActiveContract && (
          <View style={styles.warningCard}>
            <View style={styles.warningIcon}>
              <IconSymbol 
                ios_icon_name="exclamationmark.triangle.fill" 
                android_material_icon_name="warning" 
                size={24} 
                color={colors.warning} 
              />
            </View>
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>⚠️ Contrato Necessário</Text>
              <Text style={styles.warningText}>
                Para registrar a rotina de sono, é necessário ter um contrato ativo. Entre em contato com sua consultora para ativar o contrato.
              </Text>
            </View>
          </View>
        )}

        {/* Today's Summary */}
        {hasActiveContract && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <IconSymbol 
                ios_icon_name="calendar" 
                android_material_icon_name="calendar-today" 
                size={20} 
                color={colors.primary} 
              />
              <Text style={styles.sectionTitle}>Resumo de Hoje</Text>
            </View>

            {todayRoutine ? (
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <IconSymbol 
                    ios_icon_name="sunrise.fill" 
                    android_material_icon_name="wb-sunny" 
                    size={24} 
                    color={colors.secondary} 
                  />
                  <Text style={styles.summaryLabel}>Acordou às</Text>
                  <Text style={styles.summaryValue}>
                    {todayRoutine.wakeUpTime || "--:--"}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <IconSymbol 
                    ios_icon_name="moon.zzz.fill" 
                    android_material_icon_name="bedtime" 
                    size={24} 
                    color={colors.primary} 
                  />
                  <Text style={styles.summaryLabel}>Sonecas</Text>
                  <Text style={styles.summaryValue}>
                    {todayRoutine.napsCount}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <IconSymbol 
                    ios_icon_name="sun.max.fill" 
                    android_material_icon_name="wb-sunny" 
                    size={24} 
                    color={colors.success} 
                  />
                  <Text style={styles.summaryLabel}>Sono Diurno</Text>
                  <Text style={styles.summaryValue}>
                    {minutesToHM(todayRoutine.daytimeSleepMinutes)}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <IconSymbol 
                    ios_icon_name="moon.stars.fill" 
                    android_material_icon_name="nights-stay" 
                    size={24} 
                    color={colors.primary} 
                  />
                  <Text style={styles.summaryLabel}>Sono Noturno</Text>
                  <Text style={styles.summaryValue}>
                    {minutesToHM(todayRoutine.nightSleepMinutes)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Nenhuma rotina registrada hoje
                </Text>
                <Text style={styles.emptyStateHint}>
                  Toque em "Registrar Rotina" para começar
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Last Orientation */}
        {lastOrientation && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <IconSymbol 
                ios_icon_name="lightbulb.fill" 
                android_material_icon_name="lightbulb" 
                size={20} 
                color={colors.secondary} 
              />
              <Text style={styles.sectionTitle}>Última Orientação</Text>
            </View>
            <View style={styles.orientationBox}>
              <Text style={styles.orientationDate}>
                {formatDateToBR(lastOrientation.date)}
              </Text>
              <Text style={styles.orientationText} numberOfLines={3}>
                {lastOrientation.orientationText}
              </Text>
              <TouchableOpacity 
                style={styles.orientationLink}
                onPress={() => router.push("/(tabs)/(home)/mother-orientations")}
              >
                <Text style={styles.orientationLinkText}>Ver todas</Text>
                <IconSymbol 
                  ios_icon_name="chevron.right" 
                  android_material_icon_name="chevron-right" 
                  size={16} 
                  color={colors.primary} 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.actionsTitle}>O que você quer fazer?</Text>
          
          <TouchableOpacity 
            style={[
              styles.primaryActionButton,
              !hasActiveContract && styles.disabledButton
            ]}
            onPress={() => hasActiveContract && router.push("/(tabs)/(home)/mother-routine")}
            disabled={!hasActiveContract}
          >
            <View style={styles.actionButtonIcon}>
              <IconSymbol 
                ios_icon_name="plus.circle.fill" 
                android_material_icon_name="add-circle" 
                size={28} 
                color={hasActiveContract ? "#FFF" : colors.textSecondary} 
              />
            </View>
            <View style={styles.actionButtonContent}>
              <Text style={[
                styles.primaryActionTitle,
                !hasActiveContract && styles.disabledText
              ]}>
                Registrar Rotina
              </Text>
              <Text style={[
                styles.primaryActionSubtitle,
                !hasActiveContract && styles.disabledText
              ]}>
                {hasActiveContract 
                  ? "Adicione sonecas e sono noturno"
                  : "Contrato necessário"
                }
              </Text>
            </View>
            <IconSymbol 
              ios_icon_name="chevron.right" 
              android_material_icon_name="chevron-right" 
              size={24} 
              color={hasActiveContract ? "#FFF" : colors.textSecondary} 
            />
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity 
              style={styles.secondaryActionButton}
              onPress={() => router.push("/(tabs)/(home)/mother-orientations")}
            >
              <IconSymbol 
                ios_icon_name="list.bullet.clipboard.fill" 
                android_material_icon_name="assignment" 
                size={24} 
                color={colors.secondary} 
              />
              <Text style={styles.secondaryActionText}>Orientações</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.secondaryActionButton,
                !hasActiveContract && styles.disabledButton
              ]}
              onPress={() => hasActiveContract && router.push("/(tabs)/(home)/mother-evolution")}
              disabled={!hasActiveContract}
            >
              <IconSymbol 
                ios_icon_name="chart.line.uptrend.xyaxis" 
                android_material_icon_name="trending-up" 
                size={24} 
                color={hasActiveContract ? colors.success : colors.textSecondary} 
              />
              <Text style={[
                styles.secondaryActionText,
                !hasActiveContract && styles.disabledText
              ]}>
                Evolução
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Helpful Tip */}
        <View style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <IconSymbol 
              ios_icon_name="info.circle.fill" 
              android_material_icon_name="info" 
              size={24} 
              color={colors.primary} 
            />
          </View>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>💡 Dica</Text>
            <Text style={styles.tipText}>
              Registre a rotina diariamente para que sua consultora possa acompanhar a evolução e ajustar as orientações.
            </Text>
          </View>
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
  welcomeSection: {
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  babyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  babyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  babyIconContainer: {
    marginRight: spacing.md,
  },
  babyPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  babyIconPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  babyInfo: {
    flex: 1,
  },
  babyName: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  babyAge: {
    ...typography.body,
    color: colors.textSecondary,
  },
  warningCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  warningIcon: {
    marginRight: spacing.md,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    ...typography.h4,
    marginBottom: spacing.xs,
    color: colors.warning,
  },
  warningText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  summaryValue: {
    ...typography.h3,
    color: colors.text,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptyStateHint: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  orientationBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  orientationDate: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  orientationText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  orientationLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
  },
  orientationLinkText: {
    ...typography.button,
    color: colors.primary,
    fontSize: 14,
  },
  actionsSection: {
    marginBottom: spacing.lg,
  },
  actionsTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  primaryActionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: colors.backgroundAlt,
    opacity: 0.6,
  },
  actionButtonIcon: {
    marginRight: spacing.md,
  },
  actionButtonContent: {
    flex: 1,
  },
  primaryActionTitle: {
    ...typography.h3,
    color: "#FFF",
    marginBottom: spacing.xs,
  },
  primaryActionSubtitle: {
    ...typography.caption,
    color: "rgba(255, 255, 255, 0.8)",
  },
  disabledText: {
    color: colors.textSecondary,
  },
  secondaryActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryActionText: {
    ...typography.button,
    fontSize: 14,
    color: colors.text,
  },
  tipCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  tipIcon: {
    marginRight: spacing.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  tipText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
