import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultModuleSettings,
  newShopModuleSettings,
} from "@/features/settings/lib/settings-utils";

/**
 * The four lines that decide the wedding gate, pinned where they are READ.
 *
 * A fix split one module-defaults constant in two — `defaultModuleSettings`,
 * which fails open because every one of its readers is guessing, and
 * `newShopModuleSettings`, taken only where a shop is actually created. The
 * tests that came with it assert the two constants' VALUES, which is the easy
 * half. Each of these four call sites is one identifier away from re-shipping a
 * bug a merge audit refused, and the whole suite stayed green for all four:
 *
 *   - `SECTION_DEFAULTS.modules`     — "Reset defaults" takes a live page down
 *   - `getServerModules`' catch      — a Mongo outage 404s a revenue page
 *   - `getOrCreateSettings`' create  — every new shop opens selling weddings
 *   - `migrate`'s label repair       — a shop's own wording changes under it
 *
 * Mocked per test with `doMock` + `resetModules` rather than hoisted, because
 * one of these puts `settings.service` under test and another has to replace it.
 */
/**
 * `resetModules` clears the module REGISTRY, not the `doMock` REGISTRATIONS.
 *
 * Without the unmocks, the repository stub the first test installs is still in
 * force when the later ones import the repository for real — they read a stub
 * that records nothing, and `create` is never called. That direction is the
 * lucky one; a leak the other way is a test passing on a mock of the thing it
 * claims to be checking.
 */
const REPLACED = [
  "@/features/settings/server/settings.repository",
  "@/features/settings/server/settings.service",
  "@/lib/server/audit/audit-log",
  "@/lib/server/mail/transport",
  "@/lib/server/db/mongoose",
  "@/lib/server/db/models/settings.model",
  "next/server",
];

beforeEach(() => {
  for (const path of REPLACED) vi.doUnmock(path);
  vi.resetModules();
});
afterEach(() => vi.restoreAllMocks());

describe("Reset defaults on Settings > Modules", () => {
  it("sends the fail-open defaults to the server, not the new-shop ones", async () => {
    // Typed params, so `calls[0][1]` below is the section VALUE and not a
    // tuple index TypeScript has to be told to trust.
    const updateSection = vi.fn(async (_section: string, _value: unknown) => ({
      toJSON: () => ({}),
    }));
    vi.doMock("@/features/settings/server/settings.repository", () => ({
      updateSection,
      getOrCreateSettings: vi.fn(async () => ({ toJSON: () => ({}) })),
    }));
    vi.doMock("@/lib/server/audit/audit-log", () => ({
      writeAuditLog: vi.fn(async () => undefined),
      requestContext: () => ({ ip: "127.0.0.1", userAgent: "test" }),
    }));
    vi.doMock("@/lib/server/mail/transport", () => ({ resetMailTransport: vi.fn() }));

    const { resetSection } = await import("@/features/settings/server/settings.service");
    await resetSection("modules", { ip: "127.0.0.1", userAgent: "test" });

    /**
     * The client sends no body — `resetSectionRequest` POSTs empty — so this
     * argument IS the value that reaches Mongo. Pointing it at the new-shop
     * constant makes one click take /store/wedding-cakes offline for a shop
     * that has been selling from it, behind a dialog whose whole text is
     * "Replace this section with the demo defaults".
     */
    expect(updateSection).toHaveBeenCalledWith("modules", defaultModuleSettings);
    expect(updateSection.mock.calls[0][1]).toMatchObject({ weddingBuilder: true });
  });
});

describe("a settings read that fails", () => {
  it("leaves the wedding page, the builder and the sitemap entry alive", async () => {
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getPublicSettings: vi.fn(async () => {
        throw new Error("mongo unreachable");
      }),
    }));
    vi.doMock("next/server", () => ({ connection: async () => undefined }));

    const { getServerModules, isWeddingEnabledOnServer } = await import(
      "@/features/settings/server/modules.server"
    );

    // Three consumers read this one boolean: the page calls notFound(), the
    // admin builder redirects, and app/sitemap.ts drops the URL. False here
    // makes an outage do damage that outlasts it.
    await expect(isWeddingEnabledOnServer()).resolves.toBe(true);
    expect((await getServerModules()).modules).toEqual(defaultModuleSettings);
  });
});

