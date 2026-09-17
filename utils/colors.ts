export const lightTheme = {
  // Primary brand color (matching map & property detail green)
  primary: "#2E7D32",
  primaryDark: "#1B5E20",
  primaryLight: "#16A34A",

  // Base background colors
  background: "#FFFFFF",
  surface: "#F8FAFC",
  surfaceLight: "#FAFBFC",
  card: "#FFFFFF",

  // Text colors
  text: "#0D1B2A",
  textSecondary: "#4B5563",
  textLight: "#9CA3AF",

  // Borders & visual separators
  border: "#E2E8F0",

  // Semantic colors
  error: "#E53935",
  success: "#2E7D32",
  warning: "#F9A825",
  info: "#2E7D32",

  // UI components
  inputBackground: "#F1F5F9",
  shadow: "rgba(15, 23, 42, 0.08)",

  // Premium Modern clean styles
  borderRadius: 12,
  borderWidth: 1,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.8, // React Native shadow opacity works relative to the shadowColor's alpha
  shadowRadius: 10,
};

export const darkTheme = {
  // Primary brand color (matching map & property detail green)
  primary: "#2E7D32",
  primaryDark: "#1B5E20",
  primaryLight: "#4CAF50",

  // Background layers
  background: "#0A1929",
  surface: "#102A43",
  surfaceLight: "#1E3A5F",
  card: "#112D4E",

  // Text and borders
  text: "#E3F2FD",
  textSecondary: "#9CA3AF",
  textLight: "#6B7280",
  border: "#1E3A5F",

  // Semantic colors
  error: "#EF5350",
  success: "#81C784",
  warning: "#FBC02D",
  info: "#2E7D32",

  // UI
  inputBackground: "#1A273D",
  shadow: "rgba(0, 0, 0, 0.3)",

  // Premium Modern clean styles
  borderRadius: 12,
  borderWidth: 1,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.8,
  shadowRadius: 10,
};

export type Theme = typeof lightTheme;

