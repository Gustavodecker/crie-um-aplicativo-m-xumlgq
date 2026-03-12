
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";
import { apiPost } from "@/utils/api";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Clipboard from "expo-clipboard";

interface BabyResponse {
  id: string;
  token: string;
  name: string;
  birthDate: string;
  motherName: string;
  motherPhone: string;
  motherUserId: string | null;
  consultantId: string;
  objectives: string | null;
  conclusion: string | null;
  archived: boolean;
  createdAt: string;
}

export default function RegisterBabyScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [motherName, setMotherName] = useState("");
  const [motherPhone, setMotherPhone] = useState("");
  const [objectives, setObjectives] = useState("");
  const [error, setError] = useState("");
  
  // Token modal state
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState("");
  const [registeredBabyName, setRegisteredBabyName] = useState("");
  const [copiedToken, setCopiedToken] = useState(false);

  const formatDateToBR = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }

    if (selectedDate) {
      setBirthDate(selectedDate);
      if (Platform.OS === "ios") {
        setShowDatePicker(false);
      }
    }
  };

  const handleCopyToken = async () => {
    console.log("User tapped Copy Token button");
    await Clipboard.setStringAsync(generatedToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCloseTokenModal = () => {
    console.log("User closed token modal, navigating back to babies list");
    setShowTokenModal(false);
    setGeneratedToken("");
    setRegisteredBabyName("");
    setCopiedToken(false);
    
    // Navigate back to consultant dashboard to refresh the babies list
    router.replace("/(tabs)/(home)");
  };

  const handleSubmit = async () => {
    console.log("User tapped Submit button on Register Baby screen");
    setError("");

    if (!name.trim()) {
      setError("Por favor, informe o nome do bebê");
      return;
    }

    if (!motherName.trim()) {
      setError("Por favor, informe o nome da mãe");
      return;
    }

    if (!motherPhone.trim()) {
      setError("Por favor, informe o telefone da mãe");
      return;
    }

    try {
      setLoading(true);
      
      const requestBody = {
        name: name.trim(),
        birthDate: formatDateToISO(birthDate),
        motherName: motherName.trim(),
        motherPhone: motherPhone.trim(),
        objectives: objectives.trim() || undefined,
      };
      
      console.log("Submitting baby registration to /api/consultant/babies:", requestBody);

      // Use consultant-specific endpoint - backend will associate with authenticated consultant
      const response = await apiPost<BabyResponse>("/api/consultant/babies", requestBody);

      console.log("Baby registered successfully:", response);
      
      // Show token modal with the generated token
      if (response.token) {
        setGeneratedToken(response.token);
        setRegisteredBabyName(response.name);
        setShowTokenModal(true);
      } else {
        console.error("No token returned from backend");
        setError("Bebê cadastrado, mas não foi possível gerar o token. Tente novamente.");
      }
    } catch (err: any) {
      console.error("Error registering baby:", err);
      setError(err.message || "Erro ao cadastrar bebê. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const birthDateDisplay = formatDateToBR(birthDate);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Cadastrar Bebê",
          headerShown: true,
        }}
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.header}>
            <IconSymbol
              ios_icon_name="person.circle.fill"
              android_material_icon_name="account-circle"
              size={64}
              color={colors.primary}
            />
            <Text style={styles.headerTitle}>Novo Bebê</Text>
            <Text style={styles.headerSubtitle}>
              Preencha os dados do bebê e da mãe
            </Text>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <IconSymbol
                ios_icon_name="exclamationmark.triangle.fill"
                android_material_icon_name="warning"
                size={20}
                color={colors.error}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados do Bebê</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome do Bebê *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ex: João Silva"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Data de Nascimento *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>{birthDateDisplay}</Text>
                <IconSymbol
                  ios_icon_name="calendar"
                  android_material_icon_name="calendar-today"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados da Mãe</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome da Mãe *</Text>
              <TextInput
                style={styles.input}
                value={motherName}
                onChangeText={setMotherName}
                placeholder="Ex: Maria Silva"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Telefone *</Text>
              <TextInput
                style={styles.input}
                value={motherPhone}
                onChangeText={setMotherPhone}
                placeholder="Ex: (11) 98765-4321"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.infoBox}>
              <IconSymbol
                ios_icon_name="info.circle"
                android_material_icon_name="info"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.infoText}>
                O email da mãe será cadastrado por ela no primeiro acesso usando o token.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Objetivos (Opcional)</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descreva os objetivos do trabalho</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={objectives}
                onChangeText={setObjectives}
                placeholder="Ex: Melhorar a qualidade do sono noturno, estabelecer rotina de sonecas..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={24}
                    color={colors.card}
                  />
                  <Text style={styles.submitButtonText}>Cadastrar Bebê</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={birthDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Token Modal */}
      <Modal
        visible={showTokenModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseTokenModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={64}
                color={colors.success}
              />
              <Text style={styles.modalTitle}>Bebê Cadastrado!</Text>
              <Text style={styles.modalSubtitle}>{registeredBabyName}</Text>
            </View>

            <View style={styles.tokenSection}>
              <Text style={styles.tokenLabel}>Token de Acesso para a Mãe:</Text>
              <View style={styles.tokenContainer}>
                <Text style={styles.tokenText}>{generatedToken}</Text>
              </View>
              
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyToken}
              >
                <IconSymbol
                  ios_icon_name={copiedToken ? "checkmark" : "doc.on.doc"}
                  android_material_icon_name={copiedToken ? "check" : "content-copy"}
                  size={20}
                  color={colors.card}
                />
                <Text style={styles.copyButtonText}>
                  {copiedToken ? "Token Copiado!" : "Copiar Token"}
                </Text>
              </TouchableOpacity>

              <View style={styles.instructionsContainer}>
                <IconSymbol
                  ios_icon_name="info.circle"
                  android_material_icon_name="info"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.instructionsText}>
                  Envie este token para a mãe. No primeiro acesso, ela usará o token para criar sua conta com email e senha.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={handleCloseTokenModal}
            >
              <Text style={styles.closeModalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  content: {
    padding: spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error + "15",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: colors.error,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary + "15",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  buttonContainer: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.card,
  },
  cancelButton: {
    alignItems: "center",
    padding: spacing.md,
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
  },
  modalSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  tokenSection: {
    marginBottom: spacing.xl,
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tokenContainer: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  tokenText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.card,
  },
  instructionsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary + "15",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  closeModalButton: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
});
