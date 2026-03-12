
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, typography, shadows } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { ConsultantProfileCard } from "@/components/ConsultantProfileCard";
import { apiGet } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

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
  const { signOut } = useAuth();
  const isMountedRef = useRef(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [baby, setBaby] = useState<Baby | null>(null);
  const [todayRoutine, setTodayRoutine] = useState<TodayRoutine | null>(null);
  const [lastOrientation, setLastOrientation] = useState<LastOrientation | null>(null);
  const [consultant, setConsultant] = useState<ConsultantProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noBabyLinked, setNoBabyLinked] = useState(false);
  const [showRelinkModal, setShowRelinkModal] = useState(false);

  // Fade-in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const loadDashboard = useCallback(async () => {
    console.log("[Mother Dashboard] Loading dashboard data");
    try {
      // Load baby data
      const babyData = await apiGet<Baby>("/api/mother/baby");
      
      if (!isMountedRef.current) return;
      
      console.log("[Mother Dashboard] Baby loaded:", babyData.name);
      setBaby(babyData);

      // Load today's routine summary (only if there's an active contract)
      if (babyData.activeContract) {
        const today = new Date().toISOString().split("T")[0];
        try {
          const routines = await apiGet<any[]>(`/api/routines/baby/${babyData.id}`);
          
          if (!isMountedRef.current) return;
          
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
        
        if (!isMountedRef.current) return;
        
        if (orientations.length > 0) {
          const sorted = orientations.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          setLastOrientation(sorted[0]);
        }
      } catch (err) {
        console.log("[Mother Dashboard] No orientations found");
      }

      // Load consultant profile
      try {
        console.log("[Mother Dashboard] Fetching consultant profile via /api/mother/consultant");
        const consultantData = await apiGet<ConsultantProfile>("/api/mother/consultant");
        
        if (!isMountedRef.current) return;
        
        console.log("[Mother Dashboard] Consultant profile loaded:", consultantData.name);
        setConsultant(consultantData);
      } catch (err) {
        console.log("[Mother Dashboard] Could not load consultant profile:", err);
      }

    } catch (error: any) {
      console.error("[Mother Dashboard] Error loading dashboard:", error);
      console.log("[Mother Dashboard] Error details:", {
        message: error.message,
        status: error.status,
        response: error.response
      });
      
      if (!isMountedRef.current) return;
      
      // Provide user-friendly error messages
      let errorMessage = "Erro ao carregar dados";
      
      if (error.message?.includes("Authentication token not found")) {
        errorMessage = "Sessão expirada. Por favor, faça login novamente.";
      } else if (error.message?.includes("401") || error.message?.toLowerCase().includes("unauthorized")) {
        errorMessage = "Não autorizado. Por favor, faça login novamente.";
      } else if (
        error.message?.includes("No baby linked") || 
        error.message?.includes("No baby") ||
        error.message?.includes("404") || 
        error.status === 404 ||
        (error.response && error.response.status === 404)
      ) {
        console.log("[Mother Dashboard] 404 detected - baby not linked, showing re-link modal");
        setNoBabyLinked(true);
        setShowRelinkModal(true); // Automatically show the modal
        errorMessage = "Seu bebê não está vinculado à sua conta. Solicite um novo token à sua consultora.";
      } else if (error.message?.includes("Network") || error.message?.includes("fetch")) {
        errorMessage = "Erro de conexão. Verifique sua internet.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const handleRelink = useCallback(async () => {
    // In the new flow, re-linking is done by signing out and using the first-access token flow.
    // Direct the user to sign out.
    console.log("[Mother Dashboard] User chose to sign out and use first-access flow");
    setShowRelinkModal(false);
    await signOut();
    router.replace("/auth");
  }, [signOut, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboard();
    }, 300);

    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
    };
  }, [loadDashboard]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (error || !baby) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.errorContainer}>
          <IconSymbol 
            ios_icon_name="exclamationmark.triangle.fill" 
            android_material_icon_name="warning" 
            size={64} 
            color={noBabyLinked ? colors.warning : colors.error} 
          />
          <Text style={styles.errorTitle}>{noBabyLinked ? "Bebê não vinculado" : "Ops!"}</Text>
          <Text style={styles.errorText}>
            {error || "Não foi possível carregar os dados"}
          </Text>
          
          {noBabyLinked ? (
            <>
              <Text style={[styles.errorText, { fontSize: 14, marginTop: spacing.md, lineHeight: 22 }]}>
                Sua conta não está vinculada a nenhum bebê.
              </Text>
              <Text style={[styles.errorText, { fontSize: 14, marginTop: spacing.md, fontWeight: "600" }]}>
                Solicite um token à sua consultora e use a opção "Primeiro acesso" na tela de login.
              </Text>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: colors.primary, marginTop: spacing.lg }]} 
                onPress={async () => {
                  console.log("[Mother Dashboard] User chose to sign out and use first-access flow");
                  await signOut();
                  router.replace("/auth");
                }}
              >
                <IconSymbol 
                  ios_icon_name="arrow.right.circle.fill" 
                  android_material_icon_name="login" 
                  size={20} 
                  color="#FFF" 
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={styles.retryButtonText}>Sair e Usar Token</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.retryButton} onPress={loadDashboard}>
                <Text style={styles.retryButtonText}>Tentar Novamente</Text>
              </TouchableOpacity>
              
              {(error?.includes("Sessão expirada") || error?.includes("Não autorizado")) ? (
                <TouchableOpacity 
                  style={[styles.retryButton, { backgroundColor: colors.secondary, marginTop: spacing.md }]} 
                  onPress={() => router.replace("/auth")}
                >
                  <Text style={styles.retryButtonText}>Fazer Login</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>

        {/* Re-link Modal */}
        <Modal
          visible={showRelinkModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRelinkModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Bebê não vinculado</Text>
              <Text style={styles.modalSubtitle}>
                Sua conta não está vinculada a nenhum bebê. Para vincular, você precisa sair e usar o token fornecido pela sua consultora no primeiro acesso.
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowRelinkModal(false);
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Fechar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleRelink}
                >
                  <Text style={styles.modalButtonConfirmText}>Sair e Vincular</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  const ageText = `${baby.ageMonths} ${baby.ageMonths === 1 ? "mês" : "meses"}`;
  const ageDaysText = baby.ageDays > 0 ? ` e ${baby.ageDays} ${baby.ageDays === 1 ? "dia" : "dias"}` : "";
  const hasActiveContract = baby.activeContract !== null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Animated.ScrollView 
        style={[styles.scrollView, { opacity: fadeAnim }]} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => { 
              setRefreshing(true); 
              loadDashboard(); 
            }} 
            tintColor={colors.primary}
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
              <Text style={styles.warningTitle}>Contrato Necessário</Text>
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
                  <View style={styles.summaryIconContainer}>
                    <IconSymbol 
                      ios_icon_name="sunrise.fill" 
                      android_material_icon_name="wb-sunny" 
                      size={24} 
                      color={colors.secondary} 
                    />
                  </View>
                  <Text style={styles.summaryLabel}>Acordou às</Text>
                  <Text style={styles.summaryValue}>
                    {todayRoutine.wakeUpTime || "--:--"}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconContainer}>
                    <IconSymbol 
                      ios_icon_name="moon.zzz.fill" 
                      android_material_icon_name="bedtime" 
                      size={24} 
                      color={colors.primary} 
                    />
                  </View>
                  <Text style={styles.summaryLabel}>Sonecas</Text>
                  <Text style={styles.summaryValue}>
                    {todayRoutine.napsCount}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconContainer}>
                    <IconSymbol 
                      ios_icon_name="sun.max.fill" 
                      android_material_icon_name="wb-sunny" 
                      size={24} 
                      color={colors.success} 
                    />
                  </View>
                  <Text style={styles.summaryLabel}>Sono Diurno</Text>
                  <Text style={styles.summaryValue}>
                    {minutesToHM(todayRoutine.daytimeSleepMinutes)}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconContainer}>
                    <IconSymbol 
                      ios_icon_name="moon.stars.fill" 
                      android_material_icon_name="nights-stay" 
                      size={24} 
                      color={colors.primary} 
                    />
                  </View>
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
            onPress={() => hasActiveContract && router.push("/(tabs)/(home)/mother-day-selection")}
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
                  ? "Escolha o dia e adicione sonecas"
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
            <Text style={styles.tipTitle}>Dica</Text>
            <Text style={styles.tipText}>
              Registre a rotina diariamente para que sua consultora possa acompanhar a evolução e ajustar as orientações.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>
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
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
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
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    ...shadows.md,
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
    marginBottom: spacing.xxl,
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
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  babyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  babyIconContainer: {
    marginRight: spacing.lg,
  },
  babyPhoto: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  babyIconPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
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
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    ...shadows.sm,
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
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
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
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
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
    paddingVertical: spacing.xxl,
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
    padding: spacing.lg,
  },
  orientationDate: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  orientationText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 26,
    marginBottom: spacing.md,
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
    marginBottom: spacing.xl,
  },
  actionsTitle: {
    ...typography.h3,
    marginBottom: spacing.lg,
  },
  primaryActionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    minHeight: 88,
    ...shadows.lg,
  },
  disabledButton: {
    backgroundColor: colors.backgroundAlt,
    opacity: 0.6,
  },
  actionButtonIcon: {
    marginRight: spacing.lg,
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
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    minHeight: 120,
    justifyContent: "center",
    ...shadows.md,
  },
  secondaryActionText: {
    ...typography.button,
    fontSize: 15,
    color: colors.text,
  },
  tipCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    ...shadows.sm,
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
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    ...shadows.lg,
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  modalButtonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonCancelText: {
    ...typography.button,
    color: colors.text,
  },
  modalButtonConfirm: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  modalButtonConfirmText: {
    ...typography.button,
    color: "#FFF",
  },
});
