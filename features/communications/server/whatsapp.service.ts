import "server-only";

import { getSettings } from "@/features/settings/server/settings.service";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { getTemplates, writeTemplates } from "./communications.service";
import {
  listMetaTemplates,
  sendWhatsAppTemplate,
  type MetaTemplateSummary,
  type WhatsAppResult,
} from "./whatsapp-client.server";
import { WHATSAPP_VARIABLE_CONTRACT } from "@/features/communications/lib/template-contract";
import { getSampleDataForVariables } from "@/apps/admin/communications/lib/template-sample-data";
import type { WhatsAppTemplateRecord } from "@/types/communication";
import type { ContactSettings, GeneralSettings } from "@/types/settings";
import type { MetaSyncSummary, WhatsAppApprovalStatus } from "@/types/whatsapp-provider";

export type { MetaSyncSummary };

/**
 * Sending a stored WhatsApp template — the counterpart of `sendTemplatedEmail`.
 *
 * The difference between the two is the whole reason this file is separate.
 * An email template IS the message: render it, send it, done. A WhatsApp
 * template is a local record that POINTS AT wording Meta approved, and the only
 * thing this app supplies at send time is an ordered list of parameter values.
 * Getting that order wrong is not a rendering glitch — it sends the customer
 * their delivery date where the total should be, in Meta-approved wording, and
 * nothing in the response says anything is wrong.
 */

/**
 * The slugs the shop sends over WhatsApp, mirroring `EmailTemplateSlug`.
 *
 * Written out rather than derived from the contract with `keyof typeof`. That
 * looks tighter and is strictly weaker: the contract is typed
 * `Record<string, readonly string[]>`, so its `keyof` is plain `string` and
 * every call site would accept a typo'd slug — which then finds no template and
 * silently sends nothing, on a live order. `contractCoversEverySlug` below keeps
 * the two honest.
 */
export type WhatsAppTemplateSlug = "order_confirmation" | "order_ready" | "delivery_update";

export const WHATSAPP_SENDABLE_SLUGS: WhatsAppTemplateSlug[] = [
  "order_confirmation",
  "order_ready",
  "delivery_update",
];

/**
 * True when the union above and the variable contract describe the same set.
 *
 * Two hand-maintained lists that must agree; a test asserts this rather than
 * trusting that whoever adds the third one remembers the second.
 */
export function contractCoversEverySlug(): boolean {
  const contract = Object.keys(WHATSAPP_VARIABLE_CONTRACT).sort();
  return JSON.stringify([...WHATSAPP_SENDABLE_SLUGS].sort()) === JSON.stringify(contract);
}

async function findTemplate(slug: string): Promise<WhatsAppTemplateRecord | null> {
  try {
    const templates = (await getTemplates("whatsapp-templates")) as WhatsAppTemplateRecord[];
    // Active only, so a shop can park a template as a draft and have it stop
    // going out — the same rule the email side follows.
    return templates.find((item) => item.slug === slug && item.status === "active") ?? null;
  } catch {
    return null;
  }
}

/** The store's own details, merged into every send. Mirrors `storeIdentity`. */
async function storeIdentity(): Promise<Record<string, string>> {
  const fallback = { store_name: "Our bakery", store_phone: "", store_email: "" };
  try {
    const settings = (await getSettings()) as {
      general?: GeneralSettings;
      contact?: ContactSettings;
    };
    return {
      store_name: settings.general?.siteName?.trim() || fallback.store_name,
      store_phone: settings.contact?.phone?.trim() ?? "",
      store_email: settings.contact?.email?.trim() ?? "",
    };
  } catch {
    return fallback;
  }
}

/**
 * Turns the template's parameter MAPPING into the values Meta expects.
 *
 * `metaParameters` is an ordered list of local variable names — position 0 fills
 * `{{1}}`, position 1 fills `{{2}}`. Returns null when any of them has no value,
 * because Meta rejects a parameter count that does not match the approved body
 * and, worse, accepts an empty string: the customer would receive a sentence
 * with a hole in it, delivered successfully.
 */
export function buildParameters(
  metaParameters: readonly string[],
  variables: Record<string, string>,
): { ok: true; values: string[] } | { ok: false; missing: string[] } {
  const missing = metaParameters.filter((name) => !variables[name]?.trim());
  if (missing.length) return { ok: false, missing };

  return { ok: true, values: metaParameters.map((name) => variables[name].trim()) };
}

/**
 * Sends one stored WhatsApp template to one customer. Never throws.
 *
 * Every refusal below returns `sent: false` with a reason rather than throwing,
 * because every caller is a best-effort notification hanging off an order that
 * has already happened. An unsent WhatsApp message must never turn a placed
 * order into a failed one — `sendTemplatedEmail` was fixed for exactly that.
 */
