import { connectDB } from "@/lib/server/db/mongoose";
import { SettingsModel } from "@/lib/server/db/models/settings.model";
import { defaultAppSettings } from "@/features/settings/lib/settings-utils";

/**
 * Settings repository — data access for the singleton settings document.
 * Seeds from the same `defaultAppSettings` the frontend uses, so a fresh
 * install matches the bakery template exactly.
 */

const SINGLETON = "singleton";

export async function getOrCreateSettings() {
  await connectDB();
  const existing = await SettingsModel.findOne({ key: SINGLETON });
  if (existing) return existing;

  return SettingsModel.create({
    key: SINGLETON,
    general: defaultAppSettings.general,
    contact: defaultAppSettings.contact,
    social: defaultAppSettings.social,
    security: defaultAppSettings.security,
    smtp: defaultAppSettings.smtp,
    analytics: defaultAppSettings.analytics,
    maintenance: defaultAppSettings.maintenance,
    commerce: defaultAppSettings.commerce,
    modules: defaultAppSettings.modules,
    labelOverrides: {},
  });
}

export async function updateSection(section: string, value: unknown) {
  // getOrCreate first so the return is always a live (non-null) document, and
  // set-by-path keeps the update strongly scoped to the one section.
  const doc = await getOrCreateSettings();
  doc.set(section, value);
  await doc.save();
  return doc;
}
