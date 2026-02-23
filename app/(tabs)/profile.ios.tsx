
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPut, apiPost } from "@/utils/api";

interface ConsultantProfile {
  id: string;
  userId: string;
  name: string;
  photo: string | null;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  createdAt: string;
}

interface SleepWindow {
  id: string;
  consultantId: string;
  ageMonthsMin: number;
  ageMonthsMax: number;
  windowMinutes: number;
  createdAt: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profile, setProfile] = useState<ConsultantProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBranding, setShowBranding] = useState(false);
  const [showSleepWindows, setShowSleepWindows] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPrimaryColor, setEditPrimaryColor] = useState("");
  const [editSecondaryColor, setEditSecondaryColor] = useState("");
  const [sleepWindows, setSleepWindows] = useState<SleepWindow[]>([]);
  const [swLoading, setSwLoading] = useState(false);
  const [showAddSW, setShowAddSW] = useState(false);
  const [swAgeMin, setSwAgeMin] = useState("");
  const [swAgeMax, setSwAgeMax] = useState("");
  const [swMinutes, setSwMinutes] = useState("");

  const showErr = (msg: string) => { setErrorMessage(msg); setShowError(true); };

  const loadProfile = useCallback(async () => {
    try {
      console.log("[API] Loading consultant profile");
      const data = await apiGet<ConsultantProfile>("/api/consultant/profile");
      setProfile(data);
      setEditName(data.name);
      setEditPrimaryColor(data.primaryColor);
      setEditSecondaryColor(data.secondaryColor);
    } catch (error: any) {
      console.warn("[API] Profile not found (may need initialization):", error.message);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadSleepWindows = useCallback(async () => {
    try {
      console.log("[API] Loading sleep windows");
      const data = await apiGet<SleepWindow[]>("/api/sleep-windows");
      setSleepWindows(data.sort((a, b) => a.ageMonthsMin - b.ageMonthsMin));
    } catch (error: any) {
      showErr(error.message || "Erro ao carregar janelas de sono");
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSignOut = async () => {
    console.log("User confirmed sign out");
    setSigningOut(true);
    try {
      await signOut();
      console.log("Sign out successful, navigating to auth");
      setShowSignOutModal(false);
      router.replace("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setSigningOut(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName) { showErr("Nome é obrigatório"); return; }
    setEditLoading(true);
    try {
      console.log("[API] Updating consultant profile");
      const updated = await apiPut<ConsultantProfile>("/api/consultant/profile", { name: editName });
      setProfile(updated);
      setShowEditProfile(false);
    } catch (error: any) {
      showErr(error.message || "Erro ao atualizar perfil");
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveBranding = async () => {
    setEditLoading(true);
    try {
      console.log("[API] Updating consultant branding");
      const updated = await apiPut<ConsultantProfile>("/api/consultant/profile", { primaryColor: editPrimaryColor, secondaryColor: editSecondaryColor });
      setProfile(updated);
      setShowBranding(false);
    } catch (error: any) {
      showErr(error.message || "Erro ao atualizar marca");
    } finally {
      setEditLoading(false);
    }
  };

  const handleAddSleepWindow = async () => {
    if (!swAgeMin || !swAgeMax || !swMinutes) { showErr("Preencha todos os campos"); return; }
    setSwLoading(true);
    try {
      console.log("[API] Creating sleep window config");
      await apiPost("/api/sleep-windows", { ageMonthsMin: parseInt(swAgeMin), ageMonthsMax: parseInt(swAgeMax), windowMinutes: parseInt(swMinutes) });
      setSwAgeMin(""); setSwAgeMax(""); setSwMinutes("");
      setShowAddSW(false);
      loadSleepWindows();
    } catch (error: any) {
      showErr(error.message || "Erro ao criar janela de sono");
    } finally {
      setSwLoading(false);
    }
  };

  const handleInitProfile = async () => {
    if (!editName) { showErr("Informe seu nome"); return; }
    setEditLoading(true);
    try {
      console.log("[API] Initializing consultant profile");
      const created = await apiPost<ConsultantProfile>("/api/init/consultant", { name: editName });
      setProfile(created);
      setShowEditProfile(false);
    } catch (error: any) {
      showErr(error.message || "Erro ao criar perfil");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Perfil",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <IconSymbol
              ios_icon_name="person.circle.fill"
              android_material_icon_name="account-circle"
              size={80}
              color={colors.primary}
            />
          </View>
          <Text style={styles.userName}>{profile?.name || user?.name || "Consultora"}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {profile && (
            <View style={styles.colorPreview}>
              <View style={[styles.colorDot, { backgroundColor: profile.primaryColor }]} />
              <View style={[styles.colorDot, { backgroundColor: profile.secondaryColor }]} />
            </View>
          )}
        </View>

        {!profile && !profileLoading && (
          <View style={styles.initCard}>
            <Text style={styles.initCardText}>Configure seu perfil de consultora para começar</Text>
            <TouchableOpacity style={styles.initButton} onPress={() => { setEditName(user?.name || ""); setShowEditProfile(true); }}>
              <Text style={styles.initButtonText}>Configurar Perfil</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configurações</Text>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log("Tapped edit profile");
              setEditName(profile?.name || user?.name || "");
              setShowEditProfile(true);
            }}
          >
            <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={24} color={colors.text} />
            <Text style={styles.menuItemText}>Editar Perfil</Text>
            <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log("Tapped customize branding");
              setEditPrimaryColor(profile?.primaryColor || "#6B4CE6");
              setEditSecondaryColor(profile?.secondaryColor || "#9D7FEA");
              setShowBranding(true);
            }}
          >
            <IconSymbol ios_icon_name="paintbrush.fill" android_material_icon_name="palette" size={24} color={colors.text} />
            <Text style={styles.menuItemText}>Personalizar Marca</Text>
            <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Janelas de Sono por Idade</Text>
            <TouchableOpacity 
              style={styles.addSmallBtn} 
              onPress={() => {
                console.log("Tapped add sleep window");
                loadSleepWindows();
                setShowAddSW(true);
              }}
            >
              <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={16} color="#FFF" />
              <Text style={styles.addSmallBtnText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
          
          {sleepWindows.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nenhuma janela de sono configurada</Text>
              <Text style={styles.emptySubtext}>Configure as janelas de sono por faixa etária para cálculo automático</Text>
            </View>
          ) : (
            sleepWindows.map((sw) => (
              <View key={sw.id} style={styles.swCard}>
                <View style={styles.swCardContent}>
                  <IconSymbol ios_icon_name="clock.fill" android_material_icon_name="schedule" size={20} color={colors.primary} />
                  <View style={styles.swCardInfo}>
                    <Text style={styles.swText}>{sw.ageMonthsMin}-{sw.ageMonthsMax} meses</Text>
                    <Text style={styles.swMinutes}>{sw.windowMinutes} minutos</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => {
            console.log("User tapped sign out button");
            setShowSignOutModal(true);
          }}
        >
          <IconSymbol ios_icon_name="arrow.right.square.fill" android_material_icon_name="logout" size={24} color={colors.error} />
          <Text style={styles.signOutText}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showSignOutModal} transparent animationType="fade" onRequestClose={() => setShowSignOutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sair da Conta</Text>
            <Text style={styles.modalMessage}>Tem certeza que deseja sair?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setShowSignOutModal(false)} disabled={signingOut}>
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={handleSignOut} disabled={signingOut}>
                <Text style={styles.modalButtonTextConfirm}>{signingOut ? "Saindo..." : "Sair"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <View style={styles.slideModalOverlay}>
          <View style={styles.slideModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{profile ? "Editar Perfil" : "Configurar Perfil"}</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
            </View>
            <TextInput style={styles.formInput} placeholder="Nome da consultora *" value={editName} onChangeText={setEditName} autoCapitalize="words" placeholderTextColor={colors.textSecondary} />
            <TouchableOpacity style={[styles.saveButton, editLoading && { opacity: 0.6 }]} onPress={profile ? handleSaveProfile : handleInitProfile} disabled={editLoading}>
              {editLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBranding} transparent animationType="slide" onRequestClose={() => setShowBranding(false)}>
        <View style={styles.slideModalOverlay}>
          <View style={styles.slideModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Personalizar Marca</Text>
              <TouchableOpacity onPress={() => setShowBranding(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.formLabel}>Cor Primária (hex, ex: #6B4CE6)</Text>
            <View style={styles.colorInputRow}>
              <TextInput style={[styles.formInput, { flex: 1 }]} placeholder="#6B4CE6" value={editPrimaryColor} onChangeText={setEditPrimaryColor} autoCapitalize="none" placeholderTextColor={colors.textSecondary} />
              <View style={[styles.colorPreviewBox, { backgroundColor: editPrimaryColor || "#6B4CE6" }]} />
            </View>
            <Text style={styles.formLabel}>Cor Secundária (hex, ex: #9D7FEA)</Text>
            <View style={styles.colorInputRow}>
              <TextInput style={[styles.formInput, { flex: 1 }]} placeholder="#9D7FEA" value={editSecondaryColor} onChangeText={setEditSecondaryColor} autoCapitalize="none" placeholderTextColor={colors.textSecondary} />
              <View style={[styles.colorPreviewBox, { backgroundColor: editSecondaryColor || "#9D7FEA" }]} />
            </View>
            <TouchableOpacity style={[styles.saveButton, editLoading && { opacity: 0.6 }]} onPress={handleSaveBranding} disabled={editLoading}>
              {editLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Salvar Cores</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddSW} transparent animationType="slide" onRequestClose={() => setShowAddSW(false)}>
        <View style={styles.slideModalOverlay}>
          <View style={styles.slideModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar Janela de Sono</Text>
              <TouchableOpacity onPress={() => setShowAddSW(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.formLabel}>Idade mínima (meses)</Text>
            <TextInput style={styles.formInput} placeholder="Ex: 0" value={swAgeMin} onChangeText={setSwAgeMin} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            <Text style={styles.formLabel}>Idade máxima (meses)</Text>
            <TextInput style={styles.formInput} placeholder="Ex: 3" value={swAgeMax} onChangeText={setSwAgeMax} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            <Text style={styles.formLabel}>Janela de sono (minutos)</Text>
            <TextInput style={styles.formInput} placeholder="Ex: 60" value={swMinutes} onChangeText={setSwMinutes} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            <TouchableOpacity style={[styles.saveButton, swLoading && { opacity: 0.6 }]} onPress={handleAddSleepWindow} disabled={swLoading}>
              {swLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Adicionar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showError} transparent animationType="fade" onRequestClose={() => setShowError(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Erro</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={() => setShowError(false)}>
              <Text style={styles.modalButtonTextConfirm}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  profileHeader: { alignItems: "center", paddingVertical: 32 },
  avatarContainer: { marginBottom: 16 },
  userName: { fontSize: 24, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  userEmail: { fontSize: 14, color: colors.textSecondary },
  colorPreview: { flexDirection: "row", gap: 8, marginTop: 12 },
  colorDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border },
  initCard: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 24, alignItems: "center" },
  initCardText: { fontSize: 15, color: colors.textSecondary, textAlign: "center", marginBottom: 16 },
  initButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  initButtonText: { fontSize: 15, fontWeight: "600", color: "#FFF" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: colors.text, marginBottom: 12 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 8, gap: 12 },
  menuItemText: { flex: 1, fontSize: 16, color: colors.text },
  signOutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.error },
  signOutText: { fontSize: 16, fontWeight: "600", color: colors.error },
  emptyCard: { backgroundColor: colors.card, borderRadius: 12, padding: 20, alignItems: "center" },
  emptyText: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 4, textAlign: "center" },
  emptySubtext: { fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  swCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8 },
  swCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  swCardInfo: { flex: 1 },
  swText: { fontSize: 15, fontWeight: "600", color: colors.text },
  swMinutes: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  addSmallBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  addSmallBtnText: { fontSize: 12, fontWeight: "600", color: "#FFF" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  slideModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  slideModalContent: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalContent: { backgroundColor: colors.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: colors.text },
  modalMessage: { fontSize: 16, color: colors.textSecondary, marginBottom: 24 },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  modalButtonCancel: { backgroundColor: colors.background },
  modalButtonConfirm: { backgroundColor: colors.error },
  modalButtonTextCancel: { fontSize: 16, fontWeight: "600", color: colors.text },
  modalButtonTextConfirm: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  formInput: { backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text },
  formLabel: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 6 },
  saveButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 8 },
  saveButtonText: { fontSize: 16, fontWeight: "600", color: "#FFF" },
  colorInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  colorPreviewBox: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
});
