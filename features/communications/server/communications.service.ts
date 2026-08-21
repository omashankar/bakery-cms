import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import { seedEmailTemplates } from "@/features/communications/lib/email-template-seed";
import { seedWhatsAppTemplates } from "@/features/communications/lib/whatsapp-template-seed";
import type {
  EmailTemplateRecord,
  WhatsAppTemplateRecord,
} from "@/types/communication";
import type { NotificationSettings } from "@/types/notification";
import { sendMail } from "@/lib/server/mail/send-mail";
import { toEmailHtml } from "./email.service";
import { renderTemplate } from "@/lib/template-render";
import { getSampleDataForVariables } from "@/features/communications/lib/template-sample-data";
import { allowlisted } from "@/lib/server/http/allowlist";
import {
  TEMPLATE_VARIABLE_CONTRACT,
  WHATSAPP_VARIABLE_CONTRACT,
} from "@/features/communications/lib/template-contract";

/**
 * Communication templates (email + WhatsApp) that were client-only localStorage
 * collections. Each is stored whole in the MongoDB-backed cms-store, seeded on
 * first read from the same defaults the client shipped. Admin-only — never
 * rendered on the storefront.
 */
const templateStores = {
  "email-templates": createMongoStore<EmailTemplateRecord[]>({
    key: "email-templates",
    seed: seedEmailTemplates,
  }),
  "whatsapp-templates": createMongoStore<WhatsAppTemplateRecord[]>({
    key: "whatsapp-templates",
    seed: seedWhatsAppTemplates,
  }),
} as const;

export type TemplateKey = keyof typeof templateStores;

export const TEMPLATE_KEYS = Object.keys(templateStores) as TemplateKey[];

function templateStoreFor(key: string) {
  const store = allowlisted(templateStores, key);
  if (!store) throw new NotFoundError("Unknown template collection");
  return store;
}

/**
 * Wired slugs by collection — the ones something in this codebase sends.
 *
 * Kept next to the backfill below because that is the only thing that reads
 * them here; `template-contract.ts` remains the single source of the lists.
 */
const WIRED_SLUGS: Record<string, readonly string[]> = {
  "email-templates": Object.keys(TEMPLATE_VARIABLE_CONTRACT),
  "whatsapp-templates": Object.keys(WHATSAPP_VARIABLE_CONTRACT),
};

/**
 * Fields a stored row may predate. Widened when absent, never overwritten.
 *
 * All four arrived with the WhatsApp Meta binding. A row written before them
 * has `undefined` in each, which is why the `undefined` test — rather than a
 * falsy one — is what stops this touching an admin's own choice. An empty
 * `metaParameters: []` is a decision; `undefined` is an absence.
 */
const WIDENABLE_FIELDS = ["metaName", "metaLanguage", "metaParameters", "approval"] as const;

export interface BackfillPlan {
  /** Wired rows the stored collection has never had, taken from the seed. */
  restored: unknown[];
  /** Every stored row, with absent new fields filled from its seed row. */
  rows: unknown[];
  /** How many stored rows the widening actually changed. */
  widenedCount: number;
  /** Nothing to do — do not write. */
  empty: boolean;
}

/**
 * What a backfill would change, as a pure function. See the caller for why.
 *
 * Separated so the decisions can be tested against the shapes a real database
 * holds, rather than asserted at by grepping this file. The rules are narrow on
 * purpose: restore only WIRED slugs and only when no row exists, and fill only
 * fields that are absent.
 */
export function planTemplateBackfill(
  stored: readonly unknown[],
  seeded: readonly unknown[],
  wired: readonly string[],
): BackfillPlan {
  const rowsIn = stored as { slug?: string }[];
  const seedRows = seeded as { slug?: string }[];

  const present = new Set(rowsIn.map((item) => item.slug));
  const missing = wired.filter((slug) => !present.has(slug));
  const restored = seedRows.filter((item) => item.slug && missing.includes(item.slug));

  let widenedCount = 0;
  const rows = rowsIn.map((item) => {
    const defaults = seedRows.find((candidate) => candidate.slug === item.slug) as
      | Record<string, unknown>
      | undefined;
    if (!defaults) return item;

    const row = item as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const field of WIDENABLE_FIELDS) {
      if (row[field] === undefined && defaults[field] !== undefined) {
        patch[field] = defaults[field];
      }
    }
    if (!Object.keys(patch).length) return item;

    widenedCount += 1;
    return { ...item, ...patch };
  });

  return {
    restored,
    rows,
    widenedCount,
    empty: restored.length === 0 && widenedCount === 0,
  };
}

