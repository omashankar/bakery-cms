/**
 * WhatsApp sending — the provider, the Meta binding, and what the screen claims.
 *
 * This channel had a template editor, five seeded templates, four of them
 * "active", a stat card, a preview and a test-send dialog that reported a
 * message queued after a 900ms timer. What it did not have was any way to send a
 * WhatsApp message. These tests pin the parts that decide whether a message
 * genuinely leaves the building, and the parts that decide what the admin is
 * TOLD about it — because the second half is where this codebase keeps failing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { normalizePhone } from "@/features/communications/server/whatsapp-client.server";
import {
  keepServerApproval,
  planTemplateBackfill,
} from "@/features/communications/server/communications.service";
import {
  buildParameters,
  contractCoversEverySlug,
  planMetaSync,
} from "@/features/communications/server/whatsapp.service";
import {
  availableVariablesFor,
  isSendableSlug,
  TEMPLATE_VARIABLE_CONTRACT,
  validateSlug,
  WHATSAPP_VARIABLE_CONTRACT,
} from "@/features/communications/lib/template-contract";
import { seedWhatsAppTemplates } from "@/apps/admin/communications/lib/whatsapp-templates-repository";
import { seedEmailTemplates } from "@/apps/admin/communications/lib/email-templates-repository";
import {
  countUnfilledSlots,
  getWhatsAppTemplateOverview,
  isSendable,
} from "@/apps/admin/communications/lib/whatsapp-template-utils";
import { defaultTemplateSampleData } from "@/apps/admin/communications/lib/template-sample-data";
import type { WhatsAppTemplateRecord } from "@/types/communication";
import type { MetaTemplateSummary } from "@/types/whatsapp-provider";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

/** The file with comments stripped — see `communications.test.ts` for why. */
function code(relativePath: string): string {
  return source(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function template(overrides: Partial<WhatsAppTemplateRecord> = {}): WhatsAppTemplateRecord {
  return {
    id: "wa-1",
    slug: "order_confirmation",
    name: "Order confirmation",
    category: "transactional",
    body: "Order {{order_number}}",
    status: "active",
    variables: ["order_number"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    metaName: "order_confirmation_v1",
    metaLanguage: "en",
    metaParameters: ["order_number"],
    approval: "approved",
    ...overrides,
  };
}

describe("phone numbers Meta will accept", () => {
  it("takes the shapes people actually type", () => {
    // All the same Indian mobile.
    expect(normalizePhone("+91 98765 43210")).toBe("919876543210");
    expect(normalizePhone("98765 43210")).toBe("919876543210");
    expect(normalizePhone("098765-43210")).toBe("919876543210");
    expect(normalizePhone("919876543210")).toBe("919876543210");
  });

  it("leaves a number that already carries a country code alone", () => {
    // A UK number typed with its own prefix must not collect a 91.
    expect(normalizePhone("+44 20 7946 0958")).toBe("442079460958");

    // The case the length alone cannot distinguish: +65 8123 4567 is ten
    // digits, exactly like a bare Indian mobile. Only the "+" says it already
    // has a country code, so a rule that looks at length first ships this
    // customer's order details to a number in India.
    expect(normalizePhone("+65 8123 4567")).toBe("6581234567");
  });

  it("refuses rather than guesses when it is not a number", () => {
    // Returning something plausible here delivers a customer's order details
    // to a stranger, and the send reports success either way.
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("call the shop")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+1 234 567 890 123 456")).toBeNull();
  });
});

describe("filling Meta's numbered placeholders", () => {
  it("fills them in the order the mapping declares", () => {
    const result = buildParameters(["order_number", "order_total"], {
      order_total: "₹1,468",
      order_number: "BK-1042",
    });

    // Not the order of the object's keys — the order of the MAPPING. Meta has
    // no names, only positions, so this ordering is the whole contract.
    expect(result).toEqual({ ok: true, values: ["BK-1042", "₹1,468"] });
  });

  it("refuses when a value is missing instead of sending a hole", () => {
    // Meta accepts an empty string happily, and the customer receives a
    // sentence with a gap in it — delivered successfully.
    const result = buildParameters(["order_number", "delivery_date"], {
      order_number: "BK-1042",
      delivery_date: "   ",
    });

    expect(result).toEqual({ ok: false, missing: ["delivery_date"] });
  });
});

describe("the variable contract is per channel", () => {
  it("does not offer WhatsApp a variable only the email sender supplies", () => {
    // `invoice_url` is in the EMAIL order_confirmation contract. A link has to
    // be inside the wording Meta approved, so the WhatsApp sender cannot pass
    // one — offering the chip would put a literal {{invoice_url}} nowhere at
    // all, since the local body is not what gets delivered.
    expect(TEMPLATE_VARIABLE_CONTRACT.order_confirmation).toContain("invoice_url");
    expect(WHATSAPP_VARIABLE_CONTRACT.order_confirmation).not.toContain("invoice_url");

    expect(availableVariablesFor("order_confirmation", [], "whatsapp")).not.toContain(
      "invoice_url",
    );
  });

  it("knows the two channels send different slugs", () => {
    // `invoice` is emailed and never sent on WhatsApp; `order_ready` the other
    // way round. A shared lookup locks the wrong slugs on the wrong screen.
    expect(isSendableSlug("invoice", "email")).toBe(true);
    expect(isSendableSlug("invoice", "whatsapp")).toBe(false);
    expect(isSendableSlug("order_ready", "whatsapp")).toBe(true);
    expect(isSendableSlug("order_ready", "email")).toBe(false);
  });

  it("locks a wired WhatsApp slug and says so in WhatsApp's words", () => {
    const problem = validateSlug("order_ready_v2", "order_ready", [], "whatsapp");
    expect(problem?.locked).toBe(true);
    expect(problem?.message).toContain("WhatsApp message");
    // The email screen's copy would have said "email" on a WhatsApp template.
    expect(problem?.message).not.toContain("this email is sent by");
  });

  it("does not lock a WhatsApp template just because email sends that slug", () => {
    // `invoice` has an email sender and no WhatsApp one, so a WhatsApp template
    // using it is a custom draft and must stay renameable.
    expect(validateSlug("invoice_copy", "invoice", [], "whatsapp")).toBeNull();
  });
});

describe("the seeded templates can actually be sent", () => {
  const seeded = seedWhatsAppTemplates();

  it("keeps the sendable union and the variable contract in step", () => {
    // Two hand-maintained lists. The union cannot be derived from the contract
    // — `Record<string, …>` has `keyof string`, so deriving it would accept any
    // typo at every call site and send nothing on a live order.
    expect(contractCoversEverySlug()).toBe(true);
  });

  it("ships a template for every slug the order pipeline sends", () => {
    // A wired slug with no template means the send path finds nothing and the
    // customer silently receives no message at all — there is no fallback copy
    // on WhatsApp, because only Meta-approved wording can be delivered.
    for (const slug of Object.keys(WHATSAPP_VARIABLE_CONTRACT)) {
      expect(seeded.some((item) => item.slug === slug)).toBe(true);
    }
  });

  it("maps every placeholder to a variable the sender supplies", () => {
    for (const item of seeded) {
      const available = availableVariablesFor(item.slug, item.variables, "whatsapp");
      for (const parameter of item.metaParameters ?? []) {
        // A mapping naming something the sender never passes is a send that
        // refuses at the last moment, on a live order.
        expect(
          available.includes(parameter),
          `${item.slug} maps {{${parameter}}}, which nothing supplies`,
        ).toBe(true);
      }
    }
  });

  it("has sample data for every mapped placeholder, so a test send is real", () => {
    // `getSampleDataForVariables` fills any unknown key with "[name]", so a
    // missing sample never looks broken — it just puts "[order_total]" on a
    // real phone. Assert against the DEFAULTS, not that helper's output.
    for (const item of seeded) {
      for (const parameter of item.metaParameters ?? []) {
        expect(
          defaultTemplateSampleData[parameter],
          `no sample data for ${parameter}`,
        ).toBeTruthy();
      }
    }
  });

  it("links none of them to a Meta template it cannot know the name of", () => {
    // A plausible default like "order_confirmation_v1" fails at send time as
    // "template does not exist", which reads as a bug in this app rather than
    // a setup step nobody has done.
    for (const item of seeded) {
      expect(item.metaName).toBe("");
      expect(item.approval).toBe("not_submitted");
    }
  });
});

describe("what the screen claims about readiness", () => {
  it("counts a published template as sendable only once Meta has approved it", () => {
    expect(isSendable(template())).toBe(true);
    expect(isSendable(template({ approval: "pending" }))).toBe(false);
    expect(isSendable(template({ approval: "not_submitted" }))).toBe(false);
    expect(isSendable(template({ metaName: "" }))).toBe(false);
    expect(isSendable(template({ status: "draft" }))).toBe(false);
  });

  it("does not report the freshly seeded set as ready to send", () => {
    // The old stat card counted actives and labelled them "Ready to send", so
    // five templates nothing could deliver read as a working channel.
    const overview = getWhatsAppTemplateOverview(seedWhatsAppTemplates());
    expect(overview.active).toBeGreaterThan(0);
    expect(overview.sendable).toBe(0);
  });
});

describe("the claims this screen used to make", () => {
  it("no longer reports a demo send as queued", () => {
    const dialog = code(
      "apps/admin/communications/components/whatsapp-template-test-send-dialog.tsx",
    );
    expect(dialog).not.toContain("queued");
    expect(dialog).not.toContain("No real WhatsApp message is delivered");
    // A real request, not a timer.
    expect(dialog).toContain("sendWhatsAppTestRequest");
    expect(dialog).not.toContain("setTimeout");
  });

  it("does not let the admin choose who the shop's business number messages", () => {
    const dialog = code(
      "apps/admin/communications/components/whatsapp-template-test-send-dialog.tsx",
    );
    // The recipient box is gone: the server uses the shop's own contact number,
    // for the same reason the email test only mails the signed-in admin.
    expect(dialog).not.toContain("setPhone");
    expect(dialog).not.toMatch(/type="tel"/);

    const client = code("apps/admin/communications/lib/communications-api.ts");
    expect(client).toContain("sendWhatsAppTestRequest");
    // Only the slug travels.
    expect(client).toMatch(/whatsapp\/test", \{ slug \}/);
  });

  it("no longer states there is no provider regardless of the stored one", () => {
    const page = code("apps/admin/communications/pages/whatsapp-templates-admin-page.tsx");
    expect(page).not.toContain("No WhatsApp provider is connected");
    expect(page).toContain("<WhatsAppConnectionCard");
  });
});

describe("matching the shop's templates against Meta's list", () => {
  const row = (overrides: Partial<WhatsAppTemplateRecord> = {}): WhatsAppTemplateRecord =>
    template({ metaName: "order_confirmation_v1", metaLanguage: "en", ...overrides });

  const meta = (name: string, language: string, status: string) =>
    ({
      name,
      language,
      status,
      body: "Order {{1}}",
      parameterCount: 1,
      category: "UTILITY",
    }) as MetaTemplateSummary;

  it("takes an exact name and language match", () => {
    const plan = planMetaSync(
      [row({ approval: "not_submitted" })],
      [meta("order_confirmation_v1", "en", "approved")],
    );

    expect(plan.matched).toHaveLength(1);
    expect(plan.rows[0].approval).toBe("approved");
    expect(plan.rows[0].metaLanguage).toBe("en");
  });

  it("corrects the language from an unambiguous name", () => {
    // The normal path: the seed says "en" and Meta filed it as "en_US". A
    // mismatch left uncorrected fails a send as "template does not exist".
    const plan = planMetaSync([row()], [meta("order_confirmation_v1", "en_US", "approved")]);

    expect(plan.matched).toHaveLength(1);
    expect(plan.rows[0].metaLanguage).toBe("en_US");
  });

  it("refuses to pick when Meta holds the name in several languages", () => {
    /**
     * The defect this rule exists for.
     *
     * A plain name-keyed Map keeps whichever row paginated LAST, so the sync
     * took approval from an arbitrary language and wrote that language over the
     * shop's. Sends then went out in a language nobody chose — successfully,
     * under a green "Approved by Meta" badge, which is the worst possible way
     * to be wrong.
     */
    const plan = planMetaSync(
      [row({ metaLanguage: "en" })],
      [
        meta("order_confirmation_v1", "hi", "approved"),
        meta("order_confirmation_v1", "ta", "rejected"),
      ],
    );

    expect(plan.matched).toHaveLength(0);
    expect(plan.ambiguous).toEqual([
      { slug: "order_confirmation", metaName: "order_confirmation_v1", languages: ["hi", "ta"] },
    ]);
    // The shop's own language survives, and approval is cleared rather than
    // inherited from a row nobody chose.
    expect(plan.rows[0].metaLanguage).toBe("en");
    expect(plan.rows[0].approval).toBe("not_submitted");
  });

  it("still matches exactly even when the name is ambiguous", () => {
    // Ambiguity is only a problem for the FALLBACK. If the stored language is
    // one Meta actually holds, there is nothing to guess.
    const plan = planMetaSync(
      [row({ metaLanguage: "ta" })],
      [
        meta("order_confirmation_v1", "hi", "rejected"),
        meta("order_confirmation_v1", "ta", "approved"),
      ],
    );

    expect(plan.ambiguous).toHaveLength(0);
    expect(plan.rows[0].approval).toBe("approved");
    expect(plan.rows[0].metaLanguage).toBe("ta");
  });

  it("clears approval for a name Meta no longer has", () => {
    // A deleted Meta template otherwise keeps its "approved" forever, and every
    // send against it fails while the screen insists it is fine.
    const plan = planMetaSync(
      [row({ approval: "approved" })],
      [meta("something_else", "en", "approved")],
    );

    expect(plan.missing).toEqual([
      { slug: "order_confirmation", metaName: "order_confirmation_v1" },
    ]);
    expect(plan.rows[0].approval).toBe("not_submitted");
  });

  it("leaves an unlinked template completely alone", () => {
    const unlinkedRow = row({ metaName: "", approval: "not_submitted" });
    const plan = planMetaSync([unlinkedRow], [meta("order_confirmation_v1", "en", "approved")]);

    expect(plan.matched).toHaveLength(0);
    expect(plan.missing).toHaveLength(0);
    expect(plan.ambiguous).toHaveLength(0);
    expect(plan.rows[0]).toBe(unlinkedRow);
  });
});

describe("what the screen shows after a sync", () => {
  it("re-reads the server instead of the once-only hydration path", () => {
    // `ensureCommunicationsHydrated` fetches at most once per gate — that is
    // its job, and by sync time it has settled. Calling it here returns without
    // a request, so every badge would still read "Not checked with Meta" and
    // the sendable count would still be zero directly after a sync that
    // approved everything: the page contradicting the button just pressed.
    const page = code("apps/admin/communications/pages/whatsapp-templates-admin-page.tsx");
    expect(page).toContain("refreshWhatsAppTemplates()");
    expect(page).not.toMatch(/onSynced=\{[\s\S]{0,400}ensureCommunicationsHydrated\(\)/);

    const sync = code("apps/admin/communications/lib/use-communications-server-sync.ts");
    // And that refresh does not consult the gate before fetching.
    const body = sync.slice(sync.indexOf("export async function refreshWhatsAppTemplates"));
    expect(body).toContain("await fetchWhatsAppTemplates()");
    expect(body).not.toContain("hasSettled()");
    // A failed read leaves the cache alone — an empty result from a blip is
    // not "the shop has no templates".
    expect(body).toMatch(/if \(!templates\) return false;/);
  });

  it("counts a placeholder Meta expects and nothing fills", () => {
    // Meta's rejection names no parameter, so an unfilled slot otherwise
    // surfaces as an order that silently got no message.
    expect(countUnfilledSlots(3, ["order_number", "order_total", "delivery_date"])).toBe(0);
    // The case counting the MAPPING would miss: Meta says three, shop mapped
    // two. The request goes out short and comes back as a generic invalid
    // parameter error.
    expect(countUnfilledSlots(3, ["order_number", "order_total"])).toBe(1);
    expect(countUnfilledSlots(2, ["order_number", "   "])).toBe(1);
    expect(countUnfilledSlots(0, [])).toBe(0);
    expect(countUnfilledSlots(2, undefined)).toBe(2);
  });

  it("shows that count to the admin while it can still be fixed", () => {
    const fields = code(
      "apps/admin/communications/components/whatsapp-meta-binding-fields.tsx",
    );
    expect(fields).toContain("countUnfilledSlots(slots, parameters)");
    expect(fields).toMatch(/unfilled > 0/);
  });
});

describe("a shop that was already running", () => {
  /**
   * The rows a real database actually holds.
   *
   * Copied from the live dev cluster, which is what exposed this gap in the
   * first place: five WhatsApp templates with no Meta fields at all, and an
   * email collection containing neither `refund_processed` nor
   * `admin_new_order` — while every seed-based test passed, because they
   * exercise the seed FUNCTION and `createMongoStore` seeds once, only when the
   * collection does not exist. Adding a template to the seed changed nothing
   * for any shop that had ever been opened.
   */
  const LIVE_WHATSAPP_ROWS = [
    { id: "wa-welcome", slug: "welcome", status: "active", body: "", variables: [] },
    {
      id: "wa-order-confirmation",
      slug: "order_confirmation",
      status: "active",
      body: "",
      variables: [],
    },
    { id: "wa-order-ready", slug: "order_ready", status: "active", body: "", variables: [] },
    {
      id: "wa-delivery-update",
      slug: "delivery_update",
      status: "active",
      body: "",
      variables: [],
    },
    {
      id: "wa-payment-reminder",
      slug: "payment_reminder",
      status: "draft",
      body: "",
      variables: [],
    },
  ];

  const LIVE_EMAIL_SLUGS = [
    "welcome",
    "order_confirmation",
    "order_shipped",
    "invoice",
    "password_reset",
    "abandoned_cart",
  ];

  it("gets the wired emails the seed gained after it was set up", () => {
    const stored = LIVE_EMAIL_SLUGS.map((slug) => ({ id: `email-${slug}`, slug }));

    const plan = planTemplateBackfill(
      stored,
      seedEmailTemplates(),
      Object.keys(TEMPLATE_VARIABLE_CONTRACT),
    );

    const restoredSlugs = (plan.restored as { slug: string }[]).map((row) => row.slug).sort();
    // Exactly the wired emails this shop's stored set never had — the two that
    // were sending from hardcoded fallbacks with no row for the admin to edit,
    // and the cancellation email added later.
    //
    // This list growing when a template is wired is the mechanism working: a
    // shop set up before it existed gets it, which is the whole point of the
    // backfill. A template added to the seed WITHOUT being wired must not appear
    // here — the test below pins that.
    expect(restoredSlugs).toEqual(["admin_new_order", "order_cancelled", "refund_processed"]);
    expect(plan.empty).toBe(false);
  });

  it("does not resurrect a custom template the shop deleted", () => {
    // `welcome` and `abandoned_cart` are seeded but nothing sends them, so
    // they are not wired — a shop that deleted them must not find them back.
    const stored = [{ id: "email-order_confirmation", slug: "order_confirmation" }];

    const plan = planTemplateBackfill(
      stored,
      seedEmailTemplates(),
      Object.keys(TEMPLATE_VARIABLE_CONTRACT),
    );

    const restoredSlugs = (plan.restored as { slug: string }[]).map((row) => row.slug);
    expect(restoredSlugs).not.toContain("welcome");
    expect(restoredSlugs).not.toContain("abandoned_cart");
  });

  it("fills the Meta fields on rows that predate them", () => {
    const plan = planTemplateBackfill(
      LIVE_WHATSAPP_ROWS,
      seedWhatsAppTemplates(),
      Object.keys(WHATSAPP_VARIABLE_CONTRACT),
    );

    // All five predate the binding, so all five gain it.
    expect(plan.widenedCount).toBe(5);

    const confirmation = (plan.rows as WhatsAppTemplateRecord[]).find(
      (row) => row.slug === "order_confirmation",
    );
    expect(confirmation?.metaParameters).toEqual([
      "order_number",
      "order_total",
      "delivery_date",
    ]);
    expect(confirmation?.approval).toBe("not_submitted");
    // Never a guessed Meta name — that fails at send time as "template does
    // not exist", which reads like a bug rather than a setup step.
    expect(confirmation?.metaName).toBe("");
  });

  it("never overwrites a field the admin has already set", () => {
    const configured = [
      {
        ...LIVE_WHATSAPP_ROWS[1],
        metaName: "the_shops_own_name",
        metaLanguage: "hi",
        // An empty array is a DECISION — a template Meta approved with no
        // placeholders. `undefined` is an absence. Only the second is filled.
        metaParameters: [],
        approval: "approved",
      },
    ];

    const plan = planTemplateBackfill(
      configured,
      seedWhatsAppTemplates(),
      Object.keys(WHATSAPP_VARIABLE_CONTRACT),
    );

    expect(plan.widenedCount).toBe(0);
    const row = plan.rows[0] as WhatsAppTemplateRecord;
    expect(row.metaName).toBe("the_shops_own_name");
    expect(row.metaLanguage).toBe("hi");
    expect(row.metaParameters).toEqual([]);
    expect(row.approval).toBe("approved");
  });

  it("does nothing at all once there is nothing to do", () => {
    // The write must not repeat on every read of a collection already fixed.
    const first = planTemplateBackfill(
      LIVE_WHATSAPP_ROWS,
      seedWhatsAppTemplates(),
      Object.keys(WHATSAPP_VARIABLE_CONTRACT),
    );
    const settled = [...first.rows, ...first.restored];

    const second = planTemplateBackfill(
      settled,
      seedWhatsAppTemplates(),
      Object.keys(WHATSAPP_VARIABLE_CONTRACT),
    );
    expect(second.empty).toBe(true);
  });

  it("runs on the read path, before anything renders the list", () => {
    const service = code("features/communications/server/communications.service.ts");
    expect(service).toMatch(/getTemplates[\s\S]{0,120}await backfillWiredTemplates\(key\)/);
  });
});

describe("the access token", () => {
  it("is never read back to the browser", () => {
    const credentials = source("features/communications/server/whatsapp-credentials.server.ts");
    expect(credentials).toContain('import "server-only"');

    const api = code("apps/admin/communications/lib/communications-api.ts");
    expect(api).toContain("fetchWhatsAppConnection");
    expect(api).not.toContain("accessToken: loaded");
  });

  it("has nowhere in the response shape to put the token", () => {
    /**
     * Asserting the presence of `tokenSet` was not enough, and this test exists
     * because that gap was demonstrated rather than imagined: an agent auditing
     * this code added `accessToken: string` to the status interface and
     * `accessToken` to the reader that fills it — a live token leaking to the
     * browser on every page load — and the previous assertions all still
     * passed, because they only checked that `tokenSet` was still there.
     *
     * So: the field must be ABSENT from the interface a response is shaped by,
     * and absent from the function that builds it.
     */
    const types = source("types/whatsapp-provider.ts");
    const status = types.slice(
      types.indexOf("export interface WhatsAppConnectionStatus"),
      types.indexOf("}", types.indexOf("export interface WhatsAppConnectionStatus")),
    );
    expect(status).toContain("tokenSet: boolean");
    expect(status).not.toMatch(/^\s*accessToken/m);

    const credentials = source("features/communications/server/whatsapp-credentials.server.ts");
    const reader = credentials.slice(
      credentials.indexOf("export async function readWhatsAppConnectionStatus"),
    );
    const returned = reader.slice(reader.indexOf("return {"), reader.indexOf("};"));
    expect(returned).toContain("tokenSet:");
    // A returned PROPERTY, not the word: `configured` is legitimately derived
    // from the local `accessToken`, and a blunt not.toContain would fail on
    // correct code — the mistake that made the first version of this useless.
    // Catches the shorthand `accessToken,` and the explicit `accessToken: …`.
    expect(returned).not.toMatch(/^\s*accessToken\s*[,:]/m);

    // The controller returns that status object verbatim, so the shape above
    // is the whole guarantee.
    const controller = code("features/communications/server/communications.controller.ts");
    expect(controller).toContain("ok(await readWhatsAppConnectionStatus()");
  });

  it("is never written to the audit log either", () => {
    const controller = code("features/communications/server/communications.controller.ts");
    const audit = controller.slice(
      controller.indexOf("communications.whatsapp.connection.update"),
    );
    // Both offsets measured from the START of the metadata block. Searching
    // the whole slice for the closing brace found one that came earlier and
    // produced an empty string, which then satisfied `not.toContain` for free.
    const from = audit.indexOf("metadata: {");
    const metadata = audit.slice(from, audit.indexOf("},", from));
    // An audit trail is read by more people than the settings page is, and
    // kept for longer. `tokenSet` records that one was set; the value is not
    // there, and neither is its length.
    expect(metadata).toContain("tokenSet");
    expect(metadata).not.toContain("accessToken");
  });

  it("survives a save that does not retype it", () => {
    // The form posts a blank token whenever the admin only toggled `enabled`.
    // Taking that literally wipes a working token, and the failure surfaces
    // later as a 401 from Meta on a customer's order.
    const credentials = code("features/communications/server/whatsapp-credentials.server.ts");
    expect(credentials).toMatch(/if \(token\) update\.accessToken = token;/);

    const card = code("apps/admin/communications/components/whatsapp-connection-card.tsx");
    // And the card never pre-fills it from the server, so blank is the norm.
    expect(card).toContain("accessToken: \"\",");
  });
});

describe("approval is Meta's word, not the shop's", () => {
  it("is stripped from anything a client posts", () => {
    // The schema is `passthrough`, so an unmodelled `approval: "approved"`
    // would otherwise ride along and the send path would believe it.
    const row = (
      id: string,
      metaName: string,
      approval: string,
    ): { id?: string } => ({ id, metaName, approval }) as { id?: string };

    const stored = [row("wa-1", "order_confirmation_v1", "approved")];

    const [kept] = keepServerApproval(
      [row("wa-1", "order_confirmation_v1", "rejected")],
      stored,
    ) as { approval: string }[];
    // The client claimed "rejected"; the server's own answer stands.
    expect(kept.approval).toBe("approved");

    const [invented] = keepServerApproval(
      [row("wa-new", "whatever", "approved")],
      stored,
    ) as { approval: string }[];
    // A row the server has never seen cannot arrive pre-approved.
    expect(invented.approval).toBe("not_submitted");

    const [renamed] = keepServerApproval(
      [row("wa-1", "order_confirmation_v2", "approved")],
      stored,
    ) as { approval: string }[];
    // The approval belonged to the OLD name — pointing the row at different
    // wording must not carry Meta's verdict across to it.
    expect(renamed.approval).toBe("not_submitted");
  });

  it("runs that guard on the admin save path", () => {
    // The behaviour above is worth nothing if `replaceTemplates` stops calling
    // it. Asserting the function merely EXISTS passes with the call deleted —
    // the same weak-assertion shape that let an import line satisfy a check
    // meant for a rendered element.
    const service = code("features/communications/server/communications.service.ts");
    expect(service).toContain("keepServerApproval(incoming, stored)");
  });

  it("is not offered as a field the admin can set", () => {
    const fields = code(
      "apps/admin/communications/components/whatsapp-meta-binding-fields.tsx",
    );
    // The badge renders `draft.approval`; nothing writes it.
    expect(fields).not.toMatch(/onPatch\(\{\s*approval/);
    expect(fields).toContain("APPROVAL_META[approval]");
  });

  it("gates the send", () => {
    const send = code("features/communications/server/whatsapp.service.ts");
    expect(send).toMatch(/if \(template\.approval !== "approved"\)/);
  });
});

describe("a WhatsApp failure cannot break an order", () => {
  it("is fire-and-report at every call site", () => {
    const orders = code("features/orders/server/order.service.ts");
    // `notifyWhatsApp` never throws and never returns a failure the caller
    // acts on — the order is already placed and paid for.
    expect(orders).toContain("notifyWhatsApp(");
    expect(orders).not.toMatch(/const \w+ = await notifyWhatsApp/);

    const service = code("features/communications/server/whatsapp.service.ts");
    // Every refusal is a returned reason, not a throw.
    expect(service).not.toMatch(/throw new/);
  });

  it("stays silent when the shop simply has no WhatsApp connected", () => {
    // The normal state. Logging a failure per order would bury the real ones.
    const service = code("features/communications/server/whatsapp.service.ts");
    expect(service).toContain("notConfigured");
    expect(service).toMatch(/if \(notConfigured\) return;/);
  });
});
