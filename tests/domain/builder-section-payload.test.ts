import { describe, expect, it } from "vitest";

import {
  MAX_SECTIONS,
  parseSectionsPayload,
} from "@/features/cms-sections/lib/section-payload";

/**
 * The only check either builder endpoint made was `Array.isArray(body.sections)`.
 *
 * Everything else went to Mongo unread, and the storefront renders these sections
 * on the server — so a section stored without `content` becomes a `content.title`
 * on a live page, which throws during the render and answers Next's 500 page to
 * every visitor until an admin notices.
 */

interface Section {
  instanceId: string;
  type: string;
  order: number;
  isVisible: boolean;
  background: string;
  content: Record<string, string | number | boolean>;
}

function section(over: Partial<Section> = {}): Section {
  return {
    instanceId: "hero-1",
    type: "hero",
    order: 0,
    isVisible: true,
    background: "white",
    content: { title: "Fresh cakes" },
    ...over,
  };
}

describe("what a builder is allowed to store", () => {
  it("accepts what the builder actually sends", () => {
    const result = parseSectionsPayload<Section>([
      section(),
      section({ instanceId: "cta-1", type: "cta", order: 1, background: "cream" }),
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sections).toHaveLength(2);
  });

  it("refuses a section with no content object", () => {
    // The exact payload that 500s the storefront.
    const bare = { ...section() } as Partial<Section>;
    delete bare.content;

    const result = parseSectionsPayload([bare]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/content/);
  });

  it("refuses content that is not a flat object of primitives", () => {
    for (const content of [null, [], "text", 42, { nested: { deep: true } }]) {
      const result = parseSectionsPayload([section({ content: content as never })]);
      expect(result.ok, `content=${JSON.stringify(content)}`).toBe(false);
    }
  });

  it.each([
    ["instanceId", { instanceId: "" }, /instanceId/],
    ["type", { type: "" }, /type/],
    ["order", { order: Number.NaN }, /order/],
    ["isVisible", { isVisible: "yes" as never }, /isVisible/],
    ["background", { background: "chartreuse" }, /background/],
  ])("refuses a section with a bad %s", (_what, over, pattern) => {
    const result = parseSectionsPayload([section(over as Partial<Section>)]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(pattern);
  });

  it("refuses two sections sharing an instanceId", () => {
    // The editor would edit both at once and the React keys collide.
    const result = parseSectionsPayload([section(), section()]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/repeats instanceId/);
  });

  it("refuses anything that is not an array of objects", () => {
    for (const value of [undefined, null, "sections", 5, {}, [null], ["hero"], [[]]]) {
      expect(parseSectionsPayload(value).ok, JSON.stringify(value) ?? "undefined").toBe(
        false,
      );
    }
  });

  it("refuses a runaway layout", () => {
    const many = Array.from({ length: MAX_SECTIONS + 1 }, (_, index) =>
      section({ instanceId: `s-${index}`, order: index }),
    );

    const result = parseSectionsPayload(many);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/more than/);
  });

  it("still accepts a section type the registry has retired", () => {
    // Layouts saved before a type was retired still hold it, and the renderers
    // already fall through to null. Rejecting it would make the page unsavable.
    const result = parseSectionsPayload([section({ type: "faq" })]);

    expect(result.ok).toBe(true);
  });

  it("accepts an empty layout", () => {
    expect(parseSectionsPayload([]).ok).toBe(true);
  });

  it("names the offending sections rather than saying 'invalid'", () => {
    const result = parseSectionsPayload([
      section({ instanceId: "ok-1" }),
      section({ instanceId: "", order: 1 }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/section 1/);
  });
});
