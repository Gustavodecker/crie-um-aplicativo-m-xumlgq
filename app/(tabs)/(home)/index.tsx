
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
  Image,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ConsultantProfileCard } from "@/components/ConsultantProfileCard";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import DateTimePicker from "@react-native-community/datetimepicker";
import { setStringAsync } from 'expo-clipboard';
import { useAuth } from "@/contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

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
  archived: boolean;
  createdAt: string;
  ageMonths: number;
  ageDays: number;
  activeContract: Contract | null;
  token?: string;
}

interface ConsultantProfile {
  id: string;
  userId: string;
  name: string;
  photo: string | null;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  professionalTitle?: string | null;
  description?: string | null;
  createdAt: string;
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

/**
 * Normalizes nightSleep from the API response.
 * Handles various formats: null, undefined, {}, { id, ... }, [{ id, ... }], []
 */
function normalizeNightSleep(raw: any): NightSleep | null {
  console.log("[normalizeNightSleep] Input:", JSON.stringify(raw));
  
  // Handle null or undefined
  if (!raw) {
    console.log("[normalizeNightSleep] Input is null/undefined, returning null");
    return null;
  }
  
  // Handle array form (legacy data or ORM quirk)
  if (Array.isArray(raw)) {
    console.log("[normalizeNightSleep] Input is array, length:", raw.length);
    if (raw.length === 0) {
      console.log("[normalizeNightSleep] Empty array, returning null");
      return null;
    }
    // Sort by createdAt DESC to always get the most recent record
    const sorted = [...raw].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const mostRecent = sorted[0];
    if (!mostRecent || !mostRecent.id) {
      console.log("[normalizeNightSleep] Array item has no id, returning null");
      return null;
    }
    console.log("[normalizeNightSleep] Returning most recent from array, id:", mostRecent.id);
    return {
      ...mostRecent,
      wakings: Array.isArray(mostRecent.wakings) ? mostRecent.wakings : [],
    } as NightSleep;
  }
  
  // Handle object form
  if (typeof raw === 'object') {
    // Check if it's an empty object {} or an object without an id
    const hasId = 'id' in raw && raw.id;
    if (!hasId) {
      console.log("[normalizeNightSleep] Object has no id (empty object), returning null");
      return null;
    }
    console.log("[normalizeNightSleep] Valid object with id:", raw.id);
    return {
      ...raw,
      wakings: Array.isArray(raw.wakings) ? raw.wakings : [],
    } as NightSleep;
  }
  
  // Anything else
  console.log("[normalizeNightSleep] Unknown type, returning null");
  return null;
}

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | undefined): { uri: string } | number {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as number;
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
  const [consultantProfile, setConsultantProfile] = useState<ConsultantProfile | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      try {
        console.log("[Role Check] Checking if user is consultant");
        const profile = await apiGet<ConsultantProfile>("/api/consultant/profile");
        console.log("[Role Check] User is a consultant");
        setIsConsultant(true);
        setConsultantProfile(profile);
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
        return <BabiesListScreen 
          isConsultant={isConsultant} 
          consultantProfile={consultantProfile}
          onSelectBaby={(b) => setScreen({ type: "baby", baby: b })} 
          onEditProfile={() => setShowEditProfile(true)}
          showErr={showErr} 
        />;
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

  const handleSaveProfile = async (profileData: {
    name: string;
    professionalTitle: string;
    description: string;
    photoUri?: string;
  }) => {
    try {
      console.log("[Profile] Saving consultant profile");
      
      let photoUrl = consultantProfile?.photo;
      
      // Upload photo if a new one was selected
      if (profileData.photoUri) {
        console.log("[Profile] Uploading new photo");
        const formData = new FormData();
        
        // Extract filename from URI
        const uriParts = profileData.photoUri.split('/');
        const filename = uriParts[uriParts.length - 1];
        
        // @ts-expect-error - FormData append with file object
        formData.append('file', {
          uri: profileData.photoUri,
          type: 'image/jpeg',
          name: filename,
        });
        
        const uploadResponse = await apiPost<{ url: string; filename: string }>('/api/upload/profile-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        photoUrl = uploadResponse.url;
        console.log("[Profile] Photo uploaded:", photoUrl);
      }
      
      // Update profile
      const updatedProfile = await apiPut<ConsultantProfile>('/api/consultant/profile', {
        name: profileData.name,
        professionalTitle: profileData.professionalTitle,
        description: profileData.description,
        photo: photoUrl,
      });
      
      console.log("[Profile] Profile updated successfully");
      setConsultantProfile(updatedProfile);
      setShowEditProfile(false);
      showErr("✅ Perfil atualizado com sucesso!");
    } catch (error: any) {
      console.error("[Profile] Error saving profile:", error);
      showErr(error.message || "Erro ao salvar perfil");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {renderScreen()}
      
      {isConsultant && consultantProfile && (
        <EditProfileModal
          visible={showEditProfile}
          profile={consultantProfile}
          onClose={() => setShowEditProfile(false)}
          onSave={handleSaveProfile}
          showErr={showErr}
        />
      )}
      
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

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({ 
  visible, 
  profile, 
  onClose, 
  onSave, 
  showErr 
}: { 
  visible: boolean; 
  profile: ConsultantProfile; 
  onClose: () => void; 
  onSave: (data: { name: string; professionalTitle: string; description: string; photoUri?: string }) => Promise<void>; 
  showErr: (msg: string) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [professionalTitle, setProfessionalTitle] = useState(profile.professionalTitle || "");
  const [description, setDescription] = useState(profile.description || "");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(profile.name);
      setProfessionalTitle(profile.professionalTitle || "");
      setDescription(profile.description || "");
      setPhotoUri(undefined);
    }
  }, [visible, profile]);

  const handlePickImage = async () => {
    try {
      console.log("[Image Picker] Requesting permissions");
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        showErr("Permissão para acessar a galeria é necessária");
        return;
      }

      console.log("[Image Picker] Launching image picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log("[Image Picker] Image selected:", result.assets[0].uri);
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error("[Image Picker] Error:", error);
      showErr(error.message || "Erro ao selecionar imagem");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showErr("Por favor, preencha o nome");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        professionalTitle: professionalTitle.trim(),
        description: description.trim(),
        photoUri,
      });
    } catch (error: any) {
      console.error("[Edit Profile] Error:", error);
    } finally {
      setSaving(false);
    }
  };

  const displayPhotoUri = photoUri || profile.photo;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.slideModalOverlay}>
        <View style={styles.slideModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar Perfil Profissional</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.formSectionTitle}>Foto de Perfil</Text>
            <TouchableOpacity style={styles.photoUploadContainer} onPress={handlePickImage}>
              {displayPhotoUri ? (
                <Image source={resolveImageSource(displayPhotoUri)} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={48}
                    color={colors.primary}
                  />
                  <Text style={styles.photoPlaceholderText}>Toque para adicionar foto</Text>
                </View>
              )}
              <View style={styles.photoEditBadge}>
                <IconSymbol
                  ios_icon_name="camera.fill"
                  android_material_icon_name="camera"
                  size={16}
                  color="#FFF"
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.formSectionTitle}>Nome Profissional</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ex: Debora Miguel"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.formSectionTitle}>Título Profissional</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ex: Especialista em Neurociência do Sono Infantil"
              value={professionalTitle}
              onChangeText={setProfessionalTitle}
              autoCapitalize="words"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.formSectionTitle}>Descrição Profissional</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              placeholder="Descreva sua formação, metodologia, diferencial, abordagem e tempo de experiência..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              placeholderTextColor={colors.textSecondary}
            />

            <TouchableOpacity
              style={[styles.addButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.addButtonText}>Salvar Perfil</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Babies List Screen ───────────────────────────────────────────────────────

function BabiesListScreen({ 
  isConsultant, 
  consultantProfile,
  onSelectBaby, 
  onEditProfile,
  showErr 
}: { 
  isConsultant: boolean; 
  consultantProfile: ConsultantProfile | null;
  onSelectBaby: (b: Baby) => void; 
  onEditProfile: () => void;
  showErr: (m: string) => void 
}) {
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
  const [showArchived, setShowArchived] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const loadBabies = useCallback(async () => {
    console.log("[API] Loading babies, showArchived:", showArchived);
    try {
      if (isConsultant) {
        const endpoint = showArchived 
          ? "/api/consultant/babies?includeArchived=true" 
          : "/api/consultant/babies";
        const data = await apiGet<Baby[]>(endpoint);
        console.log("[API] Consultant babies loaded:", data.length);
        
        // When showArchived is true, backend returns ALL babies, so we filter to show only archived ones
        // When showArchived is false, backend returns only non-archived babies, so no filtering needed
        const filteredBabies = showArchived 
          ? data.filter(b => b.archived === true) 
          : data;
        
        console.log("[API] Filtered babies:", filteredBabies.length, "showArchived:", showArchived);
        setBabies(filteredBabies);
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
  }, [isConsultant, showArchived]);

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
        {isConsultant && consultantProfile && (
          <ConsultantProfileCard
            name={consultantProfile.name}
            professionalTitle={consultantProfile.professionalTitle || undefined}
            description={consultantProfile.description || undefined}
            photoUrl={consultantProfile.photo || undefined}
            onEdit={onEditProfile}
            isConsultant={true}
          />
        )}

        <View style={styles.header}>
          <Text style={styles.greeting}>Olá, {isConsultant ? "Consultora" : "Mamãe"}! 👋</Text>
          <Text style={styles.subtitle}>
            {showArchived ? "Bebês Arquivados" : `${babies.length} bebê${babies.length !== 1 ? "s" : ""} cadastrado${babies.length !== 1 ? "s" : ""}`}
          </Text>
        </View>

        {isConsultant && (
          <View style={styles.filterButtons}>
            <TouchableOpacity 
              style={[styles.filterButton, !showArchived && styles.filterButtonActive]} 
              onPress={() => setShowArchived(false)}
            >
              <IconSymbol 
                ios_icon_name="person.2.fill" 
                android_material_icon_name="child-care" 
                size={18} 
                color={!showArchived ? "#FFF" : colors.text} 
              />
              <Text style={[styles.filterButtonText, !showArchived && styles.filterButtonTextActive]}>
                Ativos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterButton, showArchived && styles.filterButtonActive]} 
              onPress={() => setShowArchived(true)}
            >
              <IconSymbol 
                ios_icon_name="archivebox.fill" 
                android_material_icon_name="archive" 
                size={18} 
                color={showArchived ? "#FFF" : colors.text} 
              />
              <Text style={[styles.filterButtonText, showArchived && styles.filterButtonTextActive]}>
                Arquivados
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

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

  const handleDeleteBaby = async () => {
    setDeleteLoading(true);
    try {
      console.log("[API] Deleting baby:", baby.id);
      await apiDelete(`/api/babies/${baby.id}`);
      console.log("[API] Baby deleted successfully");
      setShowDeleteConfirm(false);
      onBack();
    } catch (error: any) {
      console.error("[API] Error deleting baby:", error);
      showErr(error.message || "Erro ao excluir bebê");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleArchiveBaby = async () => {
    setArchiveLoading(true);
    try {
      console.log("[API] Archiving baby:", baby.id);
      await apiPut(`/api/babies/${baby.id}/archive`, { archived: true });
      console.log("[API] Baby archived successfully");
      setShowArchiveConfirm(false);
      onBack();
    } catch (error: any) {
      console.error("[API] Error archiving baby:", error);
      showErr(error.message || "Erro ao arquivar bebê");
    } finally {
      setArchiveLoading(false);
    }
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

        {isConsultant && (
          <View style={styles.dangerZone}>
            <Text style={styles.dangerZoneTitle}>⚠️ Zona de Perigo</Text>
            <TouchableOpacity 
              style={styles.archiveButton} 
              onPress={() => setShowArchiveConfirm(true)}
            >
              <IconSymbol ios_icon_name="archivebox.fill" android_material_icon_name="archive" size={20} color={colors.statusMedium} />
              <Text style={styles.archiveButtonText}>Arquivar Bebê</Text>
            </TouchableOpacity>
            <Text style={styles.dangerZoneHint}>
              Bebês arquivados não aparecem na lista principal, mas ficam salvos como histórico.
            </Text>
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={() => setShowDeleteConfirm(true)}
            >
              <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={20} color="#FFF" />
              <Text style={styles.deleteButtonText}>Excluir Bebê Permanentemente</Text>
            </TouchableOpacity>
            <Text style={styles.dangerZoneHint}>
              ⚠️ Esta ação não pode ser desfeita. Todos os dados serão perdidos.
            </Text>
          </View>
        )}
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

      <ConfirmModal
        visible={showArchiveConfirm}
        title="Arquivar Bebê?"
        message={`Tem certeza que deseja arquivar ${baby.name}? O bebê não aparecerá mais na lista principal, mas ficará salvo como histórico.`}
        confirmText="Arquivar"
        cancelText="Cancelar"
        confirmColor={colors.statusMedium}
        loading={archiveLoading}
        onConfirm={handleArchiveBaby}
        onCancel={() => setShowArchiveConfirm(false)}
        icon={{
          ios: "archivebox.fill",
          android: "archive",
          color: colors.statusMedium,
        }}
      />

      <ConfirmModal
        visible={showDeleteConfirm}
        title="Excluir Bebê Permanentemente?"
        message={`Tem certeza que deseja excluir ${baby.name}? Esta ação não pode ser desfeita e todos os dados (rotinas, orientações, relatórios) serão perdidos permanentemente.`}
        confirmText="Excluir Permanentemente"
        cancelText="Cancelar"
        confirmColor={colors.error}
        loading={deleteLoading}
        onConfirm={handleDeleteBaby}
        onCancel={() => setShowDeleteConfirm(false)}
        icon={{
          ios: "trash.fill",
          android: "delete",
          color: colors.error,
        }}
      />
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
    console.log("[API] Loading routines for baby:", baby.id);
    try {
      const data = await apiGet<Routine[]>(`/api/routines/baby/${baby.id}`);
      console.log("[API] Routines loaded:", data.length);
      setRoutines(data);
    } catch (error: any) {
      console.error("Error loading routines:", error);
      showErr(error.message || "Erro ao carregar rotinas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baby.id, showErr]);

  useEffect(() => { loadRoutines(); }, [loadRoutines]);

  const createRoutineForDay = async (dayNumber: number) => {
    console.log("[API] Creating routine for day:", dayNumber);
    try {
      const contractStartDate = baby.activeContract?.startDate;
      if (!contractStartDate) {
        showErr("Contrato não encontrado");
        return;
      }
      const startDate = new Date(contractStartDate);
      const targetDate = new Date(startDate);
      targetDate.setDate(startDate.getDate() + dayNumber - 1);
      const dateStr = formatDateForDisplay(targetDate);
      const routine = await apiPost<Routine>("/api/routines", { babyId: baby.id, date: dateStr, wakeUpTime: "07:00" });
      console.log("[API] Routine created:", routine.id);
      loadRoutines();
    } catch (error: any) {
      console.error("Error creating routine:", error);
      showErr(error.message || "Erro ao criar rotina");
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const contractStartDate = baby.activeContract?.startDate;
  const contractDuration = baby.activeContract?.durationDays || 21;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: `Rotina - ${baby.name}`, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerLeft: () => (
        <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}><IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} /></TouchableOpacity>
      )}} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRoutines(); }} />}>
        {!contractStartDate && (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>⚠️ Contrato não configurado</Text>
            <Text style={styles.welcomeText}>Configure o contrato na tela de detalhes do bebê para liberar as rotinas.</Text>
          </View>
        )}
        {contractStartDate && (
          <View style={styles.routineList}>
            {Array.from({ length: contractDuration }, (_, i) => {
              const dayNumber = i + 1;
              const routine = routines.find(r => {
                const startDate = new Date(contractStartDate);
                const targetDate = new Date(startDate);
                targetDate.setDate(startDate.getDate() + i);
                const targetDateStr = formatDateForDisplay(targetDate);
                return r.date === targetDateStr;
              });
              const startDate = new Date(contractStartDate);
              const targetDate = new Date(startDate);
              targetDate.setDate(startDate.getDate() + i);
              const dateStr = formatDateForDisplay(targetDate);
              return (
                <TouchableOpacity key={dayNumber} style={styles.routineCard} onPress={() => { if (routine) { console.log("Opening routine:", routine.id); onOpenRoutine(routine, dayNumber); } else { createRoutineForDay(dayNumber); } }}>
                  <View style={styles.routineCardHeader}>
                    <View style={styles.routineDayBadge}><Text style={styles.routineDayText}>Dia {dayNumber}</Text></View>
                    <Text style={styles.routineDate}>{formatDateToBR(dateStr)}</Text>
                  </View>
                  {routine ? (
                    <View style={styles.routineCardContent}>
                      <Text style={styles.routineCardText}>✅ Rotina preenchida</Text>
                      <Text style={styles.routineCardSubtext}>Acordou: {routine.wakeUpTime}</Text>
                    </View>
                  ) : (
                    <View style={styles.routineCardContent}>
                      <Text style={styles.routineCardText}>➕ Toque para criar rotina</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Routine Detail Screen ────────────────────────────────────────────────────

function RoutineDetailScreen({ isConsultant, baby, routine, dayNumber, onBack, showErr }: {
  isConsultant: boolean; baby: Baby; routine: Routine; dayNumber: number; onBack: () => void; showErr: (m: string) => void;
}) {
  const [currentRoutine, setCurrentRoutine] = useState<Routine>(routine);
  const [loading, setLoading] = useState(false);
  const [showNapModal, setShowNapModal] = useState(false);
  const [showDeleteNapConfirm, setShowDeleteNapConfirm] = useState(false);
  const [napToDelete, setNapToDelete] = useState<string | null>(null);
  const [deleteNapLoading, setDeleteNapLoading] = useState(false);
  const nightSleepIdRef = useRef<string | null>(null);

  const loadRoutine = useCallback(async () => {
    console.log("[API] Loading routine details:", routine.id);
    try {
      const data = await apiGet<Routine>(`/api/routines/${routine.id}`);
      console.log("[API] Routine loaded:", data.id);
      const normalized = { ...data, nightSleep: normalizeNightSleep(data.nightSleep) };
      setCurrentRoutine(normalized);
    } catch (error: any) {
      console.error("Error loading routine:", error);
      showErr(error.message || "Erro ao carregar rotina");
    }
  }, [routine.id, showErr]);

  useEffect(() => { loadRoutine(); }, [loadRoutine]);

  useEffect(() => {
    return () => {
      if (nightSleepIdRef.current) {
        AsyncStorage.removeItem(`nightSleepId_${routine.id}`).catch(console.error);
      }
    };
  }, [routine.id]);

  useEffect(() => {
    if (currentRoutine.nightSleep?.id) {
      nightSleepIdRef.current = currentRoutine.nightSleep.id;
      AsyncStorage.setItem(`nightSleepId_${routine.id}`, currentRoutine.nightSleep.id).catch(console.error);
    }
  }, [currentRoutine.nightSleep, routine.id]);

  const debouncedSave = useDebounce(async (field: string, value: string) => {
    console.log("[Auto-save] Saving field:", field, "value:", value);
    try {
      await apiPut(`/api/routines/${routine.id}`, { [field]: value });
      console.log("[Auto-save] Saved successfully");
    } catch (error: any) {
      console.error("[Auto-save] Error:", error);
      showErr(error.message || "Erro ao salvar");
    }
  }, 1000);

  const handleSaveWakeUp = async (time: string) => {
    console.log("[API] Saving wake up time:", time);
    try {
      const updated = await apiPut<Routine>(`/api/routines/${routine.id}`, { wakeUpTime: time });
      setCurrentRoutine({ ...updated, nightSleep: normalizeNightSleep(updated.nightSleep) });
    } catch (error: any) {
      console.error("Error saving wake up time:", error);
      showErr(error.message || "Erro ao salvar horário");
    }
  };

  const handleAddNap = async () => {
    console.log("[API] Adding nap");
    const napNumber = (currentRoutine.naps?.length || 0) + 1;
    if (napNumber > 6) { showErr("Máximo de 6 sonecas por dia"); return; }
    try {
      const nap = await apiPost<Nap>("/api/naps", { routineId: routine.id, napNumber, startTryTime: "12:00" });
      console.log("[API] Nap created:", nap.id);
      loadRoutine();
    } catch (error: any) {
      console.error("Error adding nap:", error);
      showErr(error.message || "Erro ao adicionar soneca");
    }
  };

  const handleUpdateNap = async (napId: string, updates: Partial<Nap>) => {
    console.log("[API] Updating nap:", napId, updates);
    try {
      await apiPut(`/api/naps/${napId}`, updates);
      console.log("[API] Nap updated");
      loadRoutine();
    } catch (error: any) {
      console.error("Error updating nap:", error);
      showErr(error.message || "Erro ao atualizar soneca");
    }
  };

  const handleDeleteNap = (napId: string) => {
    console.log("[Delete Nap] Showing confirmation for nap:", napId);
    setNapToDelete(napId);
    setShowDeleteNapConfirm(true);
  };

  const confirmDeleteNap = async () => {
    if (!napToDelete) return;
    console.log("[API] Deleting nap:", napToDelete);
    setDeleteNapLoading(true);
    try {
      await apiDelete(`/api/naps/${napToDelete}`);
      console.log("[API] Nap deleted");
      setShowDeleteNapConfirm(false);
      setNapToDelete(null);
      loadRoutine();
    } catch (error: any) {
      console.error("Error deleting nap:", error);
      showErr(error.message || "Erro ao excluir soneca");
    } finally {
      setDeleteNapLoading(false);
    }
  };

  const resolveNightSleepId = async (): Promise<string | null> => {
    if (nightSleepIdRef.current) {
      console.log("[Night Sleep] Using cached ID:", nightSleepIdRef.current);
      return nightSleepIdRef.current;
    }
    const storedId = await AsyncStorage.getItem(`nightSleepId_${routine.id}`);
    if (storedId) {
      console.log("[Night Sleep] Loaded ID from AsyncStorage:", storedId);
      nightSleepIdRef.current = storedId;
      return storedId;
    }
    console.log("[Night Sleep] No ID found, calling POST to create/get nightSleep");
    try {
      const currentNightSleep = currentRoutine.nightSleep;
      const response = await apiPost<NightSleep>(`/api/night-sleep`, {
        routineId: routine.id,
        ...currentNightSleep,
      });
      if (response.id) {
        console.log("[Night Sleep] Got ID from POST:", response.id);
        nightSleepIdRef.current = response.id;
        await AsyncStorage.setItem(`nightSleepId_${routine.id}`, response.id);
        return response.id;
      }
    } catch (error: any) {
      console.error("[Night Sleep] Failed to resolve ID via POST:", error);
    }
    return null;
  };

  const handleUpdateNightSleep = async (field: string, value: string | null) => {
    console.log("[Night Sleep] Updating field:", field, "value:", value);
    const nightSleepId = await resolveNightSleepId();
    if (!nightSleepId) {
      console.error("[Night Sleep] No ID available, cannot update");
      showErr("Erro: ID do sono noturno não encontrado");
      return;
    }
    try {
      const updated = await apiPut<NightSleep>(`/api/night-sleep/${nightSleepId}`, { [field]: value });
      console.log("[Night Sleep] Updated successfully");
      setCurrentRoutine(prev => ({ ...prev, nightSleep: normalizeNightSleep(updated) }));
    } catch (error: any) {
      console.error("[Night Sleep] Error updating:", error);
      showErr(error.message || "Erro ao atualizar sono noturno");
    }
  };

  const handleAddWaking = async () => {
    console.log("[Night Sleep] Adding waking");
    const nightSleepId = await resolveNightSleepId();
    if (!nightSleepId) {
      showErr("Erro: ID do sono noturno não encontrado");
      return;
    }
    try {
      await apiPost("/api/night-wakings", { nightSleepId, startTime: "02:00", endTime: "02:30" });
      console.log("[Night Sleep] Waking added");
      loadRoutine();
    } catch (error: any) {
      console.error("[Night Sleep] Error adding waking:", error);
      showErr(error.message || "Erro ao adicionar despertar");
    }
  };

  const handleDeleteWaking = async (wakingId: string) => {
    console.log("[Night Sleep] Deleting waking:", wakingId);
    try {
      await apiDelete(`/api/night-wakings/${wakingId}`);
      console.log("[Night Sleep] Waking deleted");
      loadRoutine();
    } catch (error: any) {
      console.error("[Night Sleep] Error deleting waking:", error);
      showErr(error.message || "Erro ao excluir despertar");
    }
  };

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerField, setTimePickerField] = useState<string>("");
  const [timePickerValue, setTimePickerValue] = useState(new Date());

  const handleTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (date) {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const timeStr = `${hours}:${minutes}`;
      if (timePickerField === "wakeUpTime") {
        handleSaveWakeUp(timeStr);
      }
    }
  };

  const handleUpdateWaking = async (wakingId: string, field: string, value: string) => {
    console.log("[Night Sleep] Updating waking:", wakingId, field, value);
    try {
      await apiPut(`/api/night-wakings/${wakingId}`, { [field]: value });
      console.log("[Night Sleep] Waking updated");
      loadRoutine();
    } catch (error: any) {
      console.error("[Night Sleep] Error updating waking:", error);
      showErr(error.message || "Erro ao atualizar despertar");
    }
  };

  const openTimePicker = (field: string) => {
    setTimePickerField(field);
    setTimePickerValue(new Date());
    setShowTimePicker(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: `Dia ${dayNumber} - ${baby.name}`, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerLeft: () => (
        <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}><IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} /></TouchableOpacity>
      )}} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>⏰ Horário que Acordou</Text>
          <TouchableOpacity style={styles.timeButton} onPress={() => openTimePicker("wakeUpTime")}>
            <Text style={styles.timeButtonText}>{currentRoutine.wakeUpTime}</Text>
            <IconSymbol ios_icon_name="clock.fill" android_material_icon_name="schedule" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>😴 Sonecas</Text>
            <TouchableOpacity style={styles.addSmallButton} onPress={handleAddNap}>
              <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {currentRoutine.naps && currentRoutine.naps.length > 0 ? (
            currentRoutine.naps.map((nap) => (
              <View key={nap.id} style={styles.napCard}>
                <View style={styles.napCardHeader}>
                  <Text style={styles.napNumber}>Soneca {nap.napNumber}</Text>
                  <TouchableOpacity onPress={() => handleDeleteNap(nap.id)}>
                    <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <TextInput style={styles.formInput} placeholder="Início tentativa (HH:MM)" value={nap.startTryTime} onChangeText={(v) => handleUpdateNap(nap.id, { startTryTime: v })} placeholderTextColor={colors.textSecondary} />
                <TextInput style={styles.formInput} placeholder="Dormiu (HH:MM)" value={nap.fellAsleepTime || ""} onChangeText={(v) => handleUpdateNap(nap.id, { fellAsleepTime: v || null })} placeholderTextColor={colors.textSecondary} />
                <TextInput style={styles.formInput} placeholder="Acordou (HH:MM)" value={nap.wakeUpTime || ""} onChangeText={(v) => handleUpdateNap(nap.id, { wakeUpTime: v || null })} placeholderTextColor={colors.textSecondary} />
                <TextInput style={styles.formInput} placeholder="Como dormiu" value={nap.sleepMethod || ""} onChangeText={(v) => handleUpdateNap(nap.id, { sleepMethod: v || null })} placeholderTextColor={colors.textSecondary} />
                <TextInput style={styles.formInput} placeholder="Ambiente" value={nap.environment || ""} onChangeText={(v) => handleUpdateNap(nap.id, { environment: v || null })} placeholderTextColor={colors.textSecondary} />
                <TextInput style={styles.formInput} placeholder="Como acordou" value={nap.wakeUpMood || ""} onChangeText={(v) => handleUpdateNap(nap.id, { wakeUpMood: v || null })} placeholderTextColor={colors.textSecondary} />
                <TextInput style={[styles.formInput, styles.textArea]} placeholder="Observações (mãe)" value={nap.observations || ""} onChangeText={(v) => handleUpdateNap(nap.id, { observations: v || null })} multiline numberOfLines={2} placeholderTextColor={colors.textSecondary} />
                {isConsultant && (
                  <TextInput style={[styles.formInput, styles.textArea]} placeholder="Comentários da consultora" value={nap.consultantComments || ""} onChangeText={(v) => handleUpdateNap(nap.id, { consultantComments: v || null })} multiline numberOfLines={2} placeholderTextColor={colors.textSecondary} />
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyStateSubtext}>Nenhuma soneca registrada</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🌙 Sono Noturno</Text>
          <TextInput style={styles.formInput} placeholder="Início tentativa (HH:MM)" value={currentRoutine.nightSleep?.startTryTime || ""} onChangeText={(v) => handleUpdateNightSleep("startTryTime", v || null)} placeholderTextColor={colors.textSecondary} />
          <TextInput style={styles.formInput} placeholder="Dormiu (HH:MM)" value={currentRoutine.nightSleep?.fellAsleepTime || ""} onChangeText={(v) => handleUpdateNightSleep("fellAsleepTime", v || null)} placeholderTextColor={colors.textSecondary} />
          <TextInput style={styles.formInput} placeholder="Acordou final (HH:MM)" value={currentRoutine.nightSleep?.finalWakeTime || ""} onChangeText={(v) => handleUpdateNightSleep("finalWakeTime", v || null)} placeholderTextColor={colors.textSecondary} />
          <TextInput style={styles.formInput} placeholder="Como dormiu" value={currentRoutine.nightSleep?.sleepMethod || ""} onChangeText={(v) => handleUpdateNightSleep("sleepMethod", v || null)} placeholderTextColor={colors.textSecondary} />
          <TextInput style={styles.formInput} placeholder="Ambiente" value={currentRoutine.nightSleep?.environment || ""} onChangeText={(v) => handleUpdateNightSleep("environment", v || null)} placeholderTextColor={colors.textSecondary} />
          <TextInput style={styles.formInput} placeholder="Como acordou" value={currentRoutine.nightSleep?.wakeUpMood || ""} onChangeText={(v) => handleUpdateNightSleep("wakeUpMood", v || null)} placeholderTextColor={colors.textSecondary} />
          <TextInput style={[styles.formInput, styles.textArea]} placeholder="Observações (mãe)" value={currentRoutine.nightSleep?.observations || ""} onChangeText={(v) => handleUpdateNightSleep("observations", v || null)} multiline numberOfLines={2} placeholderTextColor={colors.textSecondary} />
          {isConsultant && (
            <TextInput style={[styles.formInput, styles.textArea]} placeholder="Comentários da consultora" value={currentRoutine.nightSleep?.consultantComments || ""} onChangeText={(v) => handleUpdateNightSleep("consultantComments", v || null)} multiline numberOfLines={2} placeholderTextColor={colors.textSecondary} />
          )}
          
          <View style={styles.wakingsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionSubtitle}>Despertares Noturnos</Text>
              <TouchableOpacity style={styles.addSmallButton} onPress={handleAddWaking}>
                <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {currentRoutine.nightSleep?.wakings && currentRoutine.nightSleep.wakings.length > 0 ? (
              currentRoutine.nightSleep.wakings.map((waking, idx) => (
                <View key={waking.id} style={styles.wakingCard}>
                  <View style={styles.wakingCardHeader}>
                    <Text style={styles.wakingNumber}>Despertar {idx + 1}</Text>
                    <TouchableOpacity onPress={() => handleDeleteWaking(waking.id)}>
                      <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.wakingInputs}>
                    <TextInput style={[styles.formInput, { flex: 1 }]} placeholder="Início (HH:MM)" value={waking.startTime} onChangeText={(v) => handleUpdateWaking(waking.id, "startTime", v)} placeholderTextColor={colors.textSecondary} />
                    <TextInput style={[styles.formInput, { flex: 1 }]} placeholder="Fim (HH:MM)" value={waking.endTime} onChangeText={(v) => handleUpdateWaking(waking.id, "endTime", v)} placeholderTextColor={colors.textSecondary} />
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyStateSubtext}>Nenhum despertar registrado</Text>
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📝 Observações Gerais</Text>
          <TextInput style={[styles.formInput, styles.textArea]} placeholder="Observações da mãe sobre o dia..." value={currentRoutine.motherObservations || ""} onChangeText={(v) => debouncedSave("motherObservations", v)} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
          {isConsultant && (
            <TextInput style={[styles.formInput, styles.textArea]} placeholder="Comentários da consultora sobre o dia..." value={currentRoutine.consultantComments || ""} onChangeText={(v) => debouncedSave("consultantComments", v)} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
          )}
        </View>
      </ScrollView>

      {showTimePicker && (
        <DateTimePicker
          value={timePickerValue}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}

      <ConfirmModal
        visible={showDeleteNapConfirm}
        title="Excluir Soneca?"
        message="Tem certeza que deseja excluir esta soneca? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmColor={colors.error}
        loading={deleteNapLoading}
        onConfirm={confirmDeleteNap}
        onCancel={() => {
          setShowDeleteNapConfirm(false);
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

// ─── Orientations Screen ──────────────────────────────────────────────────────

function OrientationsScreen({ isConsultant, baby, onBack, showErr }: { isConsultant: boolean; baby: Baby; onBack: () => void; showErr: (m: string) => void }) {
  const [orientations, setOrientations] = useState<Orientation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingOrientation, setEditingOrientation] = useState<Orientation | null>(null);
  const [orientationDate, setOrientationDate] = useState(new Date().toISOString().split("T")[0]);
  const [orientationText, setOrientationText] = useState("");
  const [results, setResults] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  const loadOrientations = useCallback(async () => {
    console.log("[API] Loading orientations for baby:", baby.id);
    try {
      const data = await apiGet<Orientation[]>(`/api/orientations/baby/${baby.id}`);
      console.log("[API] Orientations loaded:", data.length);
      setOrientations(data);
    } catch (error: any) {
      console.error("Error loading orientations:", error);
      showErr(error.message || "Erro ao carregar orientações");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baby.id, showErr]);

  useEffect(() => { loadOrientations(); }, [loadOrientations]);

  const handleAdd = () => {
    console.log("[Orientations] Opening modal to add new orientation");
    setEditingOrientation(null);
    setOrientationDate(new Date().toISOString().split("T")[0]);
    setOrientationText("");
    setResults("");
    setShowModal(true);
  };

  const handleEdit = (orientation: Orientation) => {
    console.log("[Orientations] Opening modal to edit orientation:", orientation.id);
    setEditingOrientation(orientation);
    setOrientationDate(orientation.date);
    setOrientationText(orientation.orientationText);
    setResults(orientation.results || "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!orientationText) { showErr("Preencha o texto da orientação"); return; }
    setSaveLoading(true);
    try {
      if (editingOrientation) {
        console.log("[API] Updating orientation:", editingOrientation.id);
        await apiPut(`/api/orientations/${editingOrientation.id}`, { orientationText, results: results || null });
      } else {
        console.log("[API] Creating orientation");
        await apiPost("/api/orientations", { babyId: baby.id, date: orientationDate, orientationText, results: results || null });
      }
      setShowModal(false);
      loadOrientations();
    } catch (error: any) {
      console.error("Error saving orientation:", error);
      showErr(error.message || "Erro ao salvar orientação");
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: `Orientações - ${baby.name}`, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerLeft: () => (
        <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}><IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} /></TouchableOpacity>
      )}} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrientations(); }} />}>
        {orientations.length === 0 && (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>📋 Nenhuma orientação ainda</Text>
            <Text style={styles.welcomeText}>{isConsultant ? "Adicione orientações para guiar o acompanhamento." : "Sua consultora adicionará orientações aqui."}</Text>
          </View>
        )}
        {orientations.map((orientation) => (
          <TouchableOpacity key={orientation.id} style={styles.orientationCard} onPress={() => isConsultant && handleEdit(orientation)} disabled={!isConsultant}>
            <View style={styles.orientationCardHeader}>
              <Text style={styles.orientationDate}>{formatDateToBR(orientation.date)}</Text>
              {isConsultant && (
                <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={16} color={colors.primary} />
              )}
            </View>
            <Text style={styles.orientationText}>{orientation.orientationText}</Text>
            {orientation.results && (
              <View style={styles.resultsBox}>
                <Text style={styles.resultsLabel}>Resultados:</Text>
                <Text style={styles.resultsText}>{orientation.results}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        {isConsultant && (
          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <IconSymbol ios_icon_name="plus.circle.fill" android_material_icon_name="add-circle" size={24} color="#FFF" />
            <Text style={styles.addButtonText}>Nova Orientação</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {isConsultant && (
        <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
          <View style={styles.slideModalOverlay}>
            <View style={styles.slideModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingOrientation ? "Editar Orientação" : "Nova Orientação"}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
              </View>
              <TextInput style={styles.formInput} placeholder="Data (AAAA-MM-DD)" value={orientationDate} onChangeText={setOrientationDate} keyboardType="numeric" editable={!editingOrientation} placeholderTextColor={colors.textSecondary} />
              <TextInput style={[styles.formInput, styles.textArea]} placeholder="Texto da orientação..." value={orientationText} onChangeText={setOrientationText} multiline numberOfLines={5} placeholderTextColor={colors.textSecondary} />
              <TextInput style={[styles.formInput, styles.textArea]} placeholder="Resultados observados..." value={results} onChangeText={setResults} multiline numberOfLines={3} placeholderTextColor={colors.textSecondary} />
              <TouchableOpacity style={[styles.addButton, saveLoading && { opacity: 0.6 }]} onPress={handleSave} disabled={saveLoading}>
                {saveLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.addButtonText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ─── Reports Screen ───────────────────────────────────────────────────────────

function ReportsScreen({ baby, onBack, showErr }: { baby: Baby; onBack: () => void; showErr: (m: string) => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadReport = useCallback(async () => {
    console.log("[API] Loading report for baby:", baby.id);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const queryString = params.toString();
      const endpoint = `/api/reports/baby/${baby.id}${queryString ? `?${queryString}` : ""}`;
      const data = await apiGet<Report>(endpoint);
      console.log("[API] Report loaded");
      setReport(data);
    } catch (error: any) {
      console.error("Error loading report:", error);
      showErr(error.message || "Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  }, [baby.id, startDate, endDate, showErr]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const getIndicatorColor = (indicator: string) => {
    if (indicator === "green") return colors.statusGood;
    if (indicator === "yellow") return colors.statusMedium;
    return colors.statusPoor;
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: `Relatório - ${baby.name}`, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerLeft: () => (
        <TouchableOpacity onPress={onBack} style={{ marginLeft: 8 }}><IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} /></TouchableOpacity>
      )}} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {report && (
          <>
            <View style={styles.reportCard}>
              <Text style={styles.reportTitle}>📊 Resumo Geral</Text>
              <Text style={styles.reportText}>Total de sonecas: {report.totalNaps}</Text>
              <Text style={styles.reportText}>Sono diurno total: {minutesToHM(report.totalDaytimeSleep)}</Text>
              <Text style={styles.reportText}>Sono noturno total: {minutesToHM(report.totalNighttimeSleep)}</Text>
              <Text style={styles.reportText}>Sono líquido noturno: {minutesToHM(report.totalNetNighttimeSleep)}</Text>
              <Text style={styles.reportText}>Total em 24h: {minutesToHM(report.totalSleepIn24h)}</Text>
              <Text style={styles.reportText}>Média semanal: {report.weeklyAverage.toFixed(1)}h</Text>
            </View>
            <View style={styles.reportCard}>
              <Text style={styles.reportTitle}>📈 Evolução Diária</Text>
              {report.dailyEvolution.map((day) => (
                <View key={day.date} style={styles.dayRow}>
                  <View style={[styles.dayIndicator, { backgroundColor: getIndicatorColor(day.indicator) }]} />
                  <View style={styles.dayInfo}>
                    <Text style={styles.dayDate}>{formatDateToBR(day.date)}</Text>
                    <Text style={styles.dayText}>Diurno: {minutesToHM(day.daytimeSleep)} | Noturno: {minutesToHM(day.netNighttimeSleep)} | Total: {minutesToHM(day.total24h)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
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
  header: { marginBottom: 16 },
  greeting: { fontSize: 28, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 16, color: colors.textSecondary },
  filterButtons: { 
    flexDirection: "row", 
    gap: 12, 
    marginBottom: 24 
  },
  filterButton: { 
    flex: 1, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    backgroundColor: colors.card, 
    borderRadius: 12, 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    gap: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  filterButtonActive: { 
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: { 
    fontSize: 15, 
    fontWeight: "600", 
    color: colors.text 
  },
  filterButtonTextActive: { 
    color: "#FFF" 
  },
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
  textArea: { height: 120, textAlignVertical: "top" },
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
  dangerZone: { 
    backgroundColor: colors.card, 
    borderRadius: 16, 
    padding: 16, 
    marginTop: 24, 
    borderWidth: 2, 
    borderColor: colors.error + "40" 
  },
  dangerZoneTitle: { 
    fontSize: 16, 
    fontWeight: "bold", 
    color: colors.error, 
    marginBottom: 12 
  },
  dangerZoneHint: { 
    fontSize: 12, 
    color: colors.textSecondary, 
    marginBottom: 12, 
    fontStyle: "italic" 
  },
  archiveButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    backgroundColor: colors.background, 
    borderRadius: 12, 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    marginBottom: 8, 
    gap: 8,
    borderWidth: 2,
    borderColor: colors.statusMedium,
  },
  archiveButtonText: { 
    fontSize: 15, 
    fontWeight: "600", 
    color: colors.statusMedium 
  },
  deleteButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    backgroundColor: colors.error, 
    borderRadius: 12, 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    marginBottom: 8, 
    gap: 8 
  },
  deleteButtonText: { 
    fontSize: 15, 
    fontWeight: "600", 
    color: "#FFF" 
  },
  photoUploadContainer: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignSelf: "center",
    marginBottom: 20,
    position: "relative",
    overflow: "hidden",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  photoEditBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  routineList: { gap: 12 },
  routineCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  routineCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  routineDayBadge: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  routineDayText: { fontSize: 14, fontWeight: "600", color: "#FFF" },
  routineDate: { fontSize: 14, color: colors.textSecondary },
  routineCardContent: { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  routineCardText: { fontSize: 15, fontWeight: "600", color: colors.text },
  routineCardSubtext: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  sectionCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: colors.text, marginBottom: 12 },
  sectionSubtitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  addSmallButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.primary },
  timeButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.background, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  timeButtonText: { fontSize: 18, fontWeight: "600", color: colors.text },
  napCard: { backgroundColor: colors.background, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  napCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  napNumber: { fontSize: 15, fontWeight: "600", color: colors.text },
  wakingsSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  wakingCard: { backgroundColor: colors.backgroundAlt, borderRadius: 8, padding: 10, marginBottom: 8 },
  wakingCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  wakingNumber: { fontSize: 13, fontWeight: "600", color: colors.text },
  wakingInputs: { flexDirection: "row", gap: 8 },
  orientationCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  orientationCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  orientationDate: { fontSize: 14, fontWeight: "600", color: colors.primary },
  orientationText: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: 8 },
  resultsBox: { backgroundColor: colors.background, borderRadius: 8, padding: 10, marginTop: 8 },
  resultsLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 4 },
  resultsText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  reportCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  reportTitle: { fontSize: 18, fontWeight: "bold", color: colors.text, marginBottom: 12 },
  reportText: { fontSize: 15, color: colors.text, marginBottom: 6 },
  dayRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  dayInfo: { flex: 1 },
  dayDate: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 2 },
  dayText: { fontSize: 13, color: colors.textSecondary },
});

export default HomeScreen;
