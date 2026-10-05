/**
 * WHAT GOOGLE IS TOLD ABOUT A SHOP BEFORE THE SHOP HAS SAID ANYTHING.
 *
 * `seedStore()` is the SEO every shop is born with: the title, the description,
 * the keywords and the share image of every page, until somebody edits them.
 * Nineteen of its strings said cake, bakery or pastry. A florist provisioned
 * tomorrow was handed "Cake Collections" as the title Google shows for its
 * shop-all page, "Browse all cake collections and categories." as the sentence
 * under it, and a hotlinked stock photograph of somebody else's cake as the
 * image behind every share.
 *
 * `no-new-bakery-wording` is the ratchet for exactly this and it could not see
 * any of it: `features/seo` was not in its scanned list. It is now, and this
 * file covers the two halves that ratchet deliberately does not — KEYWORDS,
 * which it skips because they are usually words typed INTO the app, and the
 * og:image URL, which is not prose at all.
 *
 * WHAT REPLACED THEM IS BLANK, not a better sentence. The builder already
 * falls back: `entry.metaDescription || global.defaultDescription`, keywords
 * fall back when the entry's list is empty, and `ogImage ? [...] : undefined`
 * omits the tag. Inventing a neutral description for a shop that has not
 * written one is the same mistake in a quieter voice.
 *
 * WHAT THIS DOES NOT TOUCH: a shop's STORED SEO. This shop's own document in
 * `cmsstores` carries its own cake wording, which is correct — it is a bakery.
 * The seed is what the next shop inherits.
 */
import { describe, expect, it } from "vitest";

import { seedStore } from "@/features/seo/lib/seo-repository";
import { DEFAULT_LABELS } from "@/config/business-labels";
import { brandInfo } from "@/constants/landing-data";

/** Words that name one trade. The ratchet's own list, narrowed to this file. */
const TRADE = /\b(cake|cakes|bakery|bakeries|pastry|pastries|confection|confections|baked)\b/i;

const store = seedStore();

describe("the SEO a shop is born with", () => {
  it("names no trade in any title or description", () => {
    /*
      Reported as a LIST rather than one failing field, because the first fix
      for this changed five entries and a case that stops at the first would
      have hidden four of them.
    */
    /*
      THE SHOP'S OWN NAME IS NOT THIS SEED'S STRING, so it is removed before
      the sweep — and ONLY it.

      The unconfigured name is `brandInfo.name`, "Your Bakery": the app-wide
      identity a shop shows before it has typed one, reaching the footer, the
      invoice defaults, the settings defaults and the chrome fallback as well.
      Nine production files, thirty-three references. Changing it is a decision
      of its own and it is reported rather than made here.

      THE FIRST VERSION OF THIS EXCLUDED THE WHOLE HOME ENTRY, and a mutation
      caught it: putting back `${brandInfo.name} — Cakes & Pastries` — the
      exact string this change removed — left the case green. Stripping the
      name and sweeping what REMAINS is the difference between excusing one
      known value and excusing the field it sits in.
    */
    const withoutShopName = (text: string) => text.split(brandInfo.name).join(" ");
    const offenders = store.routes
      .filter((entry) =>
        TRADE.test(`${withoutShopName(entry.metaTitle)} ${withoutShopName(entry.metaDescription)}`),
      )
      .map((entry) => `${entry.routeKey}: "${entry.metaTitle}" / "${entry.metaDescription}"`);
    expect(offenders, "a new shop is told what trade it is in").toEqual([]);

    expect(
      TRADE.test(store.global.defaultDescription),
      "the global default description names a trade",
    ).toBe(false);
  });

  it("and ships NO keywords at all", () => {
    /*
      THE HALF THE RATCHET SKIPS, on purpose: it does not scan keyword lists,
      because they are usually words a shop types INTO the app rather than
      words it shows. Seeded ones are the opposite — nobody typed them, and
      they travel on every page of every shop.

      Empty rather than neutral. Keywords say what a shop wants to be FOUND
      for, which only the shop knows, and the builder falls back to the global
      list when a route has none — so empty means no tag, not a wrong tag.
    */
    expect(store.global.defaultKeywords, "a new shop inherits someone's search terms").toEqual([]);

    const withKeywords = store.routes
      .filter((entry) => (entry.metaKeywords ?? []).length > 0)
      .map((entry) => `${entry.routeKey}: ${JSON.stringify(entry.metaKeywords)}`);
    expect(withKeywords, "a route ships keywords nobody typed").toEqual([]);
  });

  it("and shares no image it does not own", () => {
    /*
      It was `images.unsplash.com/photo-1578985545062-…` — a third party's
      photograph of a cake, on a third party's CDN, presented as the shop's own
      in every link preview, and a dead preview the day that URL stops
      answering.

      The builder emits the tag only when there is a URL, so a blank omits it.
      No image is a correct link preview; a stranger's cake is not.
    */
    expect(store.global.defaultOgImage, "every shop shares a stock photograph").toBe("");
    const withImage = store.routes
      .filter((entry) => (entry.ogImage ?? "").trim().length > 0)
      .map((entry) => entry.routeKey);
    expect(withImage, "a route ships an image the shop did not upload").toEqual([]);
  });

  it("and hands a crawler a host that resolves to nobody", () => {
    /*
      This reaches robots.txt and every canonical tag before a shop sets its
      domain. It was `www.your-bakery.example` — reserved by RFC 2606 so it
      never resolves, which is right, while still naming the trade, which is
      not. `example.com` is reserved by the same RFC and says nothing.

      The RESERVED half is the load-bearing one: a real-looking default is how
      an unconfigured shop points crawlers at an address it does not own.
    */
    expect(store.global.canonicalBaseUrl).toMatch(/^https:\/\/(www\.)?example\.(com|org|net)$/);
    expect(TRADE.test(store.global.canonicalBaseUrl), "the placeholder host names a trade").toBe(
      false,
    );
  });

  it("but every page still has a TITLE, because a blank one is worse", () => {
    /*
      `metaTitle` is the one field that cannot be emptied: the builder appends
      the suffix to it, so a blank renders as the bare "| Shop Name". Each
      entry keeps the PAGE's name, which is not a claim about a trade — and the
      one that was a claim takes the neutral heading every shop already starts
      with, read from `DEFAULT_LABELS` rather than retyped.
    */
    for (const entry of store.routes) {
      expect(entry.metaTitle.trim(), `${entry.routeKey} has no title`).not.toBe("");
    }
    const shopAll = store.routes.find((entry) => entry.routeKey === "store-collections");
    expect(shopAll?.metaTitle, "the shop-all title drifted from the shared default").toBe(
      DEFAULT_LABELS.collectionsTitle,
    );
  });
});
