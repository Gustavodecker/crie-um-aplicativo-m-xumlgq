
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// Premium Sleep Consultant App Theme - Sophisticated & Professional
export const colors = {
  // Premium palette
  primary: '#4F6D7A',        // Azul acinzentado sofisticado
  secondary: '#8AA399',      // Verde sálvia elegante
  background: '#F7F9F9',     // Off-white clean
  card: '#FFFFFF',           // Pure white for cards
  text: '#2F3E46',           // Cinza escuro for primary text
  textSecondary: '#6B7280',  // Subtle gray for secondary text
  
  // Status colors (refined)
  statusGood: '#8AA399',     // Verde sálvia
  statusMedium: '#D4A574',   // Warm amber
  statusPoor: '#C17B7B',     // Muted red
  
  // UI elements
  border: '#E5E7EB',
  backgroundAlt: '#EEF0FB',
  accent: '#D4A574',
  highlight: '#8AA399',
  error: '#C17B7B',
  success: '#8AA399',
  warning: '#D4A574',
  grey: '#9CA3AF',
  shadow: 'rgba(47, 62, 70, 0.08)',
};

// Premium typography system
export const typography = {
  // Titles
  h1: {
    fontSize: 32,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
    lineHeight: 40,
    color: colors.text,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    lineHeight: 32,
    color: colors.text,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 28,
    color: colors.text,
  },
  h4: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0,
    lineHeight: 24,
    color: colors.text,
  },
  
  // Subtitles
  subtitle1: {
    fontSize: 18,
    fontWeight: '500' as const,
    letterSpacing: 0,
    lineHeight: 26,
    color: colors.text,
  },
  subtitle2: {
    fontSize: 16,
    fontWeight: '500' as const,
    letterSpacing: 0,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  
  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 24,
    color: colors.text,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 24,
    color: colors.text,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  
  // Small text
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    letterSpacing: 0.3,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  
  // Labels
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    lineHeight: 20,
    color: colors.text,
  },
  
  // Button text
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    lineHeight: 24,
    color: colors.text,
  },
};

// Premium spacing system
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Border radius system
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

// Premium shadow system
export const shadows = {
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
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
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  text: {
    ...typography.body1,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    width: '100%',
    ...shadows.md,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: "white",
  },
});
