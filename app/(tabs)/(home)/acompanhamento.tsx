
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import React, { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/utils/api";
import { colors } from "@/styles/commonStyles";
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaView } from "react-native-safe-area-context";
import { Platform } from "react-native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

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
  startTryTime: string | null;
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

interface CalculatedNap {
  napNumber: number;
  startTime: string;
  endTime: string;
  displayText: string;
  windowText: string;
  durationMinutes: number;
}

interface CalculatedWaking {
  index: number;
  displayText: string;
  durationMinutes: number;
}

interface DailyReport {
  dayNumber: number;
  dateDisplay: string;
  wakeUpTime: string | null;
  firstNapWindow: string | null;
  naps: CalculatedNap[];
  daytimeSleepTotal: string | null;
  nightSleepStart: string | null;
  nightSleepEnd: string | null;
  nightSleepBrute: string | null;
  nightSleepLiquidTotal: string | null;
  wakings: CalculatedWaking[];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
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
  cardHeader: {
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
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  infoText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: "center",
    marginTop: 20,
  },
});

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function calculateTimeDifference(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function formatTimeDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${minutes.toString().padStart(2, "0")}min`;
}

function formatDateToBR(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function calculateDailyReport(routine: Routine, dayIndex: number): DailyReport {
  console.log(`[Acompanhamento] Calculating report for day ${dayIndex}:`, {
    routineId: routine.id,
    date: routine.date,
    wakeUpTime: routine.wakeUpTime,
    napsCount: routine.naps?.length || 0,
    nightSleep: routine.nightSleep,
  });

  const report: DailyReport = {
    dayNumber: dayIndex,
    dateDisplay: formatDateToBR(routine.date),
    wakeUpTime: routine.wakeUpTime || null,
    firstNapWindow: null,
    naps: [],
    daytimeSleepTotal: null,
    nightSleepStart: null,
    nightSleepEnd: null,
    nightSleepBrute: null,
    nightSleepLiquidTotal: null,
    wakings: [],
  };

  // Calculate naps
  const sortedNaps = (routine.naps || [])
    .filter((n) => n.fellAsleepTime && n.wakeUpTime)
    .sort((a, b) => a.napNumber - b.napNumber);

  let totalDaytimeSleep = 0;
  let previousWakeTime = routine.wakeUpTime;

  sortedNaps.forEach((nap, index) => {
    if (!nap.fellAsleepTime || !nap.wakeUpTime) return;

    const napDuration = calculateTimeDifference(nap.fellAsleepTime, nap.wakeUpTime);
    totalDaytimeSleep += napDuration;

    const windowMinutes = previousWakeTime
      ? calculateTimeDifference(previousWakeTime, nap.startTryTime)
      : 0;

    const calculatedNap: CalculatedNap = {
      napNumber: nap.napNumber,
      startTime: nap.fellAsleepTime,
      endTime: nap.wakeUpTime,
      displayText: `Das ${nap.fellAsleepTime} às ${nap.wakeUpTime}`,
      windowText: `Janela: ${formatTimeDuration(windowMinutes)}`,
      durationMinutes: napDuration,
    };

    report.naps.push(calculatedNap);

    if (index === 0 && previousWakeTime) {
      report.firstNapWindow = formatTimeDuration(windowMinutes);
    }

    previousWakeTime = nap.wakeUpTime;
  });

  if (totalDaytimeSleep > 0) {
    report.daytimeSleepTotal = formatTimeDuration(totalDaytimeSleep);
  }

  // Calculate night sleep
  const nightSleep = routine.nightSleep;
  console.log(`[Acompanhamento] Night sleep data for day ${dayIndex}:`, nightSleep);

  if (nightSleep && nightSleep.fellAsleepTime && nightSleep.finalWakeTime) {
    report.nightSleepStart = nightSleep.fellAsleepTime;
    report.nightSleepEnd = nightSleep.finalWakeTime;

    const bruteDuration = calculateTimeDifference(
      nightSleep.fellAsleepTime,
      nightSleep.finalWakeTime
    );
    report.nightSleepBrute = formatTimeDuration(bruteDuration);

    let totalWakingMinutes = 0;
    const wakings = nightSleep.wakings || [];

    wakings.forEach((waking, index) => {
      if (waking.startTime && waking.endTime) {
        const wakingDuration = calculateTimeDifference(waking.startTime, waking.endTime);
        totalWakingMinutes += wakingDuration;

        const calculatedWaking: CalculatedWaking = {
          index: index + 1,
          displayText: `${index + 1}º - ${waking.startTime} às ${waking.endTime}`,
          durationMinutes: wakingDuration,
        };

        report.wakings.push(calculatedWaking);
      }
    });

    const liquidDuration = bruteDuration - totalWakingMinutes;
    report.nightSleepLiquidTotal = formatTimeDuration(liquidDuration);

    console.log(`[Acompanhamento] Night sleep calculated for day ${dayIndex}:`, {
      start: report.nightSleepStart,
      end: report.nightSleepEnd,
      brute: report.nightSleepBrute,
      liquid: report.nightSleepLiquidTotal,
      wakingsCount: report.wakings.length,
    });
  } else {
    console.log(`[Acompanhamento] Night sleep incomplete for day ${dayIndex}:`, {
      fellAsleepTime: nightSleep?.fellAsleepTime,
      finalWakeTime: nightSleep?.finalWakeTime,
    });
  }

  return report;
}

export default function AcompanhamentoScreen() {
  const { babyId } = useLocalSearchParams<{ babyId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);

  const normalizeNightSleep = useCallback((raw: any): NightSleep | null => {
    if (!raw) {
      console.log("[Acompanhamento] normalizeNightSleep: raw is null/undefined");
      return null;
    }

    if (Array.isArray(raw)) {
      if (raw.length === 0) {
        console.log("[Acompanhamento] normalizeNightSleep: empty array");
        return null;
      }
      const sorted = [...raw].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      raw = sorted[0];
      console.log("[Acompanhamento] normalizeNightSleep: using most recent from array", raw.id);
    }

    if (typeof raw === "object" && !raw.id) {
      console.log("[Acompanhamento] normalizeNightSleep: empty object without ID");
      return null;
    }

    const wakings = Array.isArray(raw.wakings) ? raw.wakings : [];

    const normalized: NightSleep = {
      id: raw.id,
      routineId: raw.routineId,
      startTryTime: raw.startTryTime || null,
      fellAsleepTime: raw.fellAsleepTime || null,
      finalWakeTime: raw.finalWakeTime || null,
      observations: raw.observations || null,
      consultantComments: raw.consultantComments || null,
      sleepMethod: raw.sleepMethod || null,
      environment: raw.environment || null,
      wakeUpMood: raw.wakeUpMood || null,
      wakings: wakings,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };

    console.log("[Acompanhamento] normalizeNightSleep: normalized", {
      id: normalized.id,
      fellAsleepTime: normalized.fellAsleepTime,
      finalWakeTime: normalized.finalWakeTime,
      wakingsCount: normalized.wakings?.length || 0,
    });

    return normalized;
  }, []);

  const loadData = useCallback(async () => {
    if (!babyId) {
      setError("ID do bebê não fornecido");
      setLoading(false);
      return;
    }

    console.log("[Acompanhamento] Loading data for babyId:", babyId);

    try {
      setLoading(true);
      setError(null);

      const routinesData = await apiGet<Routine[]>(`/api/routines/baby/${babyId}`);
      console.log("[Acompanhamento] Fetched routines:", routinesData.length);

      const routinesWithCompleteData: Routine[] = [];

      for (const routine of routinesData) {
        console.log(`[Acompanhamento] Processing routine ${routine.id}:`, {
          date: routine.date,
          nightSleepRaw: routine.nightSleep,
        });

        let completeRoutine = { ...routine };

        const nightSleepNormalized = normalizeNightSleep(routine.nightSleep);

        if (!nightSleepNormalized || !nightSleepNormalized.fellAsleepTime) {
          console.log(`[Acompanhamento] Night sleep incomplete for routine ${routine.id}, fetching individual routine`);
          
          try {
            const individualRoutine = await apiGet<Routine>(`/api/routines/${routine.id}`);
            console.log(`[Acompanhamento] Individual routine fetched for ${routine.id}:`, {
              nightSleep: individualRoutine.nightSleep,
            });

            const individualNightSleep = normalizeNightSleep(individualRoutine.nightSleep);
            completeRoutine = {
              ...individualRoutine,
              nightSleep: individualNightSleep,
            };
          } catch (err) {
            console.error(`[Acompanhamento] Failed to fetch individual routine ${routine.id}:`, err);
            completeRoutine.nightSleep = nightSleepNormalized;
          }
        } else {
          completeRoutine.nightSleep = nightSleepNormalized;
        }

        routinesWithCompleteData.push(completeRoutine);
      }

      const filledRoutines = routinesWithCompleteData.filter((r) => {
        const hasNapData = r.naps && r.naps.length > 0;
        const hasNightSleepData =
          r.nightSleep &&
          (r.nightSleep.fellAsleepTime ||
            r.nightSleep.finalWakeTime ||
            (r.nightSleep.wakings && r.nightSleep.wakings.length > 0));
        return hasNapData || hasNightSleepData;
      });

      console.log("[Acompanhamento] Filtered routines with data:", filledRoutines.length);

      const sortedRoutines = filledRoutines.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const calculatedReports = sortedRoutines.map((routine, index) =>
        calculateDailyReport(routine, index + 1)
      );

      console.log("[Acompanhamento] Calculated reports:", calculatedReports.length);
      setReports(calculatedReports);
    } catch (err) {
      console.error("[Acompanhamento] Error loading data:", err);
      setError("Erro ao carregar dados de acompanhamento");
    } finally {
      setLoading(false);
    }
  }, [babyId, normalizeNightSleep]);

  useEffect(() => {
    // Only unlock orientation on native platforms
    if (Platform.OS !== 'web') {
      ScreenOrientation.unlockAsync().catch((err) => {
        console.log("[Acompanhamento] Screen orientation unlock not supported:", err.message);
      });
    }
  }, []);

  useEffect(() => {
    if (babyId) {
      loadData();
    }
  }, [babyId, loadData]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: "Acompanhamento",
            headerLeft: () => (
              <TouchableOpacity onPress={handleBack}>
                <IconSymbol
                  ios_icon_name="chevron.left"
                  android_material_icon_name="arrow-back"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: "Acompanhamento",
            headerLeft: () => (
              <TouchableOpacity onPress={handleBack}>
                <IconSymbol
                  ios_icon_name="chevron.left"
                  android_material_icon_name="arrow-back"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            ),
          }}
        />
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Acompanhamento",
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack}>
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {reports.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum dado de rotina disponível</Text>
        ) : (
          reports.map((report) => {
            const dayNumberText = `DIA ${report.dayNumber}`;
            const wakeUpText = report.wakeUpTime || "Não registrado";
            const firstNapWindowText = report.firstNapWindow || "N/A";

            return (
              <View key={report.dayNumber} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.dayTitle}>{dayNumberText}</Text>
                  <Text style={styles.dateText}>{report.dateDisplay}</Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>ACORDOU:</Text>
                  <Text style={styles.infoText}>{wakeUpText}</Text>
                </View>

                {report.firstNapWindow && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>JANELA DA 1ª SONECA</Text>
                    <Text style={styles.infoText}>{firstNapWindowText}</Text>
                  </View>
                )}

                {report.naps.length > 0 && (
                  <View style={styles.section}>
                    {report.naps.map((nap) => {
                      const napTitle = `SONECA ${nap.napNumber}`;
                      const napDurationText = formatTimeDuration(nap.durationMinutes);

                      return (
                        <React.Fragment key={nap.napNumber}>
                          <Text style={styles.sectionTitle}>{napTitle}</Text>
                          <Text style={styles.infoText}>{nap.displayText}</Text>
                          <Text style={styles.infoText}>({napDurationText})</Text>
                          <Text style={styles.infoText}>{nap.windowText}</Text>
                        </React.Fragment>
                      );
                    })}
                  </View>
                )}

                {report.daytimeSleepTotal && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SONO DIURNO</Text>
                    <Text style={styles.infoText}>Total: {report.daytimeSleepTotal}</Text>
                  </View>
                )}

                {report.nightSleepStart && report.nightSleepEnd && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SONO NOTURNO</Text>
                    <Text style={styles.infoText}>Início: {report.nightSleepStart}</Text>
                    <Text style={styles.infoText}>Fim: {report.nightSleepEnd}</Text>
                    {report.nightSleepBrute && (
                      <Text style={styles.infoText}>Total bruto: {report.nightSleepBrute}</Text>
                    )}
                    {report.nightSleepLiquidTotal && (
                      <Text style={styles.infoText}>Total líquido: {report.nightSleepLiquidTotal}</Text>
                    )}
                  </View>
                )}

                {report.wakings.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>DESPERTARES</Text>
                    {report.wakings.map((waking) => {
                      const wakingDurationText = `(${formatTimeDuration(waking.durationMinutes)})`;

                      return (
                        <React.Fragment key={waking.index}>
                          <Text style={styles.infoText}>{waking.displayText}</Text>
                          <Text style={styles.infoText}>{wakingDurationText}</Text>
                        </React.Fragment>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
