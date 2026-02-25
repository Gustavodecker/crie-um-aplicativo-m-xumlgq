
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";

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
  const displayTitle = professionalTitle || "Consultora de Sono Infantil";
  const displayDescription = description || "Especialista em rotinas de sono e desenvolvimento infantil.";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.badge}>CONSULTORA</Text>
        </View>
        {isConsultant && onEdit && (
          <TouchableOpacity style={styles.editButton} onPress={onEdit}>
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
                size={48}
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    gap: 16,
  },
  photoContainer: {
    width: 80,
    height: 80,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.background,
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.secondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
    lineHeight: 26,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
