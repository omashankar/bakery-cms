import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DRAFT DID NOT STOP AN EMAIL — IT SWAPPED IN THE BUILT-IN ONE.
 *
 * The admin's Email Templates screen offers Active / Draft. A draft read as
 * "no template", and `stored ?? FALLBACKS[slug]` sent the hard-coded copy, so a
 * shop that parked "order_shipped" kept telling customers their cake was on the
 * way. WhatsApp already sent nothing for a draft.
 *
 * The sign-in and reset codes are the exception: parking one must not lock
 * every account out, so those fall back to the built-in wording.
 */

const state = vi.hoisted(() => ({
  sent: [] as Array<{ to: string; subject: string }>,
  templates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/server/mail/send-mail", () => ({
  sendMail: async (mail: { to: string; subject: string }) => {
    state.sent.push(mail);
    return { sent: true };
  },
}));
vi.mock("@/features/communications/server/communications.service", () => ({
  getTemplates: async () => state.templates,
}));
vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({ general: { siteName: "Sweet Crumbs" }, contact: {} }),
}));
vi.mock("@/features/site-layout/server/site-layout.service", () => ({
  getSiteLayout: async () => ({}),
}));

const { sendTemplatedEmail } = await import("@/features/communications/server/email.service");

function template(slug: string, status: "active" | "draft") {
  return { slug, status, subject: `Stored ${slug}`, body: "Hi", previewText: "" };
}

beforeEach(() => {
  state.sent = [];
  state.templates = [];
});

describe("a template set to Draft", () => {
  it("is not sent, and says why", async () => {
    state.templates = [template("order_shipped", "draft")];
    const result = await sendTemplatedEmail("order_shipped", "asha@example.in", {});

    expect(state.sent).toHaveLength(0);
    expect(result).toEqual({ sent: false, error: expect.stringMatching(/Draft/) });
  });

  it("still lets a customer sign in, in the built-in wording", async () => {
    state.templates = [template("customer_sign_in", "draft")];
    await sendTemplatedEmail("customer_sign_in", "asha@example.in", { code: "123456" });

    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].subject).not.toBe("Stored customer_sign_in");
  });

  it("an active template sends its own wording", async () => {
    state.templates = [template("order_shipped", "active")];
    await sendTemplatedEmail("order_shipped", "asha@example.in", {});
    expect(state.sent[0]?.subject).toBe("Stored order_shipped");
  });

  it("a shop that never stored one still gets the built-in email", async () => {
    await sendTemplatedEmail("order_shipped", "asha@example.in", {});
    expect(state.sent).toHaveLength(1);
  });
});
