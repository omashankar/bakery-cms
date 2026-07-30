/**
 * The rendering half of outbound email.
 *
 * Nothing in this codebase sent mail until now: there was no transport, so the
 * SMTP settings an admin saved were stored and unread, "Send test email" toasted
 * "demo — no backend connected", and a password-reset code went to the server log
 * instead of the customer.
 *
 * The transport itself needs a real SMTP server to exercise, so these cover what
 * can be checked without one: that a template renders every variable it is given,
 * that an unfilled slot is visible rather than silently blank, and that the
 * seeded password-reset copy asks for the value the auth flow actually issues.
 */
import { describe, expect, it } from "vitest";

import {
  extractTemplateVariables,
  mergeTemplateVariables,
  renderTemplate,
} from "@/lib/template-render";
import { seedEmailTemplates } from "@/apps/admin/communications/lib/email-templates-repository";

describe("template rendering", () => {
  it("substitutes every variable it is given", () => {
    const rendered = renderTemplate("Hi {{name}}, order {{order}} is ready.", {
      name: "Asha",
      order: "BK-1",
    });

    expect(rendered).toBe("Hi Asha, order BK-1 is ready.");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderTemplate("Hi {{ name }}!", { name: "Asha" })).toBe("Hi Asha!");
  });

  it("leaves an unfilled slot visible rather than blanking it", () => {
    // A blank would ship "Use this code to reset your password:" with nothing
    // after it, and look like a formatting quirk rather than a missing value.
    expect(renderTemplate("Code: {{reset_code}}", {})).toBe("Code: {{reset_code}}");
  });

  it("finds the variables a body actually uses, without duplicates", () => {
    expect(extractTemplateVariables("{{a}} then {{b}} then {{a}}")).toEqual(["a", "b"]);
  });

  it("merges declared and discovered variables", () => {
    expect(mergeTemplateVariables(["declared"], ["body uses {{found}}"])).toEqual([
      "declared",
      "found",
    ]);
  });
});

describe("the seeded transactional templates", () => {
  const templates = seedEmailTemplates();
  const bySlug = (slug: string) => templates.find((template) => template.slug === slug);

  it("ships the two the code actually triggers", () => {
    expect(bySlug("order_confirmation")).toBeDefined();
    expect(bySlug("password_reset")).toBeDefined();
  });

  it("asks the password reset for the CODE the auth flow issues, not a link", () => {
    const template = bySlug("password_reset");

    // The flow generates a one-time code. The seeded copy asked for
    // {{reset_link}}, which nothing ever supplied — so even once mail was wired,
    // the value the customer needs would not have been in the email.
    expect(template?.body).toContain("{{reset_code}}");
    expect(template?.body).not.toContain("{{reset_link}}");
    expect(template?.variables).toContain("reset_code");
  });

  it("renders both with the variables their senders supply", () => {
    const reset = bySlug("password_reset");
    const rendered = renderTemplate(reset?.body ?? "", {
      customer_name: "Asha",
      store_name: "Monginis",
      reset_code: "482913",
      expires_in: "10 minutes",
    });

    // No slot left over means every variable the template declares is one the
    // sender in auth.service actually passes.
    expect(extractTemplateVariables(rendered)).toEqual([]);
    expect(rendered).toContain("482913");
  });

  it("renders the order confirmation with what order.service supplies", () => {
    const confirmation = bySlug("order_confirmation");
    const rendered = renderTemplate(confirmation?.body ?? "", {
      customer_name: "Asha",
      store_name: "Monginis",
      order_number: "BK-20260730-1234",
      order_total: "₹1,250.00",
      payment_method: "Paid online",
      delivery_date: "2026-08-01, 2:00 PM – 4:00 PM",
      // `invoice_url` is declared by the seeded copy but has no sender yet.
      invoice_url: "https://example.test/invoice",
    });

    expect(extractTemplateVariables(rendered)).toEqual([]);
    expect(rendered).toContain("BK-20260730-1234");
  });
});
