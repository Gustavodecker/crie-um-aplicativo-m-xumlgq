
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
import { ConfirmModal } from "@/components/ConfirmModal";

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

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profile, setProfile] = useState<ConsultantProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isConsultant, setIsConsultant] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBranding, setShowBranding] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPrimaryColor, setEditPrimaryColor] = useState("");
  const [editSecondaryColor, setEditSecondaryColor] = useState("");

  const showErr = (msg: string) => { setErrorMessage(msg); setShowError(true); };

  const loadProfile = useCallback(async () => {
    try {
      console.log("[API] Loading consultant profile to determine role");
      const data = await apiGet<ConsultantProfile>("/api/consultant/profile");
      setProfile(data);
      setIsConsultant(true);
      setEditName(data.name);
      setEditPrimaryColor(data.primaryColor);
      setEditSecondaryColor(data.secondaryColor);
      console.log("[Role] User is a consultant");
    } catch (error: any) {
      console.log("[Role] User is NOT a consultant (mother) - profile not found");
      setIsConsultant(false);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSignOut = async () => {
    console.log("User confirmed sign out");
    setSigningOut(true);
    try {
      await signOut();
      console.log("Sign out successful, navigating to auth");
      router.replace("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setSigningOut(false);
      setShowSignOutModal(false);
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

  const handleInitProfile = async () => {
    if (!editName) { showErr("Informe seu nome"); return; }
    setEditLoading(true);
    try {
      console.log("[API] Initializing consultant profile");
      const created = await apiPost<ConsultantProfile>("/api/init/consultant", { name: editName });
      setProfile(created);
      setIsConsultant(true);
      setShowEditProfile(false);
    } catch (error: any) {
      showErr(error.message || "Erro ao criar perfil");
    } finally {
      setEditLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ headerShown: true, title: "Perfil", headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Mother Profile View ───────────────────────────────────────────────────
  if (!isConsultant) {
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentMother}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <IconSymbol
                ios_icon_name="heart.circle.fill"
                android_material_icon_name="favorite"
                size={80}
                color={colors.secondary}
              />
            </View>
            <Text style={styles.userName}>{user?.name || "Mamãe"}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>👶 Mãe</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <IconSymbol ios_icon_name="envelope.fill" android_material_icon_name="email" size={20} color={colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>E-mail</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>ℹ️ Sobre sua conta</Text>
            <Text style={styles.infoCardText}>
              Você está cadastrada como mãe. Acesse a aba "Bebês" para visualizar as rotinas e orientações do seu bebê.
            </Text>
            <Text style={styles.infoCardText}>
              A consultora responsável gerencia as informações e rotinas do seu bebê.
            </Text>
          </View>

          <View style={styles.logoutSection}>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={() => {
                console.log("Mother tapped sign out button - opening confirmation modal");
                setShowSignOutModal(true);
              }}
            >
              <IconSymbol ios_icon_name="arrow.right.square.fill" android_material_icon_name="logout" size={24} color="#FFFFFF" />
              <Text style={styles.signOutText}>Encerrar Sessão</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <ConfirmModal
          visible={showSignOutModal}
          title="Sair da Conta"
          message="Tem certeza que deseja sair?"
          confirmText="Sair"
          cancelText="Cancelar"
          confirmColor={colors.error}
          loading={signingOut}
          onConfirm={handleSignOut}
          onCancel={() => setShowSignOutModal(false)}
          icon={{
            ios: "arrow.right.square.fill",
            android: "logout",
            color: colors.error,
          }}
        />
      </SafeAreaView>
    );
  }

  // ─── Consultant Profile View ───────────────────────────────────────────────
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
          <View style={[styles.roleBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.roleBadgeText, { color: colors.primary }]}>⭐ Consultora</Text>
          </View>
          {profile && (
            <View style={styles.colorPreview}>
              <View style={[styles.colorDot, { backgroundColor: profile.primaryColor }]} />
              <View style={[styles.colorDot, { backgroundColor: profile.secondaryColor }]} />
            </View>
          )}
        </View>

        {!profile && (
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
              console.log("Tapped edit professional profile");
              router.push("/edit-consultant-profile");
            }}
          >
            <IconSymbol ios_icon_name="person.crop.circle.badge.checkmark" android_material_icon_name="verified-user" size={24} color={colors.text} />
            <Text style={styles.menuItemText}>Perfil Profissional</Text>
            <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

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

        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => {
              console.log("Consultant tapped sign out button");
              setShowSignOutModal(true);
            }}
          >
            <IconSymbol ios_icon_name="arrow.right.square.fill" android_material_icon_name="logout" size={24} color="#FFFFFF" />
            <Text style={styles.signOutText}>Encerrar Sessão</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showSignOutModal}
        title="Sair da Conta"
        message="Tem certeza que deseja sair?"
        confirmText="Sair"
        cancelText="Cancelar"
        confirmColor={colors.error}
        loading={signingOut}
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutModal(false)}
        icon={{
          ios: "arrow.right.square.fill",
          android: "logout",
          color: colors.error,
        }}
      />

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
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 280 },
  scrollContentMother: { padding: 16, paddingBottom: 280 },
  profileHeader: { alignItems: "center", paddingVertical: 32 },
  avatarContainer: { marginBottom: 16 },
  userName: { fontSize: 24, fontWeight: "bold", color: colors.text, marginBottom: 4 },
  userEmail: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
  roleBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F0EBF8", marginTop: 8 },
  roleBadgeText: { fontSize: 14, fontWeight: "600", color: colors.secondary },
  colorPreview: { flexDirection: "row", gap: 8, marginTop: 12 },
  colorDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border },
  infoCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoTextContainer: { flex: 1 },
  infoLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  infoValue: { fontSize: 15, color: colors.text, fontWeight: "500" },
  infoCardTitle: { fontSize: 16, fontWeight: "bold", color: colors.text, marginBottom: 8 },
  infoCardText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 6 },
  initCard: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 24, alignItems: "center" },
  initCardText: { fontSize: 15, color: colors.textSecondary, textAlign: "center", marginBottom: 16 },
  initButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  initButtonText: { fontSize: 15, fontWeight: "600", color: "#FFF" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: colors.text, marginBottom: 12 },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 8, gap: 12 },
  menuItemText: { flex: 1, fontSize: 16, color: colors.text },
  logoutSection: { marginTop: 32, marginBottom: 60 },
  signOutButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    backgroundColor: colors.error, 
    borderRadius: 12, 
    padding: 18, 
    gap: 10,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  signOutText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },

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
