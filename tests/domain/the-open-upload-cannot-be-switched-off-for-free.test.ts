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
  /** Sizes the cheap validator saw, so its ORDER can be asserted. */
  checked: [] as number[],
}));

vi.mock("@/lib/server/http/rate-limit", () => ({
  rateLimit: vi.fn((key: string) => {
    seen.budgets.push(key);
  }),
}));

vi.mock("@/features/uploads/server/photo-upload.service", () => ({
  rejectUnusableFile: vi.fn((file: File) => {
    seen.checked.push(file.size);
  }),
  refuseIfStorageIsFull: vi.fn(async () => undefined),
  uploadPhotoCakeImage: vi.fn(async () => {
    seen.uploads += 1;
    return { url: "https://cdn.example/p.png", bytes: 10 };
  }),
}));

const account = vi.hoisted(() => ({ value: null as { id: string } | null }));
vi.mock("@/lib/server/auth/customer-dal", () => ({
  // The ACCOUNT reader, which returns null for a blocked or deleted row — not
  // the session claim, which answers for anyone holding an unexpired token.
  getCustomerAccount: vi.fn(async () => account.value),
}));

import { rateLimit } from "@/lib/server/http/rate-limit";
import {
  refuseIfStorageIsFull,
  rejectUnusableFile,
  uploadPhotoCakeImage,
} from "@/features/uploads/server/photo-upload.service";
import { photoUploadController } from "@/features/uploads/server/photo-upload.controller";

function post(
  options: { file?: boolean; headers?: Record<string, string>; noFetchSite?: boolean } = {},
) {
  const body = new FormData();
  if (options.file !== false) body.append("photo", new File(["x"], "p.png", { type: "image/png" }));
  return photoUploadController(
    new Request("https://shop.example/api/uploads/photo-cake", {
      method: "POST",
      headers: {
        host: "shop.example",
        // What every browser sends on a POST. A request carrying NEITHER
        // signal is refused now, so the default here has to look like a real
        // one; `noFetchSite` drops it to exercise the Origin fallback.
        ...(options.noFetchSite ? {} : { "sec-fetch-site": "same-origin" }),
        ...(options.headers ?? {}),
      },
      body,
    }),
  );
}

beforeEach(() => {
  seen.budgets = [];
  seen.uploads = 0;
  seen.checked = [];
  account.value = null;
  /**
   * Implementations RE-ESTABLISHED, not merely cleared.
   *
   * Several cases below replace one of these to make it throw, and
   * `clearAllMocks` resets calls only — so the next test inherited the
   * replacement and its budget assertions went quiet rather than red.
   * `restoreAllMocks` is not the answer either: it strips the factory
   * implementations too, and every mock becomes a bare `vi.fn()`.
   */
  vi.mocked(rateLimit).mockImplementation((key: string) => {
    seen.budgets.push(key);
  });
  vi.mocked(rejectUnusableFile).mockImplementation((file: File) => {
    seen.checked.push(file.size);
  });
  vi.mocked(refuseIfStorageIsFull).mockImplementation(async () => undefined);
  vi.mocked(uploadPhotoCakeImage).mockImplementation(async () => {
    seen.uploads += 1;
    return { url: "https://cdn.example/p.png", bytes: 10 };
  });
});

describe("who the budget is charged to", () => {
  it("gives a signed-in customer their own allowance", async () => {
    account.value = { id: "cust-1" };

    await post();

    expect(seen.budgets).toEqual(["photo-upload:customer:cust-1"]);
  });

  it("does not give a blocked account one", async () => {
    /**
     * `getCustomerAccount` answers null for a blocked or deleted row. The code
     * this replaced read the session CLAIM, so an account the shop had blocked
     * kept uploading — and kept a private, separately-keyed allowance to do it
     * with. It falls to the anonymous bucket now: the endpoint is public, so a
     * blocked customer could clear a cookie and be a visitor anyway, but the
     * shop does not hand them a larger budget in their own name.
     */
    account.value = null;

    await post();

    expect(seen.budgets).toEqual(["photo-upload:anonymous"]);
  });
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
    const response = await post({
      noFetchSite: true,
      headers: { origin: "https://evil.example" },
    });

    expect(response.status).toBe(403);
    expect(seen.budgets).toEqual([]);
  });

  it("is refused when it claims no browser context at all", async () => {
    /**
     * Neither Sec-Fetch-Site nor Origin — which is exactly what a script sends.
     * This used to answer “not cross-site”, so the check stopped a form on
     * another site and waved through the curl loop it was written for.
     */
    const response = await post({ noFetchSite: true });

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

  it("refuses the empty and the oversized without spending anything", async () => {
    /**
     * The cheap refusals used to live one call downstream of the charge, so a
     * ONE-BYTE file spent the shop-wide allowance — which made cutting the
     * ceiling to 30 a four-times-cheaper denial than the 121 empty posts the
     * endpoint was hardened against.
     */
    vi.mocked(rejectUnusableFile).mockImplementation(() => {
      throw new Error("unusable");
    });

    await post().catch(() => undefined);

    expect(seen.budgets).toEqual([]);
    expect(seen.uploads).toBe(0);
  });

  it("refuses once the store is full, before storing anything more", async () => {
    // A per-process rate limit resets on every cold start, so it bounds nothing
    // across thirty-day retention. This ceiling is what does.
    vi.mocked(refuseIfStorageIsFull).mockImplementation(async () => {
      throw new Error("full");
    });

    await post().catch(() => undefined);

    expect(seen.uploads).toBe(0);
  });

  it("is charged before the file is stored, not after", async () => {
    /**
     * Order matters: a budget checked after the upload has already happened
     * bounds nothing, because the storage is spent by the time it refuses.
     */
    const order: string[] = [];
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
