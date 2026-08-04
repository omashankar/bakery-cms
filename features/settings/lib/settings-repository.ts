import type {
  ActivityLog,
  AnalyticsSettings,
  AppSettings,
  CommerceSettings,
  ContactSettings,
  GeneralSettings,
  MaintenanceSettings,
  ModuleSettings,
  SecuritySettings,
  SmtpSettings,
  SocialLinkSettings,
} from "@/types/settings";
import {
  createActivityEntry,
  defaultAnalyticsSettings,
  defaultAppSettings,
  defaultCommerceSettings,
  defaultContactSettings,
  defaultGeneralSettings,
  defaultMaintenanceSettings,
  defaultModuleSettings,
  defaultSecuritySettings,
  defaultSmtpSettings,
  defaultSocialLinks,
  mergeAppSettings,
} from "./settings-utils";
import {
  fetchFullSettings,
  fetchPublicSettings,
  pushSection,
  SERVER_SECTIONS,
  settingsHydration,
} from "./settings-api";

const STORAGE_KEY = "bakery-cms-settings";
const MAX_ACTIVITY = 100;
export const SETTINGS_UPDATED_EVENT = "bakery-settings-updated";

function nowIso(): string {
  return new Date().toISOString();
}

function persist(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT));
}

function parseSettings(raw: string): AppSettings | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    if (!parsed?.general?.siteName) return null;
    return mergeAppSettings(parsed);
  } catch {
    return null;
  }
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultAppSettings;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    persist(defaultAppSettings);
    return defaultAppSettings;
  }

  return parseSettings(raw) ?? defaultAppSettings;
}

export function saveSettings(settings: AppSettings): AppSettings {
  const next: AppSettings = {
    ...settings,
    updatedAt: nowIso(),
  };
  persist(next);
  return next;
}

export function resetSettings(): AppSettings {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    persist(defaultAppSettings);
  }
  return defaultAppSettings;
}

function appendActivity(
  settings: AppSettings,
  action: string,
  entity: string,
  details?: string
): AppSettings {
  const entry = createActivityEntry(action, entity, details);
  const activity = [entry, ...settings.activity].slice(0, MAX_ACTIVITY);
  return { ...settings, activity, updatedAt: nowIso() };
}

/**
 * Reads the server's settings into the local store, and opens the hydration
 * gate if that read was the full, authenticated one.
 *
 * Server values are deep-merged OVER the local ones, so a section the server
 * omits keeps its existing value. `saveSettings` fires SETTINGS_UPDATED_EVENT,
 * which every live consumer already listens to.
 */
export async function hydrateSettingsFromServer(): Promise<boolean> {
  const full = await fetchFullSettings();
  const server = full ?? (await fetchPublicSettings());
  if (!server) return false;

  const current = loadSettings();
  const merged = mergeAppSettings({
    ...current,
    general: { ...current.general, ...(server.general ?? {}) },
    contact: { ...current.contact, ...(server.contact ?? {}) },
    social: server.social ?? current.social,
    security: { ...current.security, ...(server.security ?? {}) },
    smtp: { ...current.smtp, ...(server.smtp ?? {}) },
    analytics: { ...current.analytics, ...(server.analytics ?? {}) },
    maintenance: { ...current.maintenance, ...(server.maintenance ?? {}) },
    commerce: {
      ...current.commerce,
      ...(server.commerce ?? {}),
      paymentMethods: {
        ...current.commerce.paymentMethods,
        ...(server.commerce?.paymentMethods ?? {}),
      },
    },
    modules: { ...current.modules, ...(server.modules ?? {}) },
    // Activity is a client-only convenience log; the server uses audit_logs.
    activity: current.activity,
  });

  saveSettings(merged);

  // Only a FULL read may open the gate: the public subset carries no
  // smtp/security/analytics, so settling on it would still let those sections
  // be pushed as this browser's seed.
  if (full) settingsHydration.markSettled();
  return Boolean(full);
}

/**
 * Guarantees the local copy came from the server before anything is written back.
 *
 * The gate used to have exactly one opener: a `[]`-dep effect in the root
 * layout. An admin who signs in through the LOGIN FORM loads that layout while
 * anonymous — so `/api/settings` 401s and the gate stays shut — and then reaches
 * the admin by `router.push`, a soft navigation that never remounts the layout.
 * The effect never ran again, so the gate stayed shut for the entire session and
 * every settings save in the app failed with "saved on this device only". Being
 * able to open it on demand is what makes the gate safe to depend on.
 */
export async function ensureSettingsHydrated(): Promise<boolean> {
  if (settingsHydration.hasSettled()) return true;
  return hydrateSettingsFromServer();
}

