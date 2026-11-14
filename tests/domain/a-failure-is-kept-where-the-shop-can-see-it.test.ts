/**
 * A FAILURE IS KEPT WHERE THE SHOP CAN SEE IT.
 *
 * Server errors went to `console.error` only — on the live site, a host's log
 * stream nobody in the shop reads — and a page that crashed in a customer's
 * browser left no trace anywhere. Now both are grouped into `errorlogs` and
 * shown in Settings → Error log, with nothing secret in them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const writes = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock("@/lib/server/db/mongoose", () => ({ connectDB: vi.fn(async () => undefined) }));
vi.mock("@/lib/server/db/models/error-log.model", () => ({
  ErrorLogModel: { updateOne: vi.fn(async (...args: unknown[]) => writes.calls.push(args)) },
}));

import { cleanPath, fingerprintOf, recordError, scrubSecrets } from "@/lib/server/errors/record-error";

beforeEach(() => {
  writes.calls.length = 0;
});

describe("nothing secret is written down", () => {
  it.each([
    ["a reset link's token", "GET /reset-password?token=abc123def456", "token=***"],
    ["a bearer token", "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abcdefghijklm.signature", "Bearer ***"],
    ["a Brevo key", "auth failed for xkeysib-0123456789abcdef", "xkeysib-***"],
    ["a Razorpay key", "bad key rzp_live_ABCDEF123456", "rzp_live-***"],
    ["a database address", "connect ECONNREFUSED mongodb+srv://user:pass@cluster0.example.net/db", "mongodb://***"],
  ])("%s", (_what, text, kept) => {
    const out = scrubSecrets(text);
    expect(out).toContain(kept);
    expect(out).not.toMatch(/abc123def456|0123456789abcdef|ABCDEF123456|user:pass|eyJhbGciOiJIUzI1NiJ9\.abc/);
  });

  it("a path loses its query string", () => {
    expect(cleanPath("/invite?token=secret#x")).toBe("/invite");
  });
});

describe("one row per kind of failure", () => {
  it("ignores the ids and numbers that change every time", () => {
    const a = fingerprintOf({ source: "server", kind: "api", message: "Order 65f1a2b3c4d5e6f7a8b9c0d1 not found", path: "/api/orders/65f1a2b3c4d5e6f7a8b9c0d1" });
    const b = fingerprintOf({ source: "server", kind: "api", message: "Order 0123456789abcdef01234567 not found", path: "/api/orders/0123456789abcdef01234567" });
    expect(a).toBe(b);
  });

  it("keeps different failures apart", () => {
    const a = fingerprintOf({ source: "server", kind: "api", message: "Payment failed", path: "/api/checkout" });
    const b = fingerprintOf({ source: "browser", kind: "browser", message: "Payment failed", path: "/api/checkout" });
    expect(a).not.toBe(b);
  });
});

describe("writing it", () => {
  it("counts it, and re-opens one that was marked fixed", async () => {
    await recordError({ source: "server", kind: "api", message: "Boom once", path: "/api/x?token=1" });
    expect(writes.calls).toHaveLength(1);
    const [filter, update] = writes.calls[0] as [Record<string, unknown>, Record<string, Record<string, unknown>>];
    expect(filter.fingerprint).toEqual(expect.any(String));
    expect(update.$inc).toEqual({ count: 1 });
    expect(update.$set.resolvedAt).toBeNull();
    expect(update.$set.path).toBe("/api/x");
  });

  it("a failure in a loop does not flood the database", async () => {
    for (let i = 0; i < 20; i++) await recordError({ source: "server", kind: "api", message: "Boom loop", path: "/api/y" });
    expect(writes.calls).toHaveLength(1);
  });

  it("never throws, even when the database does", async () => {
    const { ErrorLogModel } = await import("@/lib/server/db/models/error-log.model");
    vi.mocked(ErrorLogModel.updateOne).mockRejectedValueOnce(new Error("db down"));
    await expect(recordError({ source: "server", kind: "api", message: "Boom db", path: "/api/z" })).resolves.toBeUndefined();
  });
});

describe("where failures are caught", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("an API's own 500 is recorded, not just logged", () => {
    const errors = source("lib/server/http/errors.ts");
    const branch = errors.slice(errors.indexOf('console.error("[api] Unhandled error:"'));
    expect(branch.slice(0, 900)).toContain("recordError(");
  });

  it("a page that throws on the server is recorded by Next's own hook", () => {
    expect(source("instrumentation.ts")).toMatch(/export const onRequestError[\s\S]*recordError\(/);
  });

  it.each(["app/(storefront)/error.tsx", "app/(admin)/error.tsx", "app/global-error.tsx"])(
    "%s reports a crash in the browser",
    (file) => {
      expect(source(file)).toContain("reportClientError(error)");
    },
  );
});
