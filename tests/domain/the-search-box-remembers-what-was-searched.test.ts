import { beforeEach, describe, expect, it, vi } from "vitest";

import { signOutCustomer } from "@/apps/website/account/lib/customer-session";
import {
  MAX_RECENT_SEARCHES,
  RECENT_SEARCHES_KEY,
  loadRecentSearches,
  recentSearchesFor,
  rememberSearch,
  withRecentSearch,
} from "@/apps/website/lib/recent-searches";

describe("recent searches", () => {
  beforeEach(() => localStorage.clear());

  it("puts the newest first and keeps only the last few", () => {
    for (let i = 1; i <= MAX_RECENT_SEARCHES + 2; i += 1) rememberSearch({ term: `cake ${i}` });
    const terms = loadRecentSearches().map((entry) => entry.term);
    expect(terms).toHaveLength(MAX_RECENT_SEARCHES);
    expect(terms[0]).toBe(`cake ${MAX_RECENT_SEARCHES + 2}`);
    expect(terms).not.toContain("cake 1");
  });

  it("moves a word searched again to the top instead of listing it twice", () => {
    rememberSearch({ term: "Chocolate" });
    rememberSearch({ term: "vanilla" });
    rememberSearch({ term: " chocolate " });
    expect(loadRecentSearches().map((entry) => entry.term)).toEqual(["chocolate", "vanilla"]);
  });

  it("keeps a typed word and the product of the same name apart", () => {
    const list = withRecentSearch(
      withRecentSearch([], { term: "Red Velvet" }),
      { term: "Red Velvet", slug: "red-velvet-classic", category: "Cream Cakes" },
    );
    expect(list).toEqual([
      { term: "Red Velvet", slug: "red-velvet-classic", category: "Cream Cakes" },
      { term: "Red Velvet" },
    ]);
  });

  it("ignores a blank search and an unreadable key", () => {
    rememberSearch({ term: "   " });
    expect(loadRecentSearches()).toEqual([]);
    localStorage.setItem(RECENT_SEARCHES_KEY, "{not json");
    expect(loadRecentSearches()).toEqual([]);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([{ term: 4 }, { term: "ok" }]));
    expect(loadRecentSearches()).toEqual([{ term: "ok" }]);
  });

  it("goes with the rest of the customer's browser data on sign-out", async () => {
    // A shared screen: the next person clicks the box and sees nothing of ours.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    rememberSearch({ term: "anniversary cake for priya" });
    expect(loadRecentSearches()).toHaveLength(1);
    await signOutCustomer();
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("narrows to the entries that begin with what is typed", () => {
    const list = [{ term: "Chocolate truffle" }, { term: "cheesecake" }, { term: "vanilla" }];
    expect(recentSearchesFor(list, "")).toEqual(list);
    expect(recentSearchesFor(list, "ch").map((entry) => entry.term)).toEqual([
      "Chocolate truffle",
      "cheesecake",
    ]);
  });
});
