/**
 * A foreign hostname must never reach next/image's loader.
 *
 * `next/image` THROWS during render for a src outside `images.remotePatterns` —
 * E231, image-loader.js:96-109 — and it throws inside the component, so React
 * unwinds to the nearest boundary and the route dies. A shop owner pasted a
 * Pinterest link into the homepage builder and lost the builder preview and,
 * because features/cms-sections/* is mounted by both, the live storefront too.
 *
 * WHY next/image IS MOCKED HERE, and why that is not laziness: image-loader.js
 * wraps the host check in `process.env.NODE_ENV !== 'test'` (line 96, "micromatch
 * isn't compatible with edge runtime"). Under vitest the real component NEVER
 * throws for any host — so a plain render test asserting "does not throw" passes
 * at HEAD, against the unfixed code, and proves precisely nothing. The mock puts
 * the check back.
 *
 * The captured-props assertions are the other half. A wrapper that simply passed
 * `unoptimized` to EVERYTHING would also never throw, while silently costing the
 * shop image optimisation on every page. Both directions are asserted.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => [] as { src: string; unoptimized?: boolean }[]);

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; unoptimized?: boolean }) => {
    seen.push({ src: props.src, unoptimized: props.unoptimized });

    /**
     * Stands in for the loader check vitest disables. `images.unsplash.com` is
     * the one host allowed in a run with no Cloudinary cloud name inlined —
     * see clientImagePatterns() — so anything else, handed over WITHOUT
     * `unoptimized`, is the crash being reproduced.
     */
    if (!props.unoptimized && !props.src.startsWith("https://images.unsplash.com")) {
      throw new Error(
        `Invalid src prop (${props.src}) on \`next/image\`, hostname is not configured under images in your \`next.config.js\``,
      );
    }

    return createElement("img", { src: props.src, alt: props.alt });
  },
}));

const { OptimizedImage } = await import("@/components/shared/optimized-image");
const NextImageMock = (await import("next/image")).default as unknown as (props: {
  src: string;
  alt: string;
  unoptimized?: boolean;
}) => unknown;

/** The URL from the reported crash, kept verbatim. */
const REPORTED =
  "https://i.pinimg.com/originals/d7/f1/d3/d7f1d32039d0955b588078b7ae9d155c.jpg";
const ALLOWED = "https://images.unsplash.com/photo-1";

function render(props: Record<string, unknown>): { html: string; unmount: () => void } {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(OptimizedImage, props as never));
  });

  return {
    html: container.innerHTML,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  seen.length = 0;
});

describe("the stand-in for the loader check", () => {
  /**
   * Asserted directly, bypassing the wrapper.
   *
   * Without these two, every assertion below could be passing because the mock
   * is inert — which is the failure mode this whole file exists to avoid.
   */
  it("throws for a foreign host handed over without unoptimized", () => {
    expect(() => NextImageMock({ src: REPORTED, alt: "x", unoptimized: false })).toThrow(
      /Invalid src prop/,
    );
  });

  it("is satisfied by unoptimized, which is the property the fix relies on", () => {
    expect(() => NextImageMock({ src: REPORTED, alt: "x", unoptimized: true })).not.toThrow();
  });
});

describe("an image URL from a host next/image does not allow", () => {
  it("renders instead of taking the page down", () => {
    const view = render({ src: REPORTED, alt: "Chocolate Truffle Delight", fill: true });

    expect(view.html).toContain(REPORTED);
    view.unmount();
  });

  it("gets there by being marked unoptimized, which is what makes the throw unreachable", () => {
    const view = render({ src: REPORTED, alt: "Chocolate Truffle Delight", fill: true });

    expect(seen).toHaveLength(1);
    expect(seen[0].unoptimized).toBe(true);
    view.unmount();
  });
});

describe("an image URL from a host next/image does allow", () => {
  it("is still optimised — the wrapper does not just give up on everything", () => {
    const view = render({ src: ALLOWED, alt: "A cake", fill: true });

    expect(seen).toHaveLength(1);
    expect(
      seen[0].unoptimized,
      "marking allowed hosts unoptimized would cost the shop every page's image budget",
    ).toBeFalsy();
    view.unmount();
  });

  it("is trimmed first, because whitespace throws before unoptimized is ever read", () => {
    // E176/E21 at get-img-props.js:369-379 run BEFORE generateImgAttrs, so
    // `unoptimized` cannot save a padded src — only trimming can.
    const view = render({ src: `   ${ALLOWED}   `, alt: "A cake", fill: true });

    expect(seen[0].src).toBe(ALLOWED);
    expect(seen[0].unoptimized).toBeFalsy();
    view.unmount();
  });
});

describe("an image the data does not have", () => {
  const NOTHING = [
    ["absent", undefined],
    ["null", null],
    ["empty", ""],
    ["blank", "   "],
    ["a number", 0],
    ["an object", {}],
    ["a dead blob URL", "blob:http://localhost/abc"],
  ] as const;

  it.each(NOTHING)("renders a placeholder for %s without calling next/image", (_label, src) => {
    const view = render({ src, alt: "Chocolate Truffle Delight", fill: true });

    expect(seen, "next/image was handed a src there is no image for").toHaveLength(0);
    expect(view.html).not.toContain("<img");
    view.unmount();
  });
});
