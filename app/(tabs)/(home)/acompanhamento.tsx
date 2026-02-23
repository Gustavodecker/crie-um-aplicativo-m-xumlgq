
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
  return `${h}:${m.toString().padStart(2, "0")}:00 h`;
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

export default function AcompanhamentoScreen() {
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

  useEffect(() => {
    console.log("[Orientation] Locking to landscape mode");
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    
    return () => {
      console.log("[Orientation] Unlocking orientation");
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
      
      console.log("[Data] Report loaded:", reportData);
      console.log("[Data] Routines loaded:", filteredRoutines.length);
    } catch (error: any) {
      console.error("[Error] Loading data:", error);
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
        showsVerticalScrollIndicator={true}
      >
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {report.dailyEvolution.map((day, index) => {
            const routine = routines[index];
            if (!routine) return null;
            
            const naps = routine.naps || [];
            const nightSleep = routine.nightSleep && (routine.nightSleep as any).id ? routine.nightSleep : null;
            const wakings = nightSleep?.wakings || [];
            
            const totalNapDuration = naps.reduce((sum, nap) => {
              if (nap.fellAsleepTime && nap.wakeUpTime) {
                return sum + calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime);
              }
              return sum;
            }, 0);
            
            const nightSleepDuration = nightSleep && nightSleep.fellAsleepTime && nightSleep.finalWakeTime
              ? calcTimeDiff(nightSleep.fellAsleepTime, nightSleep.finalWakeTime)
              : 0;
            
            return (
              <View key={day.date} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>DIA {index + 1}</Text>
                  <Text style={styles.dayDate}>{formatDateToBR(day.date)}</Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Acordou</Text>
                  <Text style={styles.sectionValue}>Às {routine.wakeUpTime}h</Text>
                  <Text style={styles.sectionSubValue}>
                    Janela de {minutesToHM(naps[0] && naps[0].startTryTime ? calcTimeDiff(routine.wakeUpTime, naps[0].startTryTime) : 0)}
                  </Text>
                </View>
                
                <View style={styles.divider} />
                
                {naps.map((nap, napIndex) => {
                  const sleepDuration = nap.fellAsleepTime && nap.wakeUpTime 
                    ? calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime) 
                    : 0;
                  
                  const nextNap = naps[napIndex + 1];
                  const windowToNext = nextNap && nap.wakeUpTime && nextNap.startTryTime
                    ? calcTimeDiff(nap.wakeUpTime, nextNap.startTryTime)
                    : 0;
                  
                  return (
                    <React.Fragment key={nap.id}>
                      <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Soneca {napIndex + 1}</Text>
                        <Text style={styles.sectionValue}>
                          Das {nap.fellAsleepTime || "—"} às {nap.wakeUpTime || "—"} h
                        </Text>
                        <Text style={styles.sectionSubValue}>
                          ({minutesToHM(sleepDuration)})
                        </Text>
                        {windowToNext > 0 && (
                          <Text style={styles.sectionSubValue}>
                            Janela de {minutesToHM(windowToNext)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.divider} />
                    </React.Fragment>
                  );
                })}
                
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Duração do Sono Diurno</Text>
                  <Text style={styles.sectionValue}>
                    Somatória das Sonecas {minutesToHM(totalNapDuration)}
                  </Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Sono Noturno</Text>
                  {nightSleep ? (
                    <>
                      <Text style={styles.sectionValue}>
                        Iniciou às {nightSleep.startTryTime || "—"}h
                      </Text>
                      <Text style={styles.sectionSubValue}>
                        ({minutesToHM(nightSleepDuration)})
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.sectionValue}>—</Text>
                  )}
                </View>
                
                {wakings.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Despertares:</Text>
                      {wakings.map((waking, wakingIndex) => {
                        const duration = calcTimeDiff(waking.startTime, waking.endTime);
                        return (
                          <Text key={waking.id} style={styles.sectionValue}>
                            {wakingIndex + 1}º → {waking.startTime} - {waking.endTime} ({minutesToHM(duration)})
                          </Text>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
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
    flexDirection: "row",
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
  
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginRight: 16,
    width: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  dayHeader: {
    alignItems: "center",
    marginBottom: 10,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
  },
  dayDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  
  section: {
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 3,
  },
  sectionValue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  sectionSubValue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 16,
    fontStyle: "italic",
  },
});
