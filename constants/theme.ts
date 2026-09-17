/**
 * Professional Blue Theme for the app
 * Supports both Light and Dark mode.
 */

import { Platform } from "react-native";

// Main color palette
const primaryGreen = "#2E7D32"; // Main green (matching maps & property detail)
const lightGreen = "#16A34A";   // Accent / hover
const darkGreen = "#1B5E20";    // Darker variant for contrast
const gray = "#F8FAFC";        // Background gray for light mode (slate-50)

export const Colors = {
  light: {
    text: "#0D1B2A",             // Dark navy text for clarity
    textSecondary: "#4F5B62",    // Muted gray-blue text
    background: "#FFFFFF",       // Pure white background
    surface: gray,               // Card / surface background
    border: "#E2E8F0",           // Divider and border lines
    tint: primaryGreen,          // Button, link, or highlight color
    accent: lightGreen,          // For subtle highlights
    icon: "#5C6B73",             // Default icon color
    tabIconDefault: "#8E9AAF",
    tabIconSelected: primaryGreen,
    error: "#E53935",
  },

  dark: {
    text: "#E3F2FD",             // Very light blue text
    textSecondary: "#90A4AE",    // Muted secondary text
    background: "#0A1929",       // Deep navy background
    surface: "#102A43",          // Slightly lighter surface
    border: "#1E3A5F",
    tint: lightGreen,
    accent: primaryGreen,
    icon: "#B0BEC5",
    tabIconDefault: "#78909C",
    tabIconSelected: lightGreen,
    error: "#EF5350",
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
