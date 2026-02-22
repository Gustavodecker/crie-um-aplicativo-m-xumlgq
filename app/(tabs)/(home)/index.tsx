
import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";

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

// ─── Helper Functions ─────────────────────────────────────────────────────────

function minutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}m`;
}

function calcTimeDiff(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // overnight
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

function getSleepMethodLabel(m: string | null) {
  const map: Record<string, string> = { colo: "Colo", embalo: "Embalo", mamando: "Mamando", sozinho_berco: "Sozinho no berço" };
  return m ? (map[m] || m) : "-";
}

function getEnvironmentLabel(e: string | null) {
  const map: Record<string, string> = { adequado: "Adequado", parcialmente_adequado: "Parcialmente adequado", inadequado: "Inadequado" };
  return e ? (map[e] || e) : "-";
}

function getMoodLabel(m: string | null) {
  const map: Record<string, string> = { bom_humor: "Bom humor", sorrindo: "Sorrindo", choroso: "Choroso", muito_irritado: "Muito irritado" };
  return m ? (map[m] || m) : "-";
}

// ─── Screen Types ─────────────────────────────────────────────────────────────

type Screen = 
  | { type: "list" }
  | { type: "baby"; baby: Baby }
  | { type: "routine"; baby: Baby; routine: Routine }
  | { type: "orientations"; baby: Baby }
  | { type: "reports"; baby: Baby };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [screen, setScreen] = useState<Screen>({ type: "list" });
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);

  const showErr = (msg: string) => { setErrorMessage(msg); setShowError(true); };

  const renderScreen = () => {
    switch (screen.type) {
      case "list": return <BabiesListScreen onSelectBaby={(b) => setScreen({ type: "baby", baby: b })} showErr={showErr} />;
      case "baby": return <BabyDetailScreen baby={screen.baby} onBack={() => setScreen({ type: "list" })} onOpenRoutine={(r) => setScreen({ type: "routine", baby: screen.baby, routine: r })} onOpenOrientations={() => setScreen({ type: "orientations", baby: screen.baby })} onOpenReports={() => setScreen({ type: "reports", baby: screen.baby })} showErr={showErr} />;
      case "routine": return <RoutineDetailScreen baby={screen.baby} routine={screen.routine} onBack={() => setScreen({ type: "baby", baby: screen.baby })} showErr={showErr} />;
      case "orientations": return <OrientationsScreen baby={screen.baby} onBack={() => setScreen({ type: "baby", baby: screen.baby })} showErr={showErr} />;
      case "reports": return <ReportsScreen baby={screen.baby} onBack={() => setScreen({ type: "baby", baby: screen.baby })} showErr={showErr} />;
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

function BabiesListScreen({ onSelectBaby, showErr }: { onSelectBaby: (b: Baby) => void; showErr: (m: string) => void }) {
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
  const [createdBabyId, setCreatedBabyId] = useState("");

  const loadBabies = useCallback(async () => {
    console.log("[API] Loading babies for consultant");
    try {
      const data = await apiGet<Baby[]>("/api/consultant/babies");
      console.log("[API] Babies loaded:", data.length);
      setBabies(data);
    } catch (error: any) {
      console.error("Error loading babies:", error);
      showErr(error.message || "Erro ao carregar bebês");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadBabies(); }, [loadBabies]);

  const handleAddBaby = async () => {
    if (!babyName || !birthDate || !motherName || !motherPhone || !motherEmail) {
      showErr("Por favor, preencha todos os campos obrigatórios"); return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      showErr("Data inválida. Use AAAA-MM-DD"); return;
    }
    setAddLoading(true);
    try {
      console.log("[API] Creating baby:", babyName);
      const baby = await apiPost<{ id: string }>("/api/babies", { name: babyName, birthDate, motherName, motherPhone, motherEmail, objectives: objectives || null });
      console.log("[API] Baby created:", baby.id);
      setCreatedBabyId(baby.id);
      setShowAddBaby(false);
      setShowSuccessModal(true);
      setBabyName(""); setBirthDate(""); setMotherName(""); setMotherPhone(""); setMotherEmail(""); setObjectives("");
      loadBabies();
    } catch (error: any) {
      showErr(error.message || "Erro ao cadastrar bebê");
    } finally {
      setAddLoading(false);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: "Meus Bebês", headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBabies(); }} />}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Olá, Consultora! 👋</Text>
          <Text style={styles.subtitle}>{babies.length} bebê{babies.length !== 1 ? "s" : ""} cadastrado{babies.length !== 1 ? "s" : ""}</Text>
        </View>

        {babies.length === 0 && (
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIcon}>
              <IconSymbol ios_icon_name="moon.stars.fill" android_material_icon_name="bedtime" size={48} color={colors.primary} />
            </View>
            <Text style={styles.welcomeTitle}>Bem-vinda ao seu Consultório de Sono! 🌙</Text>
            <Text style={styles.welcomeText}>
              Comece cadastrando seu primeiro bebê para iniciar o acompanhamento de rotina de sono.
            </Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={20} color={colors.statusGood} />
                <Text style={styles.featureText}>Cadastro completo de bebês e contratos</Text>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={20} color={colors.statusGood} />
                <Text style={styles.featureText}>Registro de rotinas diárias (sonecas e sono noturno)</Text>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={20} color={colors.statusGood} />
                <Text style={styles.featureText}>Orientações personalizadas para cada bebê</Text>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={20} color={colors.statusGood} />
                <Text style={styles.featureText}>Relatórios e gráficos de evolução</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.babiesList}>
          {babies.map((baby) => {
            const contractStatus = baby.activeContract?.status || "completed";
            return (
              <TouchableOpacity key={baby.id} style={styles.babyCard} onPress={() => { console.log("Tapped baby:", baby.name); onSelectBaby(baby); }}>
                <View style={styles.babyCardHeader}>
                  <View style={styles.babyIcon}><IconSymbol ios_icon_name="person.fill" android_material_icon_name="child-care" size={24} color={colors.primary} /></View>
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
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddBaby(true)}>
          <IconSymbol ios_icon_name="plus.circle.fill" android_material_icon_name="add-circle" size={24} color="#FFF" />
          <Text style={styles.addButtonText}>Cadastrar Novo Bebê</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showAddBaby} transparent animationType="slide" onRequestClose={() => setShowAddBaby(false)}>
        <View style={styles.slideModalOverlay}>
          <View style={styles.slideModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cadastrar Bebê</Text>
              <TouchableOpacity onPress={() => setShowAddBaby(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.formSectionTitle}>Dados do Bebê</Text>
              <TextInput style={styles.formInput} placeholder="Nome do bebê *" value={babyName} onChangeText={setBabyName} autoCapitalize="words" placeholderTextColor={colors.textSecondary} />
              <TextInput style={styles.formInput} placeholder="Nascimento * (AAAA-MM-DD)" value={birthDate} onChangeText={setBirthDate} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.formSectionTitle}>Dados da Mãe</Text>
              <TextInput style={styles.formInput} placeholder="Nome da mãe *" value={motherName} onChangeText={setMotherName} autoCapitalize="words" placeholderTextColor={colors.textSecondary} />
              <TextInput style={styles.formInput} placeholder="Telefone *" value={motherPhone} onChangeText={setMotherPhone} keyboardType="phone-pad" placeholderTextColor={colors.textSecondary} />
              <TextInput style={styles.formInput} placeholder="E-mail *" value={motherEmail} onChangeText={setMotherEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.formSectionTitle}>Objetivos</Text>
              <TextInput style={[styles.formInput, styles.textArea]} placeholder="Objetivos do acompanhamento..." value={objectives} onChangeText={setObjectives} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
              <TouchableOpacity style={[styles.addButton, addLoading && { opacity: 0.6 }]} onPress={handleAddBaby} disabled={addLoading}>
                {addLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Cadastrar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <View style={styles.centeredModalOverlay}>
          <View style={styles.centeredModalContent}>
            <View style={styles.successIcon}>
              <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={64} color={colors.statusGood} />
            </View>
            <Text style={styles.modalTitle}>✅ Bebê Cadastrado!</Text>
            <Text style={styles.modalMessage}>Compartilhe este ID com a mãe para que ela possa fazer login e preencher as rotinas:</Text>
            <View style={styles.idBox}><Text style={styles.idText}>{createdBabyId}</Text></View>
            <Text style={styles.modalHint}>💡 A mãe deve criar uma conta e usar este ID durante o cadastro</Text>
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

function BabyDetailScreen({ baby, onBack, onOpenRoutine, onOpenOrientations, onOpenReports, showErr }: {
  baby: Baby; onBack: () => void; onOpenRoutine: (r: Routine) => void;
  onOpenOrientations: () => void; onOpenReports: () => void; showErr: (m: string) => void;
}) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [contract, setContract] = useState<Contract | null>(baby.activeContract);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showEditBaby, setShowEditBaby] = useState(false);
  const [addRoutineLoading, setAddRoutineLoading] = useState(false);
  const [routineDate, setRoutineDate] = useState(new Date().toISOString().split("T")[0]);
  const [routineWakeTime, setRoutineWakeTime] = useState("07:00");
  const [routineObs, setRoutineObs] = useState("");
  // Contract form
  const [contractStartDate, setContractStartDate] = useState(contract?.startDate || new Date().toISOString().split("T")[0]);
  const [contractDuration, setContractDuration] = useState(String(contract?.durationDays || 21));
  const [contractStatus, setContractStatus] = useState(contract?.status || "active");
  const [contractLoading, setContractLoading] = useState(false);
  // Edit baby
  const [editName, setEditName] = useState(baby.name);
  const [editObjectives, setEditObjectives] = useState(baby.objectives || "");
  const [editConclusion, setEditConclusion] = useState(baby.conclusion || "");
  const [editLoading, setEditLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      console.log("[API] Loading routines for baby:", baby.id);
      const [routinesData, contractData] = await Promise.all([
        apiGet<Routine[]>(`/api/routines/baby/${baby.id}`),
        apiGet<Contract | null>(`/api/contracts/baby/${baby.id}`),
      ]);
      setRoutines(routinesData.sort((a, b) => b.date.localeCompare(a.date)));
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

  const handleAddRoutine = async () => {
    if (!routineDate || !routineWakeTime) { showErr("Preencha data e horário de acordar"); return; }
    setAddRoutineLoading(true);
    try {
      console.log("[API] Creating routine for baby:", baby.id);
      const routine = await apiPost<Routine>("/api/routines", { babyId: baby.id, date: routineDate, wakeUpTime: routineWakeTime, motherObservations: routineObs || null });
      console.log("[API] Routine created:", routine.id);
      setShowAddRoutine(false);
      setRoutineDate(new Date().toISOString().split("T")[0]);
      setRoutineWakeTime("07:00");
      setRoutineObs("");
      loadData();
    } catch (error: any) {
      showErr(error.message || "Erro ao criar rotina");
    } finally {
      setAddRoutineLoading(false);
    }
  };

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

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const contractActive = contract?.status === "active";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: baby.name, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerLeft: () => (
        <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}><IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} /></TouchableOpacity>
      )}} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
        
        {/* Baby Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <View>
              <Text style={styles.infoCardTitle}>{baby.name}</Text>
              <Text style={styles.infoCardSubtitle}>{baby.ageMonths}m {baby.ageDays}d • {baby.motherName}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => setShowEditBaby(true)}>
              <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {baby.objectives && <Text style={styles.infoCardText}>🎯 {baby.objectives}</Text>}
          {baby.conclusion && <Text style={styles.infoCardText}>✅ {baby.conclusion}</Text>}
        </View>

        {/* Contract Card */}
        <TouchableOpacity style={[styles.contractCard, { borderColor: contract ? getStatusColor(contract.status) : colors.border }]} onPress={() => { setContractStartDate(contract?.startDate || new Date().toISOString().split("T")[0]); setContractDuration(String(contract?.durationDays || 21)); setContractStatus(contract?.status || "active"); setShowContractModal(true); }}>
          <View style={styles.contractCardHeader}>
            <IconSymbol ios_icon_name="doc.text.fill" android_material_icon_name="description" size={20} color={contract ? getStatusColor(contract.status) : colors.textSecondary} />
            <Text style={styles.contractCardTitle}>Contrato</Text>
            {contract && <View style={[styles.statusBadge, { backgroundColor: getStatusColor(contract.status) }]}><Text style={styles.statusText}>{getStatusText(contract.status)}</Text></View>}
          </View>
          {contract ? (
            <Text style={styles.contractCardText}>Início: {contract.startDate} • {contract.durationDays} dias</Text>
          ) : (
            <Text style={styles.contractCardText}>Toque para adicionar contrato</Text>
          )}
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenOrientations}>
            <IconSymbol ios_icon_name="list.bullet.clipboard.fill" android_material_icon_name="assignment" size={24} color={colors.primary} />
            <Text style={styles.quickActionText}>Orientações</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={onOpenReports}>
            <IconSymbol ios_icon_name="chart.bar.fill" android_material_icon_name="bar-chart" size={24} color={colors.secondary} />
            <Text style={styles.quickActionText}>Relatórios</Text>
          </TouchableOpacity>
        </View>

        {/* Routines Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rotinas Diárias</Text>
          {contractActive && (
            <TouchableOpacity style={styles.addSmallBtn} onPress={() => setShowAddRoutine(true)}>
              <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color="#FFF" />
              <Text style={styles.addSmallBtnText}>Nova</Text>
            </TouchableOpacity>
          )}
        </View>

        {routines.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyStateText}>Nenhuma rotina registrada</Text></View>
        ) : (
          routines.map((routine) => (
            <TouchableOpacity key={routine.id} style={styles.routineCard} onPress={() => { console.log("Opening routine:", routine.id); onOpenRoutine(routine); }}>
              <View style={styles.routineCardHeader}>
                <Text style={styles.routineDate}>{routine.date}</Text>
                <Text style={styles.routineWakeTime}>Acordou: {routine.wakeUpTime}</Text>
              </View>
              {routine.consultantComments && <Text style={styles.routineComment} numberOfLines={1}>💬 {routine.consultantComments}</Text>}
              <View style={{ alignItems: "flex-end", marginTop: 4 }}>
                <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={18} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add Routine Modal */}
      <Modal visible={showAddRoutine} transparent animationType="slide" onRequestClose={() => setShowAddRoutine(false)}>
        <View style={styles.slideModalOverlay}>
          <View style={styles.slideModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Rotina</Text>
              <TouchableOpacity onPress={() => setShowAddRoutine(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
            </View>
            <TextInput style={styles.formInput} placeholder="Data (AAAA-MM-DD)" value={routineDate} onChangeText={setRoutineDate} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            <TextInput style={styles.formInput} placeholder="Horário que acordou (HH:MM)" value={routineWakeTime} onChangeText={setRoutineWakeTime} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            <TextInput style={[styles.formInput, styles.textArea]} placeholder="Observações da mãe..." value={routineObs} onChangeText={setRoutineObs} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
            <TouchableOpacity style={[styles.addButton, addRoutineLoading && { opacity: 0.6 }]} onPress={handleAddRoutine} disabled={addRoutineLoading}>
              {addRoutineLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Criar Rotina</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contract Modal */}
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

      {/* Edit Baby Modal */}
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
    </SafeAreaView>
  );
}

// ─── Routine Detail Screen ────────────────────────────────────────────────────

function RoutineDetailScreen({ baby, routine: initialRoutine, onBack, showErr }: {
  baby: Baby; routine: Routine; onBack: () => void; showErr: (m: string) => void;
}) {
  const [routine, setRoutine] = useState<Routine>(initialRoutine);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consultantComments, setConsultantComments] = useState(initialRoutine.consultantComments || "");
  const [showAddNap, setShowAddNap] = useState(false);
  const [showAddNightSleep, setShowAddNightSleep] = useState(false);
  const [showAddWaking, setShowAddWaking] = useState(false);
  const [napLoading, setNapLoading] = useState(false);
  const [nightSleepLoading, setNightSleepLoading] = useState(false);
  const [wakingLoading, setWakingLoading] = useState(false);
  // Nap form
  const [napNumber, setNapNumber] = useState("1");
  const [napStartTry, setNapStartTry] = useState("");
  const [napFellAsleep, setNapFellAsleep] = useState("");
  const [napWakeUp, setNapWakeUp] = useState("");
  const [napMethod, setNapMethod] = useState("");
  const [napEnv, setNapEnv] = useState("");
  const [napMood, setNapMood] = useState("");
  const [napObs, setNapObs] = useState("");
  // Night sleep form
  const [nsStartTry, setNsStartTry] = useState("");
  const [nsFellAsleep, setNsFellAsleep] = useState("");
  const [nsFinalWake, setNsFinalWake] = useState("");
  const [nsMethod, setNsMethod] = useState("");
  const [nsEnv, setNsEnv] = useState("");
  const [nsMood, setNsMood] = useState("");
  const [nsObs, setNsObs] = useState("");
  // Night waking form
  const [wakingStart, setWakingStart] = useState("");
  const [wakingEnd, setWakingEnd] = useState("");

  const loadRoutine = useCallback(async () => {
    try {
      console.log("[API] Loading routine:", initialRoutine.id);
      const data = await apiGet<Routine>(`/api/routines/${initialRoutine.id}`);
      setRoutine(data);
      setConsultantComments(data.consultantComments || "");
    } catch (error: any) {
      showErr(error.message || "Erro ao carregar rotina");
    } finally {
      setLoading(false);
    }
  }, [initialRoutine.id]);

  useEffect(() => { loadRoutine(); }, [loadRoutine]);

  const handleSaveComments = async () => {
    setSaving(true);
    try {
      console.log("[API] Saving consultant comments for routine:", routine.id);
      await apiPut(`/api/routines/${routine.id}`, { consultantComments });
      loadRoutine();
    } catch (error: any) {
      showErr(error.message || "Erro ao salvar comentários");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNap = async () => {
    if (!napStartTry) { showErr("Informe o horário de início da tentativa"); return; }
    setNapLoading(true);
    try {
      console.log("[API] Adding nap to routine:", routine.id);
      await apiPost("/api/naps", { routineId: routine.id, napNumber: parseInt(napNumber), startTryTime: napStartTry, fellAsleepTime: napFellAsleep || null, wakeUpTime: napWakeUp || null, sleepMethod: napMethod || null, environment: napEnv || null, wakeUpMood: napMood || null, observations: napObs || null });
      setShowAddNap(false);
      setNapNumber("1"); setNapStartTry(""); setNapFellAsleep(""); setNapWakeUp(""); setNapMethod(""); setNapEnv(""); setNapMood(""); setNapObs("");
      loadRoutine();
    } catch (error: any) {
      showErr(error.message || "Erro ao adicionar soneca");
    } finally {
      setNapLoading(false);
    }
  };

  const handleDeleteNap = async (napId: string) => {
    try {
      console.log("[API] Deleting nap:", napId);
      await apiDelete(`/api/naps/${napId}`);
      loadRoutine();
    } catch (error: any) {
      showErr(error.message || "Erro ao excluir soneca");
    }
  };

  const handleAddNightSleep = async () => {
    if (!nsStartTry) { showErr("Informe o horário de início"); return; }
    setNightSleepLoading(true);
    try {
      console.log("[API] Adding night sleep to routine:", routine.id);
      if (routine.nightSleep) {
        await apiPut(`/api/night-sleep/${routine.nightSleep.id}`, { startTryTime: nsStartTry, fellAsleepTime: nsFellAsleep || null, finalWakeTime: nsFinalWake || null, sleepMethod: nsMethod || null, environment: nsEnv || null, wakeUpMood: nsMood || null, observations: nsObs || null });
      } else {
        await apiPost("/api/night-sleep", { routineId: routine.id, startTryTime: nsStartTry, fellAsleepTime: nsFellAsleep || null, finalWakeTime: nsFinalWake || null, sleepMethod: nsMethod || null, environment: nsEnv || null, wakeUpMood: nsMood || null, observations: nsObs || null });
      }
      setShowAddNightSleep(false);
      loadRoutine();
    } catch (error: any) {
      showErr(error.message || "Erro ao salvar sono noturno");
    } finally {
      setNightSleepLoading(false);
    }
  };

  const handleAddWaking = async () => {
    if (!wakingStart || !wakingEnd || !routine.nightSleep) { showErr("Preencha os horários do despertar"); return; }
    setWakingLoading(true);
    try {
      console.log("[API] Adding night waking");
      await apiPost("/api/night-wakings", { nightSleepId: routine.nightSleep.id, startTime: wakingStart, endTime: wakingEnd });
      setShowAddWaking(false);
      setWakingStart(""); setWakingEnd("");
      loadRoutine();
    } catch (error: any) {
      showErr(error.message || "Erro ao adicionar despertar");
    } finally {
      setWakingLoading(false);
    }
  };

  const handleDeleteWaking = async (wakingId: string) => {
    try {
      console.log("[API] Deleting night waking:", wakingId);
      await apiDelete(`/api/night-wakings/${wakingId}`);
      loadRoutine();
    } catch (error: any) {
      showErr(error.message || "Erro ao excluir despertar");
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const naps = routine.naps || [];
  const nightSleep = routine.nightSleep;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: `Rotina ${routine.date}`, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerLeft: () => (
        <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}><IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} /></TouchableOpacity>
      )}} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Wake up time */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>☀️ Acordou às {routine.wakeUpTime}</Text>
          {routine.motherObservations && <Text style={styles.infoCardText}>Obs: {routine.motherObservations}</Text>}
        </View>

        {/* Consultant Comments */}
        <View style={styles.infoCard}>
          <Text style={styles.formSectionTitle}>💬 Comentários da Consultora</Text>
          <TextInput style={[styles.formInput, styles.textArea]} placeholder="Adicione comentários..." value={consultantComments} onChangeText={setConsultantComments} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
          <TouchableOpacity style={[styles.addButton, saving && { opacity: 0.6 }]} onPress={handleSaveComments} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Salvar Comentários</Text>}
          </TouchableOpacity>
        </View>

        {/* Naps Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>😴 Sonecas ({naps.length})</Text>
          {naps.length < 6 && (
            <TouchableOpacity style={styles.addSmallBtn} onPress={() => { setNapNumber(String(naps.length + 1)); setShowAddNap(true); }}>
              <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color="#FFF" />
              <Text style={styles.addSmallBtnText}>Adicionar</Text>
            </TouchableOpacity>
          )}
        </View>

        {naps.map((nap) => {
          const sleepDuration = nap.fellAsleepTime && nap.wakeUpTime ? calcTimeDiff(nap.fellAsleepTime, nap.wakeUpTime) : null;
          const timeToSleep = nap.startTryTime && nap.fellAsleepTime ? calcTimeDiff(nap.startTryTime, nap.fellAsleepTime) : null;
          return (
            <View key={nap.id} style={styles.napCard}>
              <View style={styles.napCardHeader}>
                <Text style={styles.napTitle}>Soneca {nap.napNumber}</Text>
                <TouchableOpacity onPress={() => handleDeleteNap(nap.id)}>
                  <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
              <View style={styles.napTimes}>
                <Text style={styles.napTimeText}>Tentativa: {nap.startTryTime}</Text>
                {nap.fellAsleepTime && <Text style={styles.napTimeText}>Dormiu: {nap.fellAsleepTime}</Text>}
                {nap.wakeUpTime && <Text style={styles.napTimeText}>Acordou: {nap.wakeUpTime}</Text>}
              </View>
              {timeToSleep !== null && <Text style={styles.napCalc}>⏱ Tempo para dormir: {minutesToHM(timeToSleep)}</Text>}
              {sleepDuration !== null && <Text style={styles.napCalc}>💤 Dormiu: {minutesToHM(sleepDuration)}</Text>}
              <View style={styles.napDetails}>
                <Text style={styles.napDetailText}>Método: {getSleepMethodLabel(nap.sleepMethod)}</Text>
                <Text style={styles.napDetailText}>Ambiente: {getEnvironmentLabel(nap.environment)}</Text>
                <Text style={styles.napDetailText}>Humor: {getMoodLabel(nap.wakeUpMood)}</Text>
              </View>
              {nap.observations && <Text style={styles.napObs}>📝 {nap.observations}</Text>}
            </View>
          );
        })}

        {/* Night Sleep Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🌙 Sono Noturno</Text>
          <TouchableOpacity style={styles.addSmallBtn} onPress={() => { if (nightSleep) { setNsStartTry(nightSleep.startTryTime); setNsFellAsleep(nightSleep.fellAsleepTime || ""); setNsFinalWake(nightSleep.finalWakeTime || ""); setNsMethod(nightSleep.sleepMethod || ""); setNsEnv(nightSleep.environment || ""); setNsMood(nightSleep.wakeUpMood || ""); setNsObs(nightSleep.observations || ""); } setShowAddNightSleep(true); }}>
            <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={18} color="#FFF" />
            <Text style={styles.addSmallBtnText}>{nightSleep ? "Editar" : "Adicionar"}</Text>
          </TouchableOpacity>
        </View>

        {nightSleep ? (
          <View style={styles.napCard}>
            <View style={styles.napTimes}>
              <Text style={styles.napTimeText}>Tentativa: {nightSleep.startTryTime}</Text>
              {nightSleep.fellAsleepTime && <Text style={styles.napTimeText}>Dormiu: {nightSleep.fellAsleepTime}</Text>}
              {nightSleep.finalWakeTime && <Text style={styles.napTimeText}>Acordou: {nightSleep.finalWakeTime}</Text>}
            </View>
            {nightSleep.fellAsleepTime && nightSleep.finalWakeTime && (
              <Text style={styles.napCalc}>💤 Total: {minutesToHM(calcTimeDiff(nightSleep.fellAsleepTime, nightSleep.finalWakeTime))}</Text>
            )}
            <View style={styles.napDetails}>
              <Text style={styles.napDetailText}>Método: {getSleepMethodLabel(nightSleep.sleepMethod)}</Text>
              <Text style={styles.napDetailText}>Ambiente: {getEnvironmentLabel(nightSleep.environment)}</Text>
              <Text style={styles.napDetailText}>Humor: {getMoodLabel(nightSleep.wakeUpMood)}</Text>
            </View>
            {nightSleep.observations && <Text style={styles.napObs}>📝 {nightSleep.observations}</Text>}
            
            {/* Night Wakings */}
            <View style={[styles.sectionHeader, { marginTop: 12 }]}>
              <Text style={styles.formSectionTitle}>Despertares Noturnos</Text>
              <TouchableOpacity style={styles.addSmallBtn} onPress={() => setShowAddWaking(true)}>
                <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
            {(nightSleep.wakings || []).map((w) => (
              <View key={w.id} style={styles.wakingRow}>
                <Text style={styles.wakingText}>{w.startTime} → {w.endTime} ({minutesToHM(calcTimeDiff(w.startTime, w.endTime))})</Text>
                <TouchableOpacity onPress={() => handleDeleteWaking(w.id)}>
                  <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}><Text style={styles.emptyStateSubtext}>Nenhum sono noturno registrado</Text></View>
        )}
      </ScrollView>

      {/* Add Nap Modal */}
      <Modal visible={showAddNap} transparent animationType="slide" onRequestClose={() => setShowAddNap(false)}>
        <View style={styles.slideModalOverlay}>
          <View style={styles.slideModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar Soneca</Text>
              <TouchableOpacity onPress={() => setShowAddNap(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput style={styles.formInput} placeholder="Nº da soneca (1-6)" value={napNumber} onChangeText={setNapNumber} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              <TextInput style={styles.formInput} placeholder="Início tentativa * (HH:MM)" value={napStartTry} onChangeText={setNapStartTry} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              <TextInput style={styles.formInput} placeholder="Dormiu (HH:MM)" value={napFellAsleep} onChangeText={setNapFellAsleep} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              <TextInput style={styles.formInput} placeholder="Acordou (HH:MM)" value={napWakeUp} onChangeText={setNapWakeUp} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.formSectionTitle}>Como dormiu</Text>
              <View style={styles.chipRow}>
                {["colo", "embalo", "mamando", "sozinho_berco"].map((m) => (
                  <TouchableOpacity key={m} style={[styles.chip, napMethod === m && styles.chipActive]} onPress={() => setNapMethod(napMethod === m ? "" : m)}>
                    <Text style={[styles.chipText, napMethod === m && styles.chipTextActive]}>{getSleepMethodLabel(m)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formSectionTitle}>Ambiente</Text>
              <View style={styles.chipRow}>
                {["adequado", "parcialmente_adequado", "inadequado"].map((e) => (
                  <TouchableOpacity key={e} style={[styles.chip, napEnv === e && styles.chipActive]} onPress={() => setNapEnv(napEnv === e ? "" : e)}>
                    <Text style={[styles.chipText, napEnv === e && styles.chipTextActive]}>{getEnvironmentLabel(e)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formSectionTitle}>Como acordou</Text>
              <View style={styles.chipRow}>
                {["bom_humor", "sorrindo", "choroso", "muito_irritado"].map((m) => (
                  <TouchableOpacity key={m} style={[styles.chip, napMood === m && styles.chipActive]} onPress={() => setNapMood(napMood === m ? "" : m)}>
                    <Text style={[styles.chipText, napMood === m && styles.chipTextActive]}>{getMoodLabel(m)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[styles.formInput, styles.textArea]} placeholder="Observações..." value={napObs} onChangeText={setNapObs} multiline numberOfLines={2} placeholderTextColor={colors.textSecondary} />
              <TouchableOpacity style={[styles.addButton, napLoading && { opacity: 0.6 }]} onPress={handleAddNap} disabled={napLoading}>
                {napLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Adicionar Soneca</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Night Sleep Modal */}
      <Modal visible={showAddNightSleep} transparent animationType="slide" onRequestClose={() => setShowAddNightSleep(false)}>
        <View style={styles.slideModalOverlay}>
          <View style={styles.slideModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sono Noturno</Text>
              <TouchableOpacity onPress={() => setShowAddNightSleep(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput style={styles.formInput} placeholder="Início tentativa * (HH:MM)" value={nsStartTry} onChangeText={setNsStartTry} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              <TextInput style={styles.formInput} placeholder="Dormiu (HH:MM)" value={nsFellAsleep} onChangeText={setNsFellAsleep} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              <TextInput style={styles.formInput} placeholder="Acordou final (HH:MM)" value={nsFinalWake} onChangeText={setNsFinalWake} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.formSectionTitle}>Como dormiu</Text>
              <View style={styles.chipRow}>
                {["colo", "embalo", "mamando", "sozinho_berco"].map((m) => (
                  <TouchableOpacity key={m} style={[styles.chip, nsMethod === m && styles.chipActive]} onPress={() => setNsMethod(nsMethod === m ? "" : m)}>
                    <Text style={[styles.chipText, nsMethod === m && styles.chipTextActive]}>{getSleepMethodLabel(m)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formSectionTitle}>Ambiente</Text>
              <View style={styles.chipRow}>
                {["adequado", "parcialmente_adequado", "inadequado"].map((e) => (
                  <TouchableOpacity key={e} style={[styles.chip, nsEnv === e && styles.chipActive]} onPress={() => setNsEnv(nsEnv === e ? "" : e)}>
                    <Text style={[styles.chipText, nsEnv === e && styles.chipTextActive]}>{getEnvironmentLabel(e)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formSectionTitle}>Como acordou</Text>
              <View style={styles.chipRow}>
                {["bom_humor", "sorrindo", "choroso", "muito_irritado"].map((m) => (
                  <TouchableOpacity key={m} style={[styles.chip, nsMood === m && styles.chipActive]} onPress={() => setNsMood(nsMood === m ? "" : m)}>
                    <Text style={[styles.chipText, nsMood === m && styles.chipTextActive]}>{getMoodLabel(m)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[styles.formInput, styles.textArea]} placeholder="Observações..." value={nsObs} onChangeText={setNsObs} multiline numberOfLines={2} placeholderTextColor={colors.textSecondary} />
              <TouchableOpacity style={[styles.addButton, nightSleepLoading && { opacity: 0.6 }]} onPress={handleAddNightSleep} disabled={nightSleepLoading}>
                {nightSleepLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Salvar Sono Noturno</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Waking Modal */}
      <Modal visible={showAddWaking} transparent animationType="slide" onRequestClose={() => setShowAddWaking(false)}>
        <View style={styles.slideModalOverlay}>
          <View style={styles.slideModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Despertar Noturno</Text>
              <TouchableOpacity onPress={() => setShowAddWaking(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
            </View>
            <TextInput style={styles.formInput} placeholder="Início (HH:MM)" value={wakingStart} onChangeText={setWakingStart} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            <TextInput style={styles.formInput} placeholder="Fim (HH:MM)" value={wakingEnd} onChangeText={setWakingEnd} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            <TouchableOpacity style={[styles.addButton, wakingLoading && { opacity: 0.6 }]} onPress={handleAddWaking} disabled={wakingLoading}>
              {wakingLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Adicionar Despertar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Orientations Screen ──────────────────────────────────────────────────────

function OrientationsScreen({ baby, onBack, showErr }: { baby: Baby; onBack: () => void; showErr: (m: string) => void }) {
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
          <TouchableOpacity style={styles.addSmallBtn} onPress={() => { setDate(new Date().toISOString().split("T")[0]); setText(""); setResults(""); setShowAdd(true); }}>
            <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color="#FFF" />
            <Text style={styles.addSmallBtnText}>Nova</Text>
          </TouchableOpacity>
        </View>
        {orientations.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyStateText}>Nenhuma orientação registrada</Text></View>
        ) : (
          orientations.map((o) => (
            <View key={o.id} style={styles.orientationCard}>
              <View style={styles.orientationHeader}>
                <Text style={styles.orientationDate}>{o.date}</Text>
                <TouchableOpacity onPress={() => { setText(o.orientationText); setResults(o.results || ""); setShowEdit(o); }}>
                  <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.orientationText}>{o.orientationText}</Text>
              {o.results && <View style={styles.resultsBox}><Text style={styles.resultsLabel}>Resultados:</Text><Text style={styles.resultsText}>{o.results}</Text></View>}
            </View>
          ))
        )}
      </ScrollView>

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
      <Stack.Screen options={{ headerShown: true, title: `Relatórios - ${baby.name}`, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerLeft: () => (
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
                  <Text style={styles.reportDayDate}>{day.date}</Text>
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
  welcomeText: { fontSize: 16, color: colors.textSecondary, textAlign: "center", lineHeight: 24, marginBottom: 20 },
  featuresList: { gap: 12 },
  featureItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureText: { fontSize: 15, color: colors.text, flex: 1 },
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
  // Modals
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
  // Forms
  formSectionTitle: { fontSize: 15, fontWeight: "bold", color: colors.text, marginTop: 8, marginBottom: 6 },
  formInput: { backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text },
  textArea: { height: 80, textAlignVertical: "top" },
  idBox: { backgroundColor: colors.background, borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border, width: "100%" },
  idText: { fontSize: 13, color: colors.primary, fontWeight: "600", textAlign: "center" },
  roleButtons: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  roleButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", minWidth: 80 },
  roleButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  roleButtonText: { fontSize: 13, fontWeight: "600", color: colors.text },
  roleButtonTextActive: { color: "#FFFFFF" },
  // Baby Detail
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
  routineCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  routineDate: { fontSize: 16, fontWeight: "bold", color: colors.text },
  routineWakeTime: { fontSize: 14, color: colors.textSecondary },
  routineComment: { fontSize: 13, color: colors.primary, marginTop: 4 },
  // Naps
  napCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  napCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  napTitle: { fontSize: 16, fontWeight: "bold", color: colors.text },
  napTimes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  napTimeText: { fontSize: 13, color: colors.textSecondary, backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  napCalc: { fontSize: 13, color: colors.primary, marginBottom: 4 },
  napDetails: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  napDetailText: { fontSize: 12, color: colors.textSecondary },
  napObs: { fontSize: 13, color: colors.text, marginTop: 6, fontStyle: "italic" },
  wakingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  wakingText: { fontSize: 13, color: colors.textSecondary },
  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: "#FFF" },
  // Orientations
  orientationCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  orientationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  orientationDate: { fontSize: 14, fontWeight: "bold", color: colors.primary },
  orientationText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  resultsBox: { marginTop: 10, backgroundColor: colors.background, borderRadius: 8, padding: 10 },
  resultsLabel: { fontSize: 12, fontWeight: "bold", color: colors.textSecondary, marginBottom: 4 },
  resultsText: { fontSize: 14, color: colors.text },
  // Reports
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
});
