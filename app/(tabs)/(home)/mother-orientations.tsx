
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { apiGet } from "@/utils/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Baby {
  id: string;
  name: string;
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

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatDateToBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} às ${hours}:${minutes}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MotherOrientationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [baby, setBaby] = useState<Baby | null>(null);
  const [orientations, setOrientations] = useState<Orientation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    console.log("[Mother Orientations] Loading data");
    try {
      // Load baby data
      const babyData = await apiGet<Baby>("/api/mother/baby");
      console.log("[Mother Orientations] Baby loaded:", babyData.name);
      setBaby(babyData);

      // Load orientations
      const orientationsData = await apiGet<Orientation[]>(`/api/orientations/baby/${babyData.id}`);
      console.log("[Mother Orientations] Loaded", orientationsData.length, "orientations");
      
      // Sort by date descending (most recent first)
      const sorted = orientationsData.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setOrientations(sorted);
    } catch (error: any) {
      console.error("[Mother Orientations] Error loading data:", error);
      setError(error.message || "Erro ao carregar orientações");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !baby) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ 
          headerShown: true, 
          title: "Orientações",
          headerBackTitle: "Voltar",
        }} />
        <View style={styles.errorContainer}>
          <IconSymbol 
            ios_icon_name="exclamationmark.triangle.fill" 
            android_material_icon_name="warning" 
            size={64} 
            color={colors.error} 
          />
          <Text style={styles.errorTitle}>Ops!</Text>
          <Text style={styles.errorText}>
            {error || "Não foi possível carregar as orientações"}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: "Orientações",
        headerBackTitle: "Voltar",
      }} />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => { 
              setRefreshing(true); 
              loadData(); 
            }} 
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <IconSymbol 
            ios_icon_name="lightbulb.fill" 
            android_material_icon_name="lightbulb" 
            size={32} 
            color={colors.secondary} 
          />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Orientações Profissionais</Text>
            <Text style={styles.headerSubtitle}>
              Recomendações da sua consultora
            </Text>
          </View>
        </View>

        {/* Orientations List */}
        {orientations.length > 0 ? (
          orientations.map((orientation, index) => {
            const isExpanded = expandedId === orientation.id;
            const dateText = formatDateToBR(orientation.date);
            const updatedText = formatDateTime(orientation.updatedAt);

            return (
              <View key={orientation.id} style={styles.orientationCard}>
                <TouchableOpacity 
                  style={styles.orientationHeader}
                  onPress={() => toggleExpanded(orientation.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.orientationHeaderLeft}>
                    <View style={styles.orientationNumber}>
                      <Text style={styles.orientationNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.orientationHeaderInfo}>
                      <Text style={styles.orientationDate}>{dateText}</Text>
                      <Text style={styles.orientationUpdated}>
                        Atualizado: {updatedText}
                      </Text>
                    </View>
                  </View>
                  <IconSymbol 
                    ios_icon_name={isExpanded ? "chevron.up" : "chevron.down"} 
                    android_material_icon_name={isExpanded ? "expand-less" : "expand-more"} 
                    size={24} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.orientationContent}>
                    <View style={styles.orientationSection}>
                      <View style={styles.orientationSectionHeader}>
                        <IconSymbol 
                          ios_icon_name="doc.text.fill" 
                          android_material_icon_name="description" 
                          size={20} 
                          color={colors.primary} 
                        />
                        <Text style={styles.orientationSectionTitle}>
                          Orientação
                        </Text>
                      </View>
                      <Text style={styles.orientationText}>
                        {orientation.orientationText}
                      </Text>
                    </View>

                    {orientation.results && (
                      <View style={styles.orientationSection}>
                        <View style={styles.orientationSectionHeader}>
                          <IconSymbol 
                            ios_icon_name="checkmark.circle.fill" 
                            android_material_icon_name="check-circle" 
                            size={20} 
                            color={colors.success} 
                          />
                          <Text style={styles.orientationSectionTitle}>
                            Resultados
                          </Text>
                        </View>
                        <Text style={styles.orientationText}>
                          {orientation.results}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <IconSymbol 
              ios_icon_name="doc.text" 
              android_material_icon_name="description" 
              size={64} 
              color={colors.textSecondary} 
            />
            <Text style={styles.emptyStateTitle}>
              Nenhuma orientação ainda
            </Text>
            <Text style={styles.emptyStateText}>
              Sua consultora adicionará orientações conforme acompanha a evolução do sono do seu bebê.
            </Text>
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <IconSymbol 
            ios_icon_name="info.circle.fill" 
            android_material_icon_name="info" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={styles.infoText}>
            As orientações são personalizadas para o seu bebê. Siga as recomendações e registre a rotina diariamente para melhores resultados.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  errorTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  retryButtonText: {
    ...typography.button,
    color: "#FFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  orientationCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  orientationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
  },
  orientationHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  orientationNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  orientationNumberText: {
    ...typography.h3,
    color: "#FFF",
  },
  orientationHeaderInfo: {
    flex: 1,
  },
  orientationDate: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  orientationUpdated: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  orientationContent: {
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.lg,
  },
  orientationSection: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  orientationSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  orientationSectionTitle: {
    ...typography.h4,
  },
  orientationText: {
    ...typography.body,
    lineHeight: 22,
    color: colors.text,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyStateTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
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