export async function sendTemplatedWhatsApp(
  slug: WhatsAppTemplateSlug,
  to: string,
  variables: Record<string, string>,
): Promise<WhatsAppResult> {
  const template = await findTemplate(slug);
  // No fallback copy here, unlike email. A hardcoded body cannot be sent on
  // WhatsApp at all — only wording Meta has already approved can — so inventing
  // one would produce a guaranteed rejection dressed up as an attempt.
  if (!template) {
    return { sent: false, error: `No active WhatsApp template for "${slug}".` };
  }

  return sendWhatsAppTemplateRecord(template, to, variables);
}

/**
 * Sends a specific template record, whatever its local status.
 *
 * Split out so the admin's "Send test" can prove a Meta binding works BEFORE
 * the template is switched from draft to active. Making an admin publish
 * something to find out whether it sends is how a broken template reaches a
 * customer first.
 */
export async function sendWhatsAppTemplateRecord(
  template: WhatsAppTemplateRecord,
  to: string,
  variables: Record<string, string>,
): Promise<WhatsAppResult> {
  if (!to?.trim()) return { sent: false, error: "No phone number on the record." };

  if (!template.metaName?.trim()) {
    return {
      sent: false,
      error: `"${template.name}" is not linked to a template Meta has approved.`,
    };
  }
  // Approved by META, which is the only body whose opinion sends a message.
  // The status here is written solely by the sync that asks them — see
  // `syncMetaApprovals`. An unsynced binding reads as not approved, which is
  // the safe direction: it refuses instead of collecting rejections on live
  // orders, and the message says which button fixes it.
  if (template.approval !== "approved") {
    return {
      sent: false,
      error: `Meta has not approved "${template.metaName}" (${template.approval ?? "never checked"}). Use "Sync with Meta" to refresh, or submit the template in Meta's dashboard.`,
    };
  }

  const merged = { ...(await storeIdentity()), ...variables };
  const parameters = buildParameters(template.metaParameters ?? [], merged);
  if (!parameters.ok) {
    return {
      sent: false,
      error: `Nothing to fill ${parameters.missing.map((name) => `{{${name}}}`).join(", ")} with.`,
    };
  }

  return sendWhatsAppTemplate({
    to,
    metaName: template.metaName,
    metaLanguage: template.metaLanguage ?? "en",
    parameters: parameters.values,
  });
}

/**
 * Fire-and-report: sends if it can, logs if it cannot, never disturbs the caller.
 *
 * The order pipeline calls this. WhatsApp is an ADDITION to the email a customer
 * already receives, so a shop with no provider connected — the normal state —
 * must see nothing at all in its logs on every single order. Hence the silence
 * when the reason is simply that WhatsApp is off or unconfigured.
 */
export async function notifyWhatsApp(
  slug: WhatsAppTemplateSlug,
  to: string,
  variables: Record<string, string>,
  context: string,
): Promise<void> {
  const result = await sendTemplatedWhatsApp(slug, to, variables);
  if (result.sent) return;

  const error = result.error ?? "";
  const notConfigured =
    error.startsWith("WhatsApp sending is turned off") ||
    error.startsWith("WhatsApp is not connected") ||
    error.startsWith("No active WhatsApp template") ||
    error.includes("not linked to a template Meta has approved");
  if (notConfigured) return;

  console.error(`[whatsapp] ${context}: ${error}`);
}


/**
 * What a sync against Meta's list would decide, as a pure function.
 *
 * Extracted so the matching rules can be tested with real Meta shapes rather
 * than reasoned about. That is not bookkeeping: the ambiguity rule below was
 * added to fix a defect that shipped, and a mutation run then showed nothing
 * in the suite could tell the fixed version from the broken one, because
 * reaching it required a live Graph call and a database.
 */
export interface MetaSyncPlan {
  rows: WhatsAppTemplateRecord[];
  matched: MetaSyncSummary["matched"];
  missing: MetaSyncSummary["missing"];
  ambiguous: MetaSyncSummary["ambiguous"];
}

