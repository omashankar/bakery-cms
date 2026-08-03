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
import { keepServerApproval } from "@/features/communications/server/communications.service";
import {
  buildParameters,
  contractCoversEverySlug,
} from "@/features/communications/server/whatsapp.service";
import {
  availableVariablesFor,
  isSendableSlug,
  TEMPLATE_VARIABLE_CONTRACT,
  validateSlug,
  WHATSAPP_VARIABLE_CONTRACT,
} from "@/features/communications/lib/template-contract";
import { seedWhatsAppTemplates } from "@/apps/admin/communications/lib/whatsapp-templates-repository";
import {
  countUnfilledSlots,
  getWhatsAppTemplateOverview,
  isSendable,
} from "@/apps/admin/communications/lib/whatsapp-template-utils";
import { defaultTemplateSampleData } from "@/apps/admin/communications/lib/template-sample-data";
import type { WhatsAppTemplateRecord } from "@/types/communication";

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

describe("the access token", () => {
  it("is never read back to the browser", () => {
    const credentials = source("features/communications/server/whatsapp-credentials.server.ts");
    // The status type the API returns carries `tokenSet`, a boolean — and no
    // field that could hold the value.
    const status = source("types/whatsapp-provider.ts");
    expect(status).toContain("tokenSet: boolean");
    expect(credentials).toContain('import "server-only"');

    const api = code("apps/admin/communications/lib/communications-api.ts");
    expect(api).toContain("fetchWhatsAppConnection");
    // The client type has no token field to populate.
    expect(api).not.toContain("accessToken: loaded");
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
