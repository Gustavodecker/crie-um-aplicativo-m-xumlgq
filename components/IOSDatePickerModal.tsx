
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { colors, spacing, borderRadius, typography } from "@/styles/commonStyles";

interface IOSDatePickerModalProps {
  visible: boolean;
  value: Date;
  mode: "date" | "time";
  maximumDate?: Date;
  minimumDate?: Date;
  is24Hour?: boolean;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

/**
 * On iOS, wraps DateTimePicker in a dark gray bottom-sheet modal so the spinner
 * wheels are always readable regardless of the screen's background color.
 * On Android, renders the native picker directly (no modal wrapper needed).
 */
export function IOSDatePickerModal({
  visible,
  value,
  mode,
  maximumDate,
  minimumDate,
  is24Hour,
  onChange,
  onConfirm,
  onCancel,
}: IOSDatePickerModalProps) {
  const [internalDate, setInternalDate] = React.useState(value);

  // Keep internal date in sync when the modal opens with a new value
  React.useEffect(() => {
    if (visible) {
      setInternalDate(value);
    }
  }, [visible, value]);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setInternalDate(date);
    }
    onChange(event, date);
  };

  if (Platform.OS !== "ios") {
    // Android: render inline without modal wrapper
    if (!visible) return null;
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        is24Hour={is24Hour}
        onChange={onChange}
      />
    );
  }

  const confirmLabel = mode === "date" ? "Confirmar Data" : "Confirmar Hora";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onCancel}
      />
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handle} />
        {/* Header toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={onCancel} style={styles.toolbarButton}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.toolbarTitle}>
            {mode === "date" ? "Selecionar Data" : "Selecionar Hora"}
          </Text>
          <TouchableOpacity
            onPress={() => onConfirm(internalDate)}
            style={styles.toolbarButton}
          >
            <Text style={styles.confirmText}>Confirmar</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Picker on white background */}
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={internalDate}
            mode={mode}
            display="spinner"
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            is24Hour={is24Hour}
            onChange={handleChange}
            themeVariant="dark"
            style={styles.picker}
          />
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => onConfirm(internalDate)}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const DARK_BG = "#2C2C2E";
const DARK_TOOLBAR = "#2C2C2E";
const DARK_SEPARATOR = "#48484A";
const DARK_HANDLE = "#636366";

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: DARK_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // safe area bottom
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: DARK_HANDLE,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: DARK_TOOLBAR,
  },
  toolbarButton: {
    minWidth: 80,
  },
  toolbarTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    flex: 1,
  },
  cancelText: {
    fontSize: 16,
    color: "#EBEBF5CC",
    fontWeight: "500",
  },
  confirmText: {
    fontSize: 16,
    color: "#4DB6FF",
    fontWeight: "600",
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: DARK_SEPARATOR,
  },
  pickerContainer: {
    backgroundColor: DARK_BG,
    alignItems: "center",
  },
  picker: {
    width: "100%",
    backgroundColor: DARK_BG,
  },
  confirmButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
