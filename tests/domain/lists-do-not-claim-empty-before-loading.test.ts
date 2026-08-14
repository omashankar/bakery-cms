/**
 * "No orders found" before the server has answered is a guess.
 *
 * The admin's own orders list said so, in a comment: "Saying 'No orders found'
 * before the server has answered would be a guess, and a wrong one on every
 * cold load in a shop that has orders." Ten sibling screens rendered their
 * empty state regardless — each one telling an admin their shop had no
 * products, no coupons, no inventory, no inquiries, and inviting them to
 * create the first of something they already had.
 *
 * Every one of these lists starts from an empty array (or a null response) and
 * fills it in an effect, so the empty branch is reached on EVERY cold load. The
 * check below is that a loading branch is reached first.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** Anything that means "we have not looked yet" rather than "there is nothing". */
const LOADING_MARKERS = [
  "ListLoading",
  "animate-pulse",
  "animate-spin",
  "Skeleton",
];

/**
 * Screens whose list is filled asynchronously, and the flag each uses to say
 * the first read has happened.
 */
const LISTS: { file: string; gate: string }[] = [
  { file: "apps/admin/products/components/products-list-page.tsx", gate: "!mounted" },
  { file: "apps/admin/commerce/pages/delivery-zones-admin-page.tsx", gate: "!mounted" },
  { file: "apps/admin/commerce/pages/inventory-admin-page.tsx", gate: "!mounted" },
  { file: "apps/admin/commerce/pages/coupons-admin-page.tsx", gate: "!mounted" },
  { file: "apps/admin/commerce/pages/notifications-admin-page.tsx", gate: "!loaded" },
  // Gates on the SERVER having answered, not on having read the local cache —
  // see `inquiriesHydration`. The others below are still cache-read gates; that
  // is correct only where localStorage is the source of truth.
  { file: "apps/admin/inquiries/components/inquiries-list-page.tsx", gate: 'figures === "loading"' },
  {
    file: "apps/admin/inquiries/components/newsletter-subscribers-page.tsx",
    gate: 'figures === "loading"',
  },
  { file: "apps/admin/communications/pages/email-templates-admin-page.tsx", gate: "!mounted" },
  { file: "apps/admin/communications/pages/whatsapp-templates-admin-page.tsx", gate: "!mounted" },
  { file: "apps/admin/reports/components/reports-page.tsx", gate: "awaitingAnalytics" },
  // Already correct before this pass — kept so they cannot regress.
  { file: "apps/admin/pages/components/pages-list-page.tsx", gate: "!mounted" },
  { file: "apps/admin/banners/components/banners-admin-page.tsx", gate: "!mounted" },
  { file: "apps/admin/faq/components/faq-admin-page.tsx", gate: "!mounted" },
  { file: "apps/admin/testimonials/components/testimonials-admin-page.tsx", gate: "!mounted" },
  { file: "apps/admin/media/components/media-library-page.tsx", gate: "!ready" },
  { file: "apps/admin/commerce/pages/orders-list-page.tsx", gate: "pending" },
  { file: "apps/admin/commerce/pages/customers-list-page.tsx", gate: "!mounted" },
  { file: "apps/website/account/pages/account-orders-page.tsx", gate: "orders === null" },
];

describe("a list that has not loaded yet", () => {
  it.each(LISTS)("does not claim to be empty — $file", ({ file, gate }) => {
    const source = read(file);

    expect(source, `${file} has no "not loaded yet" flag`).toContain(gate);
    expect(
      LOADING_MARKERS.some((marker) => source.includes(marker)),
      `${file} renders no loading state`,
    ).toBe(true);
  });

  it.each(LISTS)("reaches the loading branch BEFORE the empty one — $file", ({ file, gate }) => {
    /**
     * Order matters, and is the whole bug.
     *
     * Every one of these already had a flag; most used it for the STAT CARDS
     * and left the table below rendering the empty state unconditionally. A
     * gate that exists but is checked after `length === 0` changes nothing.
     */
    const source = read(file);
    const gateAt = source.indexOf(gate);
    /**
     * Compared against the EMPTY-STATE RENDER, not against `length === 0`.
     *
     * Several of these legitimately write `paginated.length === 0 && !mounted ?`,
     * where the length test comes first in the source and the behaviour is
     * exactly right. What must not happen is reaching the "nothing here" render
     * without having asked whether we have looked.
     */
    const emptyAt = source.search(/<EmptyState|No adjustments yet/);

    expect(gateAt, `${file} never checks ${gate}`).toBeGreaterThan(-1);
    if (emptyAt === -1) return; // renders no empty state at all

    expect(
      gateAt,
      `${file} renders "nothing here" before it checks whether it has looked`,
    ).toBeLessThan(emptyAt);
  });
});

describe("a list whose localStorage is only a cache", () => {
  /**
   * A gate that stands for the wrong thing is not a gate.
   *
   * Inquiries and newsletter subscribers live on the SERVER; their localStorage
   * key is a cache a `*ServerSync` hook fills on entering the admin. Both
   * pages gated on having read that cache — so on a first login, another
   * device, or a cleared profile, the empty read counted as an answer and the
   * screen stated "0" under "All clear" in green and "No inquiries found",
   * about an inbox with customers waiting in it. Every marker this file checks
   * for was present; they simply opened one fetch too early.
   */
  const GATED = [
    {
      name: "inquiries",
      load: () => import("@/features/inquiries/lib/inquiries-repository"),
      gate: (m: Record<string, unknown>) => m.inquiriesHydration as { hasSettled(): boolean },
      fill: (m: Record<string, unknown>) => (m.persistServerInquiries as (rows: never[]) => void)([]),
    },
    {
      name: "newsletter",
      load: () => import("@/features/inquiries/lib/newsletter-repository"),
      gate: (m: Record<string, unknown>) => m.newsletterHydration as { hasSettled(): boolean },
      fill: (m: Record<string, unknown>) =>
        (m.persistServerSubscribers as (rows: never[]) => void)([]),
    },
  ];

  it.each(GATED)("is closed until the server has answered — $name", async ({ load, gate, fill }) => {
    vi.resetModules();
    const repo = (await load()) as unknown as Record<string, unknown>;

    expect(gate(repo).hasSettled(), "open before the server said anything").toBe(false);
    // An EMPTY server answer still opens it: "the shop has none" is an answer,
    // and the difference from "I have not looked" is the whole point.
    fill(repo);
    expect(gate(repo).hasSettled(), "the server answered and the gate stayed shut").toBe(true);
  });

  it.each([
    "apps/admin/inquiries/components/inquiries-list-page.tsx",
    "apps/admin/inquiries/components/newsletter-subscribers-page.tsx",
  ])("gates its figures on that, not on a mount flag — %s", (file) => {
    const source = read(file);

    expect(source, "the page still gates on having read the cache").not.toContain("setMounted(");
    expect(source).toMatch(/Hydration\.waitForSettled\(\)/);
    // A failed load says so rather than settling on a zero — a zero is an answer.
    expect(source).toContain('setFigures(settled ? "ready" : "unavailable")');
  });
});

describe("the shared loading row", () => {
  it("is announced to people who cannot see a shimmer", () => {
    const source = read("components/shared/list-loading.tsx");

    expect(source).toContain('role="status"');
    expect(source).toContain("sr-only");
  });
});