/**
 * Adds a wired template the stored collection has never had.
 *
 * The seed runs ONCE, when the collection does not exist — which is correct,
 * and which means adding a template to `seedEmailTemplates()` does nothing at
 * all for a shop that has been running. That is not a theoretical gap: the two
 * emails just made editable, `refund_processed` and `admin_new_order`, were
 * invisible on every existing shop while the tests — which exercise the seed
 * FUNCTION — passed. The fix looked complete and changed nothing.
 *
 * Only slugs the code actually SENDS are restored, and only when no row exists
 * at all. The resurrection worry does not apply to them: a wired slug with no
 * template does not mean the email stops going out, it means the hardcoded
 * fallback goes out instead and nobody can edit a word of it. Putting the row
 * back gives the shop control over an email it is already sending.
 *
 * A template the shop EDITED is never touched, because a row exists. Custom
 * templates are never touched, because they are not wired. And the write only
 * happens on the first read that finds something missing.
 */
async function backfillWiredTemplates(key: string): Promise<void> {
  const wired = WIRED_SLUGS[key];
  if (!wired) return;

  const store = templateStoreFor(key);
  const stored = ((await store.read()) ?? []) as unknown[];
  const seeded = key === "email-templates" ? seedEmailTemplates() : seedWhatsAppTemplates();

  const plan = planTemplateBackfill(stored, seeded, wired);
  if (plan.empty) return;

  await store.write([...plan.rows, ...plan.restored] as never);
  console.info(
    `[communications] ${key}: restored ${plan.restored.length} wired template(s)` +
      `, filled new fields on ${plan.widenedCount} row(s)`,
  );
}

export async function getTemplates(key: string) {
  await backfillWiredTemplates(key);
  return templateStoreFor(key).read();
}

/**
 * A whole-collection write from the SERVER, bypassing the admin-edit path.
 *
 * Used by the Meta approval sync, which is not an admin's edit of a list: it
 * writes one server-owned field onto rows the admin never sent, so the
 * `knownIds` reconciliation below would have nothing to reconcile against.
 */
export async function writeTemplates(key: string, items: unknown[]): Promise<void> {
  await templateStoreFor(key).write(items as never);
}

/**
 * A save may not change whether Meta approved anything.
 *
 * `approval` is the one field on a WhatsApp template that no admin gets to
 * assert: it is written only by `syncMetaApprovals`, which asks Meta. The
 * template schema does not accept it, but the schema is `passthrough` — it
 * carries unknown keys through so that fields this server does not model yet
 * survive a round trip — so a hand-made request could still post
 * `approval: "approved"` and the send path would believe it.
 *
 * That matters because "approved" is the gate on sending. A shop could be told
 * its wording had been reviewed, send against it, and collect rejections from
 * Meta on live orders. So the stored value wins, and a template the server has
 * never seen starts at `not_submitted` no matter what arrived with it.
 *
 * Changing the Meta NAME OR LANGUAGE resets it too: the approval belonged to
 * the old pair.
 */
/** The fields this function actually reads. Named, so a caller cannot pass a
 *  binding it will silently ignore. */
interface ApprovalCarrier {
  id?: string;
  metaName?: string;
  metaLanguage?: string;
  approval?: string;
}

export function keepServerApproval(
  incoming: ApprovalCarrier[],
  stored: ApprovalCarrier[],
): unknown[] {
  const byId = new Map(
    stored
      .filter((item) => item.id)
      .map((item) => [item.id as string, item] as const),
  );

  /**
   * Meta approves a template per NAME AND LANGUAGE, so both are identity.
   *
   * This compared the name alone. `listMetaTemplates` keys its results
   * `name|language` and `planMetaSync` builds its lookup the same way, for
   * exactly this reason — the language is as identity-bearing as the name. So an
   * admin who kept the name and switched the language from `en` to `hi` carried
   * the old approval across: the send path gates only on that flag
   * (`if (template.approval !== "approved") return`) and then passes the NEW
   * language straight to Meta, which has approved nothing under it. Every send
   * is rejected, and the screen still shows the template as approved.
   */
  const identity = (value: ApprovalCarrier | undefined) =>
    `${(value?.metaName ?? "").trim()}|${(value?.metaLanguage ?? "").trim()}`;

  return incoming.map((item) => {
    const previous = item.id ? byId.get(item.id) : undefined;
    const sameBinding = identity(previous) === identity(item);

    return {
      ...item,
      approval: previous && sameBinding ? (previous.approval ?? "not_submitted") : "not_submitted",
    };
  });
}

