/** Appearance settings feature module — Phase 17 */
export { AppearancePage } from "./components/appearance-page";
export {
  loadAppearanceSettings,
  saveAppearanceSettings,
  resetAppearanceSettings,
  syncAppearanceTheme,
} from "./lib/appearance-repository";
export {
  appearancePresets,
  defaultAppearanceSettings,
  applyAppearanceSettings,
  applyAppearanceSettingsTo,
  APPEARANCE_UPDATED_EVENT,
} from "./lib/appearance-utils";
export { APPEARANCE_STORAGE_KEY } from "./lib/appearance-repository";
