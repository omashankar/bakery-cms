import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CmsPage } from "@/types/content";

/**
 * THE APP READS THE PAGES THE WEBSITE PUBLISHES — and only those.
 *
 * `GET /api/storefront/pages/[slug]` is the phone app's Privacy Policy and Terms
 * of Service (the Play Store wants both reachable from the app). It is public,
 * so the rule that matters is what it must NOT answer: a draft, the editor's
 * fields, or anything `/store/pages/[slug]` would not show a visitor.
 *
 * The store is mocked at `createMongoStore`, beneath the real
 * `getPageForStorefront`, so the published-only rule under test is the one the
 * website itself runs.
 */

const state = vi.hoisted(() => ({ pages: [] as unknown[] }));

vi.mock("@/lib/server/db/cms-store", () => ({
  createMongoStore() {
    return {
      read: async () => state.pages,
      write: async (value: unknown[]) => {
        state.pages = value;
      },
      mutate: async <R,>(mutator: (current: unknown[]) => { next: unknown[]; result: R }) => {
        const { next, result } = mutator(state.pages);
        state.pages = next;
        return result;
      },
      reset: async () => {},
    };
  },
  hasSeeded: async () => true,
  markSeeded: async () => {},
}));

const contact = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({ contact: contact.value }),
}));

function page(overrides: Partial<CmsPage>): CmsPage {
  return {
    id: "page-1",
    title: "Privacy Policy",
    slug: "privacy",
    description: "How we handle your data",
    template: "standard",
    blocks: [
      { id: "b1", type: "heading", content: "What we collect" },
      { id: "b2", type: "paragraph", content: "Your name and address, to deliver your order." },
    ],
    status: "published",
    isSystem: true,
    sortOrder: 1,
    seo: { metaTitle: "Secret SEO title", metaDescription: "", noIndex: true },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  } as CmsPage;
}

async function get(slug: string) {
  const { GET } = await import("@/app/api/storefront/pages/[slug]/route");
  const response = await GET(new Request(`http://shop.test/api/storefront/pages/${slug}`), {
    params: Promise.resolve({ slug }),
  });
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  state.pages = [];
  contact.value = {};
});

describe("GET /api/storefront/pages/[slug]", () => {
  it("answers a published page with its title, description and blocks — nothing of the editor", async () => {
    state.pages = [page({})];

    const { status, body } = await get("privacy");

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      slug: "privacy",
      title: "Privacy Policy",
      description: "How we handle your data",
      blocks: [
        { id: "b1", type: "heading", content: "What we collect" },
        { id: "b2", type: "paragraph", content: "Your name and address, to deliver your order." },
      ],
    });
    // Spelled out, so a later "just send the page" cannot pass this test.
    for (const key of ["status", "seo", "scheduledPublishAt", "isSystem", "sortOrder", "id"]) {
      expect(body.data).not.toHaveProperty(key);
    }
  });

  it("answers a DRAFT with the same 404 as an unknown slug", async () => {
    state.pages = [page({ slug: "terms", title: "Terms", status: "draft" })];

    const draft = await get("terms");
    const unknown = await get("no-such-page");

    expect(draft.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect({ ...draft.body, timestamp: null }).toEqual({ ...unknown.body, timestamp: null });
    expect(JSON.stringify(draft.body)).not.toContain("Terms");
  });

  it("answers an archived page with 404", async () => {
    state.pages = [page({ status: "archived" })];
    expect((await get("privacy")).status).toBe(404);
  });

  it("ignores ?preview=1 — this route has no admin session to justify a draft", async () => {
    state.pages = [page({ status: "draft" })];
    const { GET } = await import("@/app/api/storefront/pages/[slug]/route");
    const response = await GET(
      new Request("http://shop.test/api/storefront/pages/privacy?preview=1"),
      { params: Promise.resolve({ slug: "privacy" }) },
    );
    expect(response.status).toBe(404);
  });

  it("draws blocks the way the website does: heading is a heading, anything else a paragraph", async () => {
    state.pages = [
      page({
        blocks: [
          { id: "h", type: "heading", content: "  Refunds  " },
          { id: "odd", type: "quote" as never, content: "Treated as a paragraph" },
          { id: "blank", type: "paragraph", content: "   " },
          { id: "", type: "paragraph", content: "No id" },
          { id: "num", type: "paragraph", content: 42 as never },
        ],
      }),
    ];

    const { body } = await get("privacy");

    expect(body.data.blocks).toEqual([
      { id: "h", type: "heading", content: "Refunds" },
      { id: "odd", type: "paragraph", content: "Treated as a paragraph" },
      { id: "block-3", type: "paragraph", content: "No id" },
    ]);
  });

  it("survives a stored page with no blocks array", async () => {
    state.pages = [page({ blocks: undefined as never })];
    const { status, body } = await get("privacy");
    expect(status).toBe(200);
    expect(body.data.blocks).toEqual([]);
  });
});

describe("GET /api/storefront/contact", () => {
  async function getContact() {
    const { GET } = await import("@/app/api/storefront/contact/route");
    const response = await GET();
    return { status: response.status, body: await response.json() };
  }

  it("answers the shop's own details, as the contact page shows them", async () => {
    contact.value = {
      phone: "+91 88246 75118",
      email: "hello@shop.test",
      address: "C-7, Borkhera, Kota",
      businessHours: [{ day: "Monday - Sunday", hours: "9:00 AM - 11:00 PM" }],
    };

    const { status, body } = await getContact();

    expect(status).toBe(200);
    expect(body.data).toMatchObject({
      phone: "+91 88246 75118",
      email: "hello@shop.test",
      address: "C-7, Borkhera, Kota",
      businessHours: [{ day: "Monday - Sunday", hours: "9:00 AM - 11:00 PM" }],
    });
  });

  it("blanks a shipped demo number instead of advertising it", async () => {
    contact.value = { phone: "+91 1800-123-4567", email: "", address: "" };

    const { body } = await getContact();

    expect(body.data.phone).toBe("");
    expect(body.data.email).toBe("");
  });
});