/**
 * Saves a template collection, deleting only what the caller actually removed.
 *
 * `knownIds` is the ids the caller believed existed before its edit. Without
 * it a whole-collection write means "these are all the templates there are",
 * so a save from a tab opened an hour ago silently deleted every template
 * another admin had added since — and both admins were told it worked, with
 * nothing to show the missing ones had ever existed. Delivery zones solved
 * this the same way.
 *
 * A caller that sends no `knownIds` is an older client, and then nothing
 * outside its list is touched — the safe reading.
 */

export async function replaceTemplates(
  key: string,
  items: unknown[],
  ctx: { ip: string; userAgent: string; actorId?: string | null; actorEmail?: string },
  knownIds?: string[],
) {
  const store = templateStoreFor(key);

  const incoming = items as { id?: string }[];
  const keepIds = new Set(incoming.map((item) => item.id).filter(Boolean));
  const removedIds = new Set((knownIds ?? []).filter((id) => !keepIds.has(id)));

  const stored = ((await store.read()) ?? []) as { id?: string }[];
  // Anything the caller never knew about is left exactly where it is.
  const untouched = stored.filter(
    (item) => item.id && !keepIds.has(item.id) && !removedIds.has(item.id),
  );

  const guarded = key === "whatsapp-templates" ? keepServerApproval(incoming, stored) : incoming;

  await store.write([...guarded, ...untouched] as never);
  await writeAuditLog({
    action: `communications.${key}.replace`,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "communications", id: key },
    metadata: { count: items.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return store.read();
}

/**
 * Notification preferences (order/payment/stock/inquiry alerts) — a singleton
 * object. The notifications themselves stay derived on the client from orders,
 * inventory and inquiries; only these toggles are durable admin config.
 */
const notificationSettingsStore = createMongoStore<NotificationSettings>({
  key: "notification-settings",
  seed: () => ({
    orderAlerts: true,
    paymentAlerts: true,
    stockAlerts: true,
    inquiryAlerts: true,
  }),
});

export function getNotificationSettings() {
  return notificationSettingsStore.read();
}

export async function saveNotificationSettings(
  settings: NotificationSettings,
  ctx: { ip: string; userAgent: string; actorId?: string | null; actorEmail?: string },
) {
  await notificationSettingsStore.write(settings);
  await writeAuditLog({
    action: "communications.notification-settings.update",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "communications", id: "notification-settings" },
    metadata: { ...settings },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return notificationSettingsStore.read();
}

/**
 * Renders one stored email template with sample data and sends it.
 *
 * Deliberately reads the STORED template rather than anything the caller
 * supplies: the point of a test is to prove what a real customer would receive,
 * so testing unsaved edits would prove the wrong thing.
 */
export async function sendTemplateTest(
  slug: string,
  to: string,
): Promise<{ sent: boolean; error?: string }> {
  const templates = (await getTemplates("email-templates")) as EmailTemplateRecord[];
  const template = templates.find((item) => item.slug === slug);
  if (!template) return { sent: false, error: "That template no longer exists." };

  const sample = getSampleDataForVariables(template.variables ?? [], { slug: template.slug });
  const body = renderTemplate(template.body, sample);

  return sendMail({
    to,
    subject: `[Test] ${renderTemplate(template.subject, sample)}`,
    // Including the preview line, so a test shows what an inbox will.
    html: toEmailHtml(
      body,
      template.previewText ? renderTemplate(template.previewText, sample) : undefined,
    ),
    /**
     * The plain-text alternative, given explicitly — as the real sender does.
     *
     * Without it `sendMail` derives text from the HTML, and the HTML carries
     * the hidden preheader block: thirty repetitions of `&#847;&zwnj;&nbsp;`,
     * padding that exists to stop an inbox preview spilling into the body. A
     * text-only client showed the test as a wall of entities that no real
     * order confirmation contains — so the one thing the button exists to
     * check, "what will the customer see", was the one thing it got wrong.
     */
    text: body,
  });
}
