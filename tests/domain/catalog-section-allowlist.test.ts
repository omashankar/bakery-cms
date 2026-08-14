import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The unfixed twins of the settings allowlist.
 *
 * `in` walks the prototype chain and a bare index resolves off it, so
 * `__proto__`, `constructor`, `toString`, `valueOf` and `hasOwnProperty` all
 * answered truthy in both catalog guards. The reset one then took a FUNCTION
 * into `doc.set()` and came back 200 "Catalog reset" with a
 * `catalog.reset.__proto__` audit row recording a reset that never happened —
 * in the trail the Security Center and the Activity screen read as the record
 * of what was done to this shop. The update one handed `Object.prototype` to
 * the validator, which has no `safeParse`, and answered a masked 500 where a
 * 404 was the answer.
 */
const repo = vi.hoisted(() => ({
  updateSection: vi.fn(async () => ({ toJSON: () => ({ categories: [] }) })),
  getOrCreateCatalog: vi.fn(async () => ({ toJSON: () => ({}) })),
}));
const audit = vi.hoisted(() => ({
  writeAuditLog: vi.fn(async (_entry: { action: string }) => undefined),
}));

vi.mock("@/features/catalog/server/catalog.repository", () => repo);
vi.mock("@/lib/server/audit/audit-log", () => ({
  ...audit,
  requestContext: () => ({ ip: "", userAgent: "test" }),
}));
vi.mock("@/lib/server/auth/dal", () => ({
  requireRole: vi.fn(async () => ({ sub: "u1", email: "owner@example.com", role: "owner" })),
}));

import { resetSection } from "@/features/catalog/server/catalog.service";
import { updateCatalogSectionController } from "@/features/catalog/server/catalog.controller";

const ctx = { ip: "", userAgent: "test", actorId: "u1", actorEmail: "owner@example.com" };
const inherited = ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"];

describe("resetting a catalog section that only exists on Object.prototype", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const key of inherited) {
    it(`rejects "${key}" instead of reporting a reset`, async () => {
      await expect(resetSection(key, ctx)).rejects.toThrow(/unknown catalog section/i);

      expect(repo.updateSection).not.toHaveBeenCalled();
      // Above all: no audit row. A fabricated entry in the shop's record is
      // the part Mongoose's strict schema could not protect against.
      expect(audit.writeAuditLog).not.toHaveBeenCalled();
    });
  }

  it("still resets a real section", async () => {
    await resetSection("categories", ctx);

    expect(repo.updateSection).toHaveBeenCalledOnce();
    expect(audit.writeAuditLog.mock.calls[0][0]).toMatchObject({
      action: "catalog.reset.categories",
    });
  });
});

describe("writing a catalog section that only exists on Object.prototype", () => {
  beforeEach(() => vi.clearAllMocks());

  const request = (body: unknown) =>
    new Request("http://localhost/api/catalog/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  for (const key of inherited) {
    it(`answers 404 for "${key}", not a masked 500`, async () => {
      const res = await updateCatalogSectionController(request([]), {
        params: Promise.resolve({ section: key }),
      });

      expect(res.status).toBe(404);
      expect(repo.updateSection).not.toHaveBeenCalled();
    });
  }

  it("still writes a real section", async () => {
    const res = await updateCatalogSectionController(
      request([{ id: "c1", name: "Cakes", slug: "cakes" }]),
      { params: Promise.resolve({ section: "categories" }) },
    );

    expect([200, 422]).toContain(res.status);
    // Whatever the section schema makes of that body, the guard let it through
    // to the validator rather than 404ing a real section name.
    expect(res.status).not.toBe(404);
  });
});
