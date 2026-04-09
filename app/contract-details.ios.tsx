
import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { ConfirmModal } from "@/components/ConfirmModal";
import { IOSDatePickerModal } from "@/components/IOSDatePickerModal";
import * as DocumentPicker from "expo-document-picker";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, BACKEND_URL, getBearerToken } from "@/utils/api";

interface Contract {
  id: string;
  babyId: string;
  startDate: string;
  durationDays: number;
  status: "active" | "paused" | "completed";
  contractPdfUrl: string | null;
  createdAt: string;
}

interface Baby {
  id: string;
  name: string;
  motherName: string;
}

export default function ContractDetailsScreen() {
  const router = useRouter();
  const { babyId, babyName } = useLocalSearchParams<{ babyId: string; babyName: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  const [baby, setBaby] = useState<Baby | null>(null);

  const [startDate, setStartDate] = useState(new Date());
  const [durationDays, setDurationDays] = useState("30");
  const [status, setStatus] = useState<"active" | "paused" | "completed">("active");
  const [contractPdfUrl, setContractPdfUrl] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!babyId) return;

    try {
      setLoading(true);
      console.log("Loading contract for baby:", babyId);

      const contractData = await apiGet<Contract | null>(`/api/contracts/baby/${babyId}`);
      console.log("Contract data:", contractData);

      setContract(contractData);

      if (contractData) {
        setStartDate(new Date(contractData.startDate));
        setDurationDays(contractData.durationDays.toString());
        setStatus(contractData.status);
        setContractPdfUrl(contractData.contractPdfUrl);
      }
    } catch (error) {
      console.error("Error loading contract:", error);
    } finally {
      setLoading(false);
    }
  }, [babyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
      if (event.type === "dismissed") return;
      if (selectedDate) setStartDate(selectedDate);
    }
  };

  const handleDateConfirm = (date: Date) => {
    console.log("[contract-details.ios] Date confirmed:", date.toISOString());
    setStartDate(date);
    setShowDatePicker(false);
  };

  const handlePickDocument = async () => {
    try {
      console.log("User tapped Pick Contract PDF button");
      setUploading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      console.log("Document picker result:", result);

      if (result.canceled) {
        console.log("Document picker canceled");
        setUploading(false);
        return;
      }

      const file = result.assets[0];
      console.log("Selected file:", file.name, file.size, "bytes");

      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        type: file.mimeType || "application/pdf",
        name: file.name,
      } as any);

      const token = await getBearerToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log("Uploading contract PDF to backend...");
      const response = await fetch(`${BACKEND_URL}/api/upload/contract`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", response.status, errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const uploadResult = await response.json();
      console.log("Upload successful:", uploadResult);

      setContractPdfUrl(uploadResult.url);
      Alert.alert("Sucesso", "Contrato enviado com sucesso!");
    } catch (error) {
      console.error("Error picking/uploading document:", error);
      Alert.alert("Erro", "Falha ao enviar o contrato. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!babyId) return;

    const durationNum = parseInt(durationDays, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      Alert.alert("Erro", "Duração deve ser um número positivo");
      return;
    }

    try {
      setSaving(true);
      console.log("Saving contract...");

      const dateString = startDate.toISOString().split("T")[0];

      if (contract) {
        console.log("Updating existing contract:", contract.id);
        const updated = await apiPut<Contract>(`/api/contracts/${contract.id}`, {
          startDate: dateString,
          durationDays: durationNum,
          status,
          contractPdfUrl,
        });
        setContract(updated);
        Alert.alert("Sucesso", "Contrato atualizado com sucesso!");
      } else {
        console.log("Creating new contract for baby:", babyId);
        const created = await apiPost<Contract>("/api/contracts", {
          babyId,
          startDate: dateString,
          durationDays: durationNum,
          status,
          contractPdfUrl,
        });
        setContract(created);
        Alert.alert("Sucesso", "Contrato criado com sucesso!");
      }

      router.back();
    } catch (error) {
      console.error("Error saving contract:", error);
      Alert.alert("Erro", "Falha ao salvar o contrato. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePdf = () => {
    setShowDeleteModal(true);
  };

  const confirmRemovePdf = () => {
    console.log("User confirmed PDF removal");
    setContractPdfUrl(null);
    setShowDeleteModal(false);
  };

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showContractDeleteModal, setShowContractDeleteModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleArchive = () => {
    console.log("User tapped ARQUIVAR button for contract:", contract?.id);
    setShowArchiveModal(true);
  };

  const confirmArchive = async () => {
    if (!contract) return;
    try {
      setArchiving(true);
      setShowArchiveModal(false);
      console.log("[API] Archiving contract:", contract.id);
      await apiPatch(`/api/consultant/contracts/${contract.id}/archive`, {});
      console.log("[API] Contract archived successfully");
      Alert.alert("Sucesso", "Contrato arquivado com sucesso!");
      router.back();
    } catch (error) {
      console.error("Error archiving contract:", error);
      Alert.alert("Erro", "Falha ao arquivar o contrato. Tente novamente.");
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = () => {
    console.log("User tapped EXCLUIR button for contract:", contract?.id);
    setShowContractDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!contract) return;
    try {
      setDeleting(true);
      setShowContractDeleteModal(false);
      console.log("[API] Deleting contract:", contract.id);
      await apiDelete(`/api/consultant/contracts/${contract.id}`);
      console.log("[API] Contract deleted successfully");
      Alert.alert("Sucesso", "Contrato excluído com sucesso!");
      router.back();
    } catch (error) {
      console.error("Error deleting contract:", error);
      Alert.alert("Erro", "Falha ao excluir o contrato. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDateToBR = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const calculateEndDate = (): string => {
    const durationNum = parseInt(durationDays, 10);
    if (isNaN(durationNum)) return "—";

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationNum);
    return formatDateToBR(endDate);
  };

  const statusText = status === "active" ? "Vigente" : status === "paused" ? "Em Pausa" : "Concluído";
  const statusColor =
    status === "active" ? colors.success : status === "paused" ? colors.warning : colors.textSecondary;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Contrato", headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: contract ? "Editar Contrato" : "Novo Contrato",
          headerShown: true,
        }}
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.card}>
          <Text style={styles.babyName}>{babyName}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data de Início</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="calendar-today"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.dateButtonText}>{formatDateToBR(startDate)}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duração (dias)</Text>
            <TextInput
              style={styles.input}
              value={durationDays}
              onChangeText={setDurationDays}
              keyboardType="number-pad"
              placeholder="Ex: 30"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data de Término (calculada)</Text>
            <Text style={styles.calculatedDate}>{calculateEndDate()}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.statusButtons}>
              <TouchableOpacity
                style={[styles.statusButton, status === "active" && styles.statusButtonActive]}
                onPress={() => setStatus("active")}
              >
                <Text
                  style={[styles.statusButtonText, status === "active" && styles.statusButtonTextActive]}
                >
                  Vigente
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusButton, status === "paused" && styles.statusButtonActive]}
                onPress={() => setStatus("paused")}
              >
                <Text
                  style={[styles.statusButtonText, status === "paused" && styles.statusButtonTextActive]}
                >
                  Em Pausa
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusButton, status === "completed" && styles.statusButtonActive]}
                onPress={() => setStatus("completed")}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === "completed" && styles.statusButtonTextActive,
                  ]}
                >
                  Concluído
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Arquivo do Contrato (PDF)</Text>
            {contractPdfUrl ? (
              <View style={styles.pdfContainer}>
                <View style={styles.pdfInfo}>
                  <IconSymbol
                    ios_icon_name="doc.fill"
                    android_material_icon_name="description"
                    size={32}
                    color={colors.primary}
                  />
                  <View style={styles.pdfTextContainer}>
                    <Text style={styles.pdfText}>Contrato anexado</Text>
                    <Text style={styles.pdfSubtext}>PDF disponível</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.removeButton} onPress={handleRemovePdf}>
                  <IconSymbol
                    ios_icon_name="trash"
                    android_material_icon_name="delete"
                    size={20}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handlePickDocument}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="arrow.up.doc"
                      android_material_icon_name="upload-file"
                      size={24}
                      color={colors.primary}
                    />
                    <Text style={styles.uploadButtonText}>Enviar Contrato (PDF)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar Contrato</Text>
            )}
          </TouchableOpacity>
        </View>

        {contract && (
          <View style={styles.dangerButtons}>
            <TouchableOpacity
              style={[styles.archiveButton, archiving && styles.dangerButtonDisabled]}
              onPress={handleArchive}
              disabled={archiving || deleting}
            >
              {archiving ? (
                <ActivityIndicator size="small" color={colors.warning} />
              ) : (
                <Text style={styles.archiveButtonText}>ARQUIVAR</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, deleting && styles.dangerButtonDisabled]}
              onPress={handleDelete}
              disabled={archiving || deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteButtonText}>EXCLUIR</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <IOSDatePickerModal
        visible={showDatePicker}
        value={startDate}
        mode="date"
        onChange={handleDateChange}
        onConfirm={handleDateConfirm}
        onCancel={() => setShowDatePicker(false)}
      />

      <ConfirmModal
        visible={showDeleteModal}
        title="Remover Contrato"
        message="Tem certeza que deseja remover o arquivo do contrato?"
        onConfirm={confirmRemovePdf}
        onCancel={() => setShowDeleteModal(false)}
      />

      <ConfirmModal
        visible={showArchiveModal}
        title="Arquivar Contrato"
        message="Tem certeza que deseja arquivar este contrato? Ele não aparecerá mais na lista ativa."
        onConfirm={confirmArchive}
        onCancel={() => setShowArchiveModal(false)}
      />

      <ConfirmModal
        visible={showContractDeleteModal}
        title="Excluir Contrato"
        message="Tem certeza que deseja excluir permanentemente este contrato? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        onCancel={() => setShowContractDeleteModal(false)}
      />
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  babyName: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text,
    marginBottom: spacing.md,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500" as const,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calculatedDate: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.primary,
  },
  statusButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statusButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: colors.text,
  },
  statusButtonTextActive: {
    color: "#FFFFFF",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed" as const,
    gap: spacing.sm,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.primary,
  },
  pdfContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pdfInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  pdfTextContainer: {
    flex: 1,
  },
  pdfText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text,
  },
  pdfSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  removeButton: {
    padding: spacing.sm,
  },
  dangerButtons: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  archiveButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.warning,
    backgroundColor: "transparent",
  },
  archiveButtonText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: colors.warning,
    letterSpacing: 0.5,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    backgroundColor: colors.error,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  dangerButtonDisabled: {
    opacity: 0.5,
  },
  actionButtons: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
});