export function planMetaSync(
  templates: readonly WhatsAppTemplateRecord[],
  listed: readonly MetaTemplateSummary[],
): MetaSyncPlan {
  const byName = new Map(
    listed.map((template) => [`${template.name}|${template.language}`, template]),
  );

  /**
   * Name-only matches, but ONLY where the name is unambiguous.
   *
   * The local language is routinely not the one Meta filed the template under
   * — the seed says "en", Meta may hold it as "en_US", and the binding picker
   * sets the name without touching the language — so the exact `name|language`
   * key misses on the normal path, and a name-only fallback is what makes the
   * sync work at all. It also corrects the stored language, which is worth
   * doing: a mismatch there fails a send as "template does not exist".
   *
   * The danger is a name Meta holds in SEVERAL languages. A plain Map keeps
   * whichever row paginated last, so the sync would take approval from an
   * arbitrary one and write ITS language over the shop's — after which sends
   * go out in a language the shop never chose, under a green "Approved by
   * Meta" badge. Ambiguity is recorded as ambiguity and reported, never
   * resolved by accident.
   */
  const byNameOnly = new Map<string, MetaTemplateSummary | null>();
  for (const template of listed) {
    // A second row for the same name marks it ambiguous, permanently.
    byNameOnly.set(template.name, byNameOnly.has(template.name) ? null : template);
  }

  const matched: MetaSyncSummary["matched"] = [];
  const missing: MetaSyncSummary["missing"] = [];
  const ambiguous: MetaSyncSummary["ambiguous"] = [];

  const rows = templates.map((template) => {
    const metaName = template.metaName?.trim();
    if (!metaName) return template;

    const exact = byName.get(`${metaName}|${template.metaLanguage?.trim() ?? ""}`);
    const sole = byNameOnly.get(metaName);
    const found = exact ?? sole ?? undefined;

    if (!found) {
      // `sole === null` means Meta holds this name in more than one language
      // and the stored language matched none of them. Guessing would send in a
      // language nobody chose, so it is reported instead — and the approval is
      // cleared, because nothing here can say which row was approved.
      if (sole === null) {
        ambiguous.push({
          slug: template.slug,
          metaName,
          languages: listed.filter((row) => row.name === metaName).map((row) => row.language),
        });
      } else {
        missing.push({ slug: template.slug, metaName });
      }
      return { ...template, approval: "not_submitted" as WhatsAppApprovalStatus };
    }

    matched.push({ slug: template.slug, metaName, approval: found.status });
    return {
      ...template,
      approval: found.status,
      // Corrected only from an unambiguous match — see `byNameOnly` above.
      metaLanguage: found.language || template.metaLanguage || "en",
    };
  });

  return { rows, matched, missing, ambiguous };
}
/**
 * Asks Meta which templates it has, and writes the answer onto the local rows.
 *
 * This is the only writer of `approval`, and that is the point. The obvious
 * alternative — an "Approval status" dropdown in the editor — would let a shop
 * label its own wording "Approved", which is a claim only Meta can make. This
 * codebase has produced that bug repeatedly in other forms: a refund marked
 * complete with no payout, "All changes saved" for a rejected write, "Ready to
 * send" for a channel with no provider. A self-declared approval would be the
 * next one, and it would surface as live orders failing at Meta.
 *
 * A template Meta no longer has is reported and reset rather than left alone: a
 * deleted template keeps its old "approved" forever otherwise, and every send
 * against it fails while the screen insists it is fine.
 */
export async function syncMetaApprovals(ctx: {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}): Promise<{ ok: true; summary: MetaSyncSummary } | { ok: false; error: string }> {
  const listed = await listMetaTemplates();
  if (!listed.ok) return { ok: false, error: listed.error };

  const templates = ((await getTemplates("whatsapp-templates")) ?? []) as WhatsAppTemplateRecord[];
  const { rows: next, matched, missing, ambiguous } = planMetaSync(templates, listed.templates);
  await writeTemplates("whatsapp-templates", next);
  await writeAuditLog({
    action: "communications.whatsapp.sync",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "communications", id: "whatsapp-templates" },
    metadata: {
      matched: matched.length,
      missing: missing.length,
      ambiguous: ambiguous.length,
      available: listed.templates.length,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { ok: true, summary: { matched, missing, ambiguous, available: listed.templates } };
}

/**
 * Sends a real WhatsApp test of one stored template.
 *
 * The recipient is the SHOP's own contact number and is not read from the
 * request. The dialog behind this offered a free-text phone box, and honouring
 * it would turn an admin convenience into a way to send WhatsApp messages from
 * the shop's verified business number to any number at all — the same reason
 * the email test only mails the caller's own session address.
 *
 * Sample data, so what arrives on the phone is what the admin was shown in the
 * preview.
 */
export async function sendWhatsAppTest(
  slug: string,
): Promise<{ sent: boolean; to?: string; error?: string }> {
  const settings = (await getSettings()) as { contact?: { phone?: string } };
  const to = settings.contact?.phone?.trim();
  if (!to) {
    return {
      sent: false,
      error: "Add your shop's contact phone number in Settings → Contact first — the test goes there.",
    };
  }

  const templates = (await getTemplates("whatsapp-templates")) as WhatsAppTemplateRecord[];
  const template = templates.find((item) => item.slug === slug);
  if (!template) return { sent: false, error: "That template no longer exists." };

  // The record directly, not the slug, so a DRAFT can be tested. Publishing a
  // template to find out whether it sends means a customer meets any mistake
  // before the admin does.
  const sample = getSampleDataForVariables(template.variables ?? [], {
    slug: template.slug,
    channel: "whatsapp",
  });
  const result = await sendWhatsAppTemplateRecord(template, to, sample);
  return { sent: result.sent, to, error: result.error };
}
