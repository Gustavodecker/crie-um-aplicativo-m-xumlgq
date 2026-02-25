
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
import { Stack, useRouter, Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, typography, shadows } from "@/styles/commonStyles";
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
  if (status === "active") return colors.statusGood || colors.success;
  if (status === "paused") return colors.statusMedium || colors.warning;
  return colors.statusPoor || colors.error;
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

  // Redirect mothers to their dedicated dashboard
  if (!isConsultant) {
    return <Redirect href="/(tabs)/(home)/mother-dashboard" />;
  }

  const renderScreen = () => {
    switch (screen.type) {
      case "list": 
        return (
          <BabiesListScreen 
            isConsultant={isConsultant} 
            consultantProfile={consultantProfile}
            onSelectBaby={(b) => setScreen({ type: "baby", baby: b })} 
            onEditProfile={() => setShowEditProfile(true)}
            showErr={showErr} 
          />
        );
      case "baby": 
        return (
          <BabyDetailScreen 
            isConsultant={isConsultant} 
            baby={screen.baby} 
            onBack={() => setScreen({ type: "list" })} 
            onOpenRoutineList={() => setScreen({ type: "routineList", baby: screen.baby })} 
            onOpenOrientations={() => setScreen({ type: "orientations", baby: screen.baby })} 
            onOpenReports={() => setScreen({ type: "reports", baby: screen.baby })} 
            showErr={showErr} 
          />
        );
      case "routineList":
        return (
          <RoutineListScreen 
            isConsultant={isConsultant} 
            baby={screen.baby} 
            onBack={() => setScreen({ type: "baby", baby: screen.baby })} 
            onOpenRoutine={(r, dayNum) => setScreen({ type: "routine", baby: screen.baby, routine: r, dayNumber: dayNum })} 
            showErr={showErr} 
          />
        );
      case "routine": 
        return (
          <RoutineDetailScreen 
            isConsultant={isConsultant} 
            baby={screen.baby} 
            routine={screen.routine} 
            dayNumber={screen.dayNumber} 
            onBack={() => setScreen({ type: "routineList", baby: screen.baby })} 
            showErr={showErr} 
          />
        );
      case "orientations": 
        return (
          <OrientationsScreen 
            isConsultant={isConsultant} 
            baby={screen.baby} 
            onBack={() => setScreen({ type: "baby", baby: screen.baby })} 
            showErr={showErr} 
          />
        );
      case "reports": 
        return (
          <ReportsScreen 
            baby={screen.baby} 
            onBack={() => setScreen({ type: "baby", baby: screen.baby })} 
            showErr={showErr} 
          />
        );
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
            <Text style={styles.modalTitle}>Aviso</Text>
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

// ─── Placeholder Components (Consultant-only screens) ─────────────────────────

function BabiesListScreen({ isConsultant, consultantProfile, onSelectBaby, onEditProfile, showErr }: { 
  isConsultant: boolean; 
  consultantProfile: ConsultantProfile | null;
  onSelectBaby: (b: Baby) => void; 
  onEditProfile: () => void;
  showErr: (m: string) => void 
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: "Clientes" }} />
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>Babies List Screen (Consultant Only)</Text>
      </View>
    </SafeAreaView>
  );
}

function BabyDetailScreen({ isConsultant, baby, onBack, onOpenRoutineList, onOpenOrientations, onOpenReports, showErr }: {
  isConsultant: boolean; baby: Baby; onBack: () => void; onOpenRoutineList: () => void;
  onOpenOrientations: () => void; onOpenReports: () => void; showErr: (m: string) => void;
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: baby.name }} />
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>Baby Detail Screen (Consultant Only)</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function RoutineListScreen({ isConsultant, baby, onBack, onOpenRoutine, showErr }: {
  isConsultant: boolean; baby: Baby; onBack: () => void; onOpenRoutine: (r: Routine, dayNum: number) => void; showErr: (m: string) => void;
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: "Rotinas" }} />
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>Routine List Screen (Consultant Only)</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function RoutineDetailScreen({ isConsultant, baby, routine, dayNumber, onBack, showErr }: {
  isConsultant: boolean; baby: Baby; routine: Routine; dayNumber: number; onBack: () => void; showErr: (m: string) => void;
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: `Dia ${dayNumber}` }} />
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>Routine Detail Screen (Consultant Only)</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function OrientationsScreen({ isConsultant, baby, onBack, showErr }: { 
  isConsultant: boolean; baby: Baby; onBack: () => void; showErr: (m: string) => void 
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: "Orientações" }} />
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>Orientations Screen (Consultant Only)</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ReportsScreen({ baby, onBack, showErr }: { 
  baby: Baby; onBack: () => void; showErr: (m: string) => void 
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: true, title: "Relatórios" }} />
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>Reports Screen (Consultant Only)</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: colors.background 
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  placeholderText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  backButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  backButtonText: {
    ...typography.button,
    color: "#FFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.md,
  },
  modalMessage: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  modalButtonText: {
    ...typography.button,
    color: "#FFF",
  },
  slideModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  slideModalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.xl,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  formSectionTitle: {
    ...typography.h4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  formInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border || "#E0E0E0",
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  photoUploadContainer: {
    alignSelf: "center",
    position: "relative",
    marginBottom: spacing.md,
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
  },
  photoPlaceholderText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
    maxWidth: 100,
  },
  photoEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.card,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  addButtonText: {
    ...typography.button,
    color: "#FFF",
  },
});

export default HomeScreen;
