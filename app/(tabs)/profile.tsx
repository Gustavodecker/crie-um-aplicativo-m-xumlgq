
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
  Image,
  Platform,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPut, apiPost, BACKEND_URL, getBearerToken } from "@/utils/api";
import * as ImagePicker from "expo-image-picker";

interface ConsultantProfile {
  id: string;
  userId: string;
  name: string;
  photo: string | null;
  logo: string | null;
  professionalTitle: string | null;
  description: string | null;
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
  const [photoUploading, setPhotoUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [editName, setEditName] = useState("");
  const [editProfessionalTitle, setEditProfessionalTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
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
      setEditProfessionalTitle(data.professionalTitle || "");
      setEditDescription(data.description || "");
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
      setShowSignOutModal(false);
      router.replace("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setSigningOut(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showErr("Permissão para acessar a galeria é necessária.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      setPhotoUploading(true);
      console.log("[API] Uploading profile photo");
      const formData = new FormData();
      if (Platform.OS === "web") {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append("photo", blob, "profile.jpg");
      } else {
        formData.append("photo", {
          uri: asset.uri,
          name: "profile.jpg",
          type: "image/jpeg",
        } as any);
      }
      const token = await getBearerToken();
      const uploadResponse = await fetch(`${BACKEND_URL}/api/upload/profile-photo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Upload failed: ${errText}`);
      }
      const { url } = await uploadResponse.json();
      console.log("[API] Photo uploaded, url:", url);
      // Update profile with new photo URL
      const updated = await apiPut<ConsultantProfile>("/api/consultant/profile", { photo: url });
      setProfile(updated);
    } catch (error: any) {
      console.error("[API] Photo upload error:", error);
      showErr(error.message || "Erro ao fazer upload da foto");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName) { showErr("Nome é obrigatório"); return; }
    setEditLoading(true);
    try {
      console.log("[API] Updating consultant profile");
      const updated = await apiPut<ConsultantProfile>("/api/consultant/profile", {
        name: editName,
        professionalTitle: editProfessionalTitle || null,
        description: editDescription || null,
      });
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
      // After init, update with professional title and description if provided
      if (editProfessionalTitle || editDescription) {
        const updated = await apiPut<ConsultantProfile>("/api/consultant/profile", {
          professionalTitle: editProfessionalTitle || null,
          description: editDescription || null,
        });
        setProfile(updated);
      } else {
        setProfile(created);
      }
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => {
              console.log("Mother tapped sign out button");
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
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePickPhoto} disabled={photoUploading}>
            {profile?.photo ? (
              <Image source={{ uri: profile.photo }} style={styles.avatarPhoto} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <IconSymbol
                  ios_icon_name="person.circle.fill"
                  android_material_icon_name="account-circle"
                  size={80}
                  color={colors.primary}
                />
              </View>
            )}
            {photoUploading ? (
              <View style={styles.photoOverlay}>
                <ActivityIndicator size="small" color="#FFF" />
              </View>
            ) : (
              <View style={styles.photoEditBadge}>
                <IconSymbol ios_icon_name="camera.fill" android_material_icon_name="camera-alt" size={14} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.userName}>{profile?.name || user?.name || "Consultora"}</Text>
          {profile?.professionalTitle && (
            <Text style={styles.professionalTitle}>{profile.professionalTitle}</Text>
          )}
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.roleBadgeText, { color: colors.primary }]}>⭐ Consultora</Text>
          </View>
          {profile?.description && (
            <Text style={styles.profileDescription}>{profile.description}</Text>
          )}
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
              console.log("Tapped edit profile");
              setEditName(profile?.name || user?.name || "");
              setEditProfessionalTitle(profile?.professionalTitle || "");
              setEditDescription(profile?.description || "");
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
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.slideModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{profile ? "Editar Perfil Profissional" : "Configurar Perfil"}</Text>
                <TouchableOpacity onPress={() => setShowEditProfile(false)}><Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
              </View>
              <Text style={styles.formLabel}>Nome Profissional *</Text>
              <TextInput style={styles.formInput} placeholder="Ex: Debora Miguel" value={editName} onChangeText={setEditName} autoCapitalize="words" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.formLabel}>Título Profissional</Text>
              <TextInput style={styles.formInput} placeholder="Ex: Especialista em Neurociência do Sono Infantil" value={editProfessionalTitle} onChangeText={setEditProfessionalTitle} autoCapitalize="words" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.formLabel}>Descrição Profissional</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Descreva sua formação, metodologia, diferencial, abordagem e tempo de experiência..."
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                numberOfLines={6}
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity style={[styles.saveButton, editLoading && { opacity: 0.6 }]} onPress={profile ? handleSaveProfile : handleInitProfile} disabled={editLoading}>
                {editLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Salvar Perfil</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  scrollContent: { padding: 16, paddingBottom: 120 },
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
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 8, gap: 12 },
  menuItemText: { flex: 1, fontSize: 16, color: colors.text },
  signOutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.error },
  signOutText: { fontSize: 16, fontWeight: "600", color: colors.error },

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
  avatarPhoto: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.background },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  photoOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 45, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  photoEditBadge: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: colors.card },
  professionalTitle: { fontSize: 15, fontWeight: "600", color: colors.secondary, marginTop: 4, marginBottom: 2, textAlign: "center" },
  profileDescription: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 20, marginTop: 8, paddingHorizontal: 16 },
  textArea: { height: 120, textAlignVertical: "top" },
});
