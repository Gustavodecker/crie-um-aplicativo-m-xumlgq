
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
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  infoText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  napContainer: {
    marginTop: 8,
    marginBottom: 8,
    paddingLeft: 8,
  },
  napTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  wakingContainer: {
    marginTop: 4,
    paddingLeft: 8,
  },
  wakingText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
});

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

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

  const loadData = useCallback(async () => {
    console.log("Acompanhamento: Loading data for babyId:", babyId);
    setLoading(true);
    setError(null);
    try {
      console.log(`[API] Calling: GET /api/routines/baby/${babyId}`);
      const data = await apiGet<Routine[]>(`/api/routines/baby/${babyId}`);
      console.log("Acompanhamento: Loaded routines:", data);
      setRoutines(data || []);
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

  // Filter routines that have data (wakeUpTime or naps or nightSleep)
  const filledRoutines = routines.filter((r) => {
    const hasWakeUp = r.wakeUpTime && r.wakeUpTime.trim() !== "";
    const hasNaps = r.naps && r.naps.length > 0;
    const hasNightSleep = r.nightSleep !== null && r.nightSleep !== undefined;
    return hasWakeUp || hasNaps || hasNightSleep;
  });

  console.log("Acompanhamento: Filtered routines:", filledRoutines.length);

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
        {filledRoutines.length === 0 ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Nenhuma rotina preenchida ainda.
            </Text>
          </View>
        ) : (
          filledRoutines.map((routine, index) => {
            const dayNumber = index + 1;
            const dateDisplay = formatDateToBR(routine.date);

            return (
              <View key={routine.id} style={styles.dayCard}>
                <Text style={styles.dayHeader}>DIA {dayNumber}</Text>
                <Text style={styles.dateText}>{dateDisplay}</Text>

                {/* Only show sections if data exists */}
                {routine.wakeUpTime && routine.wakeUpTime.trim() !== "" && (
                  <>
                    <Text style={styles.sectionTitle}>ACORDOU:</Text>
                    <Text style={styles.infoText}>{routine.wakeUpTime}</Text>
                  </>
                )}

                {routine.naps && routine.naps.length > 0 && (
                  <>
                    {routine.naps.map((nap) => (
                      <View key={nap.id} style={styles.napContainer}>
                        <Text style={styles.napTitle}>
                          SONECA {nap.napNumber}
                        </Text>
                        {nap.startTryTime && (
                          <Text style={styles.infoText}>
                            Início: {nap.startTryTime}
                          </Text>
                        )}
                        {nap.fellAsleepTime && (
                          <Text style={styles.infoText}>
                            Dormiu: {nap.fellAsleepTime}
                          </Text>
                        )}
                        {nap.wakeUpTime && (
                          <Text style={styles.infoText}>
                            Acordou: {nap.wakeUpTime}
                          </Text>
                        )}
                      </View>
                    ))}
                  </>
                )}

                {routine.nightSleep && (
                  <>
                    <Text style={styles.sectionTitle}>SONO NOTURNO</Text>
                    {routine.nightSleep.startTryTime && (
                      <Text style={styles.infoText}>
                        Iniciou às {routine.nightSleep.startTryTime}
                      </Text>
                    )}
                    {routine.nightSleep.fellAsleepTime && (
                      <Text style={styles.infoText}>
                        Dormiu às {routine.nightSleep.fellAsleepTime}
                      </Text>
                    )}
                    {routine.nightSleep.finalWakeTime && (
                      <Text style={styles.infoText}>
                        Acordou às {routine.nightSleep.finalWakeTime}
                      </Text>
                    )}

                    {routine.nightSleep.wakings &&
                      routine.nightSleep.wakings.length > 0 && (
                        <>
                          <Text style={styles.sectionTitle}>DESPERTARES</Text>
                          {routine.nightSleep.wakings.map((waking, idx) => (
                            <View key={waking.id} style={styles.wakingContainer}>
                              <Text style={styles.wakingText}>
                                {idx + 1}º – {waking.startTime} às{" "}
                                {waking.endTime}
                              </Text>
                            </View>
                          ))}
                        </>
                      )}
                  </>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
