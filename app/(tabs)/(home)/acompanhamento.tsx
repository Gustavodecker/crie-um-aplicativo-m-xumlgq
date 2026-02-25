
import * as ScreenOrientation from 'expo-screen-orientation';
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { apiGet } from "@/utils/api";

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

interface CalculatedNap {
  napNumber: number;
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
  naps: CalculatedNap[];
  daytimeSleepTotal: string | null;
  nightSleepStart: string | null;
  nightSleepLiquidTotal: string | null;
  wakings: CalculatedWaking[];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollContainer: {
    padding: 16,
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    width: "48%",
  },
  dayHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginTop: 10,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  infoText: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
    lineHeight: 18,
  },
  napContainer: {
    marginTop: 6,
    marginBottom: 6,
  },
  napTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  napDetail: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
    lineHeight: 18,
  },
  wakingDetail: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
    lineHeight: 18,
  },
});

// ========== UTILITY FUNCTIONS FOR TIME CALCULATIONS ==========

/**
 * Converts time string (HH:MM) to total minutes from midnight
 */
function timeToMinutes(time: string): number {
  if (!time || time.trim() === "") return 0;
  const parts = time.split(":");
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

/**
 * Calculates the difference between two time strings in minutes
 * Handles overnight periods (e.g., 23:00 to 02:00 = 3 hours)
 */
function calculateTimeDifference(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  if (endMinutes >= startMinutes) {
    return endMinutes - startMinutes;
  } else {
    // Overnight period
    return (24 * 60 - startMinutes) + endMinutes;
  }
}

/**
 * Formats total minutes into "HhMMmin" string (e.g., 150 -> "2h30min")
 */
function formatTimeDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0h00min";
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `${hours}h${minutes.toString().padStart(2, "0")}min`;
}

/**
 * Formats date string to Brazilian format
 */
function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// ========== MAIN CALCULATION FUNCTION ==========

/**
 * Calculates a complete daily report from raw routine data
 */
function calculateDailyReport(routine: Routine, dayIndex: number): DailyReport {
  console.log(`Calculating report for day ${dayIndex + 1}, routine:`, routine.id);
  
  const report: DailyReport = {
    dayNumber: dayIndex + 1,
    dateDisplay: formatDateToBR(routine.date),
    wakeUpTime: null,
    naps: [],
    daytimeSleepTotal: null,
    nightSleepStart: null,
    nightSleepLiquidTotal: null,
    wakings: [],
  };

  // ACORDOU
  if (routine.wakeUpTime && routine.wakeUpTime.trim() !== "") {
    report.wakeUpTime = routine.wakeUpTime;
  }

  // SONECAS & JANELAS
  let totalDaytimeNapMinutes = 0;
  let lastWakeTimeForWindow = routine.wakeUpTime; // For calculating windows

  if (routine.naps && routine.naps.length > 0) {
    // Sort naps by napNumber to ensure correct order
    const sortedNaps = [...routine.naps].sort((a, b) => a.napNumber - b.napNumber);

    sortedNaps.forEach((nap) => {
      // Only process naps that have both start and wake times
      if (nap.startTryTime && nap.wakeUpTime) {
        const napDuration = calculateTimeDifference(nap.startTryTime, nap.wakeUpTime);
        totalDaytimeNapMinutes += napDuration;

        const napDurationFormatted = formatTimeDuration(napDuration);
        const displayText = `Das ${nap.startTryTime} às ${nap.wakeUpTime} (${napDurationFormatted})`;

        // Calculate window (time from last wake to this nap start)
        let windowText = "";
        if (lastWakeTimeForWindow && nap.startTryTime) {
          const windowDuration = calculateTimeDifference(lastWakeTimeForWindow, nap.startTryTime);
          windowText = `Janela: ${formatTimeDuration(windowDuration)}`;
        }

        report.naps.push({
          napNumber: nap.napNumber,
          displayText,
          windowText,
          durationMinutes: napDuration,
        });

        // Update last wake time for next window calculation
        lastWakeTimeForWindow = nap.wakeUpTime;
      }
    });
  }

  // DURAÇÃO DO SONO DIURNO
  if (totalDaytimeNapMinutes > 0) {
    report.daytimeSleepTotal = formatTimeDuration(totalDaytimeNapMinutes);
  }

  // DESPERTARES (Night Wakings)
  let totalWakingMinutes = 0;
  if (routine.nightSleep && routine.nightSleep.wakings && routine.nightSleep.wakings.length > 0) {
    routine.nightSleep.wakings.forEach((waking, index) => {
      if (waking.startTime && waking.endTime) {
        const duration = calculateTimeDifference(waking.startTime, waking.endTime);
        totalWakingMinutes += duration;
        
        const durationFormatted = formatTimeDuration(duration);
        const displayText = `${index + 1}º – ${waking.startTime} às ${waking.endTime} (${durationFormatted})`;
        
        report.wakings.push({
          index: index + 1,
          displayText,
          durationMinutes: duration,
        });
      }
    });
  }

  // SONO NOTURNO
  // Check if nightSleep exists and has valid data (not just an empty object)
  const hasValidNightSleep = routine.nightSleep && 
    typeof routine.nightSleep === 'object' && 
    (routine.nightSleep as any).id;
  
  console.log(`[DEBUG] Day ${dayIndex + 1} nightSleep check:`, {
    exists: !!routine.nightSleep,
    hasId: hasValidNightSleep,
    startTryTime: routine.nightSleep?.startTryTime,
    fellAsleepTime: routine.nightSleep?.fellAsleepTime,
    finalWakeTime: routine.nightSleep?.finalWakeTime,
  });

  if (hasValidNightSleep && routine.nightSleep!.startTryTime) {
    report.nightSleepStart = routine.nightSleep!.startTryTime;

    // Calculate liquid night sleep (brute - wakings)
    if (routine.nightSleep!.fellAsleepTime && routine.nightSleep!.finalWakeTime) {
      const nightSleepBruteMinutes = calculateTimeDifference(
        routine.nightSleep!.fellAsleepTime,
        routine.nightSleep!.finalWakeTime
      );
      const nightSleepLiquidMinutes = nightSleepBruteMinutes - totalWakingMinutes;
      report.nightSleepLiquidTotal = formatTimeDuration(nightSleepLiquidMinutes);
    }
  }

  console.log(`Report calculated for day ${dayIndex + 1}:`, report);
  return report;
}

