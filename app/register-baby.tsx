
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
import { useAuth } from "@/contexts/AuthContext";


interface BabyResponse {
  success: boolean;
  babyId: string;
  motherUserId: string;
  motherEmail: string;
  temporaryPassword?: string;
}

export default function RegisterBabyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [motherName, setMotherName] = useState("");
  const [motherPhone, setMotherPhone] = useState("");
  const [motherEmail, setMotherEmail] = useState("");
  const [objectives, setObjectives] = useState("");
  const [error, setError] = useState("");
  const [successModal, setSuccessModal] = useState<{
    visible: boolean;
    email: string;
    temporaryPassword?: string;
  }>({
    visible: false,
    email: "",
    temporaryPassword: undefined,
  });
  const [copied, setCopied] = useState(false);

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

  const handleCopyPassword = async () => {
    console.log("User tapped Copy Password button");
    try {
      await Clipboard.setStringAsync(successModal.temporaryPassword || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      console.log("Password copied to clipboard");
    } catch (err) {
      console.error("Error copying to clipboard:", err);
    }
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

    if (!motherEmail.trim()) {
      setError("Por favor, informe o email da mãe");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(motherEmail.trim())) {
      setError("Por favor, informe um email válido");
      return;
    }

    try {
      setLoading(true);
      
      const requestBody = {
        name: name.trim(),
        birthDate: formatDateToISO(birthDate),
        motherName: motherName.trim(),
        motherPhone: motherPhone.trim(),
        motherEmail: motherEmail.trim(),
        consultantId: user?.id,
        objectives: objectives.trim() || undefined,
      };
      
      console.log("Submitting baby and mother registration to /api/babies:", requestBody);

      const response = await apiPost<BabyResponse>("/api/babies", requestBody);

      console.log("Baby and mother registered successfully:", response);
      
      // Show success modal instead of Alert (web-compatible)
      console.log("Temporary password returned:", response.temporaryPassword ? "yes" : "no");
      setSuccessModal({
        visible: true,
        email: motherEmail.trim(),
        temporaryPassword: response.temporaryPassword,
      });
      setCopied(false);
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email da Mãe *</Text>
              <TextInput
                style={styles.input}
                value={motherEmail}
                onChangeText={setMotherEmail}
                placeholder="Ex: maria@email.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
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
                Uma senha provisória será gerada. Você deverá compartilhá-la com a mãe para o primeiro acesso.
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

      {/* Success Modal - web-compatible, no Alert.alert() */}
      <Modal
        visible={successModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSuccessModal({ visible: false, email: "", temporaryPassword: undefined });
          router.replace("/(tabs)/(home)");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={64}
              color={colors.success}
            />
            <Text style={styles.modalTitle}>Bebê Cadastrado!</Text>
            <Text style={styles.modalMessage}>
              Bebê e conta da mãe criados com sucesso!
            </Text>
            <Text style={styles.modalMessage}>
              Compartilhe os dados de acesso com{" "}
              <Text style={styles.modalEmailHighlight}>{successModal.email}</Text>:
            </Text>
            
            <View style={styles.credentialsBox}>
              <View style={styles.credentialRow}>
                <Text style={styles.credentialLabel}>Email:</Text>
                <Text style={styles.credentialValue}>{successModal.email}</Text>
              </View>
              {successModal.temporaryPassword ? (
                <View style={styles.credentialRow}>
                  <Text style={styles.credentialLabel}>Senha provisória:</Text>
                  <View style={styles.passwordRow}>
                    <Text style={styles.credentialValuePassword}>{successModal.temporaryPassword}</Text>
                    <TouchableOpacity
                      style={[styles.copyButton, copied && styles.copyButtonSuccess]}
                      onPress={handleCopyPassword}
                    >
                      <IconSymbol
                        ios_icon_name={copied ? "checkmark" : "doc.on.doc"}
                        android_material_icon_name={copied ? "check" : "content-copy"}
                        size={18}
                        color={copied ? colors.success : colors.primary}
                      />
                      <Text style={[styles.copyButtonText, copied && styles.copyButtonTextSuccess]}>
                        {copied ? "Copiado!" : "Copiar"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
            
            <Text style={styles.modalWarning}>
              ⚠️ A mãe deverá alterar a senha no primeiro acesso
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setSuccessModal({ visible: false, email: "", temporaryPassword: undefined });
                router.replace("/(tabs)/(home)");
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
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
  scrollViewContent: {
    paddingBottom: 120,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(47, 62, 70, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.xxxl || spacing.xl,
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  modalEmailHighlight: {
    fontWeight: "700",
    color: colors.primary,
  },
  credentialsBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    width: "100%",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  credentialRow: {
    marginBottom: spacing.md,
  },
  credentialLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: "500",
  },
  credentialValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "600",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  credentialValuePassword: {
    flex: 1,
    fontSize: 18,
    color: colors.primary,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "15",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  copyButtonSuccess: {
    backgroundColor: colors.success + "15",
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  copyButtonTextSuccess: {
    color: colors.success,
  },
  modalWarning: {
    fontSize: 13,
    color: colors.warning || "#F59E0B",
    textAlign: "center",
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  modalButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl || spacing.xl,
    borderRadius: borderRadius.lg,
    minWidth: 120,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.card,
  },
});
