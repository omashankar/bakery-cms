/**
 * The Email and WhatsApp template screens.
 *
 * Both write a whole COLLECTION, so both carry the seed-clobber risk this
 * project keeps meeting — and both did, in a shape the earlier audits missed:
 * the hydration gate was correct, and the payload was composed BEFORE it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  emailTemplatesHydration,
  whatsappTemplatesHydration,
  notificationSettingsHydration,
} from "@/apps/admin/communications/lib/communications-api";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  loadEmailTemplates,
  persistServerEmailTemplates,
  saveEmailTemplate,
} from "@/apps/admin/communications/lib/email-templates-repository";
import {
  availableVariablesFor,
  TEMPLATE_VARIABLE_CONTRACT,
  validateSlug,
} from "@/features/communications/lib/template-contract";
import { getSampleDataForVariables } from "@/apps/admin/communications/lib/template-sample-data";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

/**
 * The file with its comments removed.
 *
 * Every fix in this codebase documents the bug it replaced, quoting the old
 * string verbatim — which is exactly what a `not.toContain` over raw source
 * trips on. The first version of these assertions failed against correct code
 * for that reason. What matters is whether the string still reaches an ADMIN,
 * so strip the prose and assert on what actually executes.
 */
function code(relativePath: string): string {
  return source(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** A server collection that is deliberately NOT the demo seed. */
const SERVER_TEMPLATES = [
  {
    id: "email-real",
    slug: "order_confirmation",
    name: "The shop's own confirmation",
    description: "Edited by the shop",
    category: "transactional" as const,
    subject: "Your order {{order_number}}",
    previewText: "",
    body: "Hi {{customer_name}}",
    variables: ["order_number", "customer_name"],
    status: "active" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

function mockServer(ok: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve({ success: ok, data: ok ? {} : null }),
    } as unknown as Response),
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a template mutation composes its payload AFTER hydration", () => {
  it("sends the server's list, not the seed the page rendered from", async () => {
    // THE DEFECT. Every mutation called `loadEmailTemplates()` first — which
    // SEEDS the demo templates when the cache is empty — and only then reached
    // `guardedPut`, which waited for the gate. The gate opened and dutifully
    // shipped the seed as a whole-collection replace: the clobber the gate
    // exists to prevent, surviving inside it.
    mockServer(true);

    // The gate is shut, so the mutation must wait. Meanwhile hydration lands.
    const pending = createEmailTemplate({
      slug: "custom_new",
      name: "New",
      description: "",
      category: "marketing",
      subject: "Hi",
      previewText: "",
      body: "Hi",
      status: "draft",
      variables: [],
    } as never);

    persistServerEmailTemplates(SERVER_TEMPLATES as never);
    emailTemplatesHydration.markSettled();

    await pending;

    const sent = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const raw = JSON.parse((sent[1] as RequestInit).body as string) as
      | { id: string }[]
      | { items: { id: string }[]; knownIds: string[] };
    // Either envelope — the payload gained `knownIds` so the server can delete
    // only what this admin actually removed.
    const body = Array.isArray(raw) ? raw : raw.items;

    // The shop's real template must be in the payload. Composing before the
    // gate opened would have sent the six demo seeds and none of it.
    expect(body.some((t) => t.id === "email-real")).toBe(true);
  });
});

describe("a save the server refused", () => {
  beforeEach(() => {
    emailTemplatesHydration.markSettled();
    persistServerEmailTemplates(SERVER_TEMPLATES as never);
  });

  it("rolls the local cache back, so the editor stays dirty", async () => {
    // Without the rollback the refused value stayed in localStorage, the page
    // reloaded its list from there, found it matched the editor, and showed
    // "All changes saved" with Save greyed out — for a change the server had
    // rejected.
    mockServer(false);

    const { persisted } = await saveEmailTemplate("email-real", {
      ...SERVER_TEMPLATES[0],
      subject: "Rejected edit",
    } as never);

    expect(persisted).toBe(false);
    expect(loadEmailTemplates().find((t) => t.id === "email-real")?.subject).toBe(
      "Your order {{order_number}}",
    );
  });

  it("keeps the accepted value when the server took it", async () => {
    mockServer(true);

    const { persisted } = await saveEmailTemplate("email-real", {
      ...SERVER_TEMPLATES[0],
      subject: "Accepted edit",
    } as never);

    expect(persisted).toBe(true);
    expect(loadEmailTemplates().find((t) => t.id === "email-real")?.subject).toBe(
      "Accepted edit",
    );
  });
});

describe("one hydration gate per collection", () => {
  it("does not let one store's failure block another's writes", () => {
    const sync = code("apps/admin/communications/lib/use-communications-server-sync.ts");
    // It was `if (email && whatsapp) communicationsHydration.markSettled()` — a
    // single gate for three stores, so one failed WhatsApp fetch permanently
    // blocked EMAIL template saves for the whole session.
    expect(sync).not.toMatch(/if \(email && whatsapp\)/);
    expect(sync).toContain("emailTemplatesHydration.markSettled()");
    expect(sync).toContain("whatsappTemplatesHydration.markSettled()");
    expect(sync).toContain("notificationSettingsHydration.markSettled()");

    // Three distinct gates, not three aliases of one.
    expect(emailTemplatesHydration).not.toBe(whatsappTemplatesHydration);
    expect(whatsappTemplatesHydration).not.toBe(notificationSettingsHydration);
  });

  it("gates the notification-settings write too", () => {
    const api = source("apps/admin/communications/lib/communications-api.ts");
    // This was the one PUT in the file that skipped the gate entirely.
    expect(api).toContain(
      "guardedPut(notificationSettingsHydration, NOTIFICATION_SETTINGS_PATH, settings)",
    );
  });
});

describe("what these screens tell the admin", () => {
  it("does not describe WhatsApp as a channel that sends anything", () => {
    // There is no WhatsApp provider anywhere in this repo. The stat card said
    // "Ready to send", the test dialog reported a message "queued", and the
    // settings overview described the templates as being "for order updates" —
    // three separate places implying a channel that does not exist.
    const page = code("apps/admin/communications/pages/whatsapp-templates-admin-page.tsx");
    expect(page).not.toContain("Ready to send");
    expect(page).toContain("No WhatsApp provider is connected");

    const dialog = code(
      "apps/admin/communications/components/whatsapp-template-test-send-dialog.tsx",
    );
    expect(dialog).not.toContain("queued");
    expect(dialog).not.toMatch(/setTimeout\(resolve, \d+\)/);

    const overview = code("apps/admin/settings/components/settings-overview-page.tsx");
    expect(overview).not.toContain("WhatsApp message templates for order updates");
  });

  it("does not tell an admin on the SMS page that WhatsApp is available", () => {
    const sms = code("apps/admin/settings/components/sms-settings-page.tsx");
    // Sending a reader from an honest "coming soon" page towards another
    // unbuilt channel, described as available, is the worst misdirection: they
    // arrive believing they have found the working one.
    expect(sms).not.toContain("Email and WhatsApp templates are already available");
  });

  it("does not promise the email test-send delivers nothing, now that it does", () => {
    const dialog = code(
      "apps/admin/communications/components/email-template-test-send-dialog.tsx",
    );
    // True while the handler was a 900ms sleep; a lie the moment it started
    // sending. A stale reassurance is worse than none.
    expect(dialog).not.toContain("No real email is delivered");
  });
});

describe("the template forms hold their fields closed until hydration", () => {
  it.each([
    ["Email Templates", "apps/admin/communications/pages/email-templates-admin-page.tsx"],
    ["WhatsApp Templates", "apps/admin/communications/pages/whatsapp-templates-admin-page.tsx"],
  ])("%s", (_name, file) => {
    const code = source(file);
    expect(code).toContain("<SettingsFormGate hydration={hydration}>");
    expect(code).toContain("<SettingsHydrationNotice hydration={hydration} />");
    expect(code).toContain("ensureCommunicationsHydrated()");
    // Belt as well as braces, the same rule the settings registry enforces.
    expect(code).toMatch(/disabled=\{[^}]*hydration !== "ready"/);
  });

  it.each([
    ["Email Templates", "apps/admin/communications/pages/email-templates-admin-page.tsx"],
    ["WhatsApp Templates", "apps/admin/communications/pages/whatsapp-templates-admin-page.tsx"],
  ])("%s does not discard an edit in progress", (_name, file) => {
    const code = source(file);
    // The draft effect ran on every change to `templates` — hydration included
    // — and replaced the editor's contents outright.
    expect(code).not.toMatch(/\?\? null;\s*\r?\n\s*setDraft\(next\);/);
    expect(code).toContain("setDraft((current) => {");
  });
});

describe("an empty collection is an answer, not an absence", () => {
  it("does not resurrect the demo seed after the last template is deleted", () => {
    // `readTemplates` returned [] for both "no key" and "stored empty array",
    // and the loader re-seeded whenever the result was empty. Deleting the last
    // template brought the six demo templates straight back — and the next save
    // PUT them to the server. Delivery zones already drew this distinction.
    localStorage.setItem("bakery-cms-email-templates", "[]");
    localStorage.setItem("bakery-cms-email-templates-version", "1");

    expect(loadEmailTemplates()).toEqual([]);
  });

  it("still seeds a store that was never set up", () => {
    localStorage.clear();
    expect(loadEmailTemplates().length).toBeGreaterThan(0);
  });
});

describe("the editor's draft", () => {
  it("tells a real edit apart from the baseline moving underneath it", () => {
    const page = source("apps/admin/communications/pages/email-templates-admin-page.tsx");

    // THE TRAP. Diffing the draft against the NEW baseline cannot distinguish
    // "the admin typed something" from "hydration replaced the saved copy" —
    // both read as different. The first attempt did exactly that, so a page
    // just opened on a cold cache pinned the demo seed, announced "Unsaved
    // changes", and offered to Save it over the shop's real template.
    //
    // The draft has to be compared with the copy it was DERIVED from.
    expect(page).toContain("isEdited(current, draftOriginRef.current)");
    expect(page).toContain("setDraftOrigin(");
    expect(page).not.toMatch(
      /const baseline = templates\.find\(\(template\) => template\.id === current\.id\)/,
    );
  });

  it("strips the same fields on both sides of every comparison", () => {
    const page = source("apps/admin/communications/pages/email-templates-admin-page.tsx");
    // The effect excluded only `updatedAt` while `isDirty` excluded both, so a
    // record differing solely in `createdAt` — which the client seed stamps at
    // page-load time and the server's does not — was "edited" to one and
    // "clean" to the other: a pinned draft under an "All changes saved" label.
    expect(page).toContain(
      "JSON.stringify({ ...t, updatedAt: undefined, createdAt: undefined })",
    );
  });
});

describe("a refused write is reported as a refusal", () => {
  it.each([
    ["Email Templates", "apps/admin/communications/pages/email-templates-admin-page.tsx"],
    ["WhatsApp Templates", "apps/admin/communications/pages/whatsapp-templates-admin-page.tsx"],
  ])("%s passes a failure phrase to reportWrite", (_name, file) => {
    // The store rolls back now, so the default "saved on this device only" is
    // wrong — the change is nowhere at all, and that message sends the admin
    // looking for something that does not exist. `report-write.ts` documents
    // this and provides `options.failure` for exactly this case.
    const code = source(file);
    const calls = code.match(/reportWrite\([^)]*persisted[\s\S]{0,200}?\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).toContain("failure:");
  });

  it.each([
    ["Email Templates", "apps/admin/communications/pages/email-templates-admin-page.tsx"],
    ["WhatsApp Templates", "apps/admin/communications/pages/whatsapp-templates-admin-page.tsx"],
  ])("%s gates the mobile Save bar too", (_name, file) => {
    const code = source(file);
    // The desktop Save was gated and this one was not, so the whole guard was
    // one narrow viewport away from irrelevant.
    // The OPENING TAG, not the bare name. Matching the name found the import
    // line first (slice = whole file, satisfiable by any other gated button);
    // matching it last found the CLOSING tag (slice = nothing after it).
    const mobile = code.slice(code.indexOf("<AdminMobileActionBar"));
    expect(mobile).toContain('disabled={hydration !== "ready"}');
  });
});

describe("the slug is the key a sender matches on", () => {
  it("locks the slug of a template the shop actually sends", () => {
    // Renaming one does not break loudly: `findTemplate` simply stops matching
    // and the hardcoded fallback goes out instead, so the admin's own wording
    // quietly stops reaching anyone.
    const problem = validateSlug("order_confirmation_v2", "order_confirmation", []);
    expect(problem?.locked).toBe(true);
  });

  it("refuses a duplicate, because sending would pick one at random", () => {
    // `findTemplate` takes the FIRST active match.
    expect(validateSlug("promo_summer", "promo_old", ["promo_summer"])?.locked).toBe(false);
    expect(validateSlug("promo_summer", "promo_old", ["promo_summer"])).not.toBeNull();
  });

  it("refuses a custom template claiming a slug the shop sends", () => {
    // The hijack: add a template, name it `order_confirmation`, and take over
    // the shop's real order confirmation.
    expect(validateSlug("order_confirmation", "promo_old", [])).not.toBeNull();
  });

  it("refuses a slug that could never match anything", () => {
    for (const bad of [" order_confirmation ", "Order_Confirmation", "order-confirmation", ""]) {
      expect(validateSlug(bad, "promo_old", [])).not.toBeNull();
    }
  });

  it("accepts an ordinary new slug", () => {
    expect(validateSlug("summer_promo", "promo_old", ["other_slug"])).toBeNull();
  });
});

describe("the variables an admin is offered", () => {
  it("offers only what the sender for that template supplies", () => {
    // The chips were built from every common variable regardless of template, so
    // the password-reset editor advertised {{order_total}}. Insert it, watch the
    // preview render it happily from sample data, and the customer receives the
    // literal text — `renderTemplate` leaves an unresolved key as written.
    const reset = availableVariablesFor("password_reset", []);
    expect(reset).toContain("reset_code");
    expect(reset).not.toContain("order_total");

    const confirmation = availableVariablesFor("order_confirmation", []);
    expect(confirmation).toContain("order_total");
    expect(confirmation).not.toContain("reset_code");
  });

  it("falls back to the template's own list when nothing sends it", () => {
    expect(availableVariablesFor("promo_custom", ["coupon_code"])).toEqual(["coupon_code"]);
  });

  it("every contract variable has preview sample data", () => {
    // A contract variable with no sample renders as a literal in the preview AND
    // in the real test-send, which is the one place an admin would have caught
    // the mismatch.
    for (const [slug, vars] of Object.entries(TEMPLATE_VARIABLE_CONTRACT)) {
      const sample = getSampleDataForVariables([...vars]);
      for (const v of vars) {
        expect(typeof sample[v], `${slug}.${v}`).toBe("string");
      }
    }
  });
});

describe("two admins editing templates at once", () => {
  it("sends the ids it knew about, so the server deletes only what was removed", async () => {
    // A whole-collection write otherwise means "these are all the templates
    // there are", so a save from a tab opened an hour ago deleted every
    // template another admin had added since — both saves reporting success.
    emailTemplatesHydration.markSettled();
    persistServerEmailTemplates(SERVER_TEMPLATES as never);
    mockServer(true);

    await saveEmailTemplate("email-real", {
      ...SERVER_TEMPLATES[0],
      subject: "Edited",
    } as never);

    const sent = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((sent[1] as RequestInit).body as string) as {
      knownIds?: string[];
    };
    expect(body.knownIds).toEqual(["email-real"]);
  });
});

describe("deleting a template", () => {
  it("still tells the server the id it removed", async () => {
    // `knownIds` has to come from the cache snapshot taken BEFORE the write,
    // not from the outgoing list. Reading it from what is being sent would
    // report only the survivors as known — and the server, told nothing was
    // removed, would keep the deleted template forever while the admin was
    // shown a successful delete.
    emailTemplatesHydration.markSettled();
    persistServerEmailTemplates([
      ...SERVER_TEMPLATES,
      { ...SERVER_TEMPLATES[0], id: "email-doomed", slug: "promo_old" },
    ] as never);
    mockServer(true);

    await deleteEmailTemplate("email-doomed");

    const sent = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((sent[1] as RequestInit).body as string) as {
      items: { id: string }[];
      knownIds: string[];
    };

    expect(body.items.map((t) => t.id)).not.toContain("email-doomed");
    expect(body.knownIds).toContain("email-doomed");
  });
});
