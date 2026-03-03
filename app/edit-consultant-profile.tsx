
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, typography, shadows } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { apiGet, apiPut, BACKEND_URL, getBearerToken } from "@/utils/api";
import * as ImagePicker from "expo-image-picker";

interface ConsultantProfile {
  id: string;
  userId: string;
  name: string;
  photo: string | null;
  professionalTitle: string | null;
  description: string | null;
}

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | undefined): { uri: string } | number {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as number;
}

export default function EditConsultantProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const [name, setName] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      console.log("[Edit Profile] Loading consultant profile");
      const profile = await apiGet<ConsultantProfile>("/api/consultant/profile");
      console.log("[Edit Profile] Profile loaded:", profile.name);
      
      setName(profile.name);
      setProfessionalTitle(profile.professionalTitle || "");
      setDescription(profile.description || "");
      setPhotoUrl(profile.photo);
    } catch (error: any) {
      console.error("[Edit Profile] Error loading profile:", error);
      setError(error.message || "Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      console.log("[Edit Profile] Requesting image picker permission");
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        console.warn("[Edit Profile] Permission denied");
        setError("Permissão para acessar a galeria é necessária");
        return;
      }

      console.log("[Edit Profile] Opening image picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log("[Edit Profile] Image selected:", {
          uri: asset.uri,
          type: asset.type,
          fileName: asset.fileName,
          fileSize: asset.fileSize,
        });

        // Verify URI format
        if (!asset.uri.startsWith('file://') && !asset.uri.startsWith('content://')) {
          console.error("[Edit Profile] Invalid URI format:", asset.uri);
          setError("Formato de imagem inválido");
          return;
        }

        setUploadingPhoto(true);
        setError(null);

        try {
          // Get authentication token
          const token = await getBearerToken();
          if (!token) {
            throw new Error("Token de autenticação não encontrado");
          }

          console.log("[Edit Profile] Token retrieved, preparing upload");
          console.log("[Edit Profile] Backend URL:", BACKEND_URL);

          // Verify backend URL is HTTPS
          if (!BACKEND_URL.startsWith('https://')) {
            console.error("[Edit Profile] Backend URL is not HTTPS:", BACKEND_URL);
            throw new Error("URL da API deve usar HTTPS");
          }

          // Create form data for upload
          const formData = new FormData();
          
          // Extract filename from URI or use default
          const uriParts = asset.uri.split('/');
          const fileName = asset.fileName || uriParts[uriParts.length - 1] || 'profile-photo.jpg';
          
          // Determine MIME type
          let mimeType = 'image/jpeg';
          if (fileName.toLowerCase().endsWith('.png')) {
            mimeType = 'image/png';
          } else if (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
            mimeType = 'image/jpeg';
          }

          console.log("[Edit Profile] File details:", {
            uri: asset.uri,
            name: fileName,
            type: mimeType,
          });

          // Append file to FormData
          // @ts-expect-error - FormData append with file works in React Native
          formData.append("file", {
            uri: asset.uri,
            name: fileName,
            type: mimeType,
          });

          console.log("[Edit Profile] FormData prepared, uploading to:", `${BACKEND_URL}/api/upload/profile-photo`);

          // Upload photo to backend with authentication
          const response = await fetch(`${BACKEND_URL}/api/upload/profile-photo`, {
            method: "POST",
            body: formData,
            headers: {
              Authorization: `Bearer ${token}`,
              // CRITICAL: Do NOT set Content-Type header
              // FormData automatically sets the correct multipart/form-data header with boundary
            },
          });

          console.log("[Edit Profile] Upload response status:", response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("[Edit Profile] Upload failed:", response.status, errorText);
            throw new Error(`Erro ao fazer upload da foto (${response.status})`);
          }

          const data = await response.json();
          console.log("[Edit Profile] Photo uploaded successfully:", data.url);
          setPhotoUrl(data.url);
          
        } catch (uploadError: any) {
          console.error("[Edit Profile] Error uploading photo:", uploadError);
          setError(uploadError.message || "Erro ao fazer upload da foto");
        } finally {
          setUploadingPhoto(false);
        }
      }
    } catch (error: any) {
      console.error("[Edit Profile] Error picking image:", error);
      setError(error.message || "Erro ao selecionar imagem");
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      console.log("[Edit Profile] Saving profile");
      
      await apiPut("/api/consultant/profile", {
        name: name.trim(),
        professionalTitle: professionalTitle.trim() || null,
        description: description.trim() || null,
        photo: photoUrl,
      });

      console.log("[Edit Profile] Profile saved successfully");
      router.back();
    } catch (error: any) {
      console.error("[Edit Profile] Error saving profile:", error);
      setError(error.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: "Editar Perfil Profissional", 
          headerStyle: { backgroundColor: colors.background }, 
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
              <IconSymbol 
                ios_icon_name="chevron.left" 
                android_material_icon_name="arrow-back" 
                size={24} 
                color={colors.primary} 
              />
            </TouchableOpacity>
          ),
        }} 
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo Section */}
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Foto de Perfil</Text>
          
          <View style={styles.photoContainer}>
            {photoUrl ? (
              <Image source={resolveImageSource(photoUrl)} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <IconSymbol 
                  ios_icon_name="person.fill" 
                  android_material_icon_name="person" 
                  size={64} 
                  color={colors.textSecondary} 
                />
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.photoButton} 
              onPress={handlePickImage}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <IconSymbol 
                    ios_icon_name="camera.fill" 
                    android_material_icon_name="photo-camera" 
                    size={20} 
                    color="#FFF" 
                  />
                  <Text style={styles.photoButtonText}>
                    {photoUrl ? "Alterar Foto" : "Adicionar Foto"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.photoHint}>
            Recomendamos uma foto profissional com fundo neutro
          </Text>
        </View>

        {/* Name Field */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Nome Profissional *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Debora Miguel"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Professional Title Field */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Título Profissional</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Especialista em Neurociência do Sono Infantil"
            value={professionalTitle}
            onChangeText={setProfessionalTitle}
            autoCapitalize="words"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.fieldHint}>
            Seu título ou especialização principal
          </Text>
        </View>

        {/* Description Field */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Descrição Profissional</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Descreva sua formação, metodologia, diferencial, abordagem e tempo de experiência..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.fieldHint}>
            3-6 linhas sobre seu trabalho e experiência
          </Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorBox}>
            <IconSymbol 
              ios_icon_name="exclamationmark.triangle.fill" 
              android_material_icon_name="warning" 
              size={20} 
              color={colors.error} 
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check-circle" 
                size={24} 
                color="#FFF" 
              />
              <Text style={styles.saveButtonText}>Salvar Perfil</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <IconSymbol 
            ios_icon_name="info.circle.fill" 
            android_material_icon_name="info" 
            size={20} 
            color={colors.primary} 
          />
          <Text style={styles.infoText}>
            Seu perfil profissional será exibido para todas as mães que você atende, ajudando a construir confiança e credibilidade.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  photoSection: {
    alignItems: "center",
    marginBottom: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.lg,
  },
  photoContainer: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    ...shadows.md,
  },
  photoButtonText: {
    ...typography.button,
    color: "#FFF",
    fontSize: 15,
  },
  photoHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    fontStyle: "italic",
  },
  fieldSection: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    ...shadows.sm,
  },
  textArea: {
    height: 140,
    textAlignVertical: "top",
    paddingTop: spacing.md,
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: "italic",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error + "15",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error + "40",
  },
  errorText: {
    ...typography.body2,
    color: colors.error,
    flex: 1,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.button,
    color: "#FFF",
    fontSize: 18,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
