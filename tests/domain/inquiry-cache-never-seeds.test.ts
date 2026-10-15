import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadInquiries,
  persistServerInquiries,
} from "@/features/inquiries/lib/inquiries-repository";
import {
  loadNewsletterSubscribers,
  persistServerSubscribers,
} from "@/features/inquiries/lib/newsletter-repository";
import type { Inquiry, NewsletterSubscriber } from "@/types/inquiry";

const read = (relative: string) =>
  readFileSync(path.join(process.cwd(), relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * These caches used to invent their own contents.
 *
 * `parsed.length > 0 ? parsed : seed()` made an empty list mean "not seeded
 * yet", so an admin who cleared every enquiry watched the 12 demo ones reappear
 * on the next read — and the counts and badges counted them. There was no way
 * to have none. The same shape sat in the newsletter cache, where the Total and
 * Active cards then counted 15 demo subscribers as people the shop could mail.
 *
 * The SERVER seeds a demo shop once, against a flag that survives deletions.
 * That is where the decision belongs: one shop, once, visible to everyone.
 */
describe.each([
  {
    what: "inquiries",
    load: loadInquiries as () => unknown[],
    persist: persistServerInquiries as (rows: unknown[]) => void,
    file: "features/inquiries/lib/inquiries-repository.ts",
    fn: "export function loadInquiries(",
    row: {
      id: "inq-x",
      type: "contact",
      name: "A",
      email: "a@b.c",
      message: "hello",
      status: "new",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as unknown as Inquiry,
  },
  {
    what: "newsletter subscribers",
    load: loadNewsletterSubscribers as () => unknown[],
    persist: persistServerSubscribers as (rows: unknown[]) => void,
    file: "features/inquiries/lib/newsletter-repository.ts",
    fn: "export function loadNewsletterSubscribers(",
    row: {
      id: "sub-x",
      email: "a@b.c",
      source: "Website",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    } as unknown as NewsletterSubscriber,
  },
])("the $what cache never invents rows", ({ load, persist, file, fn, row }) => {
  beforeEach(() => localStorage.clear());

  it("returns nothing when there is nothing stored", () => {
    expect(load()).toEqual([]);
  });

  it("keeps a deliberately emptied list empty", () => {
    // This is the case the bug turned into "not seeded yet".
    persist([]);
    expect(load()).toEqual([]);
  });

  it("returns what hydration put there", () => {
    persist([row]);
    expect(load()).toHaveLength(1);
  });

  it("does not throw when storage is denied", () => {
    // Private mode, or blocked cookies. `getItem` itself throws, and it used to
    // sit outside the try.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => load()).not.toThrow();
    expect(load()).toEqual([]);
    vi.restoreAllMocks();
  });

  it("has no seed call left in the read path", () => {
    const source = read(file);
    const start = source.indexOf(fn);
    const body = source.slice(start, source.indexOf("\n}", start));

    expect(body).not.toMatch(/seed[A-Z]\w*\(/);
    expect(body).not.toMatch(/length > 0 \? parsed :/);
  });
});

/**
 * And the server does not seed them either.
 *
 * It used to, once per shop, behind a flag: 15 subscribers at email.com (a real
 * provider) and 12 invented enquiries, written to a real shop's database on the
 * first admin read. "Copy emails" then put strangers into the shop's campaign.
 */
describe("the server seeds no demo leads", () => {
  it.each([
    "features/inquiries/server/inquiry.service.ts",
    "features/newsletter/server/newsletter.service.ts",
  ])("%s inserts nothing on read", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/seedIfEmpty|seedInquiries|seedSubscribers|ensureSeeded/);
  });
});