/** A fake Mongoose document: records `set`, and answers `get` by dotted path. */
function fakeDoc(stored: Record<string, unknown>) {
  return {
    sets: [] as { path: string; value: unknown; options?: { strict?: boolean } }[],
    saved: 0,
    get(path: string) {
      return path
        .split(".")
        .reduce<unknown>(
          (node, key) => (node as Record<string, unknown> | undefined)?.[key],
          stored,
        );
    },
    set(path: string, value: unknown, options?: { strict?: boolean }) {
      this.sets.push({ path, value, options });
    },
    async save() {
      this.saved += 1;
    },
  };
}

async function repositoryWith(doc: ReturnType<typeof fakeDoc> | null) {
  const create = vi.fn(async (payload: Record<string, unknown>) => payload);
  vi.doMock("@/lib/server/db/mongoose", () => ({ connectDB: vi.fn(async () => undefined) }));
  vi.doMock("@/lib/server/db/models/settings.model", () => ({
    SettingsModel: { findOne: vi.fn(async () => doc), create },
  }));
  const repo = await import("@/features/settings/server/settings.repository");
  return { repo, create };
}

describe("a shop that has never existed", () => {
  it("is created with the wedding builder off", async () => {
    const { repo, create } = await repositoryWith(null);

    await repo.getOrCreateSettings();

    // The one path that is a decision rather than a guess. Pointing it at
    // `defaultModuleSettings` gives every new shop of every trade a live public
    // wedding page it never asked for.
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].modules).toEqual(newShopModuleSettings);
    expect(create.mock.calls[0][0].modules).toMatchObject({ weddingBuilder: false });
  });
});

describe("a shop that stored a business type before the enum was deleted", () => {
  it("keeps the wording it was showing, and drops the legacy field in the same save", async () => {
    const doc = fakeDoc({
      key: "singleton",
      general: { siteName: "Real Bakery", businessType: "bakery" },
      labelOverrides: {},
    });
    const { repo } = await repositoryWith(doc);

    await repo.getOrCreateSettings();

    const wording = doc.sets.find((entry) => entry.path === "labelOverrides");
    expect(wording?.value).toMatchObject({ productWord: "Cake", productWordPlural: "Cakes" });

    /**
     * And the legacy field goes, on the same document, before the one save.
     *
     * `strict: false` is not a detail. `generalSchema` no longer declares
     * `businessType`, and under the default strict mode `doc.set(path, undefined)`
     * is a silent no-op — save() resolves, the field is still there on the next
     * read, and the repair re-fires for any shop that ever blanks its wording.
     */
    const dropped = doc.sets.find((entry) => entry.path === "general.businessType");
    expect(dropped, "the legacy business type was left on the document").toBeDefined();
    expect(dropped?.value).toBeUndefined();
    expect(dropped?.options).toMatchObject({ strict: false });
    expect(doc.saved).toBe(1);
  });

  it("does not touch a shop that has already stated its own wording", async () => {
    const doc = fakeDoc({
      key: "singleton",
      general: { siteName: "Real Bakery", businessType: "bakery" },
      labelOverrides: { productWord: "Gateau" },
    });
    const { repo } = await repositoryWith(doc);

    await repo.getOrCreateSettings();

    expect(doc.sets.find((entry) => entry.path === "labelOverrides")).toBeUndefined();
    // The legacy field still goes: there is nothing to preserve, and leaving it
    // behind is exactly what would let this fire again the day the shop clears
    // those boxes.
    expect(doc.sets.map((entry) => entry.path)).toContain("general.businessType");
  });

  it("writes nothing at all for a shop that never had a business type", async () => {
    const doc = fakeDoc({
      key: "singleton",
      general: { siteName: "A Shop With No Past" },
      labelOverrides: {},
    });
    const { repo } = await repositoryWith(doc);

    await repo.getOrCreateSettings();

    expect(doc.sets).toEqual([]);
    expect(doc.saved).toBe(0);
  });
});
