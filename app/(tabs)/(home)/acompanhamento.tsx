
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
  return `${hStr}:${mStr}`;
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
        const hasWakeUpTime = r.wakeUpTime && r.wakeUpTime.trim() !== "";
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

  const renderDayCard = (routine: Routine, index: number) => {
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
    
    const dayNumber = index + 1;
    const wakeUpTime = routine.wakeUpTime;
    
    const dayNumberText = `DIA ${dayNumber}`;
    
    const acordouLabel = "Acordou:";
    const acordouValue = wakeUpTime;
    
    let janelaLabel = "";
    let janelaValue = "";
    if (nightSleep && nightSleep.startTryTime && wakeUpTime) {
      const totalWindow = calcTimeDiff(nightSleep.startTryTime, wakeUpTime);
      const netWindow = totalWindow - totalWakingDuration;
      janelaLabel = "Janela de:";
      janelaValue = minutesToHM(netWindow);
    }
    
    const duracaoSonoDiurnoLabel = "Duração sono diurno:";
    const duracaoSonoDiurnoValue = `Somatória das sonecas: ${minutesToHM(totalNapDuration)}`;
    
    const sonoNoturnoLabel = "Sono noturno";
    let sonoNoturnoValue = "";
    if (nightSleep && nightSleep.startTryTime) {
      sonoNoturnoValue = `Iniciou às ${nightSleep.startTryTime}`;
      if (nightSleepDuration > 0) {
        sonoNoturnoValue += ` (Total ${minutesToHM(nightSleepDuration)})`;
      }
    }
    
    const despertaresLabel = "Despertares:";
    
    return (
      <View key={routine.id} style={styles.dayCard}>
        <ScrollView showsVerticalScrollIndicator={true}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>{dayNumberText}</Text>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.infoLabel}>{acordouLabel}</Text>
            <Text style={styles.infoValue}>{acordouValue}</Text>
          </View>
          
          {janelaLabel !== "" && (
            <View style={styles.section}>
              <Text style={styles.infoLabel}>{janelaLabel}</Text>
              <Text style={styles.infoValue}>{janelaValue}</Text>
            </View>
          )}
          
          <View style={styles.divider} />
          
          {naps.map((nap, napIndex) => {
            const sleepDuration = nap.fellAsleepTime && nap.wakeUpTime 
              ? calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime) 
              : 0;
            
            const prevWakeTime = napIndex > 0 && naps[napIndex - 1].wakeUpTime 
              ? naps[napIndex - 1].wakeUpTime 
              : wakeUpTime;
            
            const windowToThisNap = nap.startTryTime 
              ? calcTimeDiff(prevWakeTime, nap.startTryTime)
              : 0;
            
            const napLabel = `Soneca ${napIndex + 1}`;
            const napTimeText = nap.fellAsleepTime && nap.wakeUpTime 
              ? `Das ${nap.fellAsleepTime} às ${nap.wakeUpTime} (${minutesToHM(sleepDuration)})`
              : nap.startTryTime
              ? `Tentativa às ${nap.startTryTime}`
              : "";
            const napWindowText = windowToThisNap > 0 ? `Janela de ${minutesToHM(windowToThisNap)}` : "";
            
            return (
              <React.Fragment key={nap.id}>
                <View style={styles.napSection}>
                  <Text style={styles.napLabel}>{napLabel}</Text>
                  {napTimeText !== "" && (
                    <Text style={styles.napTime}>{napTimeText}</Text>
                  )}
                  {napWindowText !== "" && (
                    <Text style={styles.napWindow}>{napWindowText}</Text>
                  )}
                </View>
              </React.Fragment>
            );
          })}
          
          <View style={styles.divider} />
          
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{duracaoSonoDiurnoLabel}</Text>
            <Text style={styles.sectionValue}>{duracaoSonoDiurnoValue}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{sonoNoturnoLabel}</Text>
            {sonoNoturnoValue !== "" ? (
              <Text style={styles.sectionValue}>{sonoNoturnoValue}</Text>
            ) : (
              <Text style={styles.sectionValue}>Não registrado</Text>
            )}
          </View>
          
          {wakings.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{despertaresLabel}</Text>
                {wakings.map((waking, wakingIndex) => {
                  const duration = calcTimeDiff(waking.startTime, waking.endTime);
                  const wakingNumber = wakingIndex + 1;
                  const wakingText = `${wakingNumber}º - ${waking.startTime} - ${waking.endTime} (${minutesToHM(duration)})`;
                  return (
                    <Text key={waking.id} style={styles.sectionValue}>
                      {wakingText}
                    </Text>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderRows = () => {
    const rows = [];
    for (let i = 0; i < routines.length; i += 2) {
      const row = (
        <View key={`row-${i}`} style={styles.row}>
          {renderDayCard(routines[i], i)}
          {i + 1 < routines.length && renderDayCard(routines[i + 1], i + 1)}
        </View>
      );
      rows.push(row);
    }
    return rows;
  };

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
        contentContainerStyle={styles.scrollContent}
      >
        {renderRows()}
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
  
  row: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 16,
  },
  
  dayCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: 500,
  },
  
  dayHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
  },
  
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  
  section: {
    marginBottom: 8,
  },
  
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 2,
  },
  
  napSection: {
    marginBottom: 10,
  },
  napLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  napTime: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 8,
    marginBottom: 2,
  },
  napWindow: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
    fontStyle: "italic",
  },
  
  sectionLabel: {
    fontSize: 14,
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
});
