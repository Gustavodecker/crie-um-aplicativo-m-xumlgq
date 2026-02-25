
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from "react-native";
import { colors, typography, spacing, shadows } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: {
    ios: string;
    android: string;
    color: string;
  };
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmColor = colors.error,
  loading = false,
  onConfirm,
  onCancel,
  icon,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {icon && (
            <View style={styles.iconContainer}>
              <IconSymbol
                ios_icon_name={icon.ios}
                android_material_icon_name={icon.android}
                size={56}
                color={icon.color}
              />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: confirmColor },
                loading && { opacity: 0.6 },
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(47, 62, 70, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  content: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.xxxl,
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    ...shadows.xl,
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  message: {
    ...typography.body1,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  button: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  confirmButton: {
    backgroundColor: colors.error,
    ...shadows.sm,
  },
  cancelButtonText: {
    ...typography.label,
    fontSize: 16,
    color: colors.text,
  },
  confirmButtonText: {
    ...typography.label,
    fontSize: 16,
    color: "#FFFFFF",
  },
});
