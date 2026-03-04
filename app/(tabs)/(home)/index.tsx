
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  RefreshControl,
} from "react-native";
import { ConsultantProfileCard } from "@/components/ConsultantProfileCard";
import { IconSymbol } from "@/components/IconSymbol";
import { ConfirmModal } from "@/components/ConfirmModal";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";

interface Baby {
  id: string;
  name: string;
  birthDate: string;
  motherName: string;
  motherPhone: string;
  motherEmail: string;
  ageMonths: number;
  ageDays: number;
  photo?: string | null;
  activeContract: any | null;
  archived?: boolean;
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

interface ConsultantProfile {
  id: string;
  userId: string;
  name: string;
  photo: string | null;
  professionalTitle: string | null;
  description: string | null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  profileSection: {
    marginBottom: spacing.xl,
  },
  registerBabyButton: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  registerBabyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: spacing.sm,
  },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  toggleButtonTextActive: {
    color: colors.white,
  },
  babyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  babyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  babyInfo: {
    flex: 1,
  },
  babyName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  babyDetails: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  babyActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.sm,
  },
  contractStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  contractStatusActive: {
    backgroundColor: "#E8F5E9",
  },
  contractStatusPaused: {
    backgroundColor: "#FFF3E0",
  },
  contractStatusCompleted: {
    backgroundColor: "#EEEEEE",
  },
  contractStatusNone: {
    backgroundColor: "#FFEBEE",
  },
  contractStatusText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: spacing.xs,
  },
  contractStatusTextActive: {
    color: "#2E7D32",
  },
  contractStatusTextPaused: {
    color: "#F57C00",
  },
  contractStatusTextCompleted: {
    color: "#616161",
  },
  contractStatusTextNone: {
    color: "#C62828",
  },
  babyCardButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  babyCardButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  babyCardButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  babyCardButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
  },
  babyCardButtonTextSecondary: {
    color: colors.text,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 2,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  routinesList: {
    marginTop: spacing.lg,
  },
  routineCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  routineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  routineDate: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  routineStats: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  routineStat: {
    flex: 1,
  },
  routineStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  routineStatValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    padding: spacing.sm,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  routineDetailSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
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
    marginBottom: spacing.sm,
  },
  napTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  napDetails: {
    gap: spacing.xs,
  },
  napDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  napDetailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  napDetailValue: {
    fontSize: 14,
    color: colors.text,
  },
  commentSection: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  commentText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  commentInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButton: {
    padding: spacing.sm,
  },
  timePickerButton: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timePickerButtonText: {
    fontSize: 14,
    color: colors.text,
  },
});

function formatDateToBR(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR");
}

function getDayOfWeek(dateString: string): string {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const date = new Date(dateString);
  return days[date.getDay()];
}

function calcTimeDiff(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  return endMinutes - startMinutes;
}

function minutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function diffTime(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  if (!start || !end) return "-";
  const diff = calcTimeDiff(start, end);
  return minutesToHM(diff);
}