/**
 * A settings slice, plus whether the SERVER took it.
 *
 * `SettingsServerSync` merges the server's copy over the local one on every
 * admin page load, so a section the server rejected is not saved — it is
 * reverted at the next navigation. That covers real settings: the session
 * timeout, the maintenance switch, tax rates, delivery fees.
 */
export interface SettingsWriteResult<T> {
  value: T;
  persisted: boolean;
}

async function updateStore(
  patch: Partial<AppSettings>,
  activity?: { action: string; entity: string; details?: string }
): Promise<SettingsWriteResult<AppSettings>> {
  // Before reading the local copy, make sure it IS the server's copy. A section
  // PUT is a replace-all, so merging a patch onto an unhydrated cache and
  // sending it is how the demo seed overwrites a real shop's settings.
  //
  // Note what this can and cannot do. The SECTIONS NOT IN `patch` are protected
  // here. The section that IS in `patch` came from the caller — a form holding a
  // snapshot — and merging server values back into it would silently undo the
  // admin's deliberate deletions. Protecting that one is the form's job: see
  // `useSettingsSection`, which keeps the fields behind a skeleton until this
  // same hydration has landed.
  const hydrated = await ensureSettingsHydrated();

  const current = loadSettings();
  let next = mergeAppSettings({ ...current, ...patch });
  if (activity) {
    next = appendActivity(next, activity.action, activity.entity, activity.details);
  }
  const saved = saveSettings(next);

  // Dual-write to the server for any changed section. This USED to be
  // fire-and-forget, discarding the boolean pushSection already computed, so
  // every settings page toasted success on a 401 or a 422 and the change
  // silently reverted on the next page load.
  const sections = Object.keys(patch).filter((key) =>
    (SERVER_SECTIONS as readonly string[]).includes(key)
  );

  // Hydration failed, so `pushSection` would refuse every one of these anyway —
  // after burning the gate's 8-second timeout each time, with the Save button
  // sitting there enabled and unlabelled. Report the failure now instead.
  if (!hydrated && sections.length > 0) {
    return { value: saved, persisted: false };
  }

  const results = await Promise.all(
    sections.map((key) => pushSection(key, saved[key as keyof AppSettings]))
  );

  // A patch touching no server-backed section (the activity log) has nothing
  // that could fail, so it is trivially persisted.
  return { value: saved, persisted: results.every(Boolean) };
}

export function getGeneralSettings(): GeneralSettings {
  return loadSettings().general;
}

export function getContactSettings(): ContactSettings {
  return loadSettings().contact;
}

export function getSocialLinks(): SocialLinkSettings[] {
  return loadSettings().social;
}

export function getActiveSocialLinks(): SocialLinkSettings[] {
  return getSocialLinks().filter((link) => link.isActive);
}

export function getSecuritySettings(): SecuritySettings {
  return loadSettings().security;
}

export function getSmtpSettings(): SmtpSettings {
  return loadSettings().smtp;
}

export function getAnalyticsSettings(): AnalyticsSettings {
  return loadSettings().analytics;
}

export function getMaintenanceSettings(): MaintenanceSettings {
  return loadSettings().maintenance;
}

export function getCommerceSettings(): CommerceSettings {
  return loadSettings().commerce;
}

export function getModuleSettings(): ModuleSettings {
  return loadSettings().modules;
}

/**
 * Wedding features (builder, wedding-cakes page/nav, wedding inquiries) are
 * bakery-only and gated by the wedding module. Shared by admin + storefront so
 * every surface hides wedding consistently.
 */
export function isWeddingEnabled(): boolean {
  const settings = loadSettings();
  return settings.general.businessType === "bakery" && settings.modules.weddingBuilder;
}

export function getActivityLog(): ActivityLog[] {
  return loadSettings().activity;
}

export async function saveGeneralSettings(
  general: GeneralSettings
): Promise<SettingsWriteResult<GeneralSettings>> {
  const { value, persisted } = await updateStore({ general }, {
    action: "updated",
    entity: "settings",
    details: "General settings saved",
  });
  return { value: value.general, persisted };
}

export async function saveContactSettings(
  contact: ContactSettings
): Promise<SettingsWriteResult<ContactSettings>> {
  const { value, persisted } = await updateStore({ contact }, {
    action: "updated",
    entity: "settings",
    details: "Contact settings saved",
  });
  return { value: value.contact, persisted };
}

export async function saveSocialLinks(
  social: SocialLinkSettings[]
): Promise<SettingsWriteResult<SocialLinkSettings[]>> {
  const { value, persisted } = await updateStore({ social }, {
    action: "updated",
    entity: "settings",
    details: "Social links updated",
  });
  return { value: value.social, persisted };
}

