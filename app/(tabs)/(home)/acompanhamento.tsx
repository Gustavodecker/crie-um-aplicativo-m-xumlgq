
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
  const hStr = String(h);
  const mStr = String(m).padStart(2, "0");
  return `${hStr}h${mStr}min`;
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
  
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

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
      console.log("[API] Loading all routines for baby:", babyId);
      const routinesData = await apiGet<Routine[]>(`/api/routines/baby/${babyId}`);
      
      const filledRoutines = routinesData.filter(r => {
        const hasNaps = r.naps && r.naps.length > 0;
        const hasNightSleep = r.nightSleep && (r.nightSleep as any).id;
        const hasWakeUpTime = r.wakeUpTime && r.wakeUpTime !== "07:00";
        return hasNaps || hasNightSleep || hasWakeUpTime;
      });
      
      const sortedRoutines = filledRoutines.sort((a, b) => a.date.localeCompare(b.date));
      setRoutines(sortedRoutines);
      
      console.log("[Data] Total routines:", routinesData.length);
      console.log("[Data] Filled routines:", sortedRoutines.length);
    } catch (error: any) {
      console.error("[Error] Loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [babyId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (routines.length === 0) {
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
          <Text style={styles.emptyStateText}>Nenhuma rotina preenchida ainda</Text>
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
          {routines.map((routine, index) => {
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
            
            const totalWakingDuration = wakings.reduce((sum, waking) => {
              return sum + calcTimeDiff(waking.startTime, waking.endTime);
            }, 0);
            
            const netNightSleep = nightSleepDuration - totalWakingDuration;
            const total24h = totalNapDuration + netNightSleep;
            
            const dayNumber = index + 1;
            
            return (
              <View key={routine.id} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>DIA {dayNumber}</Text>
                  <Text style={styles.dayDate}>{formatDateToBR(routine.date)}</Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Acordou</Text>
                  <Text style={styles.sectionValue}>Às {routine.wakeUpTime}h</Text>
                  {naps[0] && naps[0].startTryTime && (
                    <Text style={styles.sectionSubValue}>
                      Janela de {minutesToHM(calcTimeDiff(routine.wakeUpTime, naps[0].startTryTime))}
                    </Text>
                  )}
                </View>
                
                <View style={styles.divider} />
                
                {naps.map((nap, napIndex) => {
                  const timeToSleep = nap.startTryTime && nap.fellAsleepTime
                    ? calcTimeDiff(nap.startTryTime, nap.fellAsleepTime)
                    : 0;
                  
                  const sleepDuration = nap.fellAsleepTime && nap.wakeUpTime 
                    ? calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime) 
                    : 0;
                  
                  const nextNap = naps[napIndex + 1];
                  const windowToNext = nextNap && nap.wakeUpTime && nextNap.startTryTime
                    ? calcTimeDiff(nap.wakeUpTime, nextNap.startTryTime)
                    : 0;
                  
                  const windowToNight = !nextNap && nap.wakeUpTime && nightSleep?.startTryTime
                    ? calcTimeDiff(nap.wakeUpTime, nightSleep.startTryTime)
                    : 0;
                  
                  return (
                    <React.Fragment key={nap.id}>
                      <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Soneca {napIndex + 1}</Text>
                        {nap.startTryTime && (
                          <Text style={styles.sectionValue}>
                            Tentou dormir às {nap.startTryTime}h
                          </Text>
                        )}
                        {nap.fellAsleepTime && nap.wakeUpTime && (
                          <>
                            <Text style={styles.sectionValue}>
                              Dormiu das {nap.fellAsleepTime}h às {nap.wakeUpTime}h
                            </Text>
                            <Text style={styles.sectionSubValue}>
                              Duração: {minutesToHM(sleepDuration)}
                            </Text>
                          </>
                        )}
                        {timeToSleep > 0 && (
                          <Text style={styles.sectionSubValue}>
                            Levou {minutesToHM(timeToSleep)} para dormir
                          </Text>
                        )}
                        {nap.sleepMethod && (
                          <Text style={styles.sectionSubValue}>
                            Dormiu: {nap.sleepMethod}
                          </Text>
                        )}
                        {nap.environment && (
                          <Text style={styles.sectionSubValue}>
                            Ambiente: {nap.environment}
                          </Text>
                        )}
                        {nap.wakeUpMood && (
                          <Text style={styles.sectionSubValue}>
                            Acordou: {nap.wakeUpMood}
                          </Text>
                        )}
                        {windowToNext > 0 && (
                          <Text style={styles.sectionSubValue}>
                            Janela até próxima soneca: {minutesToHM(windowToNext)}
                          </Text>
                        )}
                        {windowToNight > 0 && (
                          <Text style={styles.sectionSubValue}>
                            Janela até sono noturno: {minutesToHM(windowToNight)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.divider} />
                    </React.Fragment>
                  );
                })}
                
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Total Sono Diurno</Text>
                  <Text style={styles.sectionValue}>
                    {minutesToHM(totalNapDuration)}
                  </Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Sono Noturno</Text>
                  {nightSleep ? (
                    <>
                      {nightSleep.startTryTime && (
                        <Text style={styles.sectionValue}>
                          Tentou dormir às {nightSleep.startTryTime}h
                        </Text>
                      )}
                      {nightSleep.fellAsleepTime && nightSleep.finalWakeTime && (
                        <>
                          <Text style={styles.sectionValue}>
                            Dormiu das {nightSleep.fellAsleepTime}h às {nightSleep.finalWakeTime}h
                          </Text>
                          <Text style={styles.sectionSubValue}>
                            Duração total: {minutesToHM(nightSleepDuration)}
                          </Text>
                        </>
                      )}
                      {nightSleep.startTryTime && nightSleep.fellAsleepTime && (
                        <Text style={styles.sectionSubValue}>
                          Levou {minutesToHM(calcTimeDiff(nightSleep.startTryTime, nightSleep.fellAsleepTime))} para dormir
                        </Text>
                      )}
                      {nightSleep.sleepMethod && (
                        <Text style={styles.sectionSubValue}>
                          Dormiu: {nightSleep.sleepMethod}
                        </Text>
                      )}
                      {nightSleep.environment && (
                        <Text style={styles.sectionSubValue}>
                          Ambiente: {nightSleep.environment}
                        </Text>
                      )}
                      {nightSleep.wakeUpMood && (
                        <Text style={styles.sectionSubValue}>
                          Acordou: {nightSleep.wakeUpMood}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.sectionValue}>Não registrado</Text>
                  )}
                </View>
                
                {wakings.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Despertares Noturnos</Text>
                      {wakings.map((waking, wakingIndex) => {
                        const duration = calcTimeDiff(waking.startTime, waking.endTime);
                        return (
                          <Text key={waking.id} style={styles.sectionValue}>
                            {wakingIndex + 1}º despertar: {waking.startTime}h - {waking.endTime}h ({minutesToHM(duration)})
                          </Text>
                        );
                      })}
                      <Text style={styles.sectionSubValue}>
                        Total de despertares: {minutesToHM(totalWakingDuration)}
                      </Text>
                      <Text style={styles.sectionSubValue}>
                        Sono noturno líquido: {minutesToHM(netNightSleep)}
                      </Text>
                    </View>
                  </>
                )}
                
                <View style={styles.divider} />
                
                <View style={styles.summarySection}>
                  <Text style={styles.summaryLabel}>Resumo do Dia</Text>
                  <Text style={styles.summaryValue}>
                    Sono diurno: {minutesToHM(totalNapDuration)}
                  </Text>
                  <Text style={styles.summaryValue}>
                    Sono noturno líquido: {minutesToHM(netNightSleep)}
                  </Text>
                  <Text style={styles.summaryTotal}>
                    Total 24h: {minutesToHM(total24h)}
                  </Text>
                </View>
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
    width: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  dayHeader: {
    alignItems: "center",
    marginBottom: 8,
  },
  dayTitle: {
    fontSize: 20,
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
    marginVertical: 8,
  },
  
  section: {
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 8,
    marginBottom: 2,
  },
  sectionSubValue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 16,
    fontStyle: "italic",
    marginBottom: 1,
  },
  
  summarySection: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 3,
  },
  summaryTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 4,
  },
});
