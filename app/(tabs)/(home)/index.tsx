
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from "@/utils/api";
import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { IconSymbol } from "@/components/IconSymbol";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ConsultantProfileCard } from "@/components/ConsultantProfileCard";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";

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
  backToSleepMethod?: string | null;
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

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function getDayOfWeek(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const options: Intl.DateTimeFormatOptions = { weekday: "long" };
  return date.toLocaleDateString("pt-BR", options).toUpperCase();
}

function calcTimeDiff(start: string, end: string): number {
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startDate = new Date(0, 0, 0, startH, startM);
  const endDate = new Date(0, 0, 0, endH, endM);
  let diffMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }
  return diffMinutes;
}

function minutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) {
    return `${h}h${m}min`;
  } else if (h > 0) {
    return `${h}h`;
  } else {
    return `${m}min`;
  }
}

function diffTime(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "";

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  const startDate = new Date(0, 0, 0, startH, startM);
  const endDate = new Date(0, 0, 0, endH, endM);

  let diffMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h${minutes}`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}min`;
  }
  return "0min";
}

export default function ConsultantDashboardScreen() {
  const router = useRouter();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [editingComments, setEditingComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerField, setTimePickerField] = useState<string | null>(null);
  const [timePickerValue, setTimePickerValue] = useState(new Date());
  const [confirmDelete, setConfirmDelete] = useState<{
    visible: boolean;
    napId: string;
    napNumber: number;
  }>({ visible: false, napId: "", napNumber: 0 });
  const [confirmDeleteBaby, setConfirmDeleteBaby] = useState<{
    visible: boolean;
    babyId: string;
    babyName: string;
  }>({ visible: false, babyId: "", babyName: "" });
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [consultantProfile, setConsultantProfile] = useState<ConsultantProfile | null>(null);

  const loadConsultantProfile = useCallback(async () => {
    try {
      const data = await apiGet<ConsultantProfile>("/api/consultant/profile");
      setConsultantProfile(data);
    } catch (error) {
      console.error("Error loading consultant profile:", error);
    }
  }, []);

  const loadBabies = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await apiGet<Baby[]>("/api/consultant/babies");
      console.log("[loadBabies] Fetched babies:", data.length, "| archived:", data.filter((b) => b.archived).length);
      setBabies(data);
    } catch (error) {
      console.error("Error loading babies:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConsultantProfile();
    await loadBabies();
    if (selectedBaby) {
      await loadRoutines(selectedBaby.id);
    }
    setRefreshing(false);
  }, [loadBabies, loadConsultantProfile, selectedBaby]);

  useEffect(() => {
    loadConsultantProfile();
    loadBabies();
  }, [loadConsultantProfile, loadBabies]);

  const loadRoutines = async (babyId: string) => {
    try {
      setLoadingRoutines(true);
      const data = await apiGet<Routine[]>(`/api/routines/baby/${babyId}`);
      setRoutines(data);
    } catch (error) {
      console.error("Error loading routines:", error);
    } finally {
      setLoadingRoutines(false);
    }
  };

  const handleSelectBaby = (baby: Baby) => {
    setSelectedBaby(baby);
    setSelectedRoutine(null);
    loadRoutines(baby.id);
  };

  const handleSelectRoutine = (routine: Routine) => {
    setSelectedRoutine(routine);
  };

  const handleBackToBabies = () => {
    setSelectedBaby(null);
    setRoutines([]);
    setSelectedRoutine(null);
  };

  const handleBackToRoutines = () => {
    setSelectedRoutine(null);
  };

  const handleEditComments = (field: string, currentValue: string | null) => {
    console.log("🔵 [Edit Comments] Tapped on field:", field, "Current value:", currentValue);
    setEditingComments(field);
    setCommentText(currentValue || "");
  };

  const handleSaveComments = async () => {
    if (!selectedRoutine || !editingComments) return;

    console.log("💾 [Save Comments] Saving comments for field:", editingComments);

    try {
      if (editingComments === "consultantComments") {
        await apiPut(`/api/routines/${selectedRoutine.id}`, {
          consultantComments: commentText,
        });
        setSelectedRoutine({
          ...selectedRoutine,
          consultantComments: commentText,
        });
        console.log("✅ [Save Comments] Successfully saved general comments");
      }
      setEditingComments(null);
      setCommentText("");
    } catch (error) {
      console.error("❌ [Save Comments] Error saving comments:", error);
    }
  };

  const handleUpdateNap = async (napId: string, field: string, value: string | null) => {
    if (!selectedRoutine) return;

    try {
      await apiPut(`/api/naps/${napId}`, { [field]: value });
      const updatedNaps = selectedRoutine.naps?.map((nap) =>
        nap.id === napId ? { ...nap, [field]: value } : nap
      );
      setSelectedRoutine({
        ...selectedRoutine,
        naps: updatedNaps,
      });
    } catch (error) {
      console.error("Error updating nap:", error);
    }
  };

  const handleSaveNapComments = async (napId: string) => {
    if (!selectedRoutine) return;

    try {
      await apiPut(`/api/naps/${napId}`, {
        consultantComments: commentText,
      });
      const updatedNaps = selectedRoutine.naps?.map((nap) =>
        nap.id === napId ? { ...nap, consultantComments: commentText } : nap
      );
      setSelectedRoutine({
        ...selectedRoutine,
        naps: updatedNaps,
      });
      setEditingComments(null);
      setCommentText("");
    } catch (error) {
      console.error("Error saving nap comments:", error);
    }
  };

  const handleDeleteNap = async (napId: string, napNumber: number) => {
    setConfirmDelete({ visible: true, napId, napNumber });
  };

  const confirmDeleteNap = async () => {
    const { napId } = confirmDelete;
    if (!selectedRoutine || !napId) return;

    try {
      await apiDelete(`/api/naps/${napId}`);
      const updatedNaps = selectedRoutine.naps?.filter((nap) => nap.id !== napId);
      setSelectedRoutine({
        ...selectedRoutine,
        naps: updatedNaps,
      });
      setConfirmDelete({ visible: false, napId: "", napNumber: 0 });
    } catch (error) {
      console.error("Error deleting nap:", error);
    }
  };

  const handleUpdateNightSleep = async (field: string, value: string | null) => {
    if (!selectedRoutine || !selectedRoutine.nightSleep) return;

    try {
      await apiPut(`/api/night-sleep/${selectedRoutine.nightSleep.id}`, {
        [field]: value,
      });
      setSelectedRoutine({
        ...selectedRoutine,
        nightSleep: {
          ...selectedRoutine.nightSleep,
          [field]: value,
        },
      });
    } catch (error) {
      console.error("Error updating night sleep:", error);
    }
  };

  const handleSaveNightComments = async () => {
    if (!selectedRoutine || !selectedRoutine.nightSleep) return;

    try {
      await apiPut(`/api/night-sleep/${selectedRoutine.nightSleep.id}`, {
        consultantComments: commentText,
      });
      setSelectedRoutine({
        ...selectedRoutine,
        nightSleep: {
          ...selectedRoutine.nightSleep,
          consultantComments: commentText,
        },
      });
      setEditingComments(null);
      setCommentText("");
    } catch (error) {
      console.error("Error saving night comments:", error);
    }
  };

  const openTimePicker = (field: string, currentValue: string | null) => {
    const [hours, minutes] = currentValue ? currentValue.split(":").map(Number) : [7, 0];
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    setTimePickerValue(date);
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

      if (timePickerField.startsWith("nap-")) {
        const [, napId, field] = timePickerField.split("-");
        handleUpdateNap(napId, field, timeString);
      } else if (timePickerField.startsWith("night-")) {
        const field = timePickerField.replace("night-", "");
        handleUpdateNightSleep(field, timeString);
      }

      if (Platform.OS === "ios") {
        setShowTimePicker(false);
      }
    }
  };

  const handleArchiveBaby = async (babyId: string, babyName: string) => {
    console.log(`📦 [Archive Baby] Archiving baby: ${babyName} (${babyId})`);
    setActionLoadingId(babyId);
    // Optimistic update: immediately flip archived flag so the baby moves sections
    setBabies((prev) =>
      prev.map((b) => (b.id === babyId ? { ...b, archived: true } : b))
    );
    try {
      await apiPatch(`/api/consultant/babies/${babyId}/archive`, {});
      console.log(`✅ [Archive Baby] Successfully archived: ${babyName}`);
      // Silent re-fetch to sync server state (no loading spinner)
      await loadBabies(true);
    } catch (error) {
      console.error(`❌ [Archive Baby] Error archiving baby ${babyName}:`, error);
      // Revert optimistic update on failure
      setBabies((prev) =>
        prev.map((b) => (b.id === babyId ? { ...b, archived: false } : b))
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteBabyConfirm = (babyId: string, babyName: string) => {
    console.log(`🗑️ [Delete Baby] Showing confirm modal for: ${babyName} (${babyId})`);
    setConfirmDeleteBaby({ visible: true, babyId, babyName });
  };

  const confirmDeleteBabyAction = async () => {
    const { babyId, babyName } = confirmDeleteBaby;
    console.log(`🗑️ [Delete Baby] Confirmed deletion of: ${babyName} (${babyId})`);
    setActionLoadingId(babyId);
    try {
      await apiDelete(`/api/consultant/babies/${babyId}`);
      console.log(`✅ [Delete Baby] Successfully deleted: ${babyName}`);
      setConfirmDeleteBaby({ visible: false, babyId: "", babyName: "" });
      await loadBabies();
    } catch (error) {
      console.error(`❌ [Delete Baby] Error deleting baby ${babyName}:`, error);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRegisterBaby = useCallback(() => {
    console.log("🔵 [Cadastrar Bebê] Button pressed - navigating to /register-baby");
    try {
      router.push("/register-baby");
      console.log("🔵 [Cadastrar Bebê] Navigation command executed");
    } catch (error) {
      console.error("🔴 [Cadastrar Bebê] Navigation error:", error);
    }
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Bebês", headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (selectedRoutine) {
    const dayOfWeek = getDayOfWeek(selectedRoutine.date);
    const dateDisplay = formatDateToBR(selectedRoutine.date);

    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: `Rotina - ${selectedBaby?.name}`,
            headerShown: true,
          }}
        />
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <TouchableOpacity style={styles.backButton} onPress={handleBackToRoutines}>
            <IconSymbol
              ios_icon_name="arrow.left"
              android_material_icon_name="arrow-back"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.backButtonText}>Voltar para Rotinas</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.dayOfWeek}>{dayOfWeek}</Text>
            <Text style={styles.dateTitle}>{dateDisplay}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Horário que Acordou</Text>
              <Text style={styles.timeText}>{selectedRoutine.wakeUpTime || "Não informado"}</Text>
            </View>

            {selectedRoutine.naps && selectedRoutine.naps.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sonecas</Text>
                {selectedRoutine.naps.map((nap, index) => {
                  const previousNapWakeUpTime =
                    index > 0 && selectedRoutine.naps ? selectedRoutine.naps[index - 1].wakeUpTime : null;
                  const windowStart = index === 0 ? selectedRoutine.wakeUpTime : previousNapWakeUpTime;

                  const showResults =
                    windowStart &&
                    nap.startTryTime &&
                    nap.fellAsleepTime &&
                    nap.wakeUpTime;

                  const janelaRealizada = showResults
                    ? diffTime(windowStart, nap.startTryTime)
                    : "";
                  const tempoAdormecer = showResults
                    ? diffTime(nap.startTryTime, nap.fellAsleepTime)
                    : "";
                  const duracaoSono = showResults
                    ? diffTime(nap.fellAsleepTime, nap.wakeUpTime)
                    : "";

                  return (
                    <View key={nap.id} style={styles.napCard}>
                      <View style={styles.napHeader}>
                        <Text style={styles.napTitle}>Soneca {nap.napNumber}</Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteNap(nap.id, nap.napNumber)}
                          style={styles.deleteButton}
                        >
                          <IconSymbol
                            ios_icon_name="trash"
                            android_material_icon_name="delete"
                            size={18}
                            color={colors.error}
                          />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.timeRow}
                        onPress={() => openTimePicker(`nap-${nap.id}-startTryTime`, nap.startTryTime)}
                      >
                        <Text style={styles.timeLabel}>Início tentativa::</Text>
                        <Text style={styles.timeValue}>{nap.startTryTime || "Não informado"}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.timeRow}
                        onPress={() => openTimePicker(`nap-${nap.id}-fellAsleepTime`, nap.fellAsleepTime)}
                      >
                        <Text style={styles.timeLabel}>Dormiu às:</Text>
                        <Text style={styles.timeValue}>{nap.fellAsleepTime || "Não informado"}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.timeRow}
                        onPress={() => openTimePicker(`nap-${nap.id}-wakeUpTime`, nap.wakeUpTime)}
                      >
                        <Text style={styles.timeLabel}>Acordou às:</Text>
                        <Text style={styles.timeValue}>{nap.wakeUpTime || "Não informado"}</Text>
                      </TouchableOpacity>

                      {showResults && (
                        <View style={styles.resultsBox}>
                          <Text style={styles.resultsTitle}>Resultados:</Text>
                          <Text style={styles.resultText}>Janela realizada: {janelaRealizada}</Text>
                          <Text style={styles.resultText}>Tempo para adormecer: {tempoAdormecer}</Text>
                          <Text style={styles.resultText}>Duração do sono: {duracaoSono}</Text>
                        </View>
                      )}

                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Dormiu como:</Text>
                        <Text style={styles.infoValue}>{nap.sleepMethod || "Não informado"}</Text>
                      </View>

                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Ambiente:</Text>
                        <Text style={styles.infoValue}>{nap.environment || "Não informado"}</Text>
                      </View>

                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Como acordou:</Text>
                        <Text style={styles.infoValue}>{nap.wakeUpMood || "Não informado"}</Text>
                      </View>

                      {nap.observations && (
                        <View style={styles.observationsBox}>
                          <Text style={styles.observationsLabel}>Observações da Mãe:</Text>
                          <Text style={styles.observationsText}>{nap.observations}</Text>
                        </View>
                      )}

                      <View style={styles.commentsSection}>
                        <Text style={styles.commentsLabel}>Comentários da Consultora:</Text>
                        {editingComments === `nap-${nap.id}` ? (
                          <View>
                            <TextInput
                              style={styles.commentsInput}
                              value={commentText}
                              onChangeText={setCommentText}
                              placeholder="Adicione seus comentários..."
                              multiline
                              numberOfLines={4}
                            />
                            <View style={styles.commentButtons}>
                              <TouchableOpacity
                                style={styles.saveButton}
                                onPress={() => handleSaveNapComments(nap.id)}
                              >
                                <Text style={styles.saveButtonText}>Salvar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                  setEditingComments(null);
                                  setCommentText("");
                                }}
                              >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() =>
                              handleEditComments(`nap-${nap.id}`, nap.consultantComments)
                            }
                          >
                            <Text style={styles.commentsText}>
                              {nap.consultantComments || "Toque para adicionar comentários"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {selectedRoutine.nightSleep && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sono Noturno</Text>
                <View style={styles.napCard}>
                  <TouchableOpacity
                    style={styles.timeRow}
                    onPress={() =>
                      openTimePicker(
                        "night-startTryTime",
                        selectedRoutine.nightSleep?.startTryTime || null
                      )
                    }
                  >
                    <Text style={styles.timeLabel}>Início tentativa:</Text>
                    <Text style={styles.timeValue}>
                      {selectedRoutine.nightSleep.startTryTime || "Não informado"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.timeRow}
                    onPress={() =>
                      openTimePicker(
                        "night-fellAsleepTime",
                        selectedRoutine.nightSleep?.fellAsleepTime || null
                      )
                    }
                  >
                    <Text style={styles.timeLabel}>Dormiu às:</Text>
                    <Text style={styles.timeValue}>
                      {selectedRoutine.nightSleep.fellAsleepTime || "Não informado"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.timeRow}
                    onPress={() =>
                      openTimePicker(
                        "night-finalWakeTime",
                        selectedRoutine.nightSleep?.finalWakeTime || null
                      )
                    }
                  >
                    <Text style={styles.timeLabel}>Acordou às:</Text>
                    <Text style={styles.timeValue}>
                      {selectedRoutine.nightSleep.finalWakeTime || "Não informado"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Dormiu como:</Text>
                    <Text style={styles.infoValue}>
                      {selectedRoutine.nightSleep.sleepMethod || "Não informado"}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Ambiente:</Text>
                    <Text style={styles.infoValue}>
                      {selectedRoutine.nightSleep.environment || "Não informado"}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Como acordou:</Text>
                    <Text style={styles.infoValue}>
                      {selectedRoutine.nightSleep.wakeUpMood || "Não informado"}
                    </Text>
                  </View>

                  {selectedRoutine.nightSleep.observations && (
                    <View style={styles.observationsBox}>
                      <Text style={styles.observationsLabel}>Observações da Mãe:</Text>
                      <Text style={styles.observationsText}>
                        {selectedRoutine.nightSleep.observations}
                      </Text>
                    </View>
                  )}

                  <View style={styles.commentsSection}>
                    <Text style={styles.commentsLabel}>Comentários da Consultora:</Text>
                    {editingComments === "nightSleep" ? (
                      <View>
                        <TextInput
                          style={styles.commentsInput}
                          value={commentText}
                          onChangeText={setCommentText}
                          placeholder="Adicione seus comentários..."
                          multiline
                          numberOfLines={4}
                        />
                        <View style={styles.commentButtons}>
                          <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSaveNightComments}
                          >
                            <Text style={styles.saveButtonText}>Salvar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                              setEditingComments(null);
                              setCommentText("");
                            }}
                          >
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() =>
                          handleEditComments(
                            "nightSleep",
                            selectedRoutine.nightSleep?.consultantComments || null
                          )
                        }
                      >
                        <Text style={styles.commentsText}>
                          {selectedRoutine.nightSleep.consultantComments ||
                            "Toque para adicionar comentários"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {selectedRoutine.nightSleep.wakings && selectedRoutine.nightSleep.wakings.length > 0 && (
                  <View style={styles.wakingsSection}>
                    <Text style={styles.wakingsTitle}>Despertares Noturnos</Text>
                    {selectedRoutine.nightSleep.wakings.map((waking, index) => {
                      const wakingDuration = calcTimeDiff(waking.startTime, waking.endTime);
                      const wakingDurationText = minutesToHM(wakingDuration);
                      const wakingIndexText = `${index + 1}º Despertar`;

                      return (
                        <View key={waking.id} style={styles.wakingCard}>
                          <Text style={styles.wakingTitle}>{wakingIndexText}</Text>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Horário:</Text>
                            <Text style={styles.infoValue}>
                              {waking.startTime} - {waking.endTime}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Duração:</Text>
                            <Text style={styles.infoValue}>{wakingDurationText}</Text>
                          </View>
                          {waking.backToSleepMethod && (
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Voltou a dormir:</Text>
                              <Text style={styles.infoValue}>{waking.backToSleepMethod}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Comentários Gerais da Consultora</Text>
              {editingComments === "consultantComments" ? (
                <View>
                  <TextInput
                    style={styles.commentsInput}
                    value={commentText}
                    onChangeText={setCommentText}
                    placeholder="Adicione comentários gerais sobre o dia..."
                    multiline
                    numberOfLines={4}
                    autoFocus
                  />
                  <View style={styles.commentButtons}>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSaveComments}>
                      <Text style={styles.saveButtonText}>Salvar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        console.log("🔴 [Cancel Comments] Canceling edit");
                        setEditingComments(null);
                        setCommentText("");
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.generalCommentsButton}
                  onPress={() => {
                    console.log("🟢 [General Comments] Tapped to edit general comments");
                    handleEditComments("consultantComments", selectedRoutine.consultantComments);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.commentsText}>
                    {selectedRoutine.consultantComments || "Toque para adicionar comentários"}
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
          visible={confirmDelete.visible}
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja excluir a Soneca ${confirmDelete.napNumber}?`}
          onConfirm={confirmDeleteNap}
          onCancel={() => setConfirmDelete({ visible: false, napId: "", napNumber: 0 })}
        />
      </SafeAreaView>
    );
  }

  if (selectedBaby) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: `Rotinas - ${selectedBaby.name}`,
            headerShown: true,
          }}
        />
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <TouchableOpacity style={styles.backButton} onPress={handleBackToBabies}>
            <IconSymbol
              ios_icon_name="arrow.left"
              android_material_icon_name="arrow-back"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.backButtonText}>Voltar para Bebês</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.babyName}>{selectedBaby.name}</Text>
            <Text style={styles.babyInfo}>
              {selectedBaby.ageMonths} meses e {selectedBaby.ageDays} dias
            </Text>
            <Text style={styles.babyInfo}>Mãe: {selectedBaby.motherName}</Text>

            {selectedBaby.activeContract && (
              <View style={styles.contractInfo}>
                <View style={styles.contractHeader}>
                  <IconSymbol
                    ios_icon_name="doc.text"
                    android_material_icon_name="description"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.contractTitle}>Contrato Ativo</Text>
                </View>
                <Text style={styles.contractDetail}>
                  Início: {formatDateToBR(selectedBaby.activeContract.startDate)}
                </Text>
                <Text style={styles.contractDetail}>
                  Duração: {selectedBaby.activeContract.durationDays} dias
                </Text>
                <View style={styles.contractStatusBadge}>
                  <Text style={styles.contractStatusText}>
                    {selectedBaby.activeContract.status === "active"
                      ? "Vigente"
                      : selectedBaby.activeContract.status === "paused"
                      ? "Em Pausa"
                      : "Concluído"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                router.push({
                  pathname: "/contract-details",
                  params: { babyId: selectedBaby.id, babyName: selectedBaby.name },
                })
              }
            >
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.actionButtonText}>Contrato</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                router.push({
                  pathname: "/acompanhamento",
                  params: { babyId: selectedBaby.id, babyName: selectedBaby.name },
                })
              }
            >
              <IconSymbol
                ios_icon_name="chart.bar"
                android_material_icon_name="assessment"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.actionButtonText}>Acompanhamento</Text>
            </TouchableOpacity>
          </View>

          {loadingRoutines ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : routines.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma rotina cadastrada ainda</Text>
            </View>
          ) : (
            <View style={styles.routinesList}>
              <Text style={styles.listTitle}>Rotinas Cadastradas</Text>
              {routines.map((routine) => {
                const dayOfWeek = getDayOfWeek(routine.date);
                const dateDisplay = formatDateToBR(routine.date);
                return (
                  <TouchableOpacity
                    key={routine.id}
                    style={styles.routineCard}
                    onPress={() => handleSelectRoutine(routine)}
                  >
                    <View style={styles.routineHeader}>
                      <View>
                        <Text style={styles.routineDayOfWeek}>{dayOfWeek}</Text>
                        <Text style={styles.routineDate}>{dateDisplay}</Text>
                      </View>
                      <IconSymbol
                        ios_icon_name="chevron.right"
                        android_material_icon_name="chevron-right"
                        size={24}
                        color={colors.textSecondary}
                      />
                    </View>
                    <Text style={styles.routineInfo}>
                      Acordou: {routine.wakeUpTime || "Não informado"}
                    </Text>
                    <Text style={styles.routineInfo}>
                      Sonecas: {routine.naps?.length || 0}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const activeBabies = babies.filter((baby) => !baby.archived);
  const archivedBabies = babies.filter((baby) => baby.archived);

  const renderBabyCard = (baby: Baby) => {
    let contractStatus = "Sem contrato";
    let contractColor = colors.textSecondary;

    if (baby.activeContract) {
      const status = baby.activeContract.status;
      if (status === "active") {
        contractStatus = "Vigente";
        contractColor = colors.success;
      } else if (status === "paused") {
        contractStatus = "Em Pausa";
        contractColor = colors.warning;
      } else if (status === "completed") {
        contractStatus = "Concluído";
        contractColor = colors.textSecondary;
      }
    }

    const isLoadingAction = actionLoadingId === baby.id;

    return (
      <TouchableOpacity
        key={baby.id}
        style={styles.babyCard}
        onPress={() => handleSelectBaby(baby)}
        activeOpacity={0.7}
      >
        <View style={styles.babyCardContent}>
          <View style={styles.babyIcon}>
            <IconSymbol
              ios_icon_name="person.circle"
              android_material_icon_name="account-circle"
              size={48}
              color={colors.primary}
            />
          </View>
          <View style={styles.babyDetails}>
            <Text style={styles.babyCardName}>{baby.name}</Text>
            <Text style={styles.babyCardInfo}>{baby.motherName}</Text>
            <View style={styles.babyCardFooter}>
              <View style={styles.ageContainer}>
                <IconSymbol
                  ios_icon_name="calendar"
                  android_material_icon_name="calendar-today"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.ageText}>
                  {baby.ageMonths}m {baby.ageDays}d
                </Text>
              </View>
              <View style={[styles.contractBadge, { backgroundColor: contractColor + "20" }]}>
                <Text style={[styles.contractBadgeText, { color: contractColor }]}>
                  {contractStatus}
                </Text>
              </View>
            </View>
          </View>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron-right"
            size={24}
            color={colors.textSecondary}
          />
        </View>

        <View style={styles.babyCardActions}>
          {!baby.archived && (
            <TouchableOpacity
              style={styles.archiveButton}
              onPress={(e) => {
                e.stopPropagation();
                handleArchiveBaby(baby.id, baby.name);
              }}
              disabled={isLoadingAction}
              activeOpacity={0.7}
            >
              {isLoadingAction ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <IconSymbol
                  ios_icon_name="archivebox"
                  android_material_icon_name="archive"
                  size={16}
                  color={colors.primary}
                />
              )}
              <Text style={styles.archiveButtonText}>Arquivar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.deleteBabyButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteBabyConfirm(baby.id, baby.name);
            }}
            disabled={isLoadingAction}
            activeOpacity={0.7}
          >
            <IconSymbol
              ios_icon_name="trash"
              android_material_icon_name="delete"
              size={16}
              color={colors.error}
            />
            <Text style={styles.deleteBabyButtonText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: "Bebês", 
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/edit-consultant-profile')}
              style={{ marginRight: spacing.md }}
            >
              <IconSymbol
                ios_icon_name="person.circle"
                android_material_icon_name="account-circle"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.greetingSection}>
          <Text style={styles.greetingText}>Olá, Consultora! 👋</Text>
          <Text style={styles.babyCountText}>{activeBabies.length} bebê ativo</Text>
        </View>

        <TouchableOpacity 
          style={styles.registerButton} 
          onPress={handleRegisterBaby}
          activeOpacity={0.7}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={24}
            color={colors.card}
          />
          <Text style={styles.registerButtonText}>Cadastrar Novo Bebê</Text>
        </TouchableOpacity>

        {/* Ativos section */}
        <View style={styles.sectionHeader}>
          <IconSymbol
            ios_icon_name="arrow.2.circlepath"
            android_material_icon_name="sync"
            size={16}
            color={colors.primary}
          />
          <Text style={styles.sectionHeaderText}>Ativos</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{activeBabies.length}</Text>
          </View>
        </View>

        {activeBabies.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum bebê ativo</Text>
          </View>
        ) : (
          <View style={styles.babiesList}>
            {activeBabies.map(renderBabyCard)}
          </View>
        )}

        {/* Arquivados section */}
        <View style={[styles.sectionHeader, styles.sectionHeaderArchived]}>
          <IconSymbol
            ios_icon_name="archivebox"
            android_material_icon_name="archive"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={[styles.sectionHeaderText, styles.sectionHeaderTextArchived]}>Arquivados</Text>
          <View style={[styles.sectionBadge, styles.sectionBadgeArchived]}>
            <Text style={[styles.sectionBadgeText, styles.sectionBadgeTextArchived]}>{archivedBabies.length}</Text>
          </View>
        </View>

        {archivedBabies.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum bebê arquivado</Text>
          </View>
        ) : (
          <View style={styles.babiesList}>
            {archivedBabies.map(renderBabyCard)}
          </View>
        )}
      </ScrollView>

      <ConfirmModal
        visible={confirmDelete.visible}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir a Soneca ${confirmDelete.napNumber}?`}
        onConfirm={confirmDeleteNap}
        onCancel={() => setConfirmDelete({ visible: false, napId: "", napNumber: 0 })}
      />

      <ConfirmModal
        visible={confirmDeleteBaby.visible}
        title="Excluir Bebê"
        message={`Tem certeza que deseja excluir permanentemente ${confirmDeleteBaby.babyName}? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        confirmColor={colors.error}
        loading={actionLoadingId === confirmDeleteBaby.babyId}
        onConfirm={confirmDeleteBabyAction}
        onCancel={() => setConfirmDeleteBaby({ visible: false, babyId: "", babyName: "" })}
        icon={{ ios: "trash", android: "delete", color: colors.error }}
      />
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
  scrollViewContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  greetingSection: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  babyCountText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  sectionHeaderArchived: {
    marginTop: spacing.xl,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionHeaderTextArchived: {
    color: colors.textSecondary,
  },
  sectionBadge: {
    backgroundColor: colors.primary + "20",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    minWidth: 24,
    alignItems: "center",
  },
  sectionBadgeArchived: {
    backgroundColor: colors.border,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionBadgeTextArchived: {
    color: colors.textSecondary,
  },
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
  },
  babiesList: {
    paddingHorizontal: spacing.lg,
  },
  babyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  babyCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  babyIcon: {
    marginRight: spacing.md,
  },
  babyDetails: {
    flex: 1,
  },
  babyCardName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  babyCardInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  babyCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  ageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  ageText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  contractBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  contractBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  babyName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  babyInfo: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  contractInfo: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contractHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  contractTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
  contractDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  contractStatusBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.success + "20",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  contractStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
  },
  actionButtons: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.primary,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  routinesList: {
    padding: spacing.md,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  routineCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  routineDayOfWeek: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: "uppercase",
  },
  routineDate: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  routineInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  dayOfWeek: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  dateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  timeText: {
    fontSize: 16,
    color: colors.text,
  },
  napCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  napHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  napTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  timeValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  resultsBox: {
    backgroundColor: colors.primary + "15",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  resultText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
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
    color: colors.text,
  },
  observationsBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  observationsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  observationsText: {
    fontSize: 14,
    color: colors.text,
  },
  commentsSection: {
    marginTop: spacing.md,
  },
  commentsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  commentsText: {
    fontSize: 14,
    color: colors.text,
    fontStyle: "italic",
    padding: spacing.md,
  },
  commentsInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
    textAlignVertical: "top",
  },
  commentButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  generalCommentsButton: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
  },
  wakingsSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wakingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  wakingCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  babyCardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  archiveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + "12",
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  archiveButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  deleteBabyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.error + "12",
    borderWidth: 1,
    borderColor: colors.error + "30",
  },
  deleteBabyButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.error,
  },
  wakingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
