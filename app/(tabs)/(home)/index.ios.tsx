
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
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ConfirmModal } from "@/components/ConfirmModal";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { useAuth } from "@/contexts/AuthContext";
import React, { useState, useEffect, useCallback } from "react";

interface Baby {
  id: string;
  name: string;
  activeContract: any | null;
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
  sleepMethod: string | null;
  environment: string | null;
  wakeUpMood: string | null;
  observations: string | null;
  consultantComments: string | null;
  wakings?: NightWaking[];
}

interface Routine {
  id: string;
  babyId: string;
  date: string;
  wakeUpTime: string | null;
  motherObservations: string | null;
  consultantComments: string | null;
  naps?: Nap[];
  nightSleep?: NightSleep | null;
}

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function getDayOfWeek(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const days = [
    "DOMINGO",
    "SEGUNDA-FEIRA",
    "TERÇA-FEIRA",
    "QUARTA-FEIRA",
    "QUINTA-FEIRA",
    "SEXTA-FEIRA",
    "SÁBADO",
  ];
  return days[date.getDay()];
}

function calcTimeDiff(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  let diff = endMin - startMin;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function minutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m < 10 ? "0" : ""}${m}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerField, setTimePickerField] = useState<string>("");
  const [timePickerValue, setTimePickerValue] = useState(new Date());

  const [confirmDeleteNap, setConfirmDeleteNap] = useState<{
    napId: string;
    napNumber: number;
  } | null>(null);
  const [confirmDeleteWaking, setConfirmDeleteWaking] = useState<string | null>(
    null
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<Baby[]>("/api/babies");
      console.log("Babies carregados:", data);
      setBabies(data);
      if (data.length > 0) {
        setSelectedBaby(data[0]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar bebês:", err);
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedBaby) {
      loadRoutines();
    }
  }, [selectedBaby]);

  const loadRoutines = async () => {
    if (!selectedBaby) return;
    try {
      setLoading(true);
      const data = await apiGet<Routine[]>(
        `/api/routines?babyId=${selectedBaby.id}`
      );
      console.log("Rotinas carregadas:", data);
      setRoutines(data);
      if (data.length > 0) {
        setSelectedRoutine(data[0]);
      } else {
        setSelectedRoutine(null);
      }
    } catch (err: any) {
      console.error("Erro ao carregar rotinas:", err);
      setError(err.message || "Erro ao carregar rotinas");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConsultantComments = async () => {
    if (!selectedRoutine) return;
    try {
      setSaving(true);
      await apiPut(`/api/routines/${selectedRoutine.id}`, {
        consultantComments: selectedRoutine.consultantComments,
      });
      console.log("Comentários da consultora salvos");
    } catch (err: any) {
      console.error("Erro ao salvar comentários:", err);
      setError(err.message || "Erro ao salvar comentários");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNapConsultantComments = async (napId: string) => {
    if (!selectedRoutine) return;
    const nap = selectedRoutine.naps?.find((n) => n.id === napId);
    if (!nap) return;
    try {
      setSaving(true);
      await apiPut(`/api/naps/${napId}`, {
        consultantComments: nap.consultantComments,
      });
      console.log("Comentários da consultora salvos na soneca");
    } catch (err: any) {
      console.error("Erro ao salvar comentários da soneca:", err);
      setError(err.message || "Erro ao salvar comentários");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNightConsultantComments = async () => {
    if (!selectedRoutine?.nightSleep) return;
    try {
      setSaving(true);
      await apiPut(`/api/night-sleep/${selectedRoutine.nightSleep.id}`, {
        consultantComments: selectedRoutine.nightSleep.consultantComments,
      });
      console.log("Comentários da consultora salvos no sono noturno");
    } catch (err: any) {
      console.error("Erro ao salvar comentários do sono noturno:", err);
      setError(err.message || "Erro ao salvar comentários");
    } finally {
      setSaving(false);
    }
  };

  const openTimePicker = (field: string) => {
    setTimePickerField(field);
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (event.type === "dismissed") {
      return;
    }
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, "0");
      const minutes = selectedDate.getMinutes().toString().padStart(2, "0");
      const timeString = `${hours}:${minutes}`;
      console.log("Horário selecionado:", timeString, "para campo:", timePickerField);
      // Aqui você pode atualizar o campo correspondente
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Rotina Diária" }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Rotina Diária" }} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (babies.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Rotina Diária" }} />
        <Text style={styles.emptyText}>Nenhum bebê cadastrado</Text>
      </SafeAreaView>
    );
  }

  if (!selectedBaby) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Rotina Diária" }} />
        <Text style={styles.emptyText}>Selecione um bebê</Text>
      </SafeAreaView>
    );
  }

  if (routines.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Rotina Diária" }} />
        <Text style={styles.emptyText}>Nenhuma rotina cadastrada para este bebê</Text>
      </SafeAreaView>
    );
  }

  if (!selectedRoutine) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Rotina Diária" }} />
        <Text style={styles.emptyText}>Selecione uma rotina</Text>
      </SafeAreaView>
    );
  }

  const dayOfWeek = getDayOfWeek(selectedRoutine.date);
  const dateFormatted = formatDateToBR(selectedRoutine.date);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Rotina Diária - Consultora" }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Seletor de Bebê */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bebê</Text>
          <View style={styles.pickerContainer}>
            {babies.map((baby) => (
              <TouchableOpacity
                key={baby.id}
                style={[
                  styles.babyOption,
                  selectedBaby?.id === baby.id && styles.babyOptionSelected,
                ]}
                onPress={() => setSelectedBaby(baby)}
              >
                <Text
                  style={[
                    styles.babyOptionText,
                    selectedBaby?.id === baby.id && styles.babyOptionTextSelected,
                  ]}
                >
                  {baby.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Seletor de Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.pickerContainer}>
            {routines.map((routine) => (
              <TouchableOpacity
                key={routine.id}
                style={[
                  styles.dateOption,
                  selectedRoutine?.id === routine.id && styles.dateOptionSelected,
                ]}
                onPress={() => setSelectedRoutine(routine)}
              >
                <Text
                  style={[
                    styles.dateOptionText,
                    selectedRoutine?.id === routine.id && styles.dateOptionTextSelected,
                  ]}
                >
                  {formatDateToBR(routine.date)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dia da Semana e Data */}
        <View style={styles.dateHeader}>
          <Text style={styles.dayOfWeek}>{dayOfWeek}</Text>
          <Text style={styles.dateDisplay}>{dateFormatted}</Text>
        </View>

        {/* Horário que Acordou */}
        <View style={styles.section}>
          <Text style={styles.label}>Horário que Acordou</Text>
          <View style={styles.readOnlyBox}>
            <Text style={styles.readOnlyText}>
              {selectedRoutine.wakeUpTime || "Não informado"}
            </Text>
          </View>
        </View>

        {/* Sonecas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sonecas</Text>
          {selectedRoutine.naps && selectedRoutine.naps.length > 0 ? (
            selectedRoutine.naps.map((nap, index) => {
              const prevWakeTime =
                index === 0
                  ? selectedRoutine.wakeUpTime
                  : selectedRoutine.naps?.[index - 1]?.wakeUpTime;

              let sleepWindow = "";
              let timeToFallAsleep = "";
              let sleepDuration = "";

              if (prevWakeTime && nap.startTryTime) {
                const windowMinutes = calcTimeDiff(prevWakeTime, nap.startTryTime);
                sleepWindow = minutesToHM(windowMinutes);
              }

              if (nap.startTryTime && nap.fellAsleepTime) {
                const fallAsleepMinutes = calcTimeDiff(
                  nap.startTryTime,
                  nap.fellAsleepTime
                );
                timeToFallAsleep = minutesToHM(fallAsleepMinutes);
              }

              if (nap.fellAsleepTime && nap.wakeUpTime) {
                const durationMinutes = calcTimeDiff(
                  nap.fellAsleepTime,
                  nap.wakeUpTime
                );
                sleepDuration = minutesToHM(durationMinutes);
              }

              return (
                <View key={nap.id} style={styles.napCard}>
                  <Text style={styles.napTitle}>
                    {index === 0 ? "Primeira" : index === 1 ? "Segunda" : index === 2 ? "Terceira" : index === 3 ? "Quarta" : index === 4 ? "Quinta" : "Sexta"} Soneca
                  </Text>

                  <View style={styles.napDataSection}>
                    <View style={styles.napDataRow}>
                      <Text style={styles.napDataLabel}>Levado ao quarto:</Text>
                      <Text style={styles.napDataValue}>
                        {nap.startTryTime || "—"}
                      </Text>
                    </View>
                    <View style={styles.napDataRow}>
                      <Text style={styles.napDataLabel}>Dormiu às:</Text>
                      <Text style={styles.napDataValue}>
                        {nap.fellAsleepTime || "—"}
                      </Text>
                    </View>
                    <View style={styles.napDataRow}>
                      <Text style={styles.napDataLabel}>Acordou às:</Text>
                      <Text style={styles.napDataValue}>
                        {nap.wakeUpTime || "—"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.resultsSection}>
                    <Text style={styles.resultsTitle}>Resultados:</Text>

                    {sleepWindow && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>
                          Janela de sono realizada:
                        </Text>
                        <Text style={styles.resultValue}>{sleepWindow}</Text>
                        <Text style={styles.resultDetail}>
                          ({prevWakeTime} → {nap.startTryTime})
                        </Text>
                      </View>
                    )}

                    {timeToFallAsleep && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>
                          Tempo para adormecer:
                        </Text>
                        <Text style={styles.resultValue}>{timeToFallAsleep}</Text>
                        <Text style={styles.resultDetail}>
                          ({nap.startTryTime} → {nap.fellAsleepTime})
                        </Text>
                      </View>
                    )}

                    {sleepDuration && (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Duração do sono:</Text>
                        <Text style={styles.resultValue}>{sleepDuration}</Text>
                        <Text style={styles.resultDetail}>
                          ({nap.fellAsleepTime} → {nap.wakeUpTime})
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.napInfoSection}>
                    <Text style={styles.infoLabel}>Dormiu como:</Text>
                    <View style={styles.readOnlyBox}>
                      <Text style={styles.readOnlyText}>
                        {nap.sleepMethod || "Não informado"}
                      </Text>
                    </View>

                    <Text style={styles.infoLabel}>Ambiente:</Text>
                    <View style={styles.readOnlyBox}>
                      <Text style={styles.readOnlyText}>
                        {nap.environment || "Não informado"}
                      </Text>
                    </View>

                    <Text style={styles.infoLabel}>Como acordou:</Text>
                    <View style={styles.readOnlyBox}>
                      <Text style={styles.readOnlyText}>
                        {nap.wakeUpMood || "Não informado"}
                      </Text>
                    </View>

                    <Text style={styles.infoLabel}>Observações da Mãe:</Text>
                    <View style={styles.readOnlyBox}>
                      <Text style={styles.readOnlyText}>
                        {nap.observations || "Sem observações"}
                      </Text>
                    </View>

                    <Text style={styles.infoLabel}>Comentários da Consultora:</Text>
                    <TextInput
                      style={styles.textArea}
                      value={nap.consultantComments || ""}
                      onChangeText={(text) => {
                        setSelectedRoutine((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            naps: prev.naps?.map((n) =>
                              n.id === nap.id
                                ? { ...n, consultantComments: text }
                                : n
                            ),
                          };
                        });
                      }}
                      placeholder="Adicione seus comentários aqui..."
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={4}
                    />
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleUpdateNapConsultantComments(nap.id)}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.saveButtonText}>Salvar Comentários</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>Nenhuma soneca registrada</Text>
          )}
        </View>

        {/* Sono Noturno */}
        {selectedRoutine.nightSleep && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sono Noturno</Text>
            <View style={styles.napCard}>
              <View style={styles.napDataSection}>
                <View style={styles.napDataRow}>
                  <Text style={styles.napDataLabel}>Início da tentativa:</Text>
                  <Text style={styles.napDataValue}>
                    {selectedRoutine.nightSleep.startTryTime || "—"}
                  </Text>
                </View>
                <View style={styles.napDataRow}>
                  <Text style={styles.napDataLabel}>Dormiu às:</Text>
                  <Text style={styles.napDataValue}>
                    {selectedRoutine.nightSleep.fellAsleepTime || "—"}
                  </Text>
                </View>
                <View style={styles.napDataRow}>
                  <Text style={styles.napDataLabel}>Acordou às:</Text>
                  <Text style={styles.napDataValue}>
                    {selectedRoutine.nightSleep.finalWakeTime || "—"}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.napInfoSection}>
                <Text style={styles.infoLabel}>Dormiu como:</Text>
                <View style={styles.readOnlyBox}>
                  <Text style={styles.readOnlyText}>
                    {selectedRoutine.nightSleep.sleepMethod || "Não informado"}
                  </Text>
                </View>

                <Text style={styles.infoLabel}>Ambiente:</Text>
                <View style={styles.readOnlyBox}>
                  <Text style={styles.readOnlyText}>
                    {selectedRoutine.nightSleep.environment || "Não informado"}
                  </Text>
                </View>

                <Text style={styles.infoLabel}>Como acordou:</Text>
                <View style={styles.readOnlyBox}>
                  <Text style={styles.readOnlyText}>
                    {selectedRoutine.nightSleep.wakeUpMood || "Não informado"}
                  </Text>
                </View>

                <Text style={styles.infoLabel}>Observações da Mãe:</Text>
                <View style={styles.readOnlyBox}>
                  <Text style={styles.readOnlyText}>
                    {selectedRoutine.nightSleep.observations || "Sem observações"}
                  </Text>
                </View>

                <Text style={styles.infoLabel}>Comentários da Consultora:</Text>
                <TextInput
                  style={styles.textArea}
                  value={selectedRoutine.nightSleep.consultantComments || ""}
                  onChangeText={(text) => {
                    setSelectedRoutine((prev) => {
                      if (!prev || !prev.nightSleep) return prev;
                      return {
                        ...prev,
                        nightSleep: {
                          ...prev.nightSleep,
                          consultantComments: text,
                        },
                      };
                    });
                  }}
                  placeholder="Adicione seus comentários aqui..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleUpdateNightConsultantComments}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Salvar Comentários</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Despertares Noturnos */}
              {selectedRoutine.nightSleep.wakings &&
                selectedRoutine.nightSleep.wakings.length > 0 && (
                  <View style={styles.wakingsSection}>
                    <Text style={styles.wakingsTitle}>Despertares Noturnos:</Text>
                    {selectedRoutine.nightSleep.wakings.map((waking, index) => (
                      <View key={waking.id} style={styles.wakingItem}>
                        <Text style={styles.wakingText}>
                          Despertar {index + 1}: {waking.startTime} - {waking.endTime}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
            </View>
          </View>
        )}

        {/* Observações Gerais da Mãe */}
        <View style={styles.section}>
          <Text style={styles.label}>Observações Gerais da Mãe</Text>
          <View style={styles.readOnlyBox}>
            <Text style={styles.readOnlyText}>
              {selectedRoutine.motherObservations || "Sem observações"}
            </Text>
          </View>
        </View>

        {/* Comentários Gerais da Consultora */}
        <View style={styles.section}>
          <Text style={styles.label}>Comentários Gerais da Consultora</Text>
          <TextInput
            style={styles.textArea}
            value={selectedRoutine.consultantComments || ""}
            onChangeText={(text) => {
              setSelectedRoutine((prev) => {
                if (!prev) return prev;
                return { ...prev, consultantComments: text };
              });
            }}
            placeholder="Adicione seus comentários gerais aqui..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleUpdateConsultantComments}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar Comentários</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {showTimePicker && (
        <DateTimePicker
          value={timePickerValue}
          mode="time"
          is24Hour={true}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    color: colors.primary,
  },
  label: {
    ...typography.subtitle1,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  babyOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  babyOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  babyOptionText: {
    ...typography.body1,
    color: colors.text,
  },
  babyOptionTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  dateOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  dateOptionSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  dateOptionText: {
    ...typography.body1,
    color: colors.text,
  },
  dateOptionTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  dateHeader: {
    alignItems: "center",
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
  },
  dayOfWeek: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  dateDisplay: {
    ...typography.h4,
    color: colors.textSecondary,
  },
  readOnlyBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyText: {
    ...typography.body1,
    color: colors.text,
    lineHeight: 22,
  },
  napCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  napTitle: {
    ...typography.h4,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  napDataSection: {
    marginBottom: spacing.md,
  },
  napDataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  napDataLabel: {
    ...typography.body1,
    color: colors.textSecondary,
  },
  napDataValue: {
    ...typography.body1,
    color: colors.text,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  resultsSection: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  resultsTitle: {
    ...typography.subtitle1,
    color: colors.primary,
    marginBottom: spacing.sm,
    fontWeight: "600",
  },
  resultRow: {
    marginBottom: spacing.sm,
  },
  resultLabel: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  resultValue: {
    ...typography.h4,
    color: colors.primary,
    fontWeight: "700",
    marginBottom: 2,
  },
  resultDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  napInfoSection: {
    marginTop: spacing.md,
  },
  infoLabel: {
    ...typography.subtitle2,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  textArea: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    textAlignVertical: "top",
    ...typography.body1,
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  saveButtonText: {
    ...typography.button,
    color: "#fff",
  },
  wakingsSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wakingsTitle: {
    ...typography.subtitle1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  wakingItem: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  wakingText: {
    ...typography.body2,
    color: colors.text,
  },
  errorText: {
    ...typography.body1,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  retryButtonText: {
    ...typography.button,
    color: "#fff",
  },
  emptyText: {
    ...typography.body1,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