export async function saveSecuritySettings(
  security: SecuritySettings
): Promise<SettingsWriteResult<SecuritySettings>> {
  const { value, persisted } = await updateStore({ security }, {
    action: "updated",
    entity: "settings",
    details: "Security settings saved",
  });
  return { value: value.security, persisted };
}

export async function saveSmtpSettings(
  smtp: SmtpSettings
): Promise<SettingsWriteResult<SmtpSettings>> {
  const { value, persisted } = await updateStore({ smtp }, {
    action: "updated",
    entity: "settings",
    details: "SMTP settings saved",
  });
  return { value: value.smtp, persisted };
}

export async function saveAnalyticsSettings(
  analytics: AnalyticsSettings
): Promise<SettingsWriteResult<AnalyticsSettings>> {
  const { value, persisted } = await updateStore({ analytics }, {
    action: "updated",
    entity: "settings",
    details: "Analytics settings saved",
  });
  return { value: value.analytics, persisted };
}

export async function saveMaintenanceSettings(
  maintenance: MaintenanceSettings
): Promise<SettingsWriteResult<MaintenanceSettings>> {
  const { value, persisted } = await updateStore({ maintenance }, {
    action: maintenance.isEnabled ? "enabled" : "disabled",
    entity: "maintenance",
    details: maintenance.isEnabled
      ? "Maintenance mode enabled"
      : "Maintenance mode disabled",
  });
  return { value: value.maintenance, persisted };
}

export async function saveCommerceSettings(
  commerce: CommerceSettings
): Promise<SettingsWriteResult<CommerceSettings>> {
  const { value, persisted } = await updateStore({ commerce }, {
    action: "updated",
    entity: "settings",
    details: "Commerce settings saved",
  });
  return { value: value.commerce, persisted };
}

export async function saveModuleSettings(
  modules: ModuleSettings
): Promise<SettingsWriteResult<ModuleSettings>> {
  const { value, persisted } = await updateStore({ modules }, {
    action: "updated",
    entity: "settings",
    details: "Module settings saved",
  });
  return { value: value.modules, persisted };
}

export async function clearActivityLog(): Promise<SettingsWriteResult<ActivityLog[]>> {
  const { value, persisted } = await updateStore({ activity: [] }, {
    action: "cleared",
    entity: "activity",
    details: "Activity log cleared",
  });
  return { value: value.activity, persisted };
}

/** Section-scoped resets — do not wipe sibling settings slices. */
export function resetGeneralSettings(): Promise<SettingsWriteResult<GeneralSettings>> {
  return saveGeneralSettings({ ...defaultGeneralSettings });
}

export function resetContactSettings(): Promise<SettingsWriteResult<ContactSettings>> {
  return saveContactSettings({ ...defaultContactSettings });
}

export function resetSocialLinks(): Promise<SettingsWriteResult<SocialLinkSettings[]>> {
  return saveSocialLinks(defaultSocialLinks.map((link) => ({ ...link })));
}

export function resetSecuritySettings(): Promise<SettingsWriteResult<SecuritySettings>> {
  return saveSecuritySettings({ ...defaultSecuritySettings });
}

export function resetSmtpSettings(): Promise<SettingsWriteResult<SmtpSettings>> {
  return saveSmtpSettings({ ...defaultSmtpSettings });
}

export function resetAnalyticsSettings(): Promise<SettingsWriteResult<AnalyticsSettings>> {
  return saveAnalyticsSettings({ ...defaultAnalyticsSettings });
}

export function resetMaintenanceSettings(): Promise<SettingsWriteResult<MaintenanceSettings>> {
  return saveMaintenanceSettings({ ...defaultMaintenanceSettings });
}

export function resetCommerceSettings(): Promise<SettingsWriteResult<CommerceSettings>> {
  return saveCommerceSettings({
    ...defaultCommerceSettings,
    paymentMethods: { ...defaultCommerceSettings.paymentMethods },
    deliveryTimeSlots: [...defaultCommerceSettings.deliveryTimeSlots],
  });
}

export function resetModuleSettings(): Promise<SettingsWriteResult<ModuleSettings>> {
  return saveModuleSettings({ ...defaultModuleSettings });
}

export function exportLocalStorageBackup(): Record<string, string | null> {
  if (typeof window === "undefined") return {};

  const backup: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("bakery-cms")) {
      backup[key] = localStorage.getItem(key);
    }
  }
  return backup;
}

export function importLocalStorageBackup(
  backup: Record<string, string | null>
): number {
  if (typeof window === "undefined") return 0;

  let count = 0;
  for (const [key, value] of Object.entries(backup)) {
    if (!key.startsWith("bakery-cms") || value === null) continue;
    localStorage.setItem(key, value);
    count += 1;
  }
  return count;
}
