import type {
  ActivityLog,
  AnalyticsSettings,
  AppSettings,
  CommerceSettings,
  ContactSettings,
  GeneralSettings,
  MaintenanceSettings,
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
  defaultSecuritySettings,
  defaultSmtpSettings,
  defaultSocialLinks,
  mergeAppSettings,
} from "./settings-utils";

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

function updateStore(
  patch: Partial<AppSettings>,
  activity?: { action: string; entity: string; details?: string }
): AppSettings {
  const current = loadSettings();
  let next = mergeAppSettings({ ...current, ...patch });
  if (activity) {
    next = appendActivity(next, activity.action, activity.entity, activity.details);
  }
  return saveSettings(next);
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

export function getActivityLog(): ActivityLog[] {
  return loadSettings().activity;
}

export function saveGeneralSettings(general: GeneralSettings): GeneralSettings {
  const saved = updateStore({ general }, {
    action: "updated",
    entity: "settings",
    details: "General settings saved",
  });
  return saved.general;
}

export function saveContactSettings(contact: ContactSettings): ContactSettings {
  const saved = updateStore({ contact }, {
    action: "updated",
    entity: "settings",
    details: "Contact settings saved",
  });
  return saved.contact;
}

export function saveSocialLinks(social: SocialLinkSettings[]): SocialLinkSettings[] {
  const saved = updateStore({ social }, {
    action: "updated",
    entity: "settings",
    details: "Social links updated",
  });
  return saved.social;
}

export function saveSecuritySettings(security: SecuritySettings): SecuritySettings {
  const saved = updateStore({ security }, {
    action: "updated",
    entity: "settings",
    details: "Security settings saved",
  });
  return saved.security;
}

export function saveSmtpSettings(smtp: SmtpSettings): SmtpSettings {
  const saved = updateStore({ smtp }, {
    action: "updated",
    entity: "settings",
    details: "SMTP settings saved",
  });
  return saved.smtp;
}

export function saveAnalyticsSettings(
  analytics: AnalyticsSettings
): AnalyticsSettings {
  const saved = updateStore({ analytics }, {
    action: "updated",
    entity: "settings",
    details: "Analytics settings saved",
  });
  return saved.analytics;
}

export function saveMaintenanceSettings(
  maintenance: MaintenanceSettings
): MaintenanceSettings {
  const saved = updateStore({ maintenance }, {
    action: maintenance.isEnabled ? "enabled" : "disabled",
    entity: "maintenance",
    details: maintenance.isEnabled
      ? "Maintenance mode enabled"
      : "Maintenance mode disabled",
  });
  return saved.maintenance;
}

export function saveCommerceSettings(commerce: CommerceSettings): CommerceSettings {
  const saved = updateStore({ commerce }, {
    action: "updated",
    entity: "settings",
    details: "Commerce settings saved",
  });
  return saved.commerce;
}

export function clearActivityLog(): ActivityLog[] {
  const saved = updateStore({ activity: [] }, {
    action: "cleared",
    entity: "activity",
    details: "Activity log cleared",
  });
  return saved.activity;
}

/** Section-scoped resets — do not wipe sibling settings slices. */
export function resetGeneralSettings(): GeneralSettings {
  return saveGeneralSettings({ ...defaultGeneralSettings });
}

export function resetContactSettings(): ContactSettings {
  return saveContactSettings({ ...defaultContactSettings });
}

export function resetSocialLinks(): SocialLinkSettings[] {
  return saveSocialLinks(defaultSocialLinks.map((link) => ({ ...link })));
}

export function resetSecuritySettings(): SecuritySettings {
  return saveSecuritySettings({ ...defaultSecuritySettings });
}

export function resetSmtpSettings(): SmtpSettings {
  return saveSmtpSettings({ ...defaultSmtpSettings });
}

export function resetAnalyticsSettings(): AnalyticsSettings {
  return saveAnalyticsSettings({ ...defaultAnalyticsSettings });
}

export function resetMaintenanceSettings(): MaintenanceSettings {
  return saveMaintenanceSettings({ ...defaultMaintenanceSettings });
}

export function resetCommerceSettings(): CommerceSettings {
  return saveCommerceSettings({
    ...defaultCommerceSettings,
    paymentMethods: { ...defaultCommerceSettings.paymentMethods },
    deliveryTimeSlots: [...defaultCommerceSettings.deliveryTimeSlots],
  });
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
