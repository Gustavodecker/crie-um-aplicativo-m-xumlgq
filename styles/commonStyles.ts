import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// Professional Sleep Consultant Platform - Sophisticated, clinical, premium
export const colors = {
  // Professional palette: Blue-gray + Off-white + Sage green
  primary: '#5B7C99',        // Sophisticated blue-gray
  secondary: '#8FA998',      // Sage green
  accent: '#7B9BAD',         // Light blue-gray
  background: '#F8F9FA',     // Off-white background
  card: '#FFFFFF',           // Pure white cards
  cardSecondary: '#F5F7F9',  // Light gray card variant
  text: '#2C3E50',           // Dark blue-gray text
  textSecondary: '#6B7C8E',  // Medium gray text
  textLight: '#95A5B8',      // Light gray text
  border: '#E1E8ED',         // Soft border
  error: '#C97064',          // Muted red for errors
  success: '#8FA998',        // Sage green for success
  warning: '#D4A574',        // Warm beige for warnings
  backgroundAlt: '#F5F7F9',  // Alternative background
  grey: '#95A5B8',           // Gray
  highlight: '#8FA998',      // Highlight color
  
  // Status colors for sleep tracking
  statusGood: '#8FA998',     // Sage green
  statusMedium: '#D4A574',   // Warm beige
  statusPoor: '#C97064',     // Muted red
  
  // Shadow
  shadow: 'rgba(91, 124, 153, 0.08)',
};

export const buttonStyles = StyleSheet.create({
  instructionsButton: {
    backgroundColor: colors.primary,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    backgroundColor: colors.backgroundAlt,
    alignSelf: 'center',
    width: '100%',
  },
});

export const commonStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 800,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 10
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.grey,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
    width: '100%',
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: "white",
  },
});
