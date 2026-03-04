
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { apiGet } from "@/utils/api";

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

interface Nap {
  id: string;
  routineId: string;
  napNumber: number;
  startTryTime: string;
  fellAsleepTime: string | null;
  wakeUpTime: string | null;
  sleepMethod: string | null;
  environment: string | null;
  wakeUpMood: string | null;
  observations: string | null;
  consultantComments: string | null;
  createdAt: string;
}

interface NightWaking {
  id: string;
  nightSleepId: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

interface NightSleep {
  id: string;
  routineId: string;
  startTryTime: string;
  fellAsleepTime: string | null;
  finalWakeTime: string | null;
  sleepMethod: string | null;
  environment: string | null;
  wakeUpMood: string | null;
  observations: string | null;
  consultantComments: string | null;
  createdAt: string;
  wakings?: NightWaking[];
}

interface Routine {
  id: string;
  babyId: string;
  date: string;
  wakeUpTime: string;
  motherObservations: string | null;
  consultantComments: string | null;
  createdAt: string;
  updatedAt: string;
  naps?: Nap[];
  nightSleep?: NightSleep | null;
}

function minutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}m`;
}

function calcTimeDiff(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function getIndicatorColor(indicator: string) {
  if (indicator === "green") return colors.statusGood;
  if (indicator === "yellow") return colors.statusMedium;
  return colors.statusPoor;
}

export default function ReportsLandscapeScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const babyId = params.babyId as string;
  const babyName = params.babyName as string;
  
  const [report, setReport] = useState<Report | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[API] Loading report for baby:", babyId);
      const reportData = await apiGet<Report>(`/api/reports/baby/${babyId}?startDate=${startDate}&endDate=${endDate}`);
      setReport(reportData);
      
      // GET /api/routines/baby/:babyId now returns full data including naps and nightSleep with wakings
      console.log("[API] Loading routines with full data for baby:", babyId);
      const allRoutines = await apiGet<any[]>(`/api/routines/baby/${babyId}`);
      const filteredRoutines = allRoutines.filter((r: any) => r.date >= startDate && r.date <= endDate);
      
      // Normalize routines: treat empty object {} as null for nightSleep
      // If nightSleep comes back as {} (Fastify schema stripping), try fetching individual routine
      const normalizedRoutines: Routine[] = await Promise.all(filteredRoutines.map(async (r: any, i: number) => {
        let nightSleep: NightSleep | null = null;
        
        if (r.nightSleep && typeof r.nightSleep === 'object' && (r.nightSleep as any).id) {
          // Valid nightSleep object
          nightSleep = {
            ...r.nightSleep,
            wakings: Array.isArray(r.nightSleep.wakings) ? r.nightSleep.wakings : [],
          };
        } else if (r.nightSleep !== null && r.nightSleep !== undefined) {
          // nightSleep is {} (Fastify schema stripping) - try individual routine fetch
          console.log(`[API] Routine ${i + 1} (${r.date}): nightSleep is {} - fetching individual routine`);
          try {
            const individualRoutine = await apiGet<any>(`/api/routines/${r.id}`);
            if (individualRoutine.nightSleep && typeof individualRoutine.nightSleep === 'object' && individualRoutine.nightSleep.id) {
              nightSleep = {
                ...individualRoutine.nightSleep,
                wakings: Array.isArray(individualRoutine.nightSleep.wakings) ? individualRoutine.nightSleep.wakings : [],
              };
              console.log(`[API] Routine ${i + 1}: fetched nightSleep id=${nightSleep!.id}`);
            }
          } catch (fetchErr: any) {
            console.warn(`[API] Could not fetch individual routine ${r.id}:`, fetchErr.message);
          }
        }
        
        console.log(`[API] Routine ${i + 1} (${r.date}) - nightSleep:`, nightSleep ? `id=${nightSleep.id}, wakings=${nightSleep.wakings?.length ?? 0}` : 'null');
        
        return { ...r, nightSleep };
      }));
      
      setRoutines(normalizedRoutines.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error: any) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [babyId, startDate, endDate]);

  useEffect(() => { 
    console.log("[Navigation] Reports Landscape Screen loaded for baby:", babyId, babyName);
    loadData(); 
  }, [loadData]);

  useEffect(() => { 
    console.log("[Navigation] Reports Landscape Screen loaded for baby:", babyId, babyName);
    loadData(); 
  }, [loadData, babyId, babyName]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ 
          headerShown: true, 
          title: `Relatório Detalhado - ${babyName}`, 
          headerStyle: { backgroundColor: colors.background }, 
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
              <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          )
        }} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Nenhum dado disponível</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: `Relatório Detalhado - ${babyName}`, 
        headerStyle: { backgroundColor: colors.background }, 
        headerTintColor: colors.text,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        )
      }} />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header with period */}
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Período de Análise</Text>
          <Text style={styles.headerPeriod}>
            {formatDateToBR(report.startDate)} até {formatDateToBR(report.endDate)}
          </Text>
        </View>

        {/* Summary stats */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total de Sonecas</Text>
            <Text style={styles.summaryValue}>{report.totalNaps}</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Sono Diurno Total</Text>
            <Text style={styles.summaryValue}>{minutesToHM(report.totalDaytimeSleep)}</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Sono Noturno Bruto</Text>
            <Text style={styles.summaryValue}>{minutesToHM(report.totalNighttimeSleep)}</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Sono Noturno Líquido</Text>
            <Text style={styles.summaryValue}>{minutesToHM(report.totalNetNighttimeSleep)}</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total em 24h</Text>
            <Text style={styles.summaryValue}>{minutesToHM(report.totalSleepIn24h)}</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Média Semanal</Text>
            <Text style={styles.summaryValue}>{minutesToHM(Math.round(report.weeklyAverage))}</Text>
          </View>
        </View>

        {/* Daily evolution */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Evolução Diária</Text>
          
          {report.dailyEvolution.map((day, index) => {
            const routine = routines[index];
            const indicatorColor = getIndicatorColor(day.indicator);
            
            return (
              <View key={day.date} style={[styles.dayCard, { borderLeftColor: indicatorColor, borderLeftWidth: 4 }]}>
                <View style={styles.dayHeader}>
                  <View>
                    <Text style={styles.dayTitle}>Dia {index + 1}</Text>
                    <Text style={styles.dayDate}>{formatDateToBR(day.date)}</Text>
                  </View>
                  <View style={[styles.indicatorBadge, { backgroundColor: indicatorColor }]}>
                    <Text style={styles.indicatorText}>
                      {day.indicator === "green" ? "Ótimo" : day.indicator === "yellow" ? "Bom" : "Atenção"}
                    </Text>
                  </View>
                </View>

                {routine && (
                  <>
                    <View style={styles.dayRow}>
                      <Text style={styles.dayLabel}>Horário que acordou:</Text>
                      <Text style={styles.dayValue}>{routine.wakeUpTime}</Text>
                    </View>

                    {/* Naps */}
                    {(routine.naps || []).length > 0 && (
                      <View style={styles.subsection}>
                        <Text style={styles.subsectionTitle}>Sonecas</Text>
                        {(routine.naps || []).map((nap, napIndex) => {
                          const sleepWindow = nap.startTryTime && nap.wakeUpTime ? calcTimeDiff(nap.startTryTime, nap.wakeUpTime) : null;
                          const timeToSleep = nap.startTryTime && nap.fellAsleepTime ? calcTimeDiff(nap.startTryTime, nap.fellAsleepTime) : null;
                          const sleepDuration = nap.fellAsleepTime && nap.wakeUpTime ? calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime) : null;
                          
                          return (
                            <View key={nap.id} style={styles.napCard}>
                              <Text style={styles.napTitle}>Soneca {napIndex + 1}</Text>
                              <View style={styles.napRow}>
                                <Text style={styles.napLabel}>Começou a tentar dormir:</Text>
                                <Text style={styles.napValue}>{nap.startTryTime || "—"}</Text>
                              </View>
                              <View style={styles.napRow}>
                                <Text style={styles.napLabel}>Dormiu:</Text>
                                <Text style={styles.napValue}>{nap.fellAsleepTime || "—"}</Text>
                              </View>
                              <View style={styles.napRow}>
                                <Text style={styles.napLabel}>Acordou:</Text>
                                <Text style={styles.napValue}>{nap.wakeUpTime || "—"}</Text>
                              </View>
                              {sleepWindow !== null && (
                                <View style={styles.napRow}>
                                  <Text style={styles.napLabel}>Janela de sono:</Text>
                                  <Text style={styles.napValueHighlight}>{minutesToHM(sleepWindow)}</Text>
                                </View>
                              )}
                              {timeToSleep !== null && (
                                <View style={styles.napRow}>
                                  <Text style={styles.napLabel}>Tempo para dormir:</Text>
                                  <Text style={styles.napValueHighlight}>{minutesToHM(timeToSleep)}</Text>
                                </View>
                              )}
                              {sleepDuration !== null && (
                                <View style={styles.napRow}>
                                  <Text style={styles.napLabel}>Tempo dormido:</Text>
                                  <Text style={styles.napValueHighlight}>{minutesToHM(sleepDuration)}</Text>
                                </View>
                              )}
                              {nap.sleepMethod && (
                                <View style={styles.napRow}>
                                  <Text style={styles.napLabel}>Dormiu como:</Text>
                                  <Text style={styles.napValue}>{nap.sleepMethod}</Text>
                                </View>
                              )}
                              {nap.environment && (
                                <View style={styles.napRow}>
                                  <Text style={styles.napLabel}>Ambiente:</Text>
                                  <Text style={styles.napValue}>{nap.environment}</Text>
                                </View>
                              )}
                              {nap.wakeUpMood && (
                                <View style={styles.napRow}>
                                  <Text style={styles.napLabel}>Como acordou:</Text>
                                  <Text style={styles.napValue}>{nap.wakeUpMood}</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Night sleep - normalize empty object {} to null */}
                    {routine.nightSleep && typeof routine.nightSleep === 'object' && (routine.nightSleep as any).id && (
                      <View style={styles.subsection}>
                        <Text style={styles.subsectionTitle}>Sono Noturno</Text>
                        <View style={styles.napCard}>
                          <View style={styles.napRow}>
                            <Text style={styles.napLabel}>Começou a tentar dormir:</Text>
                            <Text style={styles.napValue}>{routine.nightSleep.startTryTime || "—"}</Text>
                          </View>
                          <View style={styles.napRow}>
                            <Text style={styles.napLabel}>Dormiu:</Text>
                            <Text style={styles.napValue}>{routine.nightSleep.fellAsleepTime || "—"}</Text>
                          </View>
                          <View style={styles.napRow}>
                            <Text style={styles.napLabel}>Acordou final:</Text>
                            <Text style={styles.napValue}>{routine.nightSleep.finalWakeTime || "—"}</Text>
                          </View>
                          <View style={styles.napRow}>
                            <Text style={styles.napLabel}>Duração total:</Text>
                            <Text style={styles.napValueHighlight}>{minutesToHM(day.nighttimeSleep)}</Text>
                          </View>
                          <View style={styles.napRow}>
                            <Text style={styles.napLabel}>Duração líquida:</Text>
                            <Text style={styles.napValueHighlight}>{minutesToHM(day.netNighttimeSleep)}</Text>
                          </View>

                          {/* Wakings */}
                          {(routine.nightSleep.wakings || []).length > 0 && (
                            <View style={styles.wakingsContainer}>
                              <Text style={styles.wakingsTitle}>Despertares Noturnos</Text>
                              {(routine.nightSleep.wakings || []).map((waking, wakingIndex) => {
                                const duration = calcTimeDiff(waking.startTime, waking.endTime);
                                return (
                                  <View key={waking.id} style={styles.wakingRow}>
                                    <Text style={styles.wakingLabel}>
                                      {wakingIndex + 1}º despertar:
                                    </Text>
                                    <Text style={styles.wakingValue}>
                                      {waking.startTime} - {waking.endTime} ({minutesToHM(duration)})
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Totals for the day */}
                    <View style={styles.dayTotals}>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Sono Diurno:</Text>
                        <Text style={styles.totalValue}>{minutesToHM(day.daytimeSleep)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Sono Noturno Líquido:</Text>
                        <Text style={styles.totalValue}>{minutesToHM(day.netNighttimeSleep)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total em 24h:</Text>
                        <Text style={styles.totalValueHighlight}>{minutesToHM(day.total24h)}</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: colors.background 
  },
  scrollView: { 
    flex: 1 
  },
  scrollContent: { 
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 40 
  },
  emptyStateText: { 
    fontSize: 18, 
    fontWeight: "600", 
    color: colors.text 
  },

  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  headerPeriod: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
  },

  summaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
  },

  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 16,
  },

  dayCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
  },
  dayDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  indicatorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
  },

  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dayValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },

  subsection: {
    marginTop: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 8,
  },

  napCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  napTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
  },
  napRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  napLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  napValue: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
  },
  napValueHighlight: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.primary,
  },

  wakingsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wakingsTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 6,
  },
  wakingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  wakingLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  wakingValue: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.text,
  },

  dayTotals: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.text,
  },
  totalValueHighlight: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.primary,
  },
});
