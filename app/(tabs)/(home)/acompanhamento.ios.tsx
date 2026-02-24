
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenOrientation from 'expo-screen-orientation';
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#666',
  },
});

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const displayDate = `${day}/${month}/${year}`;
  return displayDate;
}

export default function AcompanhamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const babyId = params.babyId as string;

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function lockOrientation() {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    lockOrientation();

    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  const loadData = useCallback(async () => {
    console.log('Acompanhamento: Loading data for babyId:', babyId);
    if (!babyId) {
      setError('Baby ID não fornecido');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const routinesResponse = await apiGet(`/api/routines?babyId=${babyId}`);
      console.log('Acompanhamento: Routines loaded:', routinesResponse);

      const filledRoutines = routinesResponse.filter((r: Routine) => {
        const hasWakeUp = r.wakeUpTime && r.wakeUpTime.trim() !== '';
        const hasNaps = r.naps && r.naps.length > 0;
        const hasNightSleep = r.nightSleep && (r.nightSleep.startTryTime || r.nightSleep.fellAsleepTime);
        return hasWakeUp || hasNaps || hasNightSleep;
      });

      filledRoutines.sort((a: Routine, b: Routine) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      console.log('Acompanhamento: Filtered and sorted routines:', filledRoutines.length);
      setRoutines(filledRoutines);
    } catch (err) {
      console.error('Acompanhamento: Error loading data:', err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [babyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderDayCard = useCallback((routine: Routine, index: number) => {
    const dayNumber = index + 1;
    const dateFormatted = formatDateToBR(routine.date);

    return (
      <View key={routine.id} style={styles.card}>
        <Text style={styles.dayTitle}>DIA {dayNumber}</Text>
        <Text style={styles.dateText}>{dateFormatted}</Text>
      </View>
    );
  }, []);

  const renderRows = useCallback(() => {
    const rows = [];
    for (let i = 0; i < routines.length; i += 2) {
      const row = (
        <View key={`row-${i}`} style={styles.rowContainer}>
          {renderDayCard(routines[i], i)}
          {i + 1 < routines.length && renderDayCard(routines[i + 1], i + 1)}
          {i + 1 >= routines.length && <View style={{ width: '48%' }} />}
        </View>
      );
      rows.push(row);
    }
    return rows;
  }, [routines, renderDayCard]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Acompanhamento',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
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
            title: 'Acompanhamento',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (routines.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Acompanhamento',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Nenhuma rotina preenchida</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Acompanhamento',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
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
        {renderRows()}
      </ScrollView>
    </SafeAreaView>
  );
}
