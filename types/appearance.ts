export type AppearancePreset = "monginis" | "espresso" | "rose-cocoa" | "custom";

export interface AppearanceSettings {
  preset: AppearancePreset;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  borderRadius: 12 | 16;
}

export interface AppearancePresetDefinition {
  id: Exclude<AppearancePreset, "custom">;
  name: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  swatches: string[];
}
