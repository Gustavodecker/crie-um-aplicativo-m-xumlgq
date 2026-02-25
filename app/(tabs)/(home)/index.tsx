
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  Switch,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import DateTimePicker from "@react-native-community/datetimepicker";
import { setStringAsync } from 'expo-clipboard';
import { useAuth } from "@/contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Contract {
  id: string;
  babyId: string;
  status: string;
  startDate: string;
  durationDays: number;
  contractPdfUrl: string | null;
  createdAt: string;
}

interface Baby {
  id: string;
  name: string;
  birthDate: string;
  motherName: string;
  motherPhone: string;
  motherEmail: string;
  motherUserId: string | null;
  consultantId: string;
  objectives: string | null;
  conclusion: string | null;
  createdAt: string;
  ageMonths: number;
  ageDays: number;
  activeContract: Contract | null;
  token?: string;
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

interface Orientation {
  id: string;
  babyId: string;
  date: string;
  orientationText: string;
  results: string | null;
  createdAt: string;
  updatedAt: string;
}

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

type Screen = 
  | { type: "list" }
  | { type: "baby"; baby: Baby }
  | { type: "routineList"; baby: Baby }
  | { type: "routine"; baby: Baby; routine: Routine; dayNumber: number }
  | { type: "orientations"; baby: Baby }
  | { type: "reports"; baby: Baby };

// ─── Helper Functions ─────────────────────────────────────────────────────────

function minutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hText = `${h}h`;
  const mText = `${m.toString().padStart(2, "0")}m`;
  return `${hText}${mText}`;
}

function calcTimeDiff(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function getStatusColor(status: string) {
  if (status === "active") return colors.statusGood;
  if (status === "paused") return colors.statusMedium;
  return colors.statusPoor;
}

function getStatusText(status: string) {
  if (status === "active") return "Vigente";
  if (status === "paused") return "Em Pausa";
  return "Concluído";
}

function formatDateForDisplay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// Debounce utility - uses ref to avoid stale closure issues
function useDebounce(callback: (...args: any[]) => void, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  
  // Keep callbackRef up to date without triggering re-renders
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);
}

// ─── Main Component ───────────────────────────────────────────────────────────

