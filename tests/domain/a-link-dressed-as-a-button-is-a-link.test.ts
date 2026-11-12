// @vitest-environment jsdom
/**
 * A LINK DRESSED AS A BUTTON IS STILL A LINK — AND "ORDER ON WHATSAPP"
 * OPENS A CHAT.
 *
 * Found checking the header (2026-11-12): the Wishlist and Cart icons were
 * <a href> elements with role="button", as were ~90 other `Button render={<Link/>}`
 * controls; and the bar's WhatsApp link was the shop's Social row,
 * https://web.whatsapp.com/ — WhatsApp Web's front page, no chat with anyone.
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { Button } from "@/components/ui/button";
import { isWhatsAppChatLink } from "@/apps/website/lib/storefront-chrome.server";

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);

describe("Button with a link inside", () => {
  it("renders the link itself, with no button role", () => {
    const out = html(
      createElement(Button, { variant: "ghost", render: createElement("a", { href: "/store/wishlist", "aria-label": "Wishlist" }) }, "♥"),
    );
    expect(out).toMatch(/^<a /);
    expect(out).toContain('href="/store/wishlist"');
    expect(out).not.toContain('role="button"');
    // The look survives: the button's classes and the link's own both.
    expect(out).toContain('data-slot="button"');
  });

  it("keeps both class lists", () => {
    const out = html(createElement(Button, { className: "mine", render: createElement("a", { href: "/x", className: "theirs" }) }, "x"));
    expect(out).toMatch(/class="[^"]*mine[^"]*theirs/);
  });

  it("leaves a real button a button", () => {
    const out = html(createElement(Button, { type: "button" }, "Save"));
    expect(out).toMatch(/^<button /);
  });
});

describe("what counts as a WhatsApp chat link", () => {
  it.each([
    ["https://wa.me/918824675118", true],
    ["https://wa.me/+918824675118?text=Hi", true],
    ["https://api.whatsapp.com/send?phone=918824675118", true],
    ["https://api.whatsapp.com/send/?text=hi&phone=918824675118", true],
    ["https://web.whatsapp.com/", false],
    ["https://whatsapp.com/", false],
    ["https://wa.me/", false],
    ["https://chat.whatsapp.com/AbCdEf", false],
    ["http://wa.me/918824675118", false],
  ])("%s → %s", (href, wanted) => {
    expect(isWhatsAppChatLink(href)).toBe(wanted);
  });
});
