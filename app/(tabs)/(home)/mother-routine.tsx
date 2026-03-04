
import React, { useState, useEffect, useCallback } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import DateTimePicker from "@react-native-community/datetimepicker";

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  timePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timePickerText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  formInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: spacing.md,
    lineHeight: 22,
  },
  readOnlyBox: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  readOnlyText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  expandableCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  expandableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
  },
  expandableTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
  },
  expandableContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  calcText: {
    fontSize: 13,
    color: colors.primary,
    marginTop: spacing.xs,
    fontWeight: "600",
  },
  noContractContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  noContractIcon: {
    marginBottom: spacing.lg,
  },
  noContractTitle: {
    ...typography.h2,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  noContractText: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  noContractHint: {
    ...typography.caption,
    textAlign: "center",
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  backButtonText: {
    ...typography.button,
    color: "#FFF",
  },
  wakingsSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wakingCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wakingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  wakingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  choiceButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  choiceBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  choiceBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  choiceBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  choiceBtnTextActive: {
    color: "#FFF",
  },
});

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

export default function MotherRoutineScreen() {
  const [baby, setBaby] = useState<Baby | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noContract, setNoContract] = useState(false);
  const [expandedNaps, setExpandedNaps] = useState<{ [key: number]: boolean }>({});
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentTimeField, setCurrentTimeField] = useState<string>("");
  const [currentNapId, setCurrentNapId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [napToDelete, setNapToDelete] = useState<string | null>(null);
  const [addingWaking, setAddingWaking] = useState(false);
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();

  // 🔥 LOCAL STATE FOR OBSERVATIONS - Prevents character loss
  const [localMotherObservations, setLocalMotherObservations] = useState<string>("");
  const [localNapObservations, setLocalNapObservations] = useState<{ [napId: string]: string }>({});
  const [localNightObservations, setLocalNightObservations] = useState<string>("");

  const loadData = useCallback(async () => {
    try {
      console.log("[Mother Routine] Loading baby and routine data");
      const babyData = await apiGet<Baby>("/api/mother/baby");
      setBaby(babyData);

      // Check if baby has an active contract
      if (!babyData.activeContract) {
        console.log("[Mother Routine] No active contract found");
        setNoContract(true);
        setLoading(false);
        return;
      }

      // Get the date from params or use today
      const targetDate = date || new Date().toISOString().split("T")[0];
      console.log("[Mother Routine] Target date:", targetDate);
      
      // 🔥 FIX: Fetch ALL routines to get complete data including wakings
      try {
        const routinesData = await apiGet<Routine[]>(`/api/routines/baby/${babyData.id}`);
        console.log("[Mother Routine] Fetched routines:", routinesData.length);
        
        const todayRoutine = routinesData.find((r: Routine) => r.date === targetDate);
        
        if (todayRoutine) {
          console.log("[Mother Routine] Found routine for date:", targetDate);
          console.log("[Mother Routine] Night sleep wakings:", todayRoutine.nightSleep?.wakings?.length || 0);
          
          setRoutine(todayRoutine);
          // Initialize local state from routine data
          setLocalMotherObservations(todayRoutine.motherObservations || "");
          setLocalNightObservations(todayRoutine.nightSleep?.observations || "");
          
          // Initialize nap observations
          const napObs: { [napId: string]: string } = {};
          (todayRoutine.naps || []).forEach((nap) => {
            napObs[nap.id] = nap.observations || "";
          });
          setLocalNapObservations(napObs);
        } else {
          console.log("[Mother Routine] No routine found for date, creating new one");
          // Create routine for the target date
          const newRoutine = await apiPost<Routine>("/api/routines", {
            babyId: babyData.id,
            date: targetDate,
            wakeUpTime: "07:00",
            motherObservations: null,
            consultantComments: null,
          });
          setRoutine(newRoutine);
          setLocalMotherObservations("");
          setLocalNightObservations("");
          setLocalNapObservations({});
        }
      } catch (err: any) {
        console.error("[Mother Routine] Error loading routine:", err);
        if (err.message && err.message.includes("No active contract")) {
          setNoContract(true);
        } else {
          setError("Erro ao carregar rotina");
        }
      }
    } catch (err: any) {
      console.error("[Mother Routine] Error loading data:", err);
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 🔥 Sync local state when routine changes (but only when routine ID changes, not on every update)
  useEffect(() => {
    if (routine) {
      setLocalMotherObservations(routine.motherObservations || "");
      setLocalNightObservations(routine.nightSleep?.observations || "");
      
      const napObs: { [napId: string]: string } = {};
      (routine.naps || []).forEach((nap) => {
        napObs[nap.id] = nap.observations || "";
      });
      setLocalNapObservations(napObs);
    }
  }, [routine?.id]);

  const handleUpdateWakeUpTime = async (time: string) => {
    if (!routine) return;
    try {
      await apiPut(`/api/routines/${routine.id}`, { wakeUpTime: time });
      setRoutine({ ...routine, wakeUpTime: time });
    } catch (err: any) {
      console.error("[Mother Routine] Error updating wake up time:", err);
    }
  };

  // 🔥 Save mother observations on blur
  const handleSaveMotherObservations = async () => {
    if (!routine) return;
    if (localMotherObservations === routine.motherObservations) return; // No change
    
    try {
      console.log("[Mother Routine] Saving mother observations");
      await apiPut(`/api/routines/${routine.id}`, { motherObservations: localMotherObservations });
      setRoutine({ ...routine, motherObservations: localMotherObservations });
    } catch (err: any) {
      console.error("[Mother Routine] Error saving mother observations:", err);
    }
  };

  const handleAddNap = async () => {
    if (!routine) return;
    try {
      const napNumber = (routine.naps || []).length + 1;
      const newNap = await apiPost<Nap>("/api/naps", {
        routineId: routine.id,
        napNumber,
        startTryTime: "08:00",
        fellAsleepTime: null,
        wakeUpTime: null,
        sleepMethod: null,
        environment: null,
        wakeUpMood: null,
        observations: null,
      });
      setRoutine({
        ...routine,
        naps: [...(routine.naps || []), newNap],
      });
      setLocalNapObservations({ ...localNapObservations, [newNap.id]: "" });
      setExpandedNaps({ ...expandedNaps, [napNumber]: true });
    } catch (err: any) {
      console.error("[Mother Routine] Error adding nap:", err);
    }
  };

  const handleUpdateNap = async (napId: string, field: string, value: string | null) => {
    if (!routine) return;
    try {
      await apiPut(`/api/naps/${napId}`, { [field]: value });
      setRoutine({
        ...routine,
        naps: routine.naps?.map((nap) =>
          nap.id === napId ? { ...nap, [field]: value } : nap
        ),
      });
    } catch (err: any) {
      console.error("[Mother Routine] Error updating nap:", err);
    }
  };

  // 🔥 Save nap observations on blur
  const handleSaveNapObservations = async (napId: string) => {
    if (!routine) return;
    const nap = routine.naps?.find((n) => n.id === napId);
    if (!nap) return;
    
    const localValue = localNapObservations[napId] || "";
    if (localValue === (nap.observations || "")) return; // No change
    
    try {
      console.log(`[Mother Routine] Saving nap ${napId} observations`);
      await apiPut(`/api/naps/${napId}`, { observations: localValue });
      setRoutine({
        ...routine,
        naps: routine.naps?.map((n) =>
          n.id === napId ? { ...n, observations: localValue } : n
        ),
      });
    } catch (err: any) {
      console.error("[Mother Routine] Error saving nap observations:", err);
    }
  };

  const handleDeleteNap = (napId: string, napNumber: number) => {
    setNapToDelete(napId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteNap = async (napId: string, napNumber: number) => {
    if (!napToDelete || !routine) return;
    try {
      await apiDelete(`/api/naps/${napToDelete}`);
      setRoutine({
        ...routine,
        naps: routine.naps?.filter((nap) => nap.id !== napToDelete),
      });
      // Clean up local state
      const newLocalNapObs = { ...localNapObservations };
      delete newLocalNapObs[napToDelete];
      setLocalNapObservations(newLocalNapObs);
      
      setShowDeleteConfirm(false);
      setNapToDelete(null);
    } catch (err: any) {
      console.error("[Mother Routine] Error deleting nap:", err);
    }
  };

  const handleUpdateNightSleep = async (field: string, value: string | null) => {
    if (!routine) return;
    
    try {
      // If night sleep doesn't exist, create it first
      if (!routine.nightSleep) {
        const newNightSleep = await apiPost<NightSleep>("/api/night-sleep", {
          routineId: routine.id,
          startTryTime: field === "startTryTime" ? value : null,
          fellAsleepTime: field === "fellAsleepTime" ? value : null,
          finalWakeTime: field === "finalWakeTime" ? value : null,
          observations: field === "observations" ? value : null,
        });
        setRoutine({ ...routine, nightSleep: newNightSleep });
      } else {
        // Update existing night sleep
        await apiPut(`/api/night-sleep/${routine.nightSleep.id}`, { [field]: value });
        setRoutine({
          ...routine,
          nightSleep: { ...routine.nightSleep, [field]: value },
        });
      }
    } catch (err: any) {
      console.error("[Mother Routine] Error updating night sleep:", err);
    }
  };

  // 🔥 Save night sleep observations on blur
  const handleSaveNightObservations = async () => {
    if (!routine?.nightSleep) {
      // If night sleep doesn't exist yet, create it with observations
      if (localNightObservations.trim()) {
        try {
          console.log("[Mother Routine] Creating night sleep with observations");
          const newNightSleep = await apiPost<NightSleep>("/api/night-sleep", {
            routineId: routine!.id,
            startTryTime: null,
            fellAsleepTime: null,
            finalWakeTime: null,
            observations: localNightObservations,
          });
          setRoutine({ ...routine!, nightSleep: newNightSleep });
        } catch (err: any) {
          console.error("[Mother Routine] Error creating night sleep:", err);
        }
      }
      return;
    }
    
    if (localNightObservations === (routine.nightSleep.observations || "")) return; // No change
    
    try {
      console.log("[Mother Routine] Saving night sleep observations");
      await apiPut(`/api/night-sleep/${routine.nightSleep.id}`, { observations: localNightObservations });
      setRoutine({
        ...routine,
        nightSleep: { ...routine.nightSleep, observations: localNightObservations },
      });
    } catch (err: any) {
      console.error("[Mother Routine] Error saving night sleep observations:", err);
    }
  };

  // 🔥 FIXED: Ensure night sleep exists before adding waking
  const handleAddWaking = async () => {
    if (!routine) {
      console.error("[Mother Routine] Cannot add waking: no routine");
      return;
    }
    
    setAddingWaking(true);
    
    try {
      // 🔥 CRITICAL: If night sleep doesn't exist, create it first
      let nightSleepId = routine.nightSleep?.id;
      
      if (!nightSleepId) {
        console.log("[Mother Routine] Night sleep doesn't exist, creating it first...");
        const newNightSleep = await apiPost<NightSleep>("/api/night-sleep", {
          routineId: routine.id,
          startTryTime: null,
          fellAsleepTime: null,
          finalWakeTime: null,
          observations: null,
        });
        
        // Update routine with new night sleep
        setRoutine({
          ...routine,
          nightSleep: newNightSleep,
        });
        
        nightSleepId = newNightSleep.id;
        console.log("[Mother Routine] Night sleep created with ID:", nightSleepId);
      }
      
      // Now add the waking
      console.log("[Mother Routine] Adding waking to night sleep ID:", nightSleepId);
      const newWaking = await apiPost<NightWaking>("/api/night-wakings", {
        nightSleepId: nightSleepId,
        startTime: "02:00",
        endTime: "02:30",
        backToSleepMethod: null,
      });
      
      console.log("[Mother Routine] Waking added successfully:", newWaking);
      
      // 🔥 FIX: Reload the routine to get fresh data with wakings
      await loadData();
      
      console.log("[Mother Routine] Routine reloaded after adding waking");
    } catch (err: any) {
      console.error("[Mother Routine] Error adding waking:", err);
      alert("Erro ao adicionar despertar. Tente novamente.");
    } finally {
      setAddingWaking(false);
    }
  };

  const handleDeleteWaking = async (wakingId: string) => {
    if (!routine?.nightSleep) return;
    
    try {
      await apiDelete(`/api/night-wakings/${wakingId}`);
      
      // 🔥 FIX: Reload the routine to get fresh data
      await loadData();
    } catch (err: any) {
      console.error("[Mother Routine] Error deleting waking:", err);
    }
  };

  const handleUpdateWaking = async (wakingId: string, field: string, value: string) => {
    if (!routine?.nightSleep) return;
    
    try {
      await apiPut(`/api/night-wakings/${wakingId}`, { [field]: value });
      setRoutine({
        ...routine,
        nightSleep: {
          ...routine.nightSleep,
          wakings: routine.nightSleep.wakings?.map((w) =>
            w.id === wakingId ? { ...w, [field]: value } : w
          ),
        },
      });
    } catch (err: any) {
      console.error("[Mother Routine] Error updating waking:", err);
    }
  };

  const openTimePicker = (field: string, napId?: string) => {
    setCurrentTimeField(field);
    setCurrentNapId(napId || null);
    
    let initialTime = new Date();
    initialTime.setSeconds(0);
    initialTime.setMilliseconds(0);
    
    if (field === "wakeUpTime" && routine?.wakeUpTime) {
      const [h, m] = routine.wakeUpTime.split(":").map(Number);
      initialTime.setHours(h, m);
    } else if (field.startsWith("nap_") && napId) {
      const nap = routine?.naps?.find((n) => n.id === napId);
      const napField = field.split("_")[1];
      const timeValue = nap?.[napField as keyof Nap];
      if (timeValue && typeof timeValue === "string") {
        const [h, m] = timeValue.split(":").map(Number);
        initialTime.setHours(h, m);
      }
    } else if (field.startsWith("night_") && routine?.nightSleep) {
      const nightField = field.split("_")[1];
      const timeValue = routine.nightSleep[nightField as keyof NightSleep];
      if (timeValue && typeof timeValue === "string") {
        const [h, m] = timeValue.split(":").map(Number);
        initialTime.setHours(h, m);
      }
    } else if (field.startsWith("waking_") && routine?.nightSleep) {
      const parts = field.split("_");
      const wakingId = parts[1];
      const wakingField = parts[2];
      const waking = routine.nightSleep.wakings?.find((w) => w.id === wakingId);
      if (waking) {
        const timeValue = waking[wakingField as keyof NightWaking];
        if (timeValue && typeof timeValue === "string") {
          const [h, m] = timeValue.split(":").map(Number);
          initialTime.setHours(h, m);
        }
      }
    }
    
    setSelectedTime(initialTime);
    setShowTimePicker(true);
  };

  const handleTimeChange = async (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    
    if (date && currentTimeField) {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const timeString = `${hours}:${minutes}`;
      
      if (currentTimeField === "wakeUpTime") {
        await handleUpdateWakeUpTime(timeString);
      } else if (currentTimeField.startsWith("nap_") && currentNapId) {
        const field = currentTimeField.split("_")[1];
        await handleUpdateNap(currentNapId, field, timeString);
      } else if (currentTimeField.startsWith("night_")) {
        const field = currentTimeField.split("_")[1];
        await handleUpdateNightSleep(field, timeString);
      } else if (currentTimeField.startsWith("waking_")) {
        const parts = currentTimeField.split("_");
        const wakingId = parts[1];
        const field = parts[2];
        await handleUpdateWaking(wakingId, field, timeString);
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

  // Show "No Contract" screen
  if (noContract) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Rotina",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.noContractContainer}>
          <View style={styles.noContractIcon}>
            <IconSymbol
              ios_icon_name="doc.text.fill"
              android_material_icon_name="description"
              size={80}
              color={colors.primary}
            />
          </View>
          <Text style={styles.noContractTitle}>Contrato Necessário</Text>
          <Text style={styles.noContractText}>
            Para registrar a rotina de sono, é necessário ter um contrato ativo com sua consultora.
          </Text>
          <Text style={styles.noContractText}>
            Entre em contato com sua consultora para ativar o contrato e começar o acompanhamento.
          </Text>
          <Text style={styles.noContractHint}>
            💡 Sua consultora poderá criar e ativar o contrato pelo painel dela.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !baby || !routine) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.error }}>{error || "Erro ao carregar dados"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const wakingsCount = routine.nightSleep?.wakings?.length || 0;
  console.log("[Mother Routine] Rendering with wakings count:", wakingsCount);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Rotina - ${baby.name}`,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Wake Up Time */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>☀️ Acordou</Text>
          <Text style={styles.fieldLabel}>Horário</Text>
          <TouchableOpacity
            style={styles.timePickerButton}
            onPress={() => openTimePicker("wakeUpTime")}
          >
            <Text style={styles.timePickerText}>{routine.wakeUpTime || "—"}</Text>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="access-time"
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Observações</Text>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Suas observações sobre como o bebê acordou..."
            value={localMotherObservations}
            onChangeText={setLocalMotherObservations}
            onBlur={handleSaveMotherObservations}
            multiline
            textAlignVertical="top"
            numberOfLines={4}
            placeholderTextColor={colors.textSecondary}
          />

          {/* Consultant Comments - READ ONLY */}
          {routine.consultantComments && (
            <View style={styles.readOnlyBox}>
              <Text style={styles.readOnlyLabel}>💬 Orientação da Consultora:</Text>
              <Text style={styles.readOnlyText}>{routine.consultantComments}</Text>
            </View>
          )}
        </View>

        {/* Naps */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>😴 Sonecas</Text>
          {(routine.naps || []).map((nap) => {
            const isExpanded = expandedNaps[nap.napNumber] || false;
            const duration =
              nap.fellAsleepTime && nap.wakeUpTime
                ? calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime)
                : null;

            return (
              <View key={nap.id} style={styles.expandableCard}>
                <TouchableOpacity
                  style={styles.expandableHeader}
                  onPress={() =>
                    setExpandedNaps({ ...expandedNaps, [nap.napNumber]: !isExpanded })
                  }
                >
                  <Text style={styles.expandableTitle}>Soneca {nap.napNumber}</Text>
                  <IconSymbol
                    ios_icon_name={isExpanded ? "chevron.up" : "chevron.down"}
                    android_material_icon_name={isExpanded ? "expand-less" : "expand-more"}
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.expandableContent}>
                    <Text style={styles.fieldLabel}>Início</Text>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => openTimePicker("nap_startTryTime", nap.id)}
                    >
                      <Text style={styles.timePickerText}>{nap.startTryTime}</Text>
                      <IconSymbol
                        ios_icon_name="clock"
                        android_material_icon_name="access-time"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>

                    <Text style={styles.fieldLabel}>Dormiu às</Text>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => openTimePicker("nap_fellAsleepTime", nap.id)}
                    >
                      <Text style={styles.timePickerText}>{nap.fellAsleepTime || "—"}</Text>
                      <IconSymbol
                        ios_icon_name="clock"
                        android_material_icon_name="access-time"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>

                    <Text style={styles.fieldLabel}>Acordou às</Text>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => openTimePicker("nap_wakeUpTime", nap.id)}
                    >
                      <Text style={styles.timePickerText}>{nap.wakeUpTime || "—"}</Text>
                      <IconSymbol
                        ios_icon_name="clock"
                        android_material_icon_name="access-time"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>

                    {duration !== null && (
                      <Text style={styles.calcText}>💤 Duração: {minutesToHM(duration)}</Text>
                    )}

                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Dormiu como</Text>
                    <View style={styles.choiceButtons}>
                      {["No colo", "Com embalo", "Mamando", "Sozinho", "Outro"].map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[styles.choiceBtn, nap.sleepMethod === method && styles.choiceBtnActive]}
                          onPress={() => handleUpdateNap(nap.id, "sleepMethod", method)}
                        >
                          <Text style={[styles.choiceBtnText, nap.sleepMethod === method && styles.choiceBtnTextActive]}>
                            {method}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Ambiente</Text>
                    <View style={styles.choiceButtons}>
                      {["Adequado", "Parcialmente adequado", "Inadequado"].map((env) => (
                        <TouchableOpacity
                          key={env}
                          style={[styles.choiceBtn, nap.environment === env && styles.choiceBtnActive]}
                          onPress={() => handleUpdateNap(nap.id, "environment", env)}
                        >
                          <Text style={[styles.choiceBtnText, nap.environment === env && styles.choiceBtnTextActive]}>
                            {env}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Como acordou</Text>
                    <View style={styles.choiceButtons}>
                      {["Sorrindo", "Calmo", "Choroso", "Muito irritado"].map((mood) => (
                        <TouchableOpacity
                          key={mood}
                          style={[styles.choiceBtn, nap.wakeUpMood === mood && styles.choiceBtnActive]}
                          onPress={() => handleUpdateNap(nap.id, "wakeUpMood", mood)}
                        >
                          <Text style={[styles.choiceBtnText, nap.wakeUpMood === mood && styles.choiceBtnTextActive]}>
                            {mood}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Observações</Text>
                    <TextInput
                      style={[styles.formInput, styles.textArea]}
                      placeholder="Suas observações sobre esta soneca..."
                      value={localNapObservations[nap.id] || ""}
                      onChangeText={(text) => {
                        setLocalNapObservations({ ...localNapObservations, [nap.id]: text });
                      }}
                      onBlur={() => handleSaveNapObservations(nap.id)}
                      multiline
                      textAlignVertical="top"
                      numberOfLines={4}
                      placeholderTextColor={colors.textSecondary}
                    />

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteNap(nap.id, nap.napNumber)}
                    >
                      <IconSymbol
                        ios_icon_name="trash.fill"
                        android_material_icon_name="delete"
                        size={18}
                        color="#FFF"
                      />
                      <Text style={styles.deleteBtnText}>Excluir Soneca</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {(routine.naps || []).length < 6 && (
            <TouchableOpacity style={styles.addButton} onPress={handleAddNap}>
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={20}
                color="#FFF"
              />
              <Text style={styles.addButtonText}>Adicionar Soneca</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Night Sleep */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🌙 Sono Noturno</Text>
          
          <Text style={styles.fieldLabel}>Começou a tentar dormir às</Text>
          <TouchableOpacity
            style={styles.timePickerButton}
            onPress={() => openTimePicker("night_startTryTime")}
          >
            <Text style={styles.timePickerText}>
              {routine.nightSleep?.startTryTime || "—"}
            </Text>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="access-time"
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Dormiu às</Text>
          <TouchableOpacity
            style={styles.timePickerButton}
            onPress={() => openTimePicker("night_fellAsleepTime")}
          >
            <Text style={styles.timePickerText}>
              {routine.nightSleep?.fellAsleepTime || "—"}
            </Text>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="access-time"
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Acordou às (final)</Text>
          <TouchableOpacity
            style={styles.timePickerButton}
            onPress={() => openTimePicker("night_finalWakeTime")}
          >
            <Text style={styles.timePickerText}>
              {routine.nightSleep?.finalWakeTime || "—"}
            </Text>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="access-time"
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>

          {routine.nightSleep?.fellAsleepTime && routine.nightSleep?.finalWakeTime && (
            <Text style={styles.calcText}>
              💤 Duração Total: {minutesToHM(calcTimeDiff(routine.nightSleep.fellAsleepTime, routine.nightSleep.finalWakeTime))}
            </Text>
          )}

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Dormiu como</Text>
          <View style={styles.choiceButtons}>
            {["No colo", "Com embalo", "Mamando", "Sozinho", "Outro"].map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.choiceBtn, routine.nightSleep?.sleepMethod === method && styles.choiceBtnActive]}
                onPress={() => handleUpdateNightSleep("sleepMethod", method)}
              >
                <Text style={[styles.choiceBtnText, routine.nightSleep?.sleepMethod === method && styles.choiceBtnTextActive]}>
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Ambiente</Text>
          <View style={styles.choiceButtons}>
            {["Adequado", "Parcialmente adequado", "Inadequado"].map((env) => (
              <TouchableOpacity
                key={env}
                style={[styles.choiceBtn, routine.nightSleep?.environment === env && styles.choiceBtnActive]}
                onPress={() => handleUpdateNightSleep("environment", env)}
              >
                <Text style={[styles.choiceBtnText, routine.nightSleep?.environment === env && styles.choiceBtnTextActive]}>
                  {env}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Como acordou</Text>
          <View style={styles.choiceButtons}>
            {["Sorrindo", "Calmo", "Choroso", "Muito irritado"].map((mood) => (
              <TouchableOpacity
                key={mood}
                style={[styles.choiceBtn, routine.nightSleep?.wakeUpMood === mood && styles.choiceBtnActive]}
                onPress={() => handleUpdateNightSleep("wakeUpMood", mood)}
              >
                <Text style={[styles.choiceBtnText, routine.nightSleep?.wakeUpMood === mood && styles.choiceBtnTextActive]}>
                  {mood}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Observações</Text>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            placeholder="Suas observações sobre o sono noturno..."
            value={localNightObservations}
            onChangeText={setLocalNightObservations}
            onBlur={handleSaveNightObservations}
            multiline
            textAlignVertical="top"
            numberOfLines={4}
            placeholderTextColor={colors.textSecondary}
          />

          {/* Awakenings */}
          <View style={styles.wakingsSection}>
            <Text style={styles.sectionTitle}>🌟 Despertares Noturnos</Text>
            {(routine.nightSleep?.wakings || []).map((waking, index) => {
              const wakingDuration = calcTimeDiff(waking.startTime, waking.endTime);
              return (
                <View key={waking.id} style={styles.wakingCard}>
                  <View style={styles.wakingHeader}>
                    <Text style={styles.wakingTitle}>Despertar {index + 1}</Text>
                    <TouchableOpacity onPress={() => handleDeleteWaking(waking.id)}>
                      <IconSymbol
                        ios_icon_name="trash.fill"
                        android_material_icon_name="delete"
                        size={18}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>Início do despertar</Text>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => openTimePicker(`waking_${waking.id}_startTime`)}
                  >
                    <Text style={styles.timePickerText}>{waking.startTime}</Text>
                    <IconSymbol
                      ios_icon_name="clock"
                      android_material_icon_name="access-time"
                      size={20}
                      color={colors.primary}
                    />
                  </TouchableOpacity>

                  <Text style={styles.fieldLabel}>Voltou a dormir às</Text>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => openTimePicker(`waking_${waking.id}_endTime`)}
                  >
                    <Text style={styles.timePickerText}>{waking.endTime}</Text>
                    <IconSymbol
                      ios_icon_name="clock"
                      android_material_icon_name="access-time"
                      size={20}
                      color={colors.primary}
                    />
                  </TouchableOpacity>

                  <Text style={styles.calcText}>
                    ⏱️ Duração: {minutesToHM(wakingDuration)}
                  </Text>

                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Como voltou a dormir</Text>
                  <View style={styles.choiceButtons}>
                    {["Mamando", "Embalando", "Sozinho", "Tapinha no bumbum"].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[styles.choiceBtn, waking.backToSleepMethod === method && styles.choiceBtnActive]}
                        onPress={() => handleUpdateWaking(waking.id, "backToSleepMethod", method)}
                      >
                        <Text style={[styles.choiceBtnText, waking.backToSleepMethod === method && styles.choiceBtnTextActive]}>
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity 
              style={[styles.addButton, addingWaking && { opacity: 0.6 }]} 
              onPress={handleAddWaking}
              disabled={addingWaking}
            >
              {addingWaking ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="plus"
                    android_material_icon_name="add"
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.addButtonText}>Adicionar Despertar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}

      <ConfirmModal
        visible={showDeleteConfirm}
        title="Excluir Soneca?"
        message="Tem certeza que deseja excluir esta soneca?"
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmColor={colors.error}
        loading={false}
        onConfirm={() => confirmDeleteNap(napToDelete!, 0)}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setNapToDelete(null);
        }}
        icon={{
          ios: "trash.fill",
          android: "delete",
          color: colors.error,
        }}
      />
    </SafeAreaView>
  );
}
