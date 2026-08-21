/**
 * The eight defects an adversarial audit found in the two template screens.
 *
 * Every one of them is the same shape underneath: a surface that agrees with
 * the admin while the customer gets something else. A preview that fills a
 * variable no sender supplies. A test send that renders the draft and delivers
 * the saved copy. A reset that reports defaults over an unchanged list. An
 * editor field that reaches no inbox. A header asserting a channel is not
 * connected while it sends.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  offContractVariables,
  TEMPLATE_VARIABLE_CONTRACT,
} from "@/features/communications/lib/template-contract";
import { getSampleDataForVariables } from "@/features/communications/lib/template-sample-data";
import { toEmailHtml } from "@/features/communications/server/email.service";
import {
  deriveTemplateVariables,
  mergeTemplateVariables,
} from "@/lib/template-render";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function code(relativePath: string): string {
  return source(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("a variable the sender will never supply", () => {
  it("is named, for a wired template", () => {
    // `invoice_url` belongs to order_confirmation, not order_shipped.
    expect(offContractVariables("order_shipped", ["customer_name", "invoice_url"])).toEqual([
      "invoice_url",
    ]);
    expect(offContractVariables("order_shipped", ["customer_name", "order_number"])).toEqual([]);
  });

  it("is nothing at all for a template no sender exists for", () => {
    // A custom template has no contract to break; refusing its variables would
    // be inventing a rule.
    expect(offContractVariables("my_custom_note", ["anything", "at_all"])).toEqual([]);
  });

  it("renders as a visible placeholder in the preview instead of a plausible URL", () => {
    // This is what made the bug invisible. The sample table holds every
    // variable any template might use, so `{{invoice_url}}` in the
    // out-for-delivery email previewed as a real link — and arrived at the
    // customer as literal braces, because the sender passes only the contract.
    const honest = getSampleDataForVariables(["customer_name", "invoice_url"], {
      slug: "order_shipped",
    });
    expect(honest.invoice_url).toBe("[invoice_url]");
    // Everything the sender DOES supply still renders properly.
    expect(honest.customer_name).toBe("Priya Sharma");
    expect(honest.delivery_address).toBeTruthy();

    // On the template that genuinely sends it, it is a real value.
    const legitimate = getSampleDataForVariables(["invoice_url"], {
      slug: "order_confirmation",
    });
    expect(legitimate.invoice_url).toMatch(/^https?:\/\//);
  });

  it("uses the WhatsApp contract on the WhatsApp screen", () => {
    // `order_confirmation` exists on BOTH channels and they disagree about
    // exactly one variable, which makes it the only case that can tell a
    // channel-aware lookup from one hardcoded to email. Asserting through
    // `getSampleDataForVariables` alone did NOT — that helper resolves the
    // channel itself, so it passed with `offContractVariables` ignoring its
    // own argument entirely.
    expect(offContractVariables("order_confirmation", ["invoice_url"], "whatsapp")).toEqual([
      "invoice_url",
    ]);
    expect(offContractVariables("order_confirmation", ["invoice_url"], "email")).toEqual([]);

    const sample = getSampleDataForVariables(["invoice_url"], {
      slug: "order_confirmation",
      channel: "whatsapp",
    });
    expect(sample.invoice_url).toBe("[invoice_url]");
  });

  it("is refused at save, on both screens", () => {
    for (const page of [
      "apps/admin/communications/pages/email-templates-admin-page.tsx",
      "apps/admin/communications/pages/whatsapp-templates-admin-page.tsx",
    ]) {
      const handler = code(page);
      // In the SAVE handler, not merely imported: the chips were already
      // filtered and the customer still received the braces.
      expect(handler).toContain("offContractVariables(draft.slug, draft.variables");
      expect(handler).toMatch(/if \(stray\.length\) \{[\s\S]{0,300}return;/);
    }
  });

  it("is named in the editor before the admin presses Save", () => {
    for (const page of [
      "apps/admin/communications/pages/email-templates-admin-page.tsx",
      "apps/admin/communications/pages/whatsapp-templates-admin-page.tsx",
    ]) {
      const rendered = code(page);
      // A stored template can carry one from before the rule existed — the
      // WhatsApp order confirmation this project shipped did — so an admin
      // editing something unrelated would be refused over a line they never
      // wrote, with nothing on screen saying which line.
      expect(rendered).toMatch(/\{stray\.length \? \(/);
      expect(rendered).toContain("Remove it from the body to save.");
      // And the button says so too, rather than looking available.
      expect(rendered).toContain("stray.length > 0");
    }
  });
});

describe("the test send", () => {
  it("previews the copy the server will actually send", () => {
    for (const page of [
      "apps/admin/communications/pages/email-templates-admin-page.tsx",
      "apps/admin/communications/pages/whatsapp-templates-admin-page.tsx",
    ]) {
      const handler = code(page);
      // The endpoint reads the STORED row and the dialog previews what it is
      // given, so passing `draft` showed unsaved edits above a button that
      // delivered something else.
      expect(handler).toMatch(/template=\{savedSelected\}\s*\r?\n\s*hasUnsavedChanges=\{isDirty\}/);
    }
  });

  it("says so when the editor holds edits it will not include", () => {
    for (const dialog of [
      "apps/admin/communications/components/email-template-test-send-dialog.tsx",
      "apps/admin/communications/components/whatsapp-template-test-send-dialog.tsx",
    ]) {
      const rendered = code(dialog);
      // The CONDITION, not the words. Both strings survive `{hasUnsavedChanges
      // ? (` becoming `{false ? (` — the prop stays in the signature and the
      // copy stays in the JSX — so asserting their presence pinned nothing.
      expect(rendered).toMatch(/\{hasUnsavedChanges \? \(/);
      expect(rendered).toContain("This test sends the SAVED version");
    }
  });

  it("no longer asserts SMTP is off from an unhydrated cache", () => {
    const dialog = code(
      "apps/admin/communications/components/email-template-test-send-dialog.tsx",
    );
    // `getSmtpSettings()` reads localStorage and defaults to disabled, and
    // nothing on this route hydrates settings — the public settings endpoint
    // omits `smtp` entirely. So a first session after an in-app login refused
    // a send the server would have accepted, and contradicted the SMTP page.
    expect(dialog).not.toContain("getSmtpSettings");
    expect(dialog).not.toContain("smtpEnabled");
    // The server's own reason is what reaches the admin.
    expect(dialog).toContain("result.error");
  });
});

describe("reset", () => {
  it("goes through the hydration gate like every other write", () => {
    for (const [repo, mutate] of [
      ["apps/admin/communications/lib/email-templates-repository.ts", "mutateEmailTemplates"],
      [
        "apps/admin/communications/lib/whatsapp-templates-repository.ts",
        "mutateWhatsAppTemplates",
      ],
    ]) {
      const store = code(repo);
      const reset = store.slice(store.indexOf("export async function reset"));
      // It called `persistAndSync` directly — the one mutation skipping the
      // gate-first helper — so `knownIds` was snapshotted from a cache the
      // server had never filled. The server then deleted nothing, kept every
      // custom row, and the admin was toasted "reset to defaults".
      expect(reset).toContain(mutate);
      expect(reset).not.toContain("await persistAndSync(seeded)");
    }
  });

  it("is the most destructive button on the page and is gated like one", () => {
    for (const page of [
      "apps/admin/communications/pages/email-templates-admin-page.tsx",
      "apps/admin/communications/pages/whatsapp-templates-admin-page.tsx",
    ]) {
      const rendered = code(page);
      expect(rendered).toMatch(
        /onClick=\{\(\) => setResetOpen\(true\)\}\s*\r?\n\s*disabled=\{hydration !== "ready"\}/,
      );
    }
  });
});

describe("the preview line an inbox shows", () => {
  it("reaches the message", () => {
    // An editable field, previewed exactly where a mail client shows it, that
    // `sendTemplatedEmail` dropped — and the test send dropped too, so no test
    // could reveal it.
    const html = toEmailHtml("Body text", "Your cake is on the way");
    expect(html).toContain("Your cake is on the way");
    // Hidden in the rendered message, read by the inbox list.
    expect(html).toMatch(/display:none[^"]*"/);
    // Padded, so the body is not dragged into the inbox line after it.
    expect(html).toContain("&zwnj;");
  });

  it("is escaped like everything else", () => {
    const html = toEmailHtml("Body", '<script>alert("x")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("is padded, so the body is not dragged into the inbox line after it", () => {
    // Without the padding a mail client fills the remaining preview space
    // with the start of the body, and the carefully written preview line is
    // followed by half a sentence of the email. Asserted separately because
    // the escaping test passes with the padding removed.
    const html = toEmailHtml("Body text here", "Your cake is on the way");
    expect(html).toContain("&zwnj;");
    expect((html.match(/&zwnj;/g) ?? []).length).toBeGreaterThan(10);
  });

  it("adds nothing when a template has none", () => {
    expect(toEmailHtml("Body")).not.toContain("display:none");
    expect(toEmailHtml("Body", "   ")).not.toContain("display:none");
  });

  it("is passed by both the real send and the test", () => {
    const sender = code("features/communications/server/email.service.ts");
    expect(sender).toMatch(/toEmailHtml\(body, preheader/);

    const test = code("features/communications/server/communications.service.ts");
    expect(test).toMatch(/template\.previewText \? renderTemplate\(template\.previewText/);
  });
});

describe("the WhatsApp page header", () => {
  it("describes the stored connection rather than asserting there is none", () => {
    const page = code("apps/admin/communications/pages/whatsapp-templates-admin-page.tsx");
    // It said "Sending is not connected yet" unconditionally — true when
    // nothing could send, and a flat contradiction of the card 140px below it
    // once something could.
    expect(page).not.toContain("Sending is not connected yet");
    expect(page).toContain("connection?.configured");
    // One read, reported up by the card that already fetches it. Two
    // independent reads is how a header and a card end up disagreeing.
    expect(page).toContain("onStatus={setConnection}");
  });
});

describe("every seeded template obeys its own contract", () => {
  it("declares no variable its sender will not supply", async () => {
    const { seedEmailTemplates } = await import(
      "@/features/communications/lib/email-template-seed"
    );
    const { seedWhatsAppTemplates } = await import(
      "@/features/communications/lib/whatsapp-template-seed"
    );

    // The shipped copy has to pass the rule the editor now enforces —
    // otherwise a shop cannot save a template it was given.
    for (const template of seedEmailTemplates()) {
      expect(
        offContractVariables(template.slug, template.variables, "email"),
        `${template.slug} (email)`,
      ).toEqual([]);
    }
    for (const template of seedWhatsAppTemplates()) {
      expect(
        offContractVariables(template.slug, template.variables, "whatsapp"),
        `${template.slug} (whatsapp)`,
      ).toEqual([]);
    }

    // And the rule is only meaningful because some slugs are wired.
    expect(Object.keys(TEMPLATE_VARIABLE_CONTRACT).length).toBeGreaterThan(0);
  });
});

describe("removing a variable actually removes it", () => {
  it("derives the list from the content instead of accumulating onto it", () => {
    // `mergeTemplateVariables` is union-only, which is right for normalising a
    // stored record and wrong while editing: it made a variable unremovable.
    // The editor refuses to save a template declaring a variable its sender
    // will never supply and tells the admin to delete it from the body — and
    // deleting it left the name in `variables`, so the refusal stood and the
    // only escape was "Reset defaults", discarding every other edit.
    expect(mergeTemplateVariables(["invoice_url"], ["Order {{order_number}}"])).toContain(
      "invoice_url",
    );
    expect(deriveTemplateVariables(["Order {{order_number}}"])).toEqual(["order_number"]);
  });

  it("is what both editors use while typing", () => {
    for (const page of [
      "apps/admin/communications/pages/email-templates-admin-page.tsx",
      "apps/admin/communications/pages/whatsapp-templates-admin-page.tsx",
    ]) {
      const rendered = code(page);
      expect(rendered).toContain("deriveTemplateVariables(");
      // The union must not be what a keystroke goes through.
      expect(rendered).not.toMatch(/variables: mergeTemplateVariables\(/);
    }
  });
});

describe("a WhatsApp slug the order pipeline sends", () => {
  it("is validated against the WhatsApp contract, not the email one", () => {
    const page = code("apps/admin/communications/pages/whatsapp-templates-admin-page.tsx");
    // The fourth argument defaults to "email", so `order_ready` and
    // `delivery_update` were renameable — after which the send path finds no
    // template and returns silently, and those messages just stop.
    expect(page).toMatch(/validateSlug\([\s\S]{0,200}"whatsapp",\s*\r?\n\s*\)/);
    expect(page).toContain('isSendableSlug(savedSelected?.slug ?? draft.slug, "whatsapp")');
    // And the field says so, rather than only refusing on save.
    expect(page).toContain("readOnly={slugLocked}");
  });
});
