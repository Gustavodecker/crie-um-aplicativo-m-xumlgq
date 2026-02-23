
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { apiGet } from "@/utils/api";
import * as ScreenOrientation from 'expo-screen-orientation';

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
  return `${day}/${month}`;
}

function getIndicatorColor(indicator: string) {
  if (indicator === "green") return colors.statusGood;
  if (indicator === "yellow") return colors.statusMedium;
  return colors.statusPoor;
}

export default function AcompanhamentoScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const babyId = params.babyId as string;
  const babyName = params.babyName as string;
  
  const [report, setReport] = useState<Report | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    // Force landscape orientation
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    
    return () => {
      // Unlock orientation when leaving screen
      ScreenOrientation.unlockAsync();
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[API] Loading report for baby:", babyId);
      const reportData = await apiGet<Report>(`/api/reports/baby/${babyId}?startDate=${startDate}&endDate=${endDate}`);
      setReport(reportData);
      
      console.log("[API] Loading routines for baby:", babyId);
      const routinesData = await apiGet<Routine[]>(`/api/routines/baby/${babyId}`);
      const filteredRoutines = routinesData.filter(r => r.date >= startDate && r.date <= endDate);
      setRoutines(filteredRoutines.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error: any) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [babyId, startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);

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
          title: `Acompanhamento - ${babyName}`, 
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

  const selectedRoutine = selectedDayIndex !== null ? routines[selectedDayIndex] : null;
  const selectedDay = selectedDayIndex !== null ? report.dailyEvolution[selectedDayIndex] : null;

  // Calculate nap details for selected day
  let napDetails: any[] = [];
  let nightSleepDetails: any = null;
  let wakingsDetails: any[] = [];
  
  if (selectedRoutine) {
    napDetails = (selectedRoutine.naps || []).map((nap, index) => {
      const sleepWindow = nap.startTryTime && nap.wakeUpTime ? calcTimeDiff(nap.startTryTime, nap.wakeUpTime) : null;
      const timeToSleep = nap.startTryTime && nap.fellAsleepTime ? calcTimeDiff(nap.startTryTime, nap.fellAsleepTime) : null;
      const sleepDuration = nap.fellAsleepTime && nap.wakeUpTime ? calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime) : null;
      
      return {
        number: index + 1,
        startTryTime: nap.startTryTime,
        fellAsleepTime: nap.fellAsleepTime,
        wakeUpTime: nap.wakeUpTime,
        sleepWindow,
        timeToSleep,
        sleepDuration,
      };
    });
    
    const nightSleep = selectedRoutine.nightSleep && (selectedRoutine.nightSleep as any).id ? selectedRoutine.nightSleep : null;
    if (nightSleep) {
      const totalNightDuration = nightSleep.fellAsleepTime && nightSleep.finalWakeTime 
        ? calcTimeDiff(nightSleep.fellAsleepTime, nightSleep.finalWakeTime) 
        : null;
      
      let totalWakingsDuration = 0;
      wakingsDetails = (nightSleep.wakings || []).map((waking, index) => {
        const duration = calcTimeDiff(waking.startTime, waking.endTime);
        totalWakingsDuration += duration;
        return {
          number: index + 1,
          startTime: waking.startTime,
          endTime: waking.endTime,
          duration,
        };
      });
      
      nightSleepDetails = {
        startTryTime: nightSleep.startTryTime,
        fellAsleepTime: nightSleep.fellAsleepTime,
        finalWakeTime: nightSleep.finalWakeTime,
        totalDuration: totalNightDuration,
        netDuration: totalNightDuration ? totalNightDuration - totalWakingsDuration : null,
      };
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: `Acompanhamento - ${babyName}`, 
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
        horizontal={false}
      >
        {/* Timeline with days */}
        <View style={styles.timelineContainer}>
          <Text style={styles.timelineTitle}>Evolução Diária</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timelineScroll}>
            {report.dailyEvolution.map((day, index) => {
              const isSelected = selectedDayIndex === index;
              const indicatorColor = getIndicatorColor(day.indicator);
              
              return (
                <TouchableOpacity 
                  key={day.date} 
                  style={[
                    styles.dayCard, 
                    isSelected && styles.dayCardSelected,
                    { borderTopColor: indicatorColor, borderTopWidth: 4 }
                  ]}
                  onPress={() => setSelectedDayIndex(index)}
                >
                  <Text style={[styles.dayCardTitle, isSelected && styles.dayCardTitleSelected]}>
                    DIA {index + 1}
                  </Text>
                  <Text style={[styles.dayCardDate, isSelected && styles.dayCardDateSelected]}>
                    {formatDateToBR(day.date)}
                  </Text>
                  
                  <View style={styles.dayCardDivider} />
                  
                  <View style={styles.dayCardRow}>
                    <Text style={styles.dayCardLabel}>Acordou</Text>
                    <Text style={styles.dayCardValue}>
                      {routines[index]?.wakeUpTime || "—"}
                    </Text>
                  </View>
                  
                  <View style={styles.dayCardRow}>
                    <Text style={styles.dayCardLabel}>Janela</Text>
                    <Text style={styles.dayCardValue}>
                      {minutesToHM(day.daytimeSleep)}
                    </Text>
                  </View>
                  
                  <View style={styles.dayCardDivider} />
                  
                  {(routines[index]?.naps || []).map((nap, napIndex) => {
                    const sleepDuration = nap.fellAsleepTime && nap.wakeUpTime 
                      ? calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime) 
                      : null;
                    
                    return (
                      <View key={nap.id} style={styles.napRow}>
                        <Text style={styles.napLabel}>Soneca {napIndex + 1}</Text>
                        <Text style={styles.napTime}>
                          Das {nap.fellAsleepTime || "—"} às {nap.wakeUpTime || "—"}
                        </Text>
                        {sleepDuration !== null && (
                          <Text style={styles.napDuration}>({minutesToHM(sleepDuration)})</Text>
                        )}
                        <Text style={styles.napWindow}>
                          Janela de {minutesToHM(calcTimeDiff(routines[index]?.wakeUpTime || "07:00", nap.startTryTime))}
                        </Text>
                      </View>
                    );
                  })}
                  
                  <View style={styles.dayCardDivider} />
                  
                  <View style={styles.dayCardRow}>
                    <Text style={styles.dayCardLabel}>Duração do Sono Diurno</Text>
                  </View>
                  <View style={styles.dayCardRow}>
                    <Text style={styles.dayCardLabel}>Somatória das Sonecas</Text>
                    <Text style={styles.dayCardValue}>
                      {minutesToHM(day.daytimeSleep)}
                    </Text>
                  </View>
                  
                  <View style={styles.dayCardDivider} />
                  
                  <View style={styles.dayCardRow}>
                    <Text style={styles.dayCardLabel}>Sono Noturno</Text>
                  </View>
                  
                  {routines[index]?.nightSleep && (routines[index]?.nightSleep as any).id ? (
                    <>
                      <View style={styles.dayCardRow}>
                        <Text style={styles.dayCardLabel}>Iniciou</Text>
                        <Text style={styles.dayCardValue}>
                          {routines[index]?.nightSleep?.startTryTime || "—"}
                        </Text>
                      </View>
                      <View style={styles.dayCardRow}>
                        <Text style={styles.dayCardValue}>
                          ({minutesToHM(day.nighttimeSleep)})
                        </Text>
                      </View>
                      
                      {(routines[index]?.nightSleep?.wakings || []).length > 0 && (
                        <>
                          <View style={styles.dayCardDivider} />
                          <View style={styles.dayCardRow}>
                            <Text style={styles.dayCardLabel}>Despertares:</Text>
                          </View>
                          {(routines[index]?.nightSleep?.wakings || []).map((waking, wakingIndex) => {
                            const duration = calcTimeDiff(waking.startTime, waking.endTime);
                            return (
                              <View key={waking.id} style={styles.dayCardRow}>
                                <Text style={styles.dayCardLabel}>
                                  {wakingIndex + 1}º → {waking.startTime} - {waking.endTime}
                                </Text>
                                <Text style={styles.dayCardValue}>
                                  ({minutesToHM(duration)})
                                </Text>
                              </View>
                            );
                          })}
                        </>
                      )}
                    </>
                  ) : (
                    <Text style={styles.dayCardValue}>—</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        
        {/* Summary stats */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Sono Diurno Total</Text>
            <Text style={styles.summaryValue}>{minutesToHM(report.totalDaytimeSleep)}</Text>
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
    padding: 16 
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
  
  timelineContainer: {
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 12,
  },
  timelineScroll: {
    flexDirection: "row",
  },
  
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  dayCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.primary,
    textAlign: "center",
  },
  dayCardTitleSelected: {
    fontSize: 18,
  },
  dayCardDate: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  dayCardDateSelected: {
    fontSize: 14,
    fontWeight: "600",
  },
  dayCardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  dayCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  dayCardLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  dayCardValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  
  napRow: {
    marginBottom: 6,
  },
  napLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.text,
  },
  napTime: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  napDuration: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
  },
  napWindow: {
    fontSize: 10,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  
  summaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
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
});
