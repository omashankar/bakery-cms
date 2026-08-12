import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createInquirySchema } from "@/features/inquiries/server/inquiry.validators";
import { subscribeSchema } from "@/features/newsletter/server/newsletter.validators";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function bodyOf(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`not found: ${signature}`);
  let angle = 0;
  let paren = 0;
  let open = -1;
  for (let i = start + signature.length - 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "<") angle += 1;
    else if (ch === ">") angle = Math.max(0, angle - 1);
    else if (ch === "(") paren += 1;
    else if (ch === ")") paren = Math.max(0, paren - 1);
    else if (ch === "{" && angle === 0 && paren === 0) {
      open = i;
      break;
    }
  }
  if (open < 0) throw new Error(`no body for: ${signature}`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return stripComments(source.slice(start, i + 1));
    }
  }
  throw new Error(`unbalanced: ${signature}`);
}

/** A top-level `export const` block — `bodyOf` cannot read a wrapped declaration. */
function exportedConst(source: string, name: string): string {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`not found: export const ${name}`);
  const rest = source.slice(start + 1);
  const end = rest.indexOf("\nexport ");
  return stripComments(rest.slice(0, end > 0 ? end : undefined));
}

/**
 * `POST /api/inquiries` is the storefront's contact and wedding form. It has no
 * session.
 *
 * It took `id` from the request body and handed it to a repository that UPSERTED
 * on it — and the stored ids are `inq-1`, `inq-7`, `inq-11`. So an anonymous
 * request carrying a guessed id rewrote that enquiry outright, and `status` in
 * the same body could set it to "closed" so the replacement never appeared in
 * the admin's queue.
 *
 * Proved against a running shop before the fix: a real wedding enquiry from
 * "Priya Sharma" came back as "Overwritten By A Stranger", closed, with no
 * cookie attached.
 */
describe("a public enquiry cannot address an existing one", () => {
  const submission = {
    type: "contact" as const,
    name: "Priya",
    email: "priya@example.com",
    message: "Do you deliver to Bengaluru?",
  };

  it("still accepts an ordinary submission", () => {
    expect(createInquirySchema.safeParse(submission).success).toBe(true);
  });

  it("drops a caller-supplied id instead of carrying it to the write", () => {
    // Asserted on the PARSED value, not on `success`: zod is non-strict, so an
    // unknown key leaves `success` true either way and a test checking only
    // `success` would pass just as happily with `id` back in the schema.
    expect(createInquirySchema.parse({ ...submission, id: "inq-1" })).not.toHaveProperty("id");
  });

  it("drops a caller-supplied status", () => {
    // "closed" on submission is an enquiry the shop never sees.
    const parsed = createInquirySchema.parse({ ...submission, status: "closed" });
    expect(parsed).not.toHaveProperty("status");
  });

  it("drops caller-supplied timestamps", () => {
    // `createdAt` is the queue's sort key.
    const parsed = createInquirySchema.parse({
      ...submission,
      createdAt: "2099-01-01T00:00:00.000Z",
      updatedAt: "2099-01-01T00:00:00.000Z",
    });
    expect(parsed).not.toHaveProperty("createdAt");
    expect(parsed).not.toHaveProperty("updatedAt");
  });

  it("mints the id and forces the status server-side", () => {
    const fn = bodyOf(read("features/inquiries/server/inquiry.service.ts"), "export async function createInquiry(");

    // Asserted POSITIVELY on the exact assignment. A `not.toMatch(/input\.x/)`
    // is satisfied by `(input as { x?: string }).x` — the property access moves
    // one character and the guard stops seeing it.
    expect(fn).toMatch(/id: `inq-\$\{randomUUID\(\)\}`,/);
    expect(fn).toMatch(/status: "new",/);
    expect(fn).toMatch(/createdAt: now,/);
    expect(fn).toMatch(/updatedAt: now,/);

    // And nothing off `input` may reach any of the four.
    expect(fn).not.toMatch(/id:[^,\n]*input/);
    expect(fn).not.toMatch(/status:[^,\n]*input/);
    expect(fn).not.toMatch(/createdAt:[^,\n]*input/);
    expect(fn).not.toMatch(/updatedAt:[^,\n]*input/);
  });

  it("inserts rather than upserts, so an id collision cannot overwrite", () => {
    const fn = bodyOf(read("features/inquiries/server/inquiry.repository.ts"), "export async function create(");

    expect(fn).toContain("InquiryModel.create(");
    expect(fn).not.toContain("upsert");
    expect(fn).not.toContain("updateOne");
  });

  it("is rate limited before it touches the database", () => {
    const fn = exportedConst(read("features/inquiries/server/inquiry.controller.ts"), "createInquiryController");

    expect(fn.indexOf("rateLimit(")).toBeLessThan(fn.indexOf("service.createInquiry"));
  });

  it("is not keyed on the IP alone", () => {
    // `ctx.ip` is "" unless TRUST_PROXY_HEADERS=true, which is not the default,
    // and an empty string is a CONSTANT — so the five-per-minute budget was one
    // bucket for the whole shop rather than one per visitor. Six enquiries in a
    // minute and the wedding form, where this bakery's largest orders come
    // from, started answering 429 to everyone.
    const fn = exportedConst(read("features/inquiries/server/inquiry.controller.ts"), "createInquiryController");

    expect(fn, "the throttle is still keyed on the IP alone").not.toContain(
      "rateLimit(`inquiry:${ctx.ip}`",
    );
    expect(fn).toContain("if (ctx.ip)");
  });

  it("the client adopts the server's id", () => {
    // Otherwise every later admin edit or delete of this enquiry addresses an id
    // the server has never heard of.
    const fn = bodyOf(read("features/inquiries/lib/inquiries-repository.ts"), "export async function addInquiry(");
    expect(fn).toContain("const stored = await createInquiryRequest(created)");

    // The GUARD, not just the assignment inside it. `toContain` on the
    // assignment alone passes when the branch is `if (false)` — the code is
    // still in the file and never runs.
    expect(fn).toMatch(/if \(stored\.id !== created\.id\) \{/);
    expect(fn).toContain("created.id = stored.id");

    // And a refusal must not be reported as stored.
    expect(fn).toContain("if (!stored) return { inquiry: created, persisted: false }");
  });
});

/**
 * The newsletter endpoint is the same shape and is NOT vulnerable — it upserts
 * on the EMAIL, and forces `isActive: true`. Pinned so it stays that way.
 */
describe("the newsletter subscribe keys on the email, not the caller's id", () => {
  it("upserts by email", () => {
    const fn = bodyOf(read("features/newsletter/server/newsletter.repository.ts"), "export async function subscribe(");
    expect(fn).toMatch(/findOneAndUpdate\(\s*\{ email \}/);
    // The caller's id may only seed a NEW row, never address an existing one.
    expect(fn).toContain("$setOnInsert");
    expect(fn).not.toMatch(/findOneAndUpdate\(\s*\{ _id/);
  });

  it("cannot be used to deactivate somebody else", () => {
    // `isActive` is in the schema but forced true on the write, so a crafted
    // subscribe cannot unsubscribe a third party.
    expect(subscribeSchema.safeParse({ email: "a@b.com", isActive: false }).success).toBe(true);
    const fn = bodyOf(read("features/newsletter/server/newsletter.repository.ts"), "export async function subscribe(");
    expect(fn).toMatch(/\$set:\s*\{\s*isActive:\s*true/);
    expect(fn).not.toContain("isActive: sub.isActive");
  });
});
