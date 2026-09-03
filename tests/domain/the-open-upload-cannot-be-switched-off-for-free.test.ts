/**
 * @vitest-environment node
 *
 * A SERVER environment, because this is server code and the difference is
 * load-bearing: under jsdom `request.formData()` hands back undici’s `File`
 * while the global `File` is jsdom’s, so the controller’s `instanceof File`
 * check answers false and every request looks like it carried no photo. In
 * Next’s runtime both come from undici and it is exact.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The endpoint that takes no account, driven rather than grepped.
 *
 * The guard that shipped with it asserted key STRINGS — that "photo-upload:ip:"
 * appears in the file. Changing `limit: 120` to a million, or moving every
 * `rateLimit` call below the upload, left all of it green. Two real holes were
 * underneath:
 *
 *   - the budget was charged BEFORE the body was read, so a hundred and
 *     twenty-one EMPTY posts spent the whole shop-wide allowance and turned
 *     photo-cake upload off for every anonymous visitor for an hour, at no cost
 *     whatever to the attacker; and
 *   - nothing checked the request came from this shop. `multipart/form-data` is
 *     CORS-safelisted, so a form on any other site could post here from a
 *     visitor's browser — spending other people's addresses against the per-IP
 *     budget, and leaving the shop's own customers to hit the limit.
 */
const seen = vi.hoisted(() => ({
  budgets: [] as string[],
  uploads: 0,
}));

vi.mock("@/lib/server/http/rate-limit", () => ({
  rateLimit: vi.fn((key: string) => {
    seen.budgets.push(key);
  }),
}));

vi.mock("@/features/uploads/server/photo-upload.service", () => ({
  uploadPhotoCakeImage: vi.fn(async () => {
    seen.uploads += 1;
    return { url: "https://cdn.example/p.png", bytes: 10 };
  }),
}));

vi.mock("@/lib/server/auth/customer-dal", () => ({
  getCustomerSession: vi.fn(async () => null),
}));

import { photoUploadController } from "@/features/uploads/server/photo-upload.controller";

function post(options: { file?: boolean; headers?: Record<string, string> } = {}) {
  const body = new FormData();
  if (options.file !== false) body.append("photo", new File(["x"], "p.png", { type: "image/png" }));
  return photoUploadController(
    new Request("https://shop.example/api/uploads/photo-cake", {
      method: "POST",
      headers: { host: "shop.example", ...(options.headers ?? {}) },
      body,
    }),
  );
}

beforeEach(() => {
  seen.budgets = [];
  seen.uploads = 0;
});
afterEach(() => vi.clearAllMocks());

describe("posting a photo from somewhere that is not this shop", () => {
  it("is refused, and spends nothing", async () => {
    const response = await post({ headers: { "sec-fetch-site": "cross-site" } });

    expect(response.status).toBe(403);
    // The point: a refusal that still charged the budget would BE the denial.
    expect(seen.budgets).toEqual([]);
    expect(seen.uploads).toBe(0);
  });

  it("is refused when the Origin belongs to another host", async () => {
    const response = await post({ headers: { origin: "https://evil.example" } });

    expect(response.status).toBe(403);
    expect(seen.budgets).toEqual([]);
  });

  it("is allowed from the shop's own pages", async () => {
    const response = await post({
      headers: { "sec-fetch-site": "same-origin", origin: "https://shop.example" },
    });

    expect(response.status).toBe(200);
    expect(seen.uploads).toBe(1);
  });
});

describe("a post carrying no file", () => {
  it("costs the attacker nothing and the shop nothing", async () => {
    /**
     * This is the whole denial. 121 of these used to spend the shop-wide
     * anonymous allowance — no file, no bytes, no Cloudinary call — and every
     * real visitor was then refused for an hour.
     */
    const response = await post({ file: false });

    // 422, which is what `ValidationError` answers throughout this app.
    expect(response.status).toBe(422);
    expect(seen.budgets).toEqual([]);
    expect(seen.uploads).toBe(0);
  });
});

describe("a real upload", () => {
  it("is charged to the shop-wide budget when no address can be trusted", async () => {
    // TRUST_PROXY_HEADERS is unset here, exactly as on the deployment, so
    // `clientIpFrom` answers "" and there is no per-visitor key to use.
    await post();

    expect(seen.budgets).toEqual(["photo-upload:anonymous"]);
  });

  it("is charged before the file is stored, not after", async () => {
    /**
     * Order matters: a budget checked after the upload has already happened
     * bounds nothing, because the storage is spent by the time it refuses.
     */
    const order: string[] = [];
    const { rateLimit } = await import("@/lib/server/http/rate-limit");
    const { uploadPhotoCakeImage } = await import(
      "@/features/uploads/server/photo-upload.service"
    );
    vi.mocked(rateLimit).mockImplementation(() => {
      order.push("budget");
    });
    vi.mocked(uploadPhotoCakeImage).mockImplementation(async () => {
      order.push("upload");
      return { url: "u", bytes: 1 };
    });

    await post();

    expect(order).toEqual(["budget", "upload"]);
  });
});
