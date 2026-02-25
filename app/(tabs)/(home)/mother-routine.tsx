
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ConfirmModal } from "@/components/ConfirmModal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Baby {
  id: string;
  name: string;
}

interface Nap {
  id: string;
  routineId: string;
  napNumber: number;
  startTryTime: string;
  fellAsleepTime: string | null;
  wakeUpTime: string | null;
  observations: string | null;
}

interface NightWaking {
  id: string;
  nightSleepId: string;
  startTime: string;
  endTime: string;
}

interface NightSleep {
  id: string;
  routineId: string;
  startTryTime: string | null;
  fellAsleepTime: string | null;
  finalWakeTime: string | null;
  observations: string | null;
  wakings?: NightWaking[];
}

interface Routine {
  id: string;
  babyId: string;
  date: string;
  wakeUpTime: string | null;
  motherObservations: string | null;
  naps?: Nap[];
  nightSleep?: NightSleep | null;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function calcTimeDiff(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function minutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}m`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MotherRoutineScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baby, setBaby] = useState<Baby | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerField, setTimePickerField] = useState<string | null>(null);
  const [timePickerValue, setTimePickerValue] = useState(new Date());
  
  // Confirm modal state
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalMessage, setConfirmModalMessage] = useState("");
  const [confirmModalAction, setConfirmModalAction] = useState<(() => void) | null>(null);

  const loadData = useCallback(async () => {
    console.log("[Mother Routine] Loading data");
    try {
      // Load baby data
      const babyData = await apiGet<Baby>("/api/mother/baby");
      console.log("[Mother Routine] Baby loaded:", babyData.name);
      setBaby(babyData);

      // Load today's routine
      const today = new Date().toISOString().split("T")[0];
      try {
        const routines = await apiGet<Routine[]>(`/api/routines/baby/${babyData.id}`);
        let todayRoutine = routines.find(r => r.date === today);
        
        if (!todayRoutine) {
          // Create routine for today
          console.log("[Mother Routine] Creating routine for today");
          todayRoutine = await apiPost<Routine>("/api/routines", {
            babyId: babyData.id,
            date: today,
            wakeUpTime: null,
            motherObservations: null,
          });
        }
        
        setRoutine(todayRoutine);
      } catch (err: any) {
        console.error("[Mother Routine] Error loading routine:", err);
        setError(err.message || "Erro ao carregar rotina");
      }
    } catch (error: any) {
      console.error("[Mother Routine] Error loading data:", error);
      setError(error.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateWakeUpTime = async (time: string) => {
    if (!routine) return;
    
    try {
      const updated = await apiPut<Routine>(`/api/routines/${routine.id}`, {
        wakeUpTime: time,
      });
      setRoutine(updated);
    } catch (error: any) {
      console.error("[Mother Routine] Error updating wake up time:", error);
      setError(error.message || "Erro ao atualizar horário");
    }
  };

  const handleAddNap = async () => {
    if (!routine) return;
    
    setSaving(true);
    try {
      const napNumber = (routine.naps?.length || 0) + 1;
      const newNap = await apiPost<Nap>("/api/naps", {
        routineId: routine.id,
        napNumber,
        startTryTime: "12:00",
        fellAsleepTime: null,
        wakeUpTime: null,
        observations: null,
      });
      
      setRoutine({
        ...routine,
        naps: [...(routine.naps || []), newNap],
      });
    } catch (error: any) {
      console.error("[Mother Routine] Error adding nap:", error);
      setError(error.message || "Erro ao adicionar soneca");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNap = async (napId: string, field: string, value: string | null) => {
    if (!routine) return;
    
    try {
      const updated = await apiPut<Nap>(`/api/naps/${napId}`, {
        [field]: value,
      });
      
      setRoutine({
        ...routine,
        naps: routine.naps?.map(n => n.id === napId ? updated : n),
      });
    } catch (error: any) {
      console.error("[Mother Routine] Error updating nap:", error);
      setError(error.message || "Erro ao atualizar soneca");
    }
  };

  const handleDeleteNap = async (napId: string) => {
    if (!routine) return;
    
    try {
      await apiDelete(`/api/naps/${napId}`);
      
      setRoutine({
        ...routine,
        naps: routine.naps?.filter(n => n.id !== napId),
      });
    } catch (error: any) {
      console.error("[Mother Routine] Error deleting nap:", error);
      setError(error.message || "Erro ao deletar soneca");
    }
  };

  const confirmDeleteNap = (napId: string, napNumber: number) => {
    setConfirmModalMessage(`Deseja realmente excluir a Soneca ${napNumber}?`);
    setConfirmModalAction(() => () => handleDeleteNap(napId));
    setConfirmModalVisible(true);
  };

  const openTimePicker = (field: string, currentValue?: string) => {
    const now = new Date();
    if (currentValue) {
      const [hours, minutes] = currentValue.split(":").map(Number);
      now.setHours(hours, minutes, 0, 0);
    }
    setTimePickerValue(now);
    setTimePickerField(field);
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    
    if (event.type === "dismissed") {
      setShowTimePicker(false);
      return;
    }
    
    if (selectedDate && timePickerField) {
      const hours = selectedDate.getHours().toString().padStart(2, "0");
      const minutes = selectedDate.getMinutes().toString().padStart(2, "0");
      const timeString = `${hours}:${minutes}`;
      
      if (timePickerField === "wakeUpTime") {
        handleUpdateWakeUpTime(timeString);
      } else if (timePickerField.startsWith("nap-")) {
        const [, napId, field] = timePickerField.split("-");
        handleUpdateNap(napId, field, timeString);
      }
      
      if (Platform.OS === "ios") {
        setShowTimePicker(false);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !baby || !routine) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ 
          headerShown: true, 
          title: "Registrar Rotina",
          headerBackTitle: "Voltar",
        }} />
        <View style={styles.errorContainer}>
          <IconSymbol 
            ios_icon_name="exclamationmark.triangle.fill" 
            android_material_icon_name="warning" 
            size={64} 
            color={colors.error} 
          />
          <Text style={styles.errorTitle}>Ops!</Text>
          <Text style={styles.errorText}>
            {error || "Não foi possível carregar os dados"}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const todayDate = formatDateToBR(routine.date);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: "Registrar Rotina",
        headerBackTitle: "Voltar",
      }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Date Header */}
        <View style={styles.dateHeader}>
          <IconSymbol 
            ios_icon_name="calendar" 
            android_material_icon_name="calendar-today" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={styles.dateText}>{todayDate}</Text>
        </View>

        {/* Wake Up Time */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Horário que Acordou</Text>
          <TouchableOpacity 
            style={styles.timeButton}
            onPress={() => openTimePicker("wakeUpTime", routine.wakeUpTime || undefined)}
          >
            <IconSymbol 
              ios_icon_name="sunrise.fill" 
              android_material_icon_name="wb-sunny" 
              size={24} 
              color={colors.secondary} 
            />
            <Text style={styles.timeButtonText}>
              {routine.wakeUpTime || "Definir horário"}
            </Text>
            <IconSymbol 
              ios_icon_name="chevron.right" 
              android_material_icon_name="chevron-right" 
              size={20} 
              color={colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>

        {/* Naps */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sonecas</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={handleAddNap}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <IconSymbol 
                    ios_icon_name="plus.circle.fill" 
                    android_material_icon_name="add-circle" 
                    size={20} 
                    color={colors.primary} 
                  />
                  <Text style={styles.addButtonText}>Adicionar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {routine.naps && routine.naps.length > 0 ? (
            routine.naps.map((nap, index) => {
              const duration = nap.fellAsleepTime && nap.wakeUpTime 
                ? calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime)
                : 0;
              const durationText = duration > 0 ? minutesToHM(duration) : "--";

              return (
                <View key={nap.id} style={styles.napCard}>
                  <View style={styles.napHeader}>
                    <Text style={styles.napTitle}>Soneca {nap.napNumber}</Text>
                    <TouchableOpacity 
                      onPress={() => confirmDeleteNap(nap.id, nap.napNumber)}
                    >
                      <IconSymbol 
                        ios_icon_name="trash.fill" 
                        android_material_icon_name="delete" 
                        size={20} 
                        color={colors.error} 
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.napTimeRow}>
                    <View style={styles.napTimeItem}>
                      <Text style={styles.napTimeLabel}>Começou a tentar</Text>
                      <TouchableOpacity 
                        style={styles.napTimeButton}
                        onPress={() => openTimePicker(`nap-${nap.id}-startTryTime`, nap.startTryTime)}
                      >
                        <Text style={styles.napTimeValue}>{nap.startTryTime}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.napTimeItem}>
                      <Text style={styles.napTimeLabel}>Dormiu</Text>
                      <TouchableOpacity 
                        style={styles.napTimeButton}
                        onPress={() => openTimePicker(`nap-${nap.id}-fellAsleepTime`, nap.fellAsleepTime || undefined)}
                      >
                        <Text style={styles.napTimeValue}>
                          {nap.fellAsleepTime || "--:--"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.napTimeItem}>
                      <Text style={styles.napTimeLabel}>Acordou</Text>
                      <TouchableOpacity 
                        style={styles.napTimeButton}
                        onPress={() => openTimePicker(`nap-${nap.id}-wakeUpTime`, nap.wakeUpTime || undefined)}
                      >
                        <Text style={styles.napTimeValue}>
                          {nap.wakeUpTime || "--:--"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.napDuration}>
                    <Text style={styles.napDurationLabel}>Duração:</Text>
                    <Text style={styles.napDurationValue}>{durationText}</Text>
                  </View>

                  <TextInput
                    style={styles.observationsInput}
                    placeholder="Observações sobre esta soneca..."
                    value={nap.observations || ""}
                    onChangeText={(text) => handleUpdateNap(nap.id, "observations", text)}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Nenhuma soneca registrada ainda
              </Text>
              <Text style={styles.emptyStateHint}>
                Toque em "Adicionar" para registrar
              </Text>
            </View>
          )}
        </View>

        {/* General Observations */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Observações Gerais do Dia</Text>
          <TextInput
            style={[styles.observationsInput, styles.generalObservations]}
            placeholder="Adicione observações sobre o dia..."
            value={routine.motherObservations || ""}
            onChangeText={(text) => {
              setRoutine({ ...routine, motherObservations: text });
              // Auto-save after typing stops (debounced)
              setTimeout(async () => {
                try {
                  await apiPut(`/api/routines/${routine.id}`, {
                    motherObservations: text,
                  });
                } catch (error) {
                  console.error("[Mother Routine] Error saving observations:", error);
                }
              }, 1000);
            }}
            multiline
            numberOfLines={5}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <IconSymbol 
            ios_icon_name="info.circle.fill" 
            android_material_icon_name="info" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={styles.infoText}>
            Registre as sonecas ao longo do dia. Sua consultora acompanhará a evolução e ajustará as orientações.
          </Text>
        </View>
      </ScrollView>

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={timePickerValue}
          mode="time"
          is24Hour={true}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        visible={confirmModalVisible}
        title="Confirmar Exclusão"
        message={confirmModalMessage}
        onConfirm={() => {
          if (confirmModalAction) {
            confirmModalAction();
          }
          setConfirmModalVisible(false);
          setConfirmModalAction(null);
        }}
        onCancel={() => {
          setConfirmModalVisible(false);
          setConfirmModalAction(null);
        }}
      />
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
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  dateText: {
    ...typography.h3,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  timeButtonText: {
    ...typography.body,
    flex: 1,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  addButtonText: {
    ...typography.button,
    color: colors.primary,
    fontSize: 14,
  },
  napCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  napHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  napTitle: {
    ...typography.h4,
  },
  napTimeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  napTimeItem: {
    flex: 1,
  },
  napTimeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  napTimeButton: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: "center",
  },
  napTimeValue: {
    ...typography.body,
    fontWeight: "600",
  },
  napDuration: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  napDurationLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  napDurationValue: {
    ...typography.h4,
    color: colors.primary,
  },
  observationsInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border || "#E0E0E0",
    textAlignVertical: "top",
  },
  generalObservations: {
    minHeight: 100,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
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
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
