/*
  EIGHT PALETTES, AND ONLY THREE OF THEM BROWN.

  The first three are the ones that shipped, and their ids are kept exactly
  as they are because a saved `preset` in the database names one of them.
  A rename here would read back as `custom` on every shop that had chosen
  one.

  The five that follow exist because this CMS is not a bakery CMS. A florist
  or a gift shop opening the Appearance screen had three shades of brown to
  pick from and, past that, a hex field.
*/
export type AppearancePreset =
  | "classic"
  | "espresso"
  | "rose-cocoa"
  | "ink"
  | "forest"
  | "plum"
  | "teal"
  | "slate"
  | "custom";

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
