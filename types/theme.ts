export type ThemeMode = "light" | "dark";

export interface ThemeConfig {
  mode: ThemeMode;
  primaryColor: string;
  accentColor: string;
  borderRadius: "sm" | "md" | "lg" | "xl";
  fontFamily: "sans" | "heading";
}

export const defaultThemeConfig: ThemeConfig = {
  mode: "light",
  primaryColor: "bakery",
  accentColor: "gold",
  borderRadius: "lg",
  fontFamily: "sans",
};
