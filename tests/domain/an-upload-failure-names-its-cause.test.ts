import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AN UPLOAD THAT FAILS SAYS WHY.
 *
 * Every failed upload used to read "Your image host refused it. Check the
 * account, then try again." The one that prompted this was the router's DNS
 * timing out on api.cloudinary.com — the account was on 9% of its free tier
 * and its keys were fine — so the owner was sent to fix the one thing that was
 * not broken.
 *
 * The cause crosses the wire as a status code: 504 when Cloudinary could not
 * be reached, 502 when it answered no. These tests drive the real functions
 * with the SDK's real rejection shapes, not the source text.
 */

const upload = vi.fn();
vi.mock("cloudinary", () => ({
  v2: { config: vi.fn(), uploader: { upload, destroy: vi.fn() } },
}));
vi.mock("@/features/auth/lib/session-expiry", () => ({ noteAuthStatus: vi.fn() }));

async function loadCloudinary() {
  vi.resetModules();
  vi.stubEnv("CLOUDINARY_URL", "");
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "probe");
  vi.stubEnv("CLOUDINARY_API_KEY", "key");
  vi.stubEnv("CLOUDINARY_API_SECRET", "secret");
  return import("@/lib/server/media/cloudinary");
}

async function statusOf(rejection: unknown): Promise<number | undefined> {
  const { uploadToCloudinary } = await loadCloudinary();
  upload.mockRejectedValueOnce(rejection);
  const error = (await uploadToCloudinary("data:image/png;base64,AA").catch((e) => e)) as {
    status?: number;
  };
  return error.status;
}

describe("the server names the cause on the status code", () => {
  beforeEach(() => {
    upload.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("a DNS failure is 'unreachable', in either shape the SDK rejects with", async () => {
    expect(await statusOf({ errno: -3008, code: "ENOTFOUND", hostname: "api.cloudinary.com" })).toBe(504);
    expect(await statusOf({ error: { code: "EAI_AGAIN" } })).toBe(504);
  });

  it("the SDK's own socket timeout (http_code 499) is 'unreachable'", async () => {
    expect(
      await statusOf({ error: { message: "Request Timeout", http_code: 499, name: "TimeoutError" } }),
    ).toBe(504);
  });

  it("Cloudinary saying no is 502 — and never 401, which would sign the admin out", async () => {
    expect(await statusOf({ error: { message: "Invalid api_key", http_code: 401 } })).toBe(502);
    expect(await statusOf({ error: { message: "Invalid image file", http_code: 400 } })).toBe(502);
  });
});

describe("the admin client turns the status into a reason", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function reasonFor(fetchImpl: () => Promise<Response>) {
    vi.stubGlobal("fetch", vi.fn(fetchImpl));
    const { uploadMediaRequest } = await import("@/apps/admin/media/lib/media-api");
    const outcome = await uploadMediaRequest("data:image/png;base64,AA");
    return outcome.status === "failed" ? outcome.reason : outcome.status;
  }

  const answer = (status: number) => async () =>
    new Response(JSON.stringify({ success: false, data: null }), { status });

  it("maps each answer to its own reason", async () => {
    expect(await reasonFor(answer(504))).toBe("unreachable");
    expect(await reasonFor(answer(502))).toBe("refused");
    expect(await reasonFor(answer(500))).toBe("refused");
    expect(await reasonFor(answer(401))).toBe("signed-out");
    expect(await reasonFor(answer(413))).toBe("too-large");
    expect(
      await reasonFor(async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).toBe("offline");
  });

  it("a network failure never tells the owner to check the account", async () => {
    const { uploadFailureMessage } = await import("@/apps/admin/media/lib/media-api");
    for (const reason of ["offline", "unreachable"] as const) {
      expect(uploadFailureMessage(reason)).toMatch(/internet/i);
      expect(uploadFailureMessage(reason)).not.toMatch(/account|refused|accept/i);
    }
    expect(uploadFailureMessage("refused")).toMatch(/account/i);
  });
});
