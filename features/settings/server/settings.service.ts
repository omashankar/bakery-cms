import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import { resetMailTransport } from "@/lib/server/mail/transport";
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
  isSafeSocialUrl,
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
      // Not a secret, and the storefront needs it: every date it renders is
      // formatted in the store's timezone, not the visitor's machine zone.
      timezone: json.general?.timezone,
      businessType,
    },
    contact: json.contact,
    // Active AND renderable. This payload feeds any client that asks, so the
    // href guard belongs at the boundary rather than only in the surfaces that
    // happen to render it today — the field was free text for the life of the
    // project, so what is at rest can still be a `javascript:` URL.
    social: (json.social ?? [])
      .filter((s: { isActive?: boolean }) => s.isActive)
      .filter((s: { href?: string }) => isSafeSocialUrl(s.href ?? "")),
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

/**
 * A blank mail password means "keep the one you have".
 *
 * The controller stops the stored password reaching the browser, so the admin
 * form no longer holds it — which means every SMTP save would otherwise arrive
 * with an empty password and wipe the shop's real credential. Correcting the
 * From-name would silently stop all outbound mail.
 *
 * It also covers a restore: a backup taken after this change carries no
 * password, and restoring one must not blank a working configuration. To
 * actually CLEAR the password an admin sets the section back to defaults, which
 * goes through `resetSection` and does not come here.
 */
async function keepStoredMailPassword(section: string, value: unknown): Promise<unknown> {
  if (section !== "smtp") return value;

  const incoming = value as { password?: unknown } | null;
  if (typeof incoming?.password === "string" && incoming.password) return value;

  const current = (await repo.getOrCreateSettings()).toJSON() as {
    smtp?: { password?: string };
  };
  const stored = current.smtp?.password;
  if (!stored) return value;

  return { ...(incoming ?? {}), password: stored };
}

export async function updateSection(section: string, value: unknown, ctx: RequestCtx) {
  const doc = await repo.updateSection(section, await keepStoredMailPassword(section, value));
  // The mail transport is cached across requests, so new credentials must not
  // keep failing against the old ones.
  if (section === "smtp") resetMailTransport();
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
  if (section === "smtp") resetMailTransport();
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
