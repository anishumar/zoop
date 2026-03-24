import { ColorSchemeName, useColorScheme } from "react-native";

const ACCENT = "rgb(46,108,221)";

export interface AppTheme {
  mode: "light" | "dark";
  accent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textOnAccent: string;
  danger: string;
  success: string;
}

export function getTheme(scheme: ColorSchemeName): AppTheme {
  const isDark = scheme !== "light";

  if (isDark) {
    return {
      mode: "dark",
      accent: ACCENT,
      background: "rgb(0,0,0)",
      surface: "#101010",
      surfaceAlt: "#161616",
      border: "#262626",
      text: "#ffffff",
      textMuted: "#a3a3a3",
      textOnAccent: "#ffffff",
      danger: "#ef4444",
      success: "#22c55e",
    };
  }

  return {
    mode: "light",
    accent: ACCENT,
    background: "rgb(255,255,255)",
    surface: "#f5f5f5",
    surfaceAlt: "#f0f0f0",
    border: "#e5e5e5",
    text: "#000000",
    textMuted: "#525252",
    textOnAccent: "#ffffff",
    danger: "#dc2626",
    success: "#16a34a",
  };
}

export function useAppTheme() {
  return getTheme(useColorScheme());
}