function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ type: "list" });
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [isConsultant, setIsConsultant] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      try {
        console.log("[Role Check] Checking if user is consultant");
        const profile = await apiGet("/api/consultant/profile");
        console.log("[Role Check] User is a consultant");
        setIsConsultant(true);
      } catch (error) {
        console.log("[Role Check] User is NOT a consultant (mother)");
        setIsConsultant(false);
      } finally {
        setCheckingRole(false);
      }
    };
    checkRole();
  }, []);

  const showErr = (msg: string) => { 
    console.log("[Error]", msg);
    setErrorMessage(msg); 
    setShowError(true); 
  };

  if (checkingRole) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderScreen = () => {
    switch (screen.type) {
      case "list": 
        return <BabiesListScreen isConsultant={isConsultant} onSelectBaby={(b) => setScreen({ type: "baby", baby: b })} showErr={showErr} />;
      case "baby": 
        return <BabyDetailScreen isConsultant={isConsultant} baby={screen.baby} onBack={() => setScreen({ type: "list" })} onOpenRoutineList={() => setScreen({ type: "routineList", baby: screen.baby })} onOpenOrientations={() => setScreen({ type: "orientations", baby: screen.baby })} onOpenReports={() => setScreen({ type: "reports", baby: screen.baby })} showErr={showErr} />;
      case "routineList":
        return <RoutineListScreen isConsultant={isConsultant} baby={screen.baby} onBack={() => setScreen({ type: "baby", baby: screen.baby })} onOpenRoutine={(r, dayNum) => setScreen({ type: "routine", baby: screen.baby, routine: r, dayNumber: dayNum })} showErr={showErr} />;
      case "routine": 
        return <RoutineDetailScreen isConsultant={isConsultant} baby={screen.baby} routine={screen.routine} dayNumber={screen.dayNumber} onBack={() => setScreen({ type: "routineList", baby: screen.baby })} showErr={showErr} />;
      case "orientations": 
        return <OrientationsScreen isConsultant={isConsultant} baby={screen.baby} onBack={() => setScreen({ type: "baby", baby: screen.baby })} showErr={showErr} />;
      case "reports": 
        return <ReportsScreen baby={screen.baby} onBack={() => setScreen({ type: "baby", baby: screen.baby })} showErr={showErr} />;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {renderScreen()}
      <Modal visible={showError} transparent animationType="fade" onRequestClose={() => setShowError(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { justifyContent: "center" }]}>
            <Text style={styles.modalTitle}>Erro</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowError(false)}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Babies List Screen ───────────────────────────────────────────────────────

function BabiesListScreen({ isConsultant, onSelectBaby, showErr }: { isConsultant: boolean; onSelectBaby: (b: Baby) => void; showErr: (m: string) => void }) {
  const [babies, setBabies] = useState<Baby[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddBaby, setShowAddBaby] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [babyName, setBabyName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [motherName, setMotherName] = useState("");
  const [motherPhone, setMotherPhone] = useState("");
  const [motherEmail, setMotherEmail] = useState("");
  const [objectives, setObjectives] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdBabyToken, setCreatedBabyToken] = useState("");
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const loadBabies = useCallback(async () => {
    console.log("[API] Loading babies");
    try {
      if (isConsultant) {
        const data = await apiGet<Baby[]>("/api/consultant/babies");
        console.log("[API] Consultant babies loaded:", data.length);
        setBabies(data);
      } else {
        console.log("[API] User is a mother - fetching linked baby via /api/mother/baby");
        try {
          const baby = await apiGet<Baby>("/api/mother/baby");
          console.log("[API] Mother's baby loaded:", baby.id, baby.name);
          setBabies([baby]);
        } catch (error: any) {
          const msg: string = error?.message || "";
          if (msg.includes("404") || msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("no baby")) {
            console.log("[API] No baby linked to this mother yet (404)");
            setBabies([]);
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      console.error("Error loading babies:", error);
      showErr(error.message || "Erro ao carregar bebês");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isConsultant]);

  useEffect(() => { loadBabies(); }, [loadBabies]);

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      const formattedDate = formatDateForDisplay(date);
      setBirthDate(formattedDate);
    }
  };

  const handleAddBaby = async () => {
    if (!babyName || !birthDate || !motherName || !motherPhone || !motherEmail) {
      showErr("Por favor, preencha todos os campos obrigatórios"); 
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      showErr("Data inválida. Use AAAA-MM-DD"); 
      return;
    }
    setAddLoading(true);
    try {
      console.log("[API] Creating baby:", babyName);
      const baby = await apiPost<Baby>("/api/babies", { 
        name: babyName, 
        birthDate, 
        motherName, 
        motherPhone, 
        motherEmail, 
        objectives: objectives || null 
      });
      console.log("[API] Baby created with token:", baby.token);
      setCreatedBabyToken(baby.token || baby.id);
      setShowAddBaby(false);
      setShowSuccessModal(true);
      setBabyName(""); 
      setBirthDate(""); 
      setMotherName(""); 
      setMotherPhone(""); 
      setMotherEmail(""); 
      setObjectives("");
      loadBabies();
    } catch (error: any) {
      showErr(error.message || "Erro ao cadastrar bebê");
    } finally {
      setAddLoading(false);
    }
  };

  const handleCopyToken = async () => {
    await setStringAsync(createdBabyToken);
    console.log("[Clipboard] Token copied:", createdBabyToken);
    showErr("✅ Código copiado para a área de transferência!");
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: "Bebês", 
        headerStyle: { backgroundColor: colors.background }, 
        headerTintColor: colors.text 
      }} />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBabies(); }} />}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Olá, {isConsultant ? "Consultora" : "Mamãe"}! 👋</Text>
          <Text style={styles.subtitle}>{babies.length} bebê{babies.length !== 1 ? "s" : ""} cadastrado{babies.length !== 1 ? "s" : ""}</Text>
        </View>

        {babies.length === 0 && (
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIcon}>
              <IconSymbol ios_icon_name="moon.stars.fill" android_material_icon_name="bedtime" size={48} color={colors.primary} />
            </View>
            <Text style={styles.welcomeTitle}>
              {isConsultant ? "Bem-vinda ao seu Consultório de Sono! 🌙" : "Bem-vinda, Mamãe! 🌙"}
            </Text>
            <Text style={styles.welcomeText}>
              {isConsultant 
                ? "Comece cadastrando seu primeiro bebê para iniciar o acompanhamento de rotina de sono."
                : "Sua consultora de sono irá cadastrar o bebê e gerenciar as rotinas. Você receberá as orientações e poderá acompanhar o progresso aqui."}
            </Text>
            {!isConsultant && (
              <View style={styles.motherInfoBox}>
                <Text style={styles.motherInfoText}>
                  💡 Caso ainda não tenha vinculado sua conta ao bebê, saia e crie uma nova conta usando o código de 4 caracteres fornecido pela consultora.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.babiesList}>
          {babies.map((baby) => {
            const contractStatus = baby.activeContract?.status || "completed";
            return (
              <TouchableOpacity key={baby.id} style={styles.babyCard} onPress={() => { console.log("Tapped baby:", baby.name); onSelectBaby(baby); }}>
                <View style={styles.babyCardHeader}>
                  <View style={styles.babyIcon}>
                    <IconSymbol ios_icon_name="person.fill" android_material_icon_name="child-care" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.babyInfo}>
                    <Text style={styles.babyName}>{baby.name}</Text>
                    <Text style={styles.motherName}>{baby.motherName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(contractStatus) }]}>
                    <Text style={styles.statusText}>{getStatusText(contractStatus)}</Text>
                  </View>
                </View>
                <View style={styles.babyCardFooter}>
                  <View style={styles.ageContainer}>
                    <IconSymbol ios_icon_name="calendar" android_material_icon_name="calendar-today" size={16} color={colors.textSecondary} />
                    <Text style={styles.ageText}>{baby.ageMonths}m {baby.ageDays}d</Text>
                  </View>
                  <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {isConsultant && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddBaby(true)}>
            <IconSymbol ios_icon_name="plus.circle.fill" android_material_icon_name="add-circle" size={24} color="#FFF" />
            <Text style={styles.addButtonText}>Cadastrar Novo Bebê</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {isConsultant && (
        <Modal visible={showAddBaby} transparent animationType="slide" onRequestClose={() => setShowAddBaby(false)}>
          <View style={styles.slideModalOverlay}>
            <View style={styles.slideModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Cadastrar Bebê</Text>
                <TouchableOpacity onPress={() => setShowAddBaby(false)}>
                  <Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.formSectionTitle}>Dados do Bebê</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder="Nome do bebê *" 
                  value={babyName} 
                  onChangeText={setBabyName} 
                  autoCapitalize="words" 
                  placeholderTextColor={colors.textSecondary} 
                />
                
                <TouchableOpacity 
                  style={styles.datePickerButton} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.datePickerText, !birthDate && { color: colors.textSecondary }]}>
                    {birthDate || "Data de Nascimento * (toque para selecionar)"}
                  </Text>
                  <IconSymbol 
                    ios_icon_name="calendar" 
                    android_material_icon_name="calendar-today" 
                    size={20} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
                
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                  />
                )}
                
                {Platform.OS === "ios" && showDatePicker && (
                  <TouchableOpacity 
                    style={styles.datePickerDoneButton} 
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.datePickerDoneText}>Confirmar</Text>
                  </TouchableOpacity>
                )}
                
                <Text style={styles.formSectionTitle}>Dados da Mãe</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder="Nome da mãe *" 
                  value={motherName} 
                  onChangeText={setMotherName} 
                  autoCapitalize="words" 
                  placeholderTextColor={colors.textSecondary} 
                />
                <TextInput 
                  style={styles.formInput} 
                  placeholder="Telefone *" 
                  value={motherPhone} 
                  onChangeText={setMotherPhone} 
                  keyboardType="phone-pad" 
                  placeholderTextColor={colors.textSecondary} 
                />
                <TextInput 
                  style={styles.formInput} 
                  placeholder="E-mail *" 
                  value={motherEmail} 
                  onChangeText={setMotherEmail} 
                  autoCapitalize="none" 
                  keyboardType="email-address" 
                  placeholderTextColor={colors.textSecondary} 
                />
                <Text style={styles.formSectionTitle}>Objetivos</Text>
                <TextInput 
                  style={[styles.formInput, styles.textArea]} 
                  placeholder="Objetivos do acompanhamento..." 
                  value={objectives} 
                  onChangeText={setObjectives} 
                  multiline 
                  numberOfLines={3} 
                  placeholderTextColor={colors.textSecondary} 
                />
                <TouchableOpacity 
                  style={[styles.addButton, addLoading && { opacity: 0.6 }]} 
                  onPress={handleAddBaby} 
                  disabled={addLoading}
                >
                  {addLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Cadastrar</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <View style={styles.centeredModalOverlay}>
          <View style={styles.centeredModalContent}>
            <View style={styles.successIcon}>
              <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={64} color={colors.statusGood} />
            </View>
            <Text style={styles.modalTitle}>✅ Bebê Cadastrado!</Text>
            <Text style={styles.modalMessage}>Compartilhe este código com a mãe:</Text>
            <View style={styles.tokenBox}>
              <Text style={styles.tokenText}>{createdBabyToken}</Text>
            </View>
            <TouchableOpacity style={styles.copyButton} onPress={handleCopyToken}>
              <IconSymbol ios_icon_name="doc.on.clipboard" android_material_icon_name="content-copy" size={20} color="#FFF" />
              <Text style={styles.copyButtonText}>Copiar Código</Text>
            </TouchableOpacity>
            <Text style={styles.modalHint}>💡 A mãe deve criar uma conta e usar este código durante o cadastro</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowSuccessModal(false)}>
              <Text style={styles.modalButtonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Baby Detail Screen ───────────────────────────────────────────────────────

function BabyDetailScreen({ isConsultant, baby, onBack, onOpenRoutineList, onOpenOrientations, onOpenReports, showErr }: {
  isConsultant: boolean; baby: Baby; onBack: () => void; onOpenRoutineList: () => void;
  onOpenOrientations: () => void; onOpenReports: () => void; showErr: (m: string) => void;
}) {
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(baby.activeContract);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showEditBaby, setShowEditBaby] = useState(false);
  const [contractStartDate, setContractStartDate] = useState(contract?.startDate || new Date().toISOString().split("T")[0]);
  const [contractDuration, setContractDuration] = useState(String(contract?.durationDays || 21));
  const [contractStatus, setContractStatus] = useState(contract?.status || "active");
  const [contractLoading, setContractLoading] = useState(false);
  const [editName, setEditName] = useState(baby.name);
  const [editObjectives, setEditObjectives] = useState(baby.objectives || "");
  const [editConclusion, setEditConclusion] = useState(baby.conclusion || "");
  const [editLoading, setEditLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      console.log("[API] Loading contract for baby:", baby.id);
      const contractData = await apiGet<Contract | null>(`/api/contracts/baby/${baby.id}`);
      setContract(contractData);
    } catch (error: any) {
      console.error("Error loading baby data:", error);
      showErr(error.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baby.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveContract = async () => {
    if (!contractStartDate || !contractDuration) { showErr("Preencha todos os campos do contrato"); return; }
    setContractLoading(true);
    try {
      if (contract) {
        console.log("[API] Updating contract:", contract.id);
        const updated = await apiPut<Contract>(`/api/contracts/${contract.id}`, { startDate: contractStartDate, durationDays: parseInt(contractDuration), status: contractStatus });
        setContract(updated);
      } else {
        console.log("[API] Creating contract for baby:", baby.id);
        const created = await apiPost<Contract>("/api/contracts", { babyId: baby.id, startDate: contractStartDate, durationDays: parseInt(contractDuration), status: contractStatus });
        setContract(created);
      }
      setShowContractModal(false);
    } catch (error: any) {
      showErr(error.message || "Erro ao salvar contrato");
    } finally {
      setContractLoading(false);
    }
  };

  const handleEditBaby = async () => {
    setEditLoading(true);
    try {
      console.log("[API] Updating baby:", baby.id);
      await apiPut(`/api/babies/${baby.id}`, { name: editName, objectives: editObjectives || null, conclusion: editConclusion || null });
      setShowEditBaby(false);
      loadData();
    } catch (error: any) {
      showErr(error.message || "Erro ao atualizar bebê");
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenAcompanhamento = () => {
    console.log("[Navigation] Opening acompanhamento (landscape reports) for baby:", baby.id, baby.name);
    router.push({
      pathname: "/(tabs)/(home)/acompanhamento",
      params: { babyId: baby.id, babyName: baby.name },
    });
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: baby.name, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerLeft: () => (
        <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}><IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} /></TouchableOpacity>
      )}} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
        
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <View>
              <Text style={styles.infoCardTitle}>{baby.name}</Text>
              <Text style={styles.infoCardSubtitle}>{baby.ageMonths}m {baby.ageDays}d • {baby.motherName}</Text>
            </View>
            {isConsultant && (
              <TouchableOpacity style={styles.editBtn} onPress={() => setShowEditBaby(true)}>
                <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          {baby.objectives && <Text style={styles.infoCardText}>🎯 {baby.objectives}</Text>}
          {baby.conclusion && <Text style={styles.infoCardText}>✅ {baby.conclusion}</Text>}
        </View>

        {isConsultant && (
          <TouchableOpacity style={[styles.contractCard, { borderColor: contract ? getStatusColor(contract.status) : colors.border }]} onPress={() => { setContractStartDate(contract?.startDate || new Date().toISOString().split("T")[0]); setContractDuration(String(contract?.durationDays || 21)); setContractStatus(contract?.status || "active"); setShowContractModal(true); }}>
            <View style={styles.contractCardHeader}>
              <IconSymbol ios_icon_name="doc.text.fill" android_material_icon_name="description" size={20} color={contract ? getStatusColor(contract.status) : colors.textSecondary} />
              <Text style={styles.contractCardTitle}>Contrato</Text>
              {contract && <View style={[styles.statusBadge, { backgroundColor: getStatusColor(contract.status) }]}><Text style={styles.statusText}>{getStatusText(contract.status)}</Text></View>}
            </View>
            {contract ? (
              <Text style={styles.contractCardText}>Início: {formatDateToBR(contract.startDate)} • {contract.durationDays} dias</Text>
            ) : (
              <Text style={styles.contractCardText}>Toque para adicionar contrato</Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenRoutineList}>
            <IconSymbol ios_icon_name="calendar.badge.clock" android_material_icon_name="schedule" size={24} color={colors.primary} />
            <Text style={styles.quickActionText}>Rotina</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenOrientations}>
            <IconSymbol ios_icon_name="list.bullet.clipboard.fill" android_material_icon_name="assignment" size={24} color={colors.secondary} />
            <Text style={styles.quickActionText}>Orientações</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={handleOpenAcompanhamento}>
            <IconSymbol ios_icon_name="chart.bar.fill" android_material_icon_name="bar-chart" size={24} color={colors.success} />
            <Text style={styles.quickActionText}>Acompanhamento</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {isConsultant && (
        <>
          <Modal visible={showContractModal} transparent animationType="slide" onRequestClose={() => setShowContractModal(false)}>
            <View style={styles.slideModalOverlay}>
              <View style={styles.slideModalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{contract ? "Editar Contrato" : "Novo Contrato"}</Text>
                  <TouchableOpacity onPress={() => setShowContractModal(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
                </View>
                <TextInput style={styles.formInput} placeholder="Data de início (AAAA-MM-DD)" value={contractStartDate} onChangeText={setContractStartDate} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
                <TextInput style={styles.formInput} placeholder="Duração em dias" value={contractDuration} onChangeText={setContractDuration} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
                <Text style={styles.formSectionTitle}>Status</Text>
                <View style={styles.roleButtons}>
                  {["active", "paused", "completed"].map((s) => (
                    <TouchableOpacity key={s} style={[styles.roleButton, contractStatus === s && styles.roleButtonActive]} onPress={() => setContractStatus(s)}>
                      <Text style={[styles.roleButtonText, contractStatus === s && styles.roleButtonTextActive]}>{getStatusText(s)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.addButton, { marginTop: 16 }, contractLoading && { opacity: 0.6 }]} onPress={handleSaveContract} disabled={contractLoading}>
                  {contractLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Salvar Contrato</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={showEditBaby} transparent animationType="slide" onRequestClose={() => setShowEditBaby(false)}>
            <View style={styles.slideModalOverlay}>
              <View style={styles.slideModalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Editar Bebê</Text>
                  <TouchableOpacity onPress={() => setShowEditBaby(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
                </View>
                <TextInput style={styles.formInput} placeholder="Nome" value={editName} onChangeText={setEditName} autoCapitalize="words" placeholderTextColor={colors.textSecondary} />
                <TextInput style={[styles.formInput, styles.textArea]} placeholder="Objetivos..." value={editObjectives} onChangeText={setEditObjectives} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
                <TextInput style={[styles.formInput, styles.textArea]} placeholder="Conclusão do trabalho (consultora)..." value={editConclusion} onChangeText={setEditConclusion} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
                <TouchableOpacity style={[styles.addButton, editLoading && { opacity: 0.6 }]} onPress={handleEditBaby} disabled={editLoading}>
                  {editLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Routine List Screen ──────────────────────────────────────────────────────

function RoutineListScreen({ isConsultant, baby, onBack, onOpenRoutine, showErr }: {
  isConsultant: boolean; baby: Baby; onBack: () => void; onOpenRoutine: (r: Routine, dayNum: number) => void; showErr: (m: string) => void;
}) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRoutines = useCallback(async () => {
    try {
      console.log("[API] Loading routines for baby:", baby.id);
      const routinesData = await apiGet<Routine[]>(`/api/routines/baby/${baby.id}`);
      setRoutines(routinesData.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error: any) {
      console.error("Error loading routines:", error);
      showErr(error.message || "Erro ao carregar rotinas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baby.id]);

  useEffect(() => { loadRoutines(); }, [loadRoutines]);

  const createRoutineForDay = async (dayNumber: number) => {
    try {
      console.log("[API] Creating routine for day:", dayNumber);
      const contract = baby.activeContract;
      if (!contract) {
        showErr("Nenhum contrato ativo");
        return;
      }
      
      const startDate = new Date(contract.startDate);
      startDate.setDate(startDate.getDate() + (dayNumber - 1));
      const routineDate = formatDateForDisplay(startDate);
      
      const newRoutine = await apiPost<Routine>("/api/routines", {
        babyId: baby.id,
        date: routineDate,
        wakeUpTime: "07:00",
        motherObservations: null,
        consultantComments: null
      });
      
      console.log("[API] Routine created:", newRoutine.id);
      onOpenRoutine(newRoutine, dayNumber);
    } catch (error: any) {
      showErr(error.message || "Erro ao criar rotina");
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const contract = baby.activeContract;
  const contractActive = contract?.status === "active";
  const totalDays = contract?.durationDays || 0;

  const routinesByDay: { [key: number]: Routine | null } = {};
  for (let i = 1; i <= totalDays; i++) {
    routinesByDay[i] = null;
  }

  routines.forEach((routine, index) => {
    const dayNumber = index + 1;
    if (dayNumber <= totalDays) {
      routinesByDay[dayNumber] = routine;
    }
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: `Rotina - ${baby.name}`, 
        headerStyle: { backgroundColor: colors.background }, 
        headerTintColor: colors.text, 
        headerLeft: () => (
          <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        )
      }} />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRoutines(); }} />}
      >
        {contract && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Contrato: {contract.durationDays} dias</Text>
            <Text style={styles.infoCardSubtitle}>Início: {formatDateToBR(contract.startDate)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(contract.status), marginTop: 8, alignSelf: "flex-start" }]}>
              <Text style={styles.statusText}>{getStatusText(contract.status)}</Text>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dias da Rotina</Text>
        </View>

        {totalDays === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Nenhum contrato ativo</Text>
            <Text style={styles.emptyStateSubtext}>Configure um contrato para visualizar os dias</Text>
          </View>
        ) : (
          Object.keys(routinesByDay).map((dayKey) => {
            const dayNumber = parseInt(dayKey);
            const routine = routinesByDay[dayNumber];
            const routineStatus = routine?.consultantComments ? "Concluído" : routine ? "Em Preenchimento" : "Pendente";
            const statusColor = routine?.consultantComments ? colors.statusGood : routine ? colors.statusMedium : colors.statusPoor;

            return (
              <TouchableOpacity 
                key={dayNumber} 
                style={styles.routineCard} 
                onPress={() => {
                  console.log("Tapped day:", dayNumber);
                  if (routine) {
                    console.log("Opening existing routine:", routine.id);
                    onOpenRoutine(routine, dayNumber);
                  } else {
                    console.log("Creating new routine for day:", dayNumber);
                    createRoutineForDay(dayNumber);
                  }
                }}
              >
                <View style={styles.routineCardHeader}>
                  <View>
                    <Text style={styles.routineDayNumber}>Dia {dayNumber}</Text>
                    {routine && <Text style={styles.routineDate}>{formatDateToBR(routine.date)}</Text>}
                  </View>
                  <View style={[styles.routineStatusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.routineStatusText}>{routineStatus}</Text>
                  </View>
                </View>
                {routine?.consultantComments && (
                  <Text style={styles.routineComment} numberOfLines={2}>💬 {routine.consultantComments}</Text>
                )}
                <View style={{ alignItems: "flex-end", marginTop: 4 }}>
                  <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Routine Detail Screen ────────────────────────────────────────────────────

function RoutineDetailScreen({ isConsultant, baby, routine: initialRoutine, dayNumber, onBack, showErr }: {
  isConsultant: boolean; baby: Baby; routine: Routine; dayNumber: number; onBack: () => void; showErr: (m: string) => void;
}) {
  const [routine, setRoutine] = useState<Routine>(initialRoutine);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wakeUpTime, setWakeUpTime] = useState(initialRoutine.wakeUpTime || "07:00");
  const [expandedNaps, setExpandedNaps] = useState<{ [key: number]: boolean }>({ 1: true });
  const [expandedNightSleep, setExpandedNightSleep] = useState(false);
  const [expandedWakings, setExpandedWakings] = useState<{ [key: number]: boolean }>({});
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentTimeField, setCurrentTimeField] = useState<string>("");
  const [currentNapId, setCurrentNapId] = useState<string | null>(null);
  const [currentWakingId, setCurrentWakingId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState(new Date());
  
  // Local state for text inputs with auto-save
  const [routineObservations, setRoutineObservations] = useState(initialRoutine.motherObservations || "");
  const [routineConsultantComments, setRoutineConsultantComments] = useState(initialRoutine.consultantComments || "");
  const [napObservations, setNapObservations] = useState<{ [key: string]: string }>({});
  const [napConsultantComments, setNapConsultantComments] = useState<{ [key: string]: string }>({});
  const [nightSleepObservations, setNightSleepObservations] = useState("");
  const [nightSleepConsultantComments, setNightSleepConsultantComments] = useState("");

  // Ref to always have the latest nightSleep id for auto-save
  const nightSleepIdRef = useRef<string | null>(null);
  
  // Initialize nightSleepIdRef from initialRoutine
  useEffect(() => {
    const initialNightSleep = initialRoutine.nightSleep;
    if (initialNightSleep && typeof initialNightSleep === 'object' && 'id' in initialNightSleep && initialNightSleep.id) {
      nightSleepIdRef.current = initialNightSleep.id;
      console.log("[Night Sleep Ref] Initialized nightSleepIdRef from initialRoutine to:", initialNightSleep.id);
    }
  }, []);
  
  // Keep nightSleepIdRef in sync with routine.nightSleep
  useEffect(() => {
    const currentNightSleep = routine.nightSleep;
    if (currentNightSleep && typeof currentNightSleep === 'object' && 'id' in currentNightSleep && currentNightSleep.id) {
      nightSleepIdRef.current = currentNightSleep.id;
      console.log("[Night Sleep Ref] Updated nightSleepIdRef to:", currentNightSleep.id);
    }
  }, [routine.nightSleep]);

  // Auto-save functions with debounce
  const autoSaveRoutineObservations = useDebounce(async (text: string) => {
    try {
      console.log("[Auto-save] Saving routine observations");
      await apiPut(`/api/routines/${routine.id}`, { motherObservations: text });
    } catch (error: any) {
      console.error("[Auto-save] Error saving routine observations:", error);
    }
  }, 1000);

  const autoSaveRoutineComments = useDebounce(async (text: string) => {
    try {
      console.log("[Auto-save] Saving routine consultant comments");
      await apiPut(`/api/routines/${routine.id}`, { consultantComments: text });
    } catch (error: any) {
      console.error("[Auto-save] Error saving routine comments:", error);
    }
  }, 1000);

  const autoSaveNapObservations = useDebounce(async (napId: string, text: string) => {
    try {
      console.log("[Auto-save] Saving nap observations for:", napId);
      await apiPut(`/api/naps/${napId}`, { observations: text });
    } catch (error: any) {
      console.error("[Auto-save] Error saving nap observations:", error);
    }
  }, 1000);

  const autoSaveNapComments = useDebounce(async (napId: string, text: string) => {
    try {
      console.log("[Auto-save] Saving nap consultant comments for:", napId);
      await apiPut(`/api/naps/${napId}`, { consultantComments: text });
    } catch (error: any) {
      console.error("[Auto-save] Error saving nap comments:", error);
    }
  }, 1000);

  const autoSaveNightSleepObservations = useDebounce(async (text: string) => {
    try {
      const id = nightSleepIdRef.current;
      if (id) {
        console.log("[Auto-save] Saving night sleep observations for id:", id);
        await apiPut(`/api/night-sleep/${id}`, { observations: text });
      } else {
        console.log("[Auto-save] Night sleep id not available yet, skipping observations save");
      }
    } catch (error: any) {
      console.error("[Auto-save] Error saving night sleep observations:", error);
    }
  }, 1000);

  const autoSaveNightSleepComments = useDebounce(async (text: string) => {
    try {
      const id = nightSleepIdRef.current;
      if (id) {
        console.log("[Auto-save] Saving night sleep consultant comments for id:", id);
        await apiPut(`/api/night-sleep/${id}`, { consultantComments: text });
      } else {
        console.log("[Auto-save] Night sleep id not available yet, skipping comments save");
      }
    } catch (error: any) {
      console.error("[Auto-save] Error saving night sleep comments:", error);
    }
  }, 1000);

  const loadRoutine = useCallback(async (skipTextUpdate = false, preserveNightSleep = false) => {
    try {
      console.log("[API] Loading routine:", initialRoutine.id);
      const data = await apiGet<Routine>(`/api/routines/${initialRoutine.id}`);
      
      // Validate that nightSleep has an id field (it's a real object, not just a placeholder)
      // The backend sometimes returns {} instead of null for nightSleep
      const apiNightSleep: NightSleep | null = 
        (data.nightSleep && 
         typeof data.nightSleep === 'object' && 
         'id' in data.nightSleep && 
         data.nightSleep.id)
          ? (data.nightSleep as NightSleep)
          : null;
      
      console.log("[API] Routine loaded successfully:", data.id, "nightSleep:", apiNightSleep ? `id=${apiNightSleep.id}` : "null or empty object");
      
      // Update the nightSleepIdRef with the latest id from API
      if (apiNightSleep?.id && !preserveNightSleep) {
        nightSleepIdRef.current = apiNightSleep.id;
        console.log("[API] Updated nightSleepIdRef from API to:", apiNightSleep.id);
      }
      
      setRoutine(prev => {
        // When preserveNightSleep is true, keep the current nightSleep state (e.g., after adding a nap)
        // But if the API returned a nightSleep and we don't have one locally, always use the API version
        let nightSleepToUse: NightSleep | null | undefined;
        if (preserveNightSleep) {
          // Keep current state but merge in API data if we don't have a local nightSleep yet
          nightSleepToUse = prev.nightSleep || apiNightSleep;
        } else {
          // Use API data, falling back to current state if API returned null
          nightSleepToUse = apiNightSleep || prev.nightSleep;
        }
        
        // Update ref if we have a night sleep
        if (nightSleepToUse?.id) {
          nightSleepIdRef.current = nightSleepToUse.id;
          console.log("[API] Updated nightSleepIdRef from nightSleepToUse to:", nightSleepToUse.id);
        }
        
        return {
          ...data,
          nightSleep: nightSleepToUse,
        };
      });
      
      setWakeUpTime(data.wakeUpTime || "07:00");
      
      if (!skipTextUpdate) {
        setRoutineObservations(data.motherObservations || "");
        setRoutineConsultantComments(data.consultantComments || "");
        
        const napObs: { [key: string]: string } = {};
        const napComments: { [key: string]: string } = {};
        data.naps?.forEach(nap => {
          napObs[nap.id] = nap.observations || "";
          napComments[nap.id] = nap.consultantComments || "";
        });
        setNapObservations(napObs);
        setNapConsultantComments(napComments);
        
        if (apiNightSleep) {
          setNightSleepObservations(apiNightSleep.observations || "");
          setNightSleepConsultantComments(apiNightSleep.consultantComments || "");
        }
      }
    } catch (error: any) {
      console.error("[API] Error loading routine:", error);
      showErr(error.message || "Erro ao carregar rotina");
    } finally {
      setLoading(false);
    }
  }, [initialRoutine.id]);

  useEffect(() => { loadRoutine(); }, [loadRoutine]);

  const handleSaveWakeUp = async (time: string) => {
    try {
      console.log("[API] Auto-saving wake up time for routine:", routine.id, "time:", time);
      await apiPut(`/api/routines/${routine.id}`, { wakeUpTime: time });
    } catch (error: any) {
      console.error("[API] Error auto-saving wake up time:", error);
      showErr(error.message || "Erro ao salvar horário");
    }
  };

  const handleAddNap = async () => {
    try {
      const napNumber = (routine.naps || []).length + 1;
      console.log("[API] Adding nap", napNumber, "to routine:", routine.id);
      const newNap = await apiPost<Nap>("/api/naps", { 
        routineId: routine.id, 
        napNumber, 
        startTryTime: "08:00",
        fellAsleepTime: null,
        wakeUpTime: null,
        sleepMethod: null,
        environment: null,
        wakeUpMood: null,
        observations: null
      });
      
      setNapObservations(prev => ({ ...prev, [newNap.id]: "" }));
      setNapConsultantComments(prev => ({ ...prev, [newNap.id]: "" }));
      
      await loadRoutine(false, true);
      setExpandedNaps({ ...expandedNaps, [napNumber]: true });
    } catch (error: any) {
      showErr(error.message || "Erro ao adicionar soneca");
    }
  };

  const handleUpdateNap = async (napId: string, updates: Partial<Nap>) => {
    try {
      console.log("[API] Updating nap:", napId, "with updates:", updates);
      await apiPut(`/api/naps/${napId}`, updates);
      
      setRoutine(prev => ({
        ...prev,
        naps: prev.naps?.map(nap => 
          nap.id === napId ? { ...nap, ...updates } : nap
        )
      }));
    } catch (error: any) {
      console.error("[API] Error updating nap:", error);
      showErr(error.message || "Erro ao atualizar soneca");
    }
  };

  const handleDeleteNap = async (napId: string) => {
    try {
      console.log("[API] Deleting nap:", napId);
      await apiDelete(`/api/naps/${napId}`);
      
      setNapObservations(prev => {
        const newState = { ...prev };
        delete newState[napId];
        return newState;
      });
      setNapConsultantComments(prev => {
        const newState = { ...prev };
        delete newState[napId];
        return newState;
      });
      
      await loadRoutine(false, true);
    } catch (error: any) {
      showErr(error.message || "Erro ao excluir soneca");
    }
  };

  const handleAddOrUpdateNightSleep = async () => {
    try {
      const currentNightSleep = routine.nightSleep;
      if (currentNightSleep && typeof currentNightSleep === 'object' && 'id' in currentNightSleep && currentNightSleep.id) {
        console.log("[API] Night sleep already exists:", currentNightSleep.id, "- just expanding");
        setExpandedNightSleep(true);
        return;
      }
      
      console.log("[API] Creating night sleep for routine:", routine.id);
      const newNightSleep = await apiPost<NightSleep>("/api/night-sleep", {
        routineId: routine.id,
        startTryTime: null,
        fellAsleepTime: null,
        finalWakeTime: null,
        sleepMethod: null,
        environment: null,
        wakeUpMood: null,
        observations: null,
        consultantComments: null,
      });
      
      console.log("[API] Night sleep created with ID:", newNightSleep.id);
      
      // Update ref immediately so auto-save functions can use it
      nightSleepIdRef.current = newNightSleep.id;
      console.log("[API] Updated nightSleepIdRef after creation to:", newNightSleep.id);
      
      // Update local state immediately with the created night sleep
      const nightSleepWithWakings: NightSleep = { ...newNightSleep, wakings: [] };
      setRoutine(prev => ({ ...prev, nightSleep: nightSleepWithWakings }));
      setNightSleepObservations(newNightSleep.observations || "");
      setNightSleepConsultantComments(newNightSleep.consultantComments || "");
      setExpandedNightSleep(true);
    } catch (error: any) {
      console.error("[API] Error creating night sleep:", error);
      showErr(error.message || "Erro ao criar sono noturno");
    }
  };

  const handleUpdateNightSleep = async (field: string, value: string | null) => {
    try {
      console.log("[API] Updating night sleep field:", field, "value:", value);
      
      // Convert empty string to null
      const normalizedValue = (value === "" || value === undefined) ? null : value;
      
      const currentNightSleep = routine.nightSleep;
      let updatedNightSleep: NightSleep;

      if (currentNightSleep && typeof currentNightSleep === 'object' && 'id' in currentNightSleep && currentNightSleep.id) {
        console.log("[API] Night sleep exists (id:", currentNightSleep.id, "), using PUT");
        const putResult = await apiPut<NightSleep>(`/api/night-sleep/${currentNightSleep.id}`, {
          [field]: normalizedValue
        });
        updatedNightSleep = {
          ...currentNightSleep,
          ...putResult,
          [field]: normalizedValue,
          wakings: currentNightSleep.wakings || [],
        };
      } else {
        console.log("[API] Night sleep does not exist yet, creating via POST for routine:", routine.id);
        const postResult = await apiPost<NightSleep>("/api/night-sleep", {
          routineId: routine.id,
          startTryTime: field === "startTryTime" ? normalizedValue : null,
          fellAsleepTime: field === "fellAsleepTime" ? normalizedValue : null,
          finalWakeTime: field === "finalWakeTime" ? normalizedValue : null,
          sleepMethod: field === "sleepMethod" ? normalizedValue : null,
          environment: field === "environment" ? normalizedValue : null,
          wakeUpMood: field === "wakeUpMood" ? normalizedValue : null,
          observations: field === "observations" ? normalizedValue : null,
          consultantComments: field === "consultantComments" ? normalizedValue : null,
        });
        updatedNightSleep = { ...postResult, wakings: [] };
        // Update the ref immediately so auto-save functions can use it
        nightSleepIdRef.current = postResult.id;
        console.log("[API] Updated nightSleepIdRef after POST to:", postResult.id);
      }
      
      console.log("[API] Night sleep updated/created with ID:", updatedNightSleep.id);
      
      setRoutine(prev => ({
        ...prev,
        nightSleep: updatedNightSleep
      }));
    } catch (error: any) {
      console.error("[API] Error processing night sleep:", error);
      showErr(error.message || "Erro ao processar sono noturno");
    }
  };

  const handleAddWaking = async () => {
    try {
      let nightSleepId = nightSleepIdRef.current;
      let currentNightSleep = routine.nightSleep;
      
      if (!nightSleepId) {
        console.log("[API] Night sleep doesn't exist yet, creating it for routine:", routine.id);
        const newNightSleep = await apiPost<NightSleep>("/api/night-sleep", {
          routineId: routine.id,
          startTryTime: null,
          fellAsleepTime: null,
          finalWakeTime: null,
          sleepMethod: null,
          environment: null,
          wakeUpMood: null,
          observations: null,
          consultantComments: null,
        });
        
        console.log("[API] Night sleep created with ID:", newNightSleep.id);
        nightSleepId = newNightSleep.id;
        currentNightSleep = { ...newNightSleep, wakings: [] };
        
        // Update ref immediately
        nightSleepIdRef.current = newNightSleep.id;
        console.log("[API] Updated nightSleepIdRef after waking creation to:", newNightSleep.id);
        
        setRoutine(prev => ({
          ...prev,
          nightSleep: currentNightSleep
        }));
      }
      
      console.log("[API] Adding night waking to night sleep:", nightSleepId);
      const newWaking = await apiPost<NightWaking>("/api/night-wakings", {
        nightSleepId: nightSleepId,
        startTime: "02:00",
        endTime: "02:30"
      });
      
      console.log("[API] Night waking created:", newWaking.id);
      
      setRoutine(prev => ({
        ...prev,
        nightSleep: prev.nightSleep ? {
          ...prev.nightSleep,
          wakings: [...(prev.nightSleep.wakings || []), newWaking]
        } : currentNightSleep ? {
          ...currentNightSleep,
          wakings: [newWaking]
        } : null
      }));
    } catch (error: any) {
      console.error("[API] Error adding waking:", error);
      showErr(error.message || "Erro ao adicionar despertar");
    }
  };

  const handleDeleteWaking = async (wakingId: string) => {
    try {
      console.log("[API] Deleting night waking:", wakingId);
      await apiDelete(`/api/night-wakings/${wakingId}`);
      
      setRoutine(prev => ({
        ...prev,
        nightSleep: prev.nightSleep ? {
          ...prev.nightSleep,
          wakings: (prev.nightSleep.wakings || []).filter(w => w.id !== wakingId)
        } : null
      }));
    } catch (error: any) {
      showErr(error.message || "Erro ao excluir despertar");
    }
  };

  const handleTimeChange = async (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    
    if (date && currentTimeField) {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const timeString = `${hours}:${minutes}`;
      
      console.log("[Time Picker] Selected time:", timeString, "for field:", currentTimeField);
      
      try {
        if (currentTimeField === "wakeUpTime") {
          setWakeUpTime(timeString);
          await handleSaveWakeUp(timeString);
        } else if (currentTimeField.startsWith("nap_") && currentNapId) {
          const field = currentTimeField.split("_")[1];
          
          setRoutine(prev => ({
            ...prev,
            naps: prev.naps?.map(nap => 
              nap.id === currentNapId ? { ...nap, [field]: timeString } : nap
            )
          }));
          
          await handleUpdateNap(currentNapId, { [field]: timeString });
        } else if (currentTimeField.startsWith("nightSleep_")) {
          const field = currentTimeField.split("_")[1];
          
          setRoutine(prev => ({
            ...prev,
            nightSleep: prev.nightSleep ? { ...prev.nightSleep, [field]: timeString } : null
          }));
          
          await handleUpdateNightSleep(field, timeString);
        } else if (currentTimeField.startsWith("waking_") && currentWakingId) {
          const field = currentTimeField.split("_")[1];
          await handleUpdateWaking(currentWakingId, field, timeString);
        }
      } catch (error: any) {
        console.error("[Time Picker] Error updating time:", error);
        showErr(error.message || "Erro ao atualizar horário");
      }
    }
    
    if (Platform.OS === "ios") {
      // Keep picker open on iOS
    }
  };

  const handleUpdateWaking = async (wakingId: string, field: string, value: string) => {
    try {
      console.log("[API] Updating waking:", wakingId, field, value);
      const waking = routine.nightSleep?.wakings?.find(w => w.id === wakingId);
      if (!waking) {
        console.error("[API] Waking not found:", wakingId);
        return;
      }
      
      const updates = {
        startTime: field === "startTime" ? value : waking.startTime,
        endTime: field === "endTime" ? value : waking.endTime
      };
      
      await apiPut(`/api/night-wakings/${wakingId}`, updates);
      
      setRoutine(prev => ({
        ...prev,
        nightSleep: prev.nightSleep ? {
          ...prev.nightSleep,
          wakings: prev.nightSleep.wakings?.map(w => 
            w.id === wakingId ? { ...w, ...updates } : w
          )
        } : null
      }));
    } catch (error: any) {
      console.error("[API] Error updating waking:", error);
      showErr(error.message || "Erro ao atualizar despertar");
    }
  };

  const openTimePicker = (field: string, napId?: string, wakingId?: string) => {
    console.log("[Time Picker] Opening for field:", field, "napId:", napId, "wakingId:", wakingId);
    setCurrentTimeField(field);
    setCurrentNapId(napId || null);
    setCurrentWakingId(wakingId || null);
    
    let initialTime = new Date();
    initialTime.setSeconds(0);
    initialTime.setMilliseconds(0);
    
    if (field === "wakeUpTime") {
      const [h, m] = wakeUpTime.split(":").map(Number);
      initialTime.setHours(h, m);
    } else if (field.startsWith("nap_") && napId) {
      const nap = routine.naps?.find(n => n.id === napId);
      const napField = field.split("_")[1];
      const timeValue = nap?.[napField as keyof Nap];
      if (timeValue && typeof timeValue === "string") {
        const [h, m] = timeValue.split(":").map(Number);
        initialTime.setHours(h, m);
      }
    } else if (field.startsWith("nightSleep_")) {
      const nsField = field.split("_")[1];
      const currentNightSleep = routine.nightSleep;
      if (currentNightSleep && typeof currentNightSleep === 'object' && nsField in currentNightSleep) {
        const timeValue = currentNightSleep[nsField as keyof NightSleep];
        if (timeValue && typeof timeValue === "string" && timeValue.includes(":")) {
          const [h, m] = timeValue.split(":").map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            initialTime.setHours(h, m);
          }
        }
      }
    } else if (field.startsWith("waking_") && wakingId) {
      const waking = routine.nightSleep?.wakings?.find(w => w.id === wakingId);
      const wakingField = field.split("_")[1];
      const timeValue = waking?.[wakingField as keyof NightWaking];
      if (timeValue && typeof timeValue === "string") {
        const [h, m] = timeValue.split(":").map(Number);
        initialTime.setHours(h, m);
      }
    }
    
    setSelectedTime(initialTime);
    setShowTimePicker(true);
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const naps = routine.naps || [];
  const nightSleep = (routine.nightSleep && typeof routine.nightSleep === 'object' && 'id' in routine.nightSleep && routine.nightSleep.id) ? routine.nightSleep : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: `Dia ${dayNumber}`, 
        headerStyle: { backgroundColor: colors.background }, 
        headerTintColor: colors.text, 
        headerLeft: () => (
          <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        )
      }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* ACORDOU */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>☀️ Acordou</Text>
          
          <Text style={styles.fieldLabel}>Horário (salva automaticamente)</Text>
          <TouchableOpacity 
            style={styles.timePickerButton} 
            onPress={() => openTimePicker("wakeUpTime")}
          >
            <Text style={styles.timePickerText}>{wakeUpTime}</Text>
            <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
          </TouchableOpacity>
          
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Observações (salva automaticamente)</Text>
          <TextInput 
            style={[styles.formInput, styles.textArea]} 
            placeholder="Observações da mãe..." 
            value={routineObservations} 
            onChangeText={(text) => {
              setRoutineObservations(text);
              autoSaveRoutineObservations(text);
            }}
            multiline 
            numberOfLines={2} 
            placeholderTextColor={colors.textSecondary} 
          />
          
          {isConsultant && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Comentário da Consultora (salva automaticamente)</Text>
              <TextInput 
                style={[styles.formInput, styles.textArea]} 
                placeholder="Comentários da consultora..." 
                value={routineConsultantComments} 
                onChangeText={(text) => {
                  setRoutineConsultantComments(text);
                  autoSaveRoutineComments(text);
                }}
                multiline 
                numberOfLines={2} 
                placeholderTextColor={colors.textSecondary} 
              />
            </>
          )}
        </View>

        {/* SONECAS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>😴 Sonecas</Text>
          {naps.length < 6 && (
            <TouchableOpacity style={styles.addSmallBtn} onPress={handleAddNap}>
              <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color="#FFF" />
              <Text style={styles.addSmallBtnText}>Adicionar</Text>
            </TouchableOpacity>
          )}
        </View>

        {naps.map((nap, index) => {
          const isExpanded = expandedNaps[nap.napNumber] || false;
          const sleepWindow = nap.startTryTime && nap.wakeUpTime ? calcTimeDiff(nap.startTryTime, nap.wakeUpTime) : null;
          const timeToSleep = nap.startTryTime && nap.fellAsleepTime ? calcTimeDiff(nap.startTryTime, nap.fellAsleepTime) : null;
          const sleepDuration = nap.fellAsleepTime && nap.wakeUpTime ? calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime) : null;
          
          return (
            <View key={nap.id} style={styles.expandableCard}>
              <TouchableOpacity 
                style={styles.expandableHeader} 
                onPress={() => setExpandedNaps({ ...expandedNaps, [nap.napNumber]: !isExpanded })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.expandableTitle}>Soneca {nap.napNumber}</Text>
                  {!isExpanded && nap.fellAsleepTime && nap.wakeUpTime && (
                    <Text style={styles.expandableSubtitle}>
                      {nap.fellAsleepTime} - {nap.wakeUpTime}
                    </Text>
                  )}
                </View>
                <IconSymbol 
                  ios_icon_name={isExpanded ? "chevron.up" : "chevron.down"} 
                  android_material_icon_name={isExpanded ? "expand-less" : "expand-more"} 
                  size={24} 
                  color={colors.primary} 
                />
              </TouchableOpacity>
              
              {isExpanded && (
                <View style={styles.expandableContent}>
                  <Text style={styles.fieldLabel}>Janela de sono - Início</Text>
                  <TouchableOpacity 
                    style={styles.timePickerButton} 
                    onPress={() => openTimePicker("nap_startTryTime", nap.id)}
                  >
                    <Text style={styles.timePickerText}>{nap.startTryTime}</Text>
                    <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  
                  <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Dormiu às</Text>
                  <TouchableOpacity 
                    style={styles.timePickerButton} 
                    onPress={() => openTimePicker("nap_fellAsleepTime", nap.id)}
                  >
                    <Text style={styles.timePickerText}>{nap.fellAsleepTime || "—"}</Text>
                    <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  
                  <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Acordou às</Text>
                  <TouchableOpacity 
                    style={styles.timePickerButton} 
                    onPress={() => openTimePicker("nap_wakeUpTime", nap.id)}
                  >
                    <Text style={styles.timePickerText}>{nap.wakeUpTime || "—"}</Text>
                    <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  
                  {sleepWindow !== null && (
                    <Text style={styles.calcText}>📊 Janela de sono (Total): {minutesToHM(sleepWindow)}</Text>
                  )}
                  
                  {timeToSleep !== null && (
                    <Text style={styles.calcText}>⏱ Em quanto tempo dormiu: {minutesToHM(timeToSleep)}</Text>
                  )}
                  
                  {sleepDuration !== null && (
                    <Text style={styles.calcText}>💤 Quanto tempo dormiu: {minutesToHM(sleepDuration)}</Text>
                  )}
                  
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Dormiu como</Text>
                  <View style={styles.choiceButtons}>
                    {["No colo", "Com embalo", "Mamando", "Sozinho no berço"].map((method) => (
                      <TouchableOpacity 
                        key={method} 
                        style={[styles.choiceBtn, nap.sleepMethod === method && styles.choiceBtnActive]} 
                        onPress={() => handleUpdateNap(nap.id, { sleepMethod: method })}
                      >
                        <Text style={[styles.choiceBtnText, nap.sleepMethod === method && styles.choiceBtnTextActive]}>{method}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Ambiente</Text>
                  <View style={styles.choiceButtons}>
                    {["Adequado", "Parcialmente adequado", "Inadequado"].map((env) => (
                      <TouchableOpacity 
                        key={env} 
                        style={[styles.choiceBtn, nap.environment === env && styles.choiceBtnActive]} 
                        onPress={() => handleUpdateNap(nap.id, { environment: env })}
                      >
                        <Text style={[styles.choiceBtnText, nap.environment === env && styles.choiceBtnTextActive]}>{env}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Como acordou</Text>
                  <View style={styles.choiceButtons}>
                    {["De bom humor", "Sorrindo", "Choroso", "Muito irritado"].map((mood) => (
                      <TouchableOpacity 
                        key={mood} 
                        style={[styles.choiceBtn, nap.wakeUpMood === mood && styles.choiceBtnActive]} 
                        onPress={() => handleUpdateNap(nap.id, { wakeUpMood: mood })}
                      >
                        <Text style={[styles.choiceBtnText, nap.wakeUpMood === mood && styles.choiceBtnTextActive]}>{mood}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Observações (salva automaticamente)</Text>
                  <TextInput 
                    style={[styles.formInput, styles.textArea]} 
                    placeholder="Observações..." 
                    value={napObservations[nap.id] || ""} 
                    onChangeText={(text) => {
                      setNapObservations(prev => ({ ...prev, [nap.id]: text }));
                      autoSaveNapObservations(nap.id, text);
                    }}
                    multiline 
                    numberOfLines={2} 
                    placeholderTextColor={colors.textSecondary} 
                  />
                  
                  {isConsultant && (
                    <>
                      <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Comentários da Consultora (salva automaticamente)</Text>
                      <TextInput 
                        style={[styles.formInput, styles.textArea]} 
                        placeholder="Comentários da consultora..." 
                        value={napConsultantComments[nap.id] || ""} 
                        onChangeText={(text) => {
                          setNapConsultantComments(prev => ({ ...prev, [nap.id]: text }));
                          autoSaveNapComments(nap.id, text);
                        }}
                        multiline 
                        numberOfLines={2} 
                        placeholderTextColor={colors.textSecondary} 
                      />
                    </>
                  )}
                  
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteNap(nap.id)}>
                    <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={18} color="#FFF" />
                    <Text style={styles.deleteBtnText}>Excluir Soneca</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* SONO NOTURNO */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🌙 Sono Noturno</Text>
          {!nightSleep && (
            <TouchableOpacity style={styles.addSmallBtn} onPress={handleAddOrUpdateNightSleep}>
              <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color="#FFF" />
              <Text style={styles.addSmallBtnText}>Adicionar</Text>
            </TouchableOpacity>
          )}
        </View>

        {nightSleep && (
          <View style={styles.expandableCard}>
            <TouchableOpacity 
              style={styles.expandableHeader} 
              onPress={() => setExpandedNightSleep(!expandedNightSleep)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.expandableTitle}>Sono Noturno</Text>
                {!expandedNightSleep && (nightSleep.startTryTime || nightSleep.finalWakeTime) && (
                  <Text style={styles.expandableSubtitle}>
                    {nightSleep.startTryTime || "—"} - {nightSleep.finalWakeTime || "—"}
                  </Text>
                )}
              </View>
              <IconSymbol 
                ios_icon_name={expandedNightSleep ? "chevron.up" : "chevron.down"} 
                android_material_icon_name={expandedNightSleep ? "expand-less" : "expand-more"} 
                size={24} 
                color={colors.primary} 
              />
            </TouchableOpacity>
            
            {expandedNightSleep && (
              <View style={styles.expandableContent}>
                <Text style={styles.fieldLabel}>Início (toque para definir)</Text>
                <TouchableOpacity 
                  style={styles.timePickerButton} 
                  onPress={() => openTimePicker("nightSleep_startTryTime")}
                >
                  <Text style={[styles.timePickerText, !nightSleep.startTryTime && { color: colors.textSecondary }]}>
                    {nightSleep.startTryTime || "—"}
                  </Text>
                  <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
                </TouchableOpacity>
                
                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Dormiu (toque para definir)</Text>
                <TouchableOpacity 
                  style={styles.timePickerButton} 
                  onPress={() => openTimePicker("nightSleep_fellAsleepTime")}
                >
                  <Text style={[styles.timePickerText, !nightSleep.fellAsleepTime && { color: colors.textSecondary }]}>
                    {nightSleep.fellAsleepTime || "—"}
                  </Text>
                  <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
                </TouchableOpacity>
                
                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Acordou (toque para definir)</Text>
                <TouchableOpacity 
                  style={styles.timePickerButton} 
                  onPress={() => openTimePicker("nightSleep_finalWakeTime")}
                >
                  <Text style={[styles.timePickerText, !nightSleep.finalWakeTime && { color: colors.textSecondary }]}>
                    {nightSleep.finalWakeTime || "—"}
                  </Text>
                  <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
                </TouchableOpacity>
                
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Observações (salva automaticamente)</Text>
                <TextInput 
                  style={[styles.formInput, styles.textArea]} 
                  placeholder="Observações..." 
                  value={nightSleepObservations} 
                  onChangeText={(text) => {
                    setNightSleepObservations(text);
                    autoSaveNightSleepObservations(text);
                  }}
                  multiline 
                  numberOfLines={2} 
                  placeholderTextColor={colors.textSecondary} 
                />
                
                {isConsultant && (
                  <>
                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Comentários da Consultora (salva automaticamente)</Text>
                    <TextInput 
                      style={[styles.formInput, styles.textArea]} 
                      placeholder="Comentários da consultora..." 
                      value={nightSleepConsultantComments} 
                      onChangeText={(text) => {
                        setNightSleepConsultantComments(text);
                        autoSaveNightSleepComments(text);
                      }}
                      multiline 
                      numberOfLines={2} 
                      placeholderTextColor={colors.textSecondary} 
                    />
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* DESPERTARES */}
        {nightSleep && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🌜 Despertares</Text>
              <TouchableOpacity style={styles.addSmallBtn} onPress={handleAddWaking}>
                <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color="#FFF" />
                <Text style={styles.addSmallBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>

            {(nightSleep.wakings || []).map((waking, index) => {
              const wakingNumber = index + 1;
              const isExpanded = expandedWakings[wakingNumber] || false;
              const duration = calcTimeDiff(waking.startTime, waking.endTime);
              
              return (
                <View key={waking.id} style={styles.expandableCard}>
                  <TouchableOpacity 
                    style={styles.expandableHeader} 
                    onPress={() => setExpandedWakings({ ...expandedWakings, [wakingNumber]: !isExpanded })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.expandableTitle}>Despertar {wakingNumber}</Text>
                      {!isExpanded && (
                        <Text style={styles.expandableSubtitle}>
                          {waking.startTime} - {waking.endTime}
                        </Text>
                      )}
                    </View>
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
                        onPress={() => openTimePicker("waking_startTime", undefined, waking.id)}
                      >
                        <Text style={styles.timePickerText}>{waking.startTime}</Text>
                        <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
                      </TouchableOpacity>
                      
                      <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Término</Text>
                      <TouchableOpacity 
                        style={styles.timePickerButton} 
                        onPress={() => openTimePicker("waking_endTime", undefined, waking.id)}
                      >
                        <Text style={styles.timePickerText}>{waking.endTime}</Text>
                        <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
                      </TouchableOpacity>
                      
                      <Text style={styles.calcText}>⏱ Duração: {minutesToHM(duration)}</Text>
                      
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteWaking(waking.id)}>
                        <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={18} color="#FFF" />
                        <Text style={styles.deleteBtnText}>Excluir Despertar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {showTimePicker && (
        <>
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
          />
          {Platform.OS === "ios" && (
            <View style={styles.timePickerOverlay}>
              <View style={styles.timePickerContainer}>
                <TouchableOpacity 
                  style={styles.timePickerDoneButton} 
                  onPress={() => setShowTimePicker(false)}
                >
                  <Text style={styles.timePickerDoneText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Orientations Screen ──────────────────────────────────────────────────────

function OrientationsScreen({ isConsultant, baby, onBack, showErr }: { isConsultant: boolean; baby: Baby; onBack: () => void; showErr: (m: string) => void }) {
  const [orientations, setOrientations] = useState<Orientation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<Orientation | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [text, setText] = useState("");
  const [results, setResults] = useState("");

  const loadOrientations = useCallback(async () => {
    try {
      console.log("[API] Loading orientations for baby:", baby.id);
      const data = await apiGet<Orientation[]>(`/api/orientations/baby/${baby.id}`);
      setOrientations(data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (error: any) {
      showErr(error.message || "Erro ao carregar orientações");
    } finally {
      setLoading(false);
    }
  }, [baby.id]);

  useEffect(() => { loadOrientations(); }, [loadOrientations]);

  const handleAdd = async () => {
    if (!date || !text) { showErr("Preencha data e orientação"); return; }
    setAddLoading(true);
    try {
      console.log("[API] Creating orientation for baby:", baby.id);
      await apiPost("/api/orientations", { babyId: baby.id, date, orientationText: text, results: results || null });
      setShowAdd(false);
      setDate(new Date().toISOString().split("T")[0]); setText(""); setResults("");
      loadOrientations();
    } catch (error: any) {
      showErr(error.message || "Erro ao criar orientação");
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!showEdit) return;
    setAddLoading(true);
    try {
      console.log("[API] Updating orientation:", showEdit.id);
      await apiPut(`/api/orientations/${showEdit.id}`, { orientationText: text, results: results || null });
      setShowEdit(null);
      loadOrientations();
    } catch (error: any) {
      showErr(error.message || "Erro ao atualizar orientação");
    } finally {
      setAddLoading(false);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: `Orientações - ${baby.name}`, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerLeft: () => (
        <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}><IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} /></TouchableOpacity>
      )}} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Orientações</Text>
          {isConsultant && (
            <TouchableOpacity style={styles.addSmallBtn} onPress={() => { setDate(new Date().toISOString().split("T")[0]); setText(""); setResults(""); setShowAdd(true); }}>
              <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color="#FFF" />
              <Text style={styles.addSmallBtnText}>Nova</Text>
            </TouchableOpacity>
          )}
        </View>
        {orientations.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyStateText}>Nenhuma orientação registrada</Text></View>
        ) : (
          orientations.map((o) => (
            <View key={o.id} style={styles.orientationCard}>
              <View style={styles.orientationHeader}>
                <Text style={styles.orientationDate}>{formatDateToBR(o.date)}</Text>
                {isConsultant && (
                  <TouchableOpacity onPress={() => { setText(o.orientationText); setResults(o.results || ""); setShowEdit(o); }}>
                    <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.orientationText}>{o.orientationText}</Text>
              {o.results && <View style={styles.resultsBox}><Text style={styles.resultsLabel}>Resultados:</Text><Text style={styles.resultsText}>{o.results}</Text></View>}
            </View>
          ))
        )}
      </ScrollView>

      {isConsultant && (
        <>
          <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
            <View style={styles.slideModalOverlay}>
              <View style={styles.slideModalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Nova Orientação</Text>
                  <TouchableOpacity onPress={() => setShowAdd(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
                </View>
                <TextInput style={styles.formInput} placeholder="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
                <TextInput style={[styles.formInput, styles.textArea]} placeholder="Orientação *" value={text} onChangeText={setText} multiline numberOfLines={4} placeholderTextColor={colors.textSecondary} />
                <TextInput style={[styles.formInput, styles.textArea]} placeholder="Resultados..." value={results} onChangeText={setResults} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
                <TouchableOpacity style={[styles.addButton, addLoading && { opacity: 0.6 }]} onPress={handleAdd} disabled={addLoading}>
                  {addLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={!!showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(null)}>
            <View style={styles.slideModalOverlay}>
              <View style={styles.slideModalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Editar Orientação</Text>
                  <TouchableOpacity onPress={() => setShowEdit(null)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
                </View>
                <TextInput style={[styles.formInput, styles.textArea]} placeholder="Orientação *" value={text} onChangeText={setText} multiline numberOfLines={4} placeholderTextColor={colors.textSecondary} />
                <TextInput style={[styles.formInput, styles.textArea]} placeholder="Resultados..." value={results} onChangeText={setResults} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
                <TouchableOpacity style={[styles.addButton, addLoading && { opacity: 0.6 }]} onPress={handleEdit} disabled={addLoading}>
                  {addLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Reports Screen ───────────────────────────────────────────────────────────

function ReportsScreen({ baby, onBack, showErr }: { baby: Baby; onBack: () => void; showErr: (m: string) => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[API] Loading report for baby:", baby.id);
      const data = await apiGet<Report>(`/api/reports/baby/${baby.id}?startDate=${startDate}&endDate=${endDate}`);
      setReport(data);
    } catch (error: any) {
      showErr(error.message || "Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  }, [baby.id, startDate, endDate]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const getIndicatorColor = (indicator: string) => {
    if (indicator === "green") return colors.statusGood;
    if (indicator === "yellow") return colors.statusMedium;
    return colors.statusPoor;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: `Acompanhamento - ${baby.name}`, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerLeft: () => (
        <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}><IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} /></TouchableOpacity>
      )}} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <Text style={styles.formSectionTitle}>Período</Text>
          <View style={styles.dateRow}>
            <TextInput style={[styles.formInput, { flex: 1, marginRight: 8 }]} placeholder="Início (AAAA-MM-DD)" value={startDate} onChangeText={setStartDate} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            <TextInput style={[styles.formInput, { flex: 1 }]} placeholder="Fim (AAAA-MM-DD)" value={endDate} onChangeText={setEndDate} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
          </View>
          <TouchableOpacity style={styles.addButton} onPress={loadReport}>
            <Text style={styles.addButtonText}>Atualizar Relatório</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : report ? (
          <>
            <View style={styles.reportSummary}>
              <Text style={styles.reportSummaryTitle}>Resumo do Período</Text>
              <View style={styles.reportGrid}>
                <View style={styles.reportGridItem}>
                  <Text style={styles.reportGridValue}>{minutesToHM(report.totalDaytimeSleep)}</Text>
                  <Text style={styles.reportGridLabel}>Sono Diurno Total</Text>
                </View>
                <View style={styles.reportGridItem}>
                  <Text style={styles.reportGridValue}>{minutesToHM(report.totalNetNighttimeSleep)}</Text>
                  <Text style={styles.reportGridLabel}>Sono Noturno Líquido</Text>
                </View>
                <View style={styles.reportGridItem}>
                  <Text style={styles.reportGridValue}>{minutesToHM(report.totalSleepIn24h)}</Text>
                  <Text style={styles.reportGridLabel}>Total em 24h</Text>
                </View>
                <View style={styles.reportGridItem}>
                  <Text style={styles.reportGridValue}>{minutesToHM(Math.round(report.weeklyAverage))}</Text>
                  <Text style={styles.reportGridLabel}>Média Semanal</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Evolução Diária</Text>
            {report.dailyEvolution.map((day) => (
              <View key={day.date} style={[styles.reportDayCard, { borderLeftColor: getIndicatorColor(day.indicator), borderLeftWidth: 4 }]}>
                <View style={styles.reportDayHeader}>
                  <Text style={styles.reportDayDate}>{formatDateToBR(day.date)}</Text>
                  <View style={[styles.indicatorDot, { backgroundColor: getIndicatorColor(day.indicator) }]} />
                </View>
                <View style={styles.reportDayStats}>
                  <Text style={styles.reportDayStat}>☀️ {minutesToHM(day.daytimeSleep)}</Text>
                  <Text style={styles.reportDayStat}>🌙 {minutesToHM(day.netNighttimeSleep)}</Text>
                  <Text style={styles.reportDayStat}>📊 {minutesToHM(day.total24h)}</Text>
                </View>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}><Text style={styles.emptyStateText}>Nenhum dado disponível</Text></View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  header: { marginBottom: 24 },
  greeting: { fontSize: 28, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 16, color: colors.textSecondary },
  welcomeCard: { backgroundColor: colors.card, borderRadius: 20, padding: 24, marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  welcomeIcon: { alignSelf: "center", marginBottom: 16 },
  welcomeTitle: { fontSize: 22, fontWeight: "bold", color: colors.text, textAlign: "center", marginBottom: 12 },
  welcomeText: { fontSize: 16, color: colors.textSecondary, textAlign: "center", lineHeight: 24, marginBottom: 12 },
  motherInfoBox: { backgroundColor: colors.backgroundAlt, borderRadius: 12, padding: 12, marginTop: 8 },
  motherInfoText: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 20, fontStyle: "italic" },
  babiesList: { gap: 12 },
  babyCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  babyCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  babyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", marginRight: 12 },
  babyInfo: { flex: 1 },
  babyName: { fontSize: 18, fontWeight: "bold", color: colors.text, marginBottom: 2 },
  motherName: { fontSize: 14, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  babyCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  ageContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
  ageText: { fontSize: 14, color: colors.textSecondary },
  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: 16, padding: 16, marginTop: 16, gap: 8 },
  addButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyStateText: { fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 8 },
  emptyStateSubtext: { fontSize: 14, color: colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  slideModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  slideModalContent: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "90%" },
  centeredModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  centeredModalContent: { backgroundColor: colors.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, alignItems: "center" },
  modalContent: { backgroundColor: colors.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: colors.text },
  modalMessage: { fontSize: 16, color: colors.textSecondary, marginBottom: 16, textAlign: "center" },
  modalButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, alignItems: "center", marginTop: 8, width: "100%" },
  modalButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  modalHint: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginBottom: 8, fontStyle: "italic" },
  successIcon: { marginBottom: 16 },
  formSectionTitle: { fontSize: 15, fontWeight: "bold", color: colors.text, marginTop: 8, marginBottom: 6 },
  formInput: { backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text },
  textArea: { height: 80, textAlignVertical: "top" },
  tokenBox: { backgroundColor: colors.background, borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 2, borderColor: colors.primary, width: "100%" },
  tokenText: { fontSize: 32, color: colors.primary, fontWeight: "bold", textAlign: "center", letterSpacing: 4 },
  copyButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginBottom: 16, gap: 8, width: "100%" },
  copyButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  roleButtons: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  roleButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", minWidth: 80 },
  roleButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  roleButtonText: { fontSize: 13, fontWeight: "600", color: colors.text },
  roleButtonTextActive: { color: "#FFFFFF" },
  datePickerButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    backgroundColor: colors.background, 
    borderRadius: 10, 
    padding: 12, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: colors.border 
  },
  datePickerText: { fontSize: 15, color: colors.text, flex: 1 },
  datePickerDoneButton: { 
    backgroundColor: colors.primary, 
    borderRadius: 10, 
    padding: 12, 
    alignItems: "center", 
    marginBottom: 10 
  },
  datePickerDoneText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  infoCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  infoCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  infoCardTitle: { fontSize: 20, fontWeight: "bold", color: colors.text },
  infoCardSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  infoCardText: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  editBtn: { padding: 8, backgroundColor: colors.background, borderRadius: 8 },
  contractCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2 },
  contractCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  contractCardTitle: { fontSize: 16, fontWeight: "bold", color: colors.text, flex: 1 },
  contractCardText: { fontSize: 14, color: colors.textSecondary },
  quickActions: { flexDirection: "row", gap: 12, marginBottom: 16 },
  quickActionBtn: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 16, alignItems: "center", gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  quickActionText: { fontSize: 14, fontWeight: "600", color: colors.text },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: colors.text },
  addSmallBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  addSmallBtnText: { fontSize: 13, fontWeight: "600", color: "#FFF" },
  routineCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  routineCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  routineDayNumber: { fontSize: 18, fontWeight: "bold", color: colors.primary },
  routineDate: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  routineStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  routineStatusText: { fontSize: 11, fontWeight: "600", color: "#FFF" },
  routineComment: { fontSize: 13, color: colors.text, marginTop: 4, fontStyle: "italic" },
  sectionCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  sectionCardTitle: { fontSize: 18, fontWeight: "bold", color: colors.text, marginBottom: 12 },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  fieldValue: { fontSize: 15, fontWeight: "bold", color: colors.text },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", marginTop: 8 },
  saveBtnText: { fontSize: 14, fontWeight: "600", color: "#FFF" },
  expandableCard: { backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  expandableHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  expandableTitle: { fontSize: 16, fontWeight: "bold", color: colors.text },
  expandableSubtitle: { fontSize: 13, color: colors.textSecondary, fontWeight: "normal" },
  expandableContent: { padding: 14, paddingTop: 0 },
  timePickerButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    backgroundColor: colors.background, 
    borderRadius: 10, 
    padding: 12, 
    marginTop: 6,
    marginBottom: 6,
    borderWidth: 1, 
    borderColor: colors.border 
  },
  timePickerText: { fontSize: 16, color: colors.text, fontWeight: "600" },
  calcText: { fontSize: 13, color: colors.primary, marginTop: 6, fontWeight: "600" },
  choiceButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  choiceBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.background },
  choiceBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  choiceBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
  choiceBtnTextActive: { color: "#FFF" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.error, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, marginTop: 12, gap: 6 },
  deleteBtnText: { fontSize: 14, fontWeight: "600", color: "#FFF" },
  wakingCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  wakingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  wakingTitle: { fontSize: 15, fontWeight: "bold", color: colors.text },
  orientationCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  orientationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  orientationDate: { fontSize: 14, fontWeight: "bold", color: colors.primary },
  orientationText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  resultsBox: { marginTop: 10, backgroundColor: colors.background, borderRadius: 8, padding: 10 },
  resultsLabel: { fontSize: 12, fontWeight: "bold", color: colors.textSecondary, marginBottom: 4 },
  resultsText: { fontSize: 14, color: colors.text },
  reportSummary: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  reportSummaryTitle: { fontSize: 18, fontWeight: "bold", color: colors.text, marginBottom: 12 },
  reportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  reportGridItem: { flex: 1, minWidth: "45%", backgroundColor: colors.background, borderRadius: 12, padding: 12, alignItems: "center" },
  reportGridValue: { fontSize: 20, fontWeight: "bold", color: colors.primary },
  reportGridLabel: { fontSize: 12, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  reportDayCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8 },
  reportDayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  reportDayDate: { fontSize: 15, fontWeight: "bold", color: colors.text },
  indicatorDot: { width: 12, height: 12, borderRadius: 6 },
  reportDayStats: { flexDirection: "row", gap: 16 },
  reportDayStat: { fontSize: 13, color: colors.textSecondary },
  dateRow: { flexDirection: "row", gap: 8 },
  timePickerOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.card, padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  timePickerContainer: { alignItems: "center" },
});

export default HomeScreen;
