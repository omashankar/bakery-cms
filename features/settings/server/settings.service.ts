import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import {
  defaultAnalyticsSettings,
  defaultCommerceSettings,
  defaultContactSettings,
  defaultGeneralSettings,
  defaultMaintenanceSettings,
  defaultModuleSettings,
  defaultSecuritySettings,
  defaultSmtpSettings,
  defaultSocialLinks,
} from "@/features/settings/lib/settings-utils";
import type { BusinessType } from "@/types/settings";

import * as repo from "./settings.repository";
import { resolveLabels, type LabelOverrides } from "./business-labels.server";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/** Per-section defaults, used by resetSection. */
const SECTION_DEFAULTS: Record<string, unknown> = {
  general: defaultGeneralSettings,
  contact: defaultContactSettings,
  social: defaultSocialLinks,
  security: defaultSecuritySettings,
  smtp: defaultSmtpSettings,
  analytics: defaultAnalyticsSettings,
  maintenance: defaultMaintenanceSettings,
  commerce: defaultCommerceSettings,
  modules: defaultModuleSettings,
  labelOverrides: {},
};

type SettingsJson = Record<string, unknown> & {
  general?: { businessType?: BusinessType };
  labelOverrides?: LabelOverrides;
};

function withLabels(json: SettingsJson) {
  const businessType = (json.general?.businessType ?? "bakery") as BusinessType;
  return {
    ...json,
    activity: [], // server keeps audit_logs separately; kept for client shape parity
    labels: resolveLabels(businessType, json.labelOverrides ?? {}),
  };
}

/** Full settings (admin only) including internal sections. */
export async function getSettings() {
  const doc = await repo.getOrCreateSettings();
  return withLabels(doc.toJSON() as SettingsJson);
}

/** Storefront-safe subset — no smtp/security/analytics secrets. */
export async function getPublicSettings() {
  const doc = await repo.getOrCreateSettings();
  // Loosely typed on purpose — we cherry-pick storefront-safe fields below.
  const json = doc.toJSON() as Record<string, any>;
  const businessType = (json.general?.businessType ?? "bakery") as BusinessType;
  return {
    general: {
      siteName: json.general?.siteName,
      siteTagline: json.general?.siteTagline,
      siteDescription: json.general?.siteDescription,
      logo: json.general?.logo,
      favicon: json.general?.favicon,
      currency: json.general?.currency,
      businessType,
    },
    contact: json.contact,
    social: (json.social ?? []).filter((s: { isActive?: boolean }) => s.isActive),
    commerce: json.commerce,
    maintenance: {
      isEnabled: json.maintenance?.isEnabled ?? false,
      message: json.maintenance?.message ?? "",
    },
    modules: json.modules,
    labels: resolveLabels(businessType, json.labelOverrides ?? {}),
  };
}

/** Resolved white-label wording for the current business type. */
export async function getLabels() {
  const doc = await repo.getOrCreateSettings();
  const json = doc.toJSON() as SettingsJson;
  const businessType = (json.general?.businessType ?? "bakery") as BusinessType;
  return resolveLabels(businessType, json.labelOverrides ?? {});
}

export async function updateSection(section: string, value: unknown, ctx: RequestCtx) {
  const doc = await repo.updateSection(section, value);
  await writeAuditLog({
    action: `settings.update.${section}`,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "settings", id: section },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return withLabels(doc.toJSON() as SettingsJson);
}

export async function resetSection(section: string, ctx: RequestCtx) {
  if (!(section in SECTION_DEFAULTS)) throw new NotFoundError("Unknown settings section");
  const doc = await repo.updateSection(section, SECTION_DEFAULTS[section]);
  await writeAuditLog({
    action: `settings.reset.${section}`,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "settings", id: section },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return withLabels(doc.toJSON() as SettingsJson);
}
