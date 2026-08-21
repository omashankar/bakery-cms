/** Appearance settings feature module — Phase 17 */
export { AppearancePage } from "./components/appearance-page";
export {
  loadAppearanceSettings,
  saveAppearanceSettings,
  resetAppearanceSettings,
  syncAppearanceTheme,
} from "@/features/site-layout/lib/appearance-repository";
export {
  appearancePresets,
  defaultAppearanceSettings,
  applyAppearanceSettings,
  applyAppearanceSettingsTo,
  APPEARANCE_UPDATED_EVENT,
} from "@/features/site-layout/lib/appearance-utils";
export { APPEARANCE_STORAGE_KEY } from "@/features/site-layout/lib/appearance-repository";