// ========== MAIN COMPONENT ==========

export default function AcompanhamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const babyId = params.babyId as string;
  const babyName = params.babyName as string;

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("Acompanhamento: Locking screen orientation to landscape");
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch((err) => {
      console.log("Acompanhamento: Failed to lock orientation:", err);
    });

    return () => {
      console.log("Acompanhamento: Unlocking screen orientation");
      ScreenOrientation.unlockAsync().catch((err) => {
        console.log("Acompanhamento: Failed to unlock orientation:", err);
      });
    };
  }, []);

  /**
   * Normalizes nightSleep from the API response.
   * The backend ORM may return nightSleep as:
   *   - null / undefined  → no night sleep record
   *   - {}                → empty object (legacy bug, treat as null)
   *   - { id, ... }       → valid object
   *   - [{ id, ... }]     → array with one item (ORM "with" relation quirk)
   *   - []                → empty array (treat as null)
   */
  const normalizeNightSleep = (raw: any): NightSleep | null => {
    if (!raw) return null;
    // Handle array form (ORM "with" relation returns array)
    if (Array.isArray(raw)) {
      if (raw.length === 0) return null;
      const first = raw[0];
      if (!first || !first.id) return null;
      // Normalize wakings inside the array item as well
      return {
        ...first,
        wakings: Array.isArray(first.wakings) ? first.wakings : [],
      } as NightSleep;
    }
    // Handle object form
    if (typeof raw === 'object' && raw.id) {
      return {
        ...raw,
        wakings: Array.isArray(raw.wakings) ? raw.wakings : [],
      } as NightSleep;
    }
    // Empty object {} or anything else without an id
    return null;
  };

  const loadData = useCallback(async () => {
    console.log("Acompanhamento: Loading data for babyId:", babyId);
    setLoading(true);
    setError(null);
    try {
      // GET /api/routines/baby/:babyId returns full data including naps and nightSleep with wakings
      console.log(`[API] Calling: GET /api/routines/baby/${babyId}`);
      const routinesData = await apiGet<any[]>(`/api/routines/baby/${babyId}`);
      console.log("Acompanhamento: Loaded routines with full data:", routinesData?.length);
      
      // Normalize each routine's nightSleep field
      const normalized: Routine[] = (routinesData || []).map((r, i) => {
        const nightSleep = normalizeNightSleep(r.nightSleep);
        console.log(`[DEBUG] Routine ${i + 1} (${r.date}):`, {
          id: r.id,
          rawNightSleep: r.nightSleep,
          rawNightSleepIsArray: Array.isArray(r.nightSleep),
          normalizedNightSleepId: nightSleep?.id ?? null,
          wakingsCount: nightSleep?.wakings?.length ?? 0,
        });
        if (nightSleep) {
          console.log(`[Night Sleep] Found for routine ${r.id}: id=${nightSleep.id}`);
        } else {
          console.log(`[Night Sleep] No night sleep found for routine ${r.id}`);
        }
        return { ...r, nightSleep };
      });
      
      setRoutines(normalized);
    } catch (err: any) {
      console.error("Acompanhamento: Error loading data:", err);
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [babyId]);

  useEffect(() => {
    if (babyId) {
      loadData();
    }
  }, [babyId, loadData]);

  const handleBack = () => {
    console.log("Acompanhamento: Navigating back");
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Acompanhamento - {babyName}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Acompanhamento - {babyName}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadData} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Routines are already normalized on load (nightSleep is either a valid object or null)
  const normalizedRoutines = routines;

  // Filter routines that have meaningful data
  const filledRoutines = normalizedRoutines.filter((r) => {
    const hasWakeUp = r.wakeUpTime && r.wakeUpTime.trim() !== "";
    const hasNaps = r.naps && r.naps.length > 0;
    const hasNightSleep = r.nightSleep !== null && r.nightSleep !== undefined;
    return hasWakeUp || hasNaps || hasNightSleep;
  });

  // Calculate reports for all filled routines
  const dailyReports = filledRoutines.map((routine, index) => 
    calculateDailyReport(routine, index)
  );

  console.log("Acompanhamento: Generated daily reports:", dailyReports.length);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Acompanhamento - {babyName}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollContainer}>
        {dailyReports.length === 0 ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Nenhuma rotina preenchida ainda.
            </Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {dailyReports.map((report) => {
              const dayNumberText = `DIA ${report.dayNumber}`;
              const dateText = report.dateDisplay;

              return (
                <View key={report.dayNumber} style={styles.dayCard}>
                  <Text style={styles.dayHeader}>{dayNumberText}</Text>
                  <Text style={styles.dateText}>{dateText}</Text>

                  {/* ACORDOU */}
                  {report.wakeUpTime && (
                    <React.Fragment>
                      <Text style={styles.sectionTitle}>ACORDOU:</Text>
                      <Text style={styles.infoText}>{report.wakeUpTime}</Text>
                    </React.Fragment>
                  )}

                  {/* SONECAS */}
                  {report.naps.map((nap) => {
                    const napTitleText = `SONECA ${nap.napNumber}`;
                    
                    return (
                      <View key={nap.napNumber} style={styles.napContainer}>
                        <Text style={styles.napTitle}>{napTitleText}</Text>
                        <Text style={styles.napDetail}>{nap.displayText}</Text>
                        {nap.windowText && (
                          <Text style={styles.napDetail}>{nap.windowText}</Text>
                        )}
                      </View>
                    );
                  })}

                  {/* DURAÇÃO DO SONO DIURNO */}
                  {report.daytimeSleepTotal && (
                    <React.Fragment>
                      <Text style={styles.sectionTitle}>DURAÇÃO DO SONO DIURNO</Text>
                      <Text style={styles.infoText}>
                        Somatória das sonecas: {report.daytimeSleepTotal}
                      </Text>
                    </React.Fragment>
                  )}

                  {/* SONO NOTURNO */}
                  {report.nightSleepStart && (
                    <React.Fragment>
                      <Text style={styles.sectionTitle}>SONO NOTURNO</Text>
                      <Text style={styles.infoText}>
                        Iniciou às {report.nightSleepStart}
                      </Text>
                      {report.nightSleepLiquidTotal && (
                        <Text style={styles.infoText}>
                          Total líquido: {report.nightSleepLiquidTotal}
                        </Text>
                      )}
                    </React.Fragment>
                  )}

                  {/* DESPERTARES */}
                  {report.wakings.length > 0 && (
                    <React.Fragment>
                      <Text style={styles.sectionTitle}>DESPERTARES</Text>
                      {report.wakings.map((waking) => (
                        <Text key={waking.index} style={styles.wakingDetail}>
                          {waking.displayText}
                        </Text>
                      ))}
                    </React.Fragment>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