export default function ConsultantDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [consultantProfile, setConsultantProfile] =
    useState<ConsultantProfile | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerField, setTimePickerField] = useState<string>("");
  const [timePickerValue, setTimePickerValue] = useState(new Date());
  const [deleteNapId, setDeleteNapId] = useState<string | null>(null);
  const [deleteNapNumber, setDeleteNapNumber] = useState<number | null>(null);

  const loadConsultantProfile = useCallback(async () => {
    try {
      console.log("🔵 [Dashboard] Loading consultant profile");
      const profile = await apiGet<ConsultantProfile>("/api/consultant/profile");
      setConsultantProfile(profile);
      console.log("✅ [Dashboard] Profile loaded:", profile.name);
    } catch (error) {
      console.error("🔴 [Dashboard] Error loading profile:", error);
    }
  }, []);

  const loadBabies = useCallback(async () => {
    try {
      console.log("🔵 [Dashboard] Loading babies list");
      const data = await apiGet<Baby[]>("/api/babies");
      setBabies(data);
      console.log(`✅ [Dashboard] Loaded ${data.length} babies`);
    } catch (error) {
      console.error("🔴 [Dashboard] Error loading babies:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConsultantProfile();
    loadBabies();
  }, [loadConsultantProfile, loadBabies]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConsultantProfile();
    loadBabies();
  }, [loadConsultantProfile, loadBabies]);

  const handleRegisterBaby = useCallback(() => {
    console.log("🔵 [Cadastrar Bebê] Button pressed - navigating to /register-baby");
    try {
      router.push("/register-baby");
      console.log("🔵 [Cadastrar Bebê] Navigation command executed");
    } catch (error) {
      console.error("🔴 [Cadastrar Bebê] Navigation error:", error);
    }
  }, [router]);

  const loadRoutines = async (babyId: string) => {
    try {
      console.log(`🔵 [Dashboard] Loading routines for baby ${babyId}`);
      const data = await apiGet<Routine[]>(`/api/routines?babyId=${babyId}`);
      setRoutines(data);
      console.log(`✅ [Dashboard] Loaded ${data.length} routines`);
    } catch (error) {
      console.error("🔴 [Dashboard] Error loading routines:", error);
    }
  };

  const handleSelectBaby = (baby: Baby) => {
    console.log(`🔵 [Dashboard] Selected baby: ${baby.name}`);
    setSelectedBaby(baby);
    loadRoutines(baby.id);
  };

  const handleSelectRoutine = (routine: Routine) => {
    console.log(`🔵 [Dashboard] Selected routine: ${routine.date}`);
    setSelectedRoutine(routine);
  };

  const handleBackToBabies = () => {
    console.log("🔵 [Dashboard] Back to babies list");
    setSelectedBaby(null);
    setRoutines([]);
    setSelectedRoutine(null);
  };

  const handleBackToRoutines = () => {
    console.log("🔵 [Dashboard] Back to routines list");
    setSelectedRoutine(null);
  };

  const handleEditComments = (field: string, currentValue: string | null) => {
    console.log(`🔵 [Dashboard] Editing field: ${field}`);
    setEditingField(field);
    setEditValue(currentValue || "");
  };

  const handleSaveComments = async () => {
    if (!selectedRoutine || !editingField) return;

    try {
      console.log(`🔵 [Dashboard] Saving ${editingField}`);
      await apiPut(`/api/routines/${selectedRoutine.id}`, {
        [editingField]: editValue,
      });

      setSelectedRoutine({
        ...selectedRoutine,
        [editingField]: editValue,
      });

      setEditingField(null);
      setEditValue("");
      console.log("✅ [Dashboard] Comments saved");
    } catch (error) {
      console.error("🔴 [Dashboard] Error saving comments:", error);
    }
  };

  const handleUpdateNap = async (
    napId: string,
    field: string,
    value: string | null
  ) => {
    try {
      console.log(`🔵 [Dashboard] Updating nap ${napId}, field: ${field}`);
      await apiPut(`/api/naps/${napId}`, { [field]: value });

      if (selectedRoutine?.naps) {
        const updatedNaps = selectedRoutine.naps.map((nap) =>
          nap.id === napId ? { ...nap, [field]: value } : nap
        );
        setSelectedRoutine({ ...selectedRoutine, naps: updatedNaps });
      }

      console.log("✅ [Dashboard] Nap updated");
    } catch (error) {
      console.error("🔴 [Dashboard] Error updating nap:", error);
    }
  };

  const handleSaveNapComments = async (napId: string) => {
    if (!editingField || !editingField.startsWith(`nap-${napId}`)) return;

    const field = editingField.split("-")[2];
    await handleUpdateNap(napId, field, editValue);
    setEditingField(null);
    setEditValue("");
  };

  const handleDeleteNap = (napId: string, napNumber: number) => {
    console.log(`🔵 [Dashboard] Requesting delete for nap ${napNumber}`);
    setDeleteNapId(napId);
    setDeleteNapNumber(napNumber);
  };

  const confirmDeleteNap = async () => {
    if (!deleteNapId || !selectedRoutine) return;

    try {
      console.log(`🔵 [Dashboard] Deleting nap ${deleteNapId}`);
      await apiDelete(`/api/naps/${deleteNapId}`);

      const updatedNaps = selectedRoutine.naps?.filter(
        (nap) => nap.id !== deleteNapId
      );
      setSelectedRoutine({ ...selectedRoutine, naps: updatedNaps });

      setDeleteNapId(null);
      setDeleteNapNumber(null);
      console.log("✅ [Dashboard] Nap deleted");
    } catch (error) {
      console.error("🔴 [Dashboard] Error deleting nap:", error);
      setDeleteNapId(null);
      setDeleteNapNumber(null);
    }
  };

  const handleUpdateNightSleep = async (field: string, value: string | null) => {
    if (!selectedRoutine?.nightSleep) return;

    try {
      console.log(`🔵 [Dashboard] Updating night sleep, field: ${field}`);
      await apiPut(`/api/night-sleep/${selectedRoutine.nightSleep.id}`, {
        [field]: value,
      });

      setSelectedRoutine({
        ...selectedRoutine,
        nightSleep: { ...selectedRoutine.nightSleep, [field]: value },
      });

      console.log("✅ [Dashboard] Night sleep updated");
    } catch (error) {
      console.error("🔴 [Dashboard] Error updating night sleep:", error);
    }
  };

  const handleSaveNightComments = async () => {
    if (!editingField || !editingField.startsWith("night-")) return;

    const field = editingField.split("-")[1];
    await handleUpdateNightSleep(field, editValue);
    setEditingField(null);
    setEditValue("");
  };

  const openTimePicker = (field: string, currentValue: string | null) => {
    console.log(`🔵 [Dashboard] Opening time picker for ${field}`);
    setTimePickerField(field);

    if (currentValue) {
      const [hours, minutes] = currentValue.split(":").map(Number);
      const date = new Date();
      date.setHours(hours, minutes);
      setTimePickerValue(date);
    } else {
      setTimePickerValue(new Date());
    }

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

    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, "0");
      const minutes = selectedDate.getMinutes().toString().padStart(2, "0");
      const timeString = `${hours}:${minutes}`;

      console.log(`🔵 [Dashboard] Time selected: ${timeString} for ${timePickerField}`);

      if (timePickerField.startsWith("nap-")) {
        const [, napId, field] = timePickerField.split("-");
        handleUpdateNap(napId, field, timeString);
      } else if (timePickerField.startsWith("night-")) {
        const field = timePickerField.split("-")[1];
        handleUpdateNightSleep(field, timeString);
      }

      if (Platform.OS === "ios") {
        setShowTimePicker(false);
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const displayedBabies = babies.filter((baby) =>
    showArchived ? baby.archived : !baby.archived
  );

  if (selectedRoutine) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToRoutines}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <IconSymbol
              name="arrow-back"
              size={24}
              color={colors.primary}
            />
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>
              {formatDateToBR(selectedRoutine.date)} - {getDayOfWeek(selectedRoutine.date)}
            </Text>
            <Text style={styles.subtitle}>{selectedBaby?.name}</Text>
          </View>

          <View style={styles.routineDetailSection}>
            <Text style={styles.sectionTitle}>Informações Gerais</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Acordou às</Text>
              <Text style={styles.infoValue}>
                {selectedRoutine.wakeUpTime || "-"}
              </Text>
            </View>
          </View>

          {selectedRoutine.naps && selectedRoutine.naps.length > 0 && (
            <View style={styles.routineDetailSection}>
              <Text style={styles.sectionTitle}>Sonecas</Text>
              {selectedRoutine.naps.map((nap) => (
                <View key={nap.id} style={styles.napCard}>
                  <View style={styles.napHeader}>
                    <Text style={styles.napTitle}>Soneca {nap.napNumber}</Text>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteNap(nap.id, nap.napNumber)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <IconSymbol
                        name="delete"
                        size={20}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.napDetails}>
                    <View style={styles.napDetailRow}>
                      <Text style={styles.napDetailLabel}>Começou a tentar</Text>
                      <TouchableOpacity
                        onPress={() =>
                          openTimePicker(`nap-${nap.id}-startTryTime`, nap.startTryTime)
                        }
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.napDetailValue}>
                          {nap.startTryTime || "-"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.napDetailRow}>
                      <Text style={styles.napDetailLabel}>Dormiu às</Text>
                      <TouchableOpacity
                        onPress={() =>
                          openTimePicker(`nap-${nap.id}-fellAsleepTime`, nap.fellAsleepTime)
                        }
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.napDetailValue}>
                          {nap.fellAsleepTime || "-"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.napDetailRow}>
                      <Text style={styles.napDetailLabel}>Acordou às</Text>
                      <TouchableOpacity
                        onPress={() =>
                          openTimePicker(`nap-${nap.id}-wakeUpTime`, nap.wakeUpTime)
                        }
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.napDetailValue}>
                          {nap.wakeUpTime || "-"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.napDetailRow}>
                      <Text style={styles.napDetailLabel}>Tempo para dormir</Text>
                      <Text style={styles.napDetailValue}>
                        {diffTime(nap.startTryTime, nap.fellAsleepTime)}
                      </Text>
                    </View>

                    <View style={styles.napDetailRow}>
                      <Text style={styles.napDetailLabel}>Tempo dormido</Text>
                      <Text style={styles.napDetailValue}>
                        {diffTime(nap.fellAsleepTime, nap.wakeUpTime)}
                      </Text>
                    </View>
                  </View>

                  {nap.observations && (
                    <View style={styles.commentSection}>
                      <Text style={styles.commentLabel}>Observações da Mãe</Text>
                      <Text style={styles.commentText}>{nap.observations}</Text>
                    </View>
                  )}

                  <View style={styles.commentSection}>
                    <Text style={styles.commentLabel}>Comentários da Consultora</Text>
                    {editingField === `nap-${nap.id}-consultantComments` ? (
                      <React.Fragment>
                        <TextInput
                          style={styles.commentInput}
                          value={editValue}
                          onChangeText={setEditValue}
                          placeholder="Adicione seus comentários..."
                          placeholderTextColor={colors.textSecondary}
                          multiline
                        />
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={() => handleSaveNapComments(nap.id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.saveButtonText}>Salvar</Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    ) : (
                      <TouchableOpacity
                        onPress={() =>
                          handleEditComments(
                            `nap-${nap.id}-consultantComments`,
                            nap.consultantComments
                          )
                        }
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.commentText}>
                          {nap.consultantComments || "Toque para adicionar comentários"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {selectedRoutine.nightSleep && (
            <View style={styles.routineDetailSection}>
              <Text style={styles.sectionTitle}>Sono Noturno</Text>
              <View style={styles.napCard}>
                <View style={styles.napDetails}>
                  <View style={styles.napDetailRow}>
                    <Text style={styles.napDetailLabel}>Começou a tentar</Text>
                    <TouchableOpacity
                      onPress={() =>
                        openTimePicker(
                          "night-startTryTime",
                          selectedRoutine.nightSleep?.startTryTime || null
                        )
                      }
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.napDetailValue}>
                        {selectedRoutine.nightSleep.startTryTime || "-"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.napDetailRow}>
                    <Text style={styles.napDetailLabel}>Dormiu às</Text>
                    <TouchableOpacity
                      onPress={() =>
                        openTimePicker(
                          "night-fellAsleepTime",
                          selectedRoutine.nightSleep?.fellAsleepTime || null
                        )
                      }
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.napDetailValue}>
                        {selectedRoutine.nightSleep.fellAsleepTime || "-"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.napDetailRow}>
                    <Text style={styles.napDetailLabel}>Acordou às</Text>
                    <TouchableOpacity
                      onPress={() =>
                        openTimePicker(
                          "night-finalWakeTime",
                          selectedRoutine.nightSleep?.finalWakeTime || null
                        )
                      }
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.napDetailValue}>
                        {selectedRoutine.nightSleep.finalWakeTime || "-"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {selectedRoutine.nightSleep.observations && (
                  <View style={styles.commentSection}>
                    <Text style={styles.commentLabel}>Observações da Mãe</Text>
                    <Text style={styles.commentText}>
                      {selectedRoutine.nightSleep.observations}
                    </Text>
                  </View>
                )}

                <View style={styles.commentSection}>
                  <Text style={styles.commentLabel}>Comentários da Consultora</Text>
                  {editingField === "night-consultantComments" ? (
                    <React.Fragment>
                      <TextInput
                        style={styles.commentInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        placeholder="Adicione seus comentários..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                      />
                      <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSaveNightComments}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.saveButtonText}>Salvar</Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  ) : (
                    <TouchableOpacity
                      onPress={() =>
                        handleEditComments(
                          "night-consultantComments",
                          selectedRoutine.nightSleep?.consultantComments || null
                        )
                      }
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.commentText}>
                        {selectedRoutine.nightSleep.consultantComments ||
                          "Toque para adicionar comentários"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          <View style={styles.routineDetailSection}>
            <Text style={styles.sectionTitle}>Observações Gerais</Text>
            {selectedRoutine.motherObservations && (
              <View style={styles.commentSection}>
                <Text style={styles.commentLabel}>Observações da Mãe</Text>
                <Text style={styles.commentText}>
                  {selectedRoutine.motherObservations}
                </Text>
              </View>
            )}

            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>Comentários da Consultora</Text>
              {editingField === "consultantComments" ? (
                <React.Fragment>
                  <TextInput
                    style={styles.commentInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    placeholder="Adicione seus comentários..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveComments}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.saveButtonText}>Salvar</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ) : (
                <TouchableOpacity
                  onPress={() =>
                    handleEditComments(
                      "consultantComments",
                      selectedRoutine.consultantComments
                    )
                  }
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.commentText}>
                    {selectedRoutine.consultantComments ||
                      "Toque para adicionar comentários"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
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

        <ConfirmModal
          visible={deleteNapId !== null}
          title="Excluir Soneca"
          message={`Tem certeza que deseja excluir a Soneca ${deleteNapNumber}?`}
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={confirmDeleteNap}
          onCancel={() => {
            setDeleteNapId(null);
            setDeleteNapNumber(null);
          }}
        />
      </SafeAreaView>
    );
  }

  if (selectedBaby) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToBabies}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <IconSymbol
              name="arrow-back"
              size={24}
              color={colors.primary}
            />
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>{selectedBaby.name}</Text>
            <Text style={styles.subtitle}>Rotinas Diárias</Text>
          </View>

          {routines.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                name="calendar-today"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateText}>
                Nenhuma rotina registrada ainda
              </Text>
            </View>
          ) : (
            <View style={styles.routinesList}>
              {routines.map((routine) => (
                <TouchableOpacity
                  key={routine.id}
                  style={styles.routineCard}
                  onPress={() => handleSelectRoutine(routine)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.routineHeader}>
                    <Text style={styles.routineDate}>
                      {formatDateToBR(routine.date)} - {getDayOfWeek(routine.date)}
                    </Text>
                    <IconSymbol
                      name="arrow-forward"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>

                  <View style={styles.routineStats}>
                    <View style={styles.routineStat}>
                      <Text style={styles.routineStatLabel}>Acordou</Text>
                      <Text style={styles.routineStatValue}>
                        {routine.wakeUpTime || "-"}
                      </Text>
                    </View>
                    <View style={styles.routineStat}>
                      <Text style={styles.routineStatLabel}>Sonecas</Text>
                      <Text style={styles.routineStatValue}>
                        {routine.naps?.length || 0}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Bem-vinda, {consultantProfile?.name}</Text>
        </View>

        {consultantProfile && (
          <View style={styles.profileSection}>
            <ConsultantProfileCard profile={consultantProfile} />
          </View>
        )}

        <TouchableOpacity
          style={styles.registerBabyButton}
          onPress={handleRegisterBaby}
          activeOpacity={0.7}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <IconSymbol name="add" size={24} color={colors.white} />
          <Text style={styles.registerBabyButtonText}>Cadastrar Novo Bebê</Text>
        </TouchableOpacity>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              !showArchived && styles.toggleButtonActive,
            ]}
            onPress={() => setShowArchived(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.toggleButtonText,
                !showArchived && styles.toggleButtonTextActive,
              ]}
            >
              Ativos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              showArchived && styles.toggleButtonActive,
            ]}
            onPress={() => setShowArchived(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.toggleButtonText,
                showArchived && styles.toggleButtonTextActive,
              ]}
            >
              Arquivados
            </Text>
          </TouchableOpacity>
        </View>

        {displayedBabies.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              name="person"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyStateText}>
              {showArchived
                ? "Nenhum bebê arquivado"
                : "Nenhum bebê cadastrado ainda"}
            </Text>
          </View>
        ) : (
          displayedBabies.map((baby) => {
            const contractStatusStyle = baby.activeContract
              ? baby.activeContract.status === "active"
                ? styles.contractStatusActive
                : baby.activeContract.status === "paused"
                ? styles.contractStatusPaused
                : styles.contractStatusCompleted
              : styles.contractStatusNone;

            const contractStatusTextStyle = baby.activeContract
              ? baby.activeContract.status === "active"
                ? styles.contractStatusTextActive
                : baby.activeContract.status === "paused"
                ? styles.contractStatusTextPaused
                : styles.contractStatusTextCompleted
              : styles.contractStatusTextNone;

            const contractStatusText = baby.activeContract
              ? baby.activeContract.status === "active"
                ? "Contrato Ativo"
                : baby.activeContract.status === "paused"
                ? "Contrato Pausado"
                : "Contrato Concluído"
              : "Sem Contrato";

            const contractIconName = baby.activeContract
              ? baby.activeContract.status === "active"
                ? "check-circle"
                : baby.activeContract.status === "paused"
                ? "pause-circle"
                : "cancel"
              : "error";

            const contractIconColor = baby.activeContract
              ? baby.activeContract.status === "active"
                ? "#2E7D32"
                : baby.activeContract.status === "paused"
                ? "#F57C00"
                : "#616161"
              : "#C62828";

            return (
              <View key={baby.id} style={styles.babyCard}>
                <View style={styles.babyHeader}>
                  <View style={styles.babyInfo}>
                    <Text style={styles.babyName}>{baby.name}</Text>
                    <Text style={styles.babyDetails}>
                      {baby.ageMonths} meses e {baby.ageDays} dias
                    </Text>
                    <Text style={styles.babyDetails}>Mãe: {baby.motherName}</Text>
                  </View>
                  <View style={styles.babyActions}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() =>
                        router.push(`/contract-details?babyId=${baby.id}`)
                      }
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <IconSymbol
                        name="description"
                        size={24}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.contractStatus, contractStatusStyle]}>
                  <IconSymbol
                    name={contractIconName}
                    size={16}
                    color={contractIconColor}
                  />
                  <Text style={[styles.contractStatusText, contractStatusTextStyle]}>
                    {contractStatusText}
                  </Text>
                </View>

                <View style={styles.babyCardButtons}>
                  <TouchableOpacity
                    style={styles.babyCardButton}
                    onPress={() => handleSelectBaby(baby)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.babyCardButtonText}>Ver Rotinas</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.babyCardButton, styles.babyCardButtonSecondary]}
                    onPress={() =>
                      router.push(`/acompanhamento?babyId=${baby.id}&babyName=${baby.name}`)
                    }
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text
                      style={[
                        styles.babyCardButtonText,
                        styles.babyCardButtonTextSecondary,
                      ]}
                    >
                      Acompanhamento
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
