/**
 * The rules a storefront sign-in rests on.
 *
 * The whole flow used to be a lie: the modal waited 700ms and declared you
 * signed in, no code was ever sent, any five digits were accepted, and the
 * identity it minted was `<phone>@customer.local` — an address no order in the
 * shop has ever carried, which is why My Orders could never find anything.
 *
 * The repository is mocked so these exercise the DECISIONS, not Mongo: what
 * counts as a valid code, what a wrong one costs, and when an account comes
 * into existence. The end-to-end path is proved against the real database and
 * real SMTP in tests/e2e/customer-account.spec.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sha256 } from "@/lib/server/auth/hash";

const repo = vi.hoisted(() => ({
  findAccountByEmail: vi.fn(),
  createAccount: vi.fn(),
  markSignedIn: vi.fn(),
  updateProfile: vi.fn(),
  replaceLoginCode: vi.fn(),
  findLoginCode: vi.fn(),
  countWrongGuess: vi.fn(),
  consumeLoginCode: vi.fn(),
}));
vi.mock("@/features/customer-auth/server/customer-auth.repository", () => repo);

const mail = vi.hoisted(() => ({ sendTemplatedEmail: vi.fn() }));
vi.mock("@/features/communications/server/email.service", () => mail);

const orders = vi.hoisted(() => ({ findByCustomerEmail: vi.fn() }));
vi.mock("@/features/orders/server/order.repository", () => orders);

vi.mock("@/lib/server/audit/audit-log", () => ({ writeAuditLog: vi.fn() }));

import {
  requestSignInCode,
  verifySignInCode,
} from "@/features/customer-auth/server/customer-auth.service";

const ctx = { ip: "1.2.3.4", userAgent: "probe" };

function codeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "code-1",
    email: "asha@example.com",
    codeHash: sha256("123456"),
    attempts: 0,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mail.sendTemplatedEmail.mockResolvedValue({ sent: true });
  orders.findByCustomerEmail.mockResolvedValue([]);
  repo.findAccountByEmail.mockResolvedValue(null);
  repo.countWrongGuess.mockResolvedValue(1);
  repo.createAccount.mockImplementation(async (input: { email: string }) => ({
    id: "acct-1",
    email: input.email,
    name: "",
    phone: "",
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("asking for a sign-in code", () => {
  it("stores the code hashed, never in the clear", async () => {
    await requestSignInCode({ email: "asha@example.com" }, ctx);

    const written = repo.replaceLoginCode.mock.calls[0][0];
    expect(written.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(written).not.toHaveProperty("code");
    // And the hash is of a 6-digit code, not of something else.
    const emailed = mail.sendTemplatedEmail.mock.calls[0][2].sign_in_code;
    expect(emailed).toMatch(/^\d{6}$/);
    expect(written.codeHash).toBe(sha256(emailed));
  });

  it("replaces any previous code rather than adding another", async () => {
    // `replaceLoginCode` deletes first. Two live codes would double the guessing
    // surface and make the per-row attempt counter meaningless.
    await requestSignInCode({ email: "asha@example.com" }, ctx);

    expect(repo.replaceLoginCode).toHaveBeenCalledTimes(1);
  });

  it("refuses to claim a code was sent when the email did not go out", async () => {
    // The mail module's own rule: `sent` is the only honest basis for telling
    // anyone an email went out. A customer left waiting for a code that was
    // never sent has no way to tell that from one that is slow.
    mail.sendTemplatedEmail.mockResolvedValue({ sent: false, error: "smtp down" });

    await expect(requestSignInCode({ email: "asha@example.com" }, ctx)).rejects.toThrow(
      /could not send/i,
    );
  });

  it("does not create an account just because someone typed an address", async () => {
    await requestSignInCode({ email: "stranger@example.com" }, ctx);

    // Otherwise this endpoint fills the collection with accounts for addresses
    // nobody controls, one POST at a time.
    expect(repo.createAccount).not.toHaveBeenCalled();
  });

  it("greets a returning customer by the name already on their orders", async () => {
    orders.findByCustomerEmail.mockResolvedValue([
      { address: { fullName: "Asha Menon", phone: "9812345678" } },
    ]);

    await requestSignInCode({ email: "asha@example.com" }, ctx);

    expect(mail.sendTemplatedEmail.mock.calls[0][2].customer_name).toBe("Asha Menon");
  });

  it("tells a blocked account nothing it could act on", async () => {
    repo.findAccountByEmail.mockResolvedValue({ id: "a", email: "a@b.c", blocked: true });

    await expect(requestSignInCode({ email: "a@b.c" }, ctx)).rejects.toThrow(/could not sign you in/i);
    expect(repo.replaceLoginCode).not.toHaveBeenCalled();
  });
});

describe("checking a code", () => {
  it("signs in on the right code", async () => {
    repo.findLoginCode.mockResolvedValue(codeRow());

    const identity = await verifySignInCode({ email: "asha@example.com", code: "123456" }, ctx);

    expect(identity.email).toBe("asha@example.com");
    expect(repo.consumeLoginCode).toHaveBeenCalledWith("asha@example.com");
  });

  it("refuses a wrong code and counts the guess", async () => {
    repo.findLoginCode.mockResolvedValue(codeRow());

    await expect(
      verifySignInCode({ email: "asha@example.com", code: "999999" }, ctx),
    ).rejects.toThrow(/not right|expired/i);
    expect(repo.countWrongGuess).toHaveBeenCalledWith("code-1");
  });

  it("burns the code after five wrong guesses", async () => {
    // A 6-digit code is only meaningful while the guesses are capped.
    repo.findLoginCode.mockResolvedValue(codeRow({ attempts: 5 }));

    await expect(
      verifySignInCode({ email: "asha@example.com", code: "123456" }, ctx),
    ).rejects.toThrow();
    // Even though the code itself was RIGHT.
    expect(repo.consumeLoginCode).toHaveBeenCalled();
  });

  it("refuses an expired code, and clears it", async () => {
    repo.findLoginCode.mockResolvedValue(codeRow({ expiresAt: new Date(Date.now() - 1000) }));

    await expect(
      verifySignInCode({ email: "asha@example.com", code: "123456" }, ctx),
    ).rejects.toThrow();
    expect(repo.consumeLoginCode).toHaveBeenCalled();
  });

  it("refuses when there is no outstanding code at all", async () => {
    repo.findLoginCode.mockResolvedValue(null);

    await expect(
      verifySignInCode({ email: "asha@example.com", code: "123456" }, ctx),
    ).rejects.toThrow();
  });

  it("creates the account only now, and takes the name from their orders", async () => {
    repo.findLoginCode.mockResolvedValue(codeRow());
    orders.findByCustomerEmail.mockResolvedValue([
      { address: { fullName: "Asha Menon", phone: "9812345678" } },
    ]);

    await verifySignInCode({ email: "asha@example.com", code: "123456" }, ctx);

    expect(repo.createAccount).toHaveBeenCalledWith({
      email: "asha@example.com",
      name: "Asha Menon",
      phone: "9812345678",
    });
  });

  it("does not create a second account for someone who already has one", async () => {
    repo.findLoginCode.mockResolvedValue(codeRow());
    repo.findAccountByEmail.mockResolvedValue({
      id: "acct-existing",
      email: "asha@example.com",
      name: "Asha",
      phone: "",
      blocked: false,
    });

    const identity = await verifySignInCode({ email: "asha@example.com", code: "123456" }, ctx);

    expect(repo.createAccount).not.toHaveBeenCalled();
    expect(identity.id).toBe("acct-existing");
    expect(repo.markSignedIn).toHaveBeenCalledWith("acct-existing");
  });

  it("will not sign in a blocked account even with the right code", async () => {
    repo.findLoginCode.mockResolvedValue(codeRow());
    repo.findAccountByEmail.mockResolvedValue({ id: "a", email: "a@b.c", blocked: true });

    await expect(
      verifySignInCode({ email: "asha@example.com", code: "123456" }, ctx),
    ).rejects.toThrow(/could not sign you in/i);
  });
});
