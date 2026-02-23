
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/styles/commonStyles";

export default function ReportsLandscapeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Reports Landscape Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 18,
    color: colors.text,
  },
});
