
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 PREMIUM DESIGN SYSTEM - TODANOITE
// Professional Sleep Consultancy Platform
// ═══════════════════════════════════════════════════════════════════════════

export const colors = {
  // ─── Premium Palette ─────────────────────────────────────────────────────
  primary: '#2F4F6F',        // Azul profundo elegante
  secondary: '#6C9A8B',      // Verde sutil clínico
  background: '#F4F6F8',     // Off-white clean
  card: '#FFFFFF',           // Pure white for cards
  text: '#1F2933',           // Texto principal
  textSecondary: '#6B7280',  // Subtle gray for secondary text
  
  // ─── Status Colors (Refined) ─────────────────────────────────────────────
  statusGood: '#6C9A8B',     // Verde sálvia
  statusMedium: '#D4A574',   // Warm amber
  statusPoor: '#C17B7B',     // Muted red
  
  // ─── UI Elements ─────────────────────────────────────────────────────────
  border: '#E6E9ED',         // Cinza neutro
  backgroundAlt: '#EEF0FB',
  accent: '#D4A574',
  highlight: '#6C9A8B',
  error: '#C17B7B',
  success: '#6C9A8B',
  warning: '#D4A574',
  grey: '#9CA3AF',
  shadow: 'rgba(47, 79, 111, 0.08)',  // Sombra suave baseada no primary
};

// ═══════════════════════════════════════════════════════════════════════════
// 📝 PREMIUM TYPOGRAPHY SYSTEM
// Hierarquia clara e profissional
// ═══════════════════════════════════════════════════════════════════════════

export const typography = {
  // ─── Títulos (Semi-bold) ─────────────────────────────────────────────────
  h1: {
    fontSize: 32,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
    lineHeight: 40,
    color: colors.text,
  },
  h2: {
    fontSize: 26,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    lineHeight: 34,
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
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: 0,
    lineHeight: 26,
    color: colors.text,
  },
  
  // ─── Subtítulos (Medium) ─────────────────────────────────────────────────
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
  
  // ─── Corpo (Regular) ─────────────────────────────────────────────────────
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 26,
    color: colors.text,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 26,
    color: colors.text,
  },
  body2: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  
  // ─── Small Text ──────────────────────────────────────────────────────────
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  
  // ─── Labels (Semi-bold) ──────────────────────────────────────────────────
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    lineHeight: 20,
    color: colors.text,
  },
  
  // ─── Button Text (Semi-bold) ─────────────────────────────────────────────
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    lineHeight: 24,
    color: colors.text,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 📏 PREMIUM SPACING SYSTEM
// Espaçamento maior entre blocos
// ═══════════════════════════════════════════════════════════════════════════

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔲 BORDER RADIUS SYSTEM
// BorderRadius 18 para cards elegantes
// ═══════════════════════════════════════════════════════════════════════════

export const borderRadius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  full: 9999,
};

// ═══════════════════════════════════════════════════════════════════════════
// 🌫️ PREMIUM SHADOW SYSTEM
// Sombras suaves e elegantes
// ═══════════════════════════════════════════════════════════════════════════

export const shadows = {
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  xl: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 BUTTON STYLES
// Botões premium com altura confortável
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ COMMON STYLES
// Estilos base para o app
// ═══════════════════════════════════════════════════════════════════════════

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
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginVertical: spacing.md,
    width: '100%',
    ...shadows.md,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: "white",
  },
});
