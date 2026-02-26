
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { colors, typography, spacing, shadows } from "@/styles/commonStyles";

interface ConsultantProfileCardProps {
  name: string;
  professionalTitle?: string;
  description?: string;
  photoUrl?: string;
  onEdit?: () => void;
  isConsultant?: boolean;
}

// Helper to resolve image sources (handles both local require() and remote URLs)
function resolveImageSource(source: string | number | undefined): { uri: string } | number {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as number;
}

export function ConsultantProfileCard({
  name,
  professionalTitle,
  description,
  photoUrl,
  onEdit,
  isConsultant = false,
}: ConsultantProfileCardProps) {
  const router = useRouter();
  const displayTitle = professionalTitle || "Consultora de Sono Infantil";
  const displayDescription = description || "Especialista em rotinas de sono e desenvolvimento infantil saudável.";

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    } else {
      router.push("/edit-consultant-profile");
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.badge}>CONSULTORA</Text>
        </View>
        {isConsultant && (
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <IconSymbol
              ios_icon_name="pencil"
              android_material_icon_name="edit"
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.photoContainer}>
          {photoUrl ? (
            <Image source={resolveImageSource(photoUrl)} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={52}
                color={colors.primary}
              />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.description} numberOfLines={4}>
            {displayDescription}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.xxl,
    marginBottom: spacing.xxxl,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  headerLeft: {
    flex: 1,
  },
  badge: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  content: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  photoContainer: {
    width: 88,
    height: 88,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  title: {
    ...typography.body2,
    fontWeight: "600",
    color: colors.secondary,
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body2,
    lineHeight: 22,
  },
});
