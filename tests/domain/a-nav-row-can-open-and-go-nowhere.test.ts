/**
 * A NAV ROW CAN BE A MENU AND NOTHING ELSE.
 *
 * A reference header's category rows carry no destination of their own: CAKES
 * is not a page, it is the thing that opens the cake menu. Every row here had
 * to have an address — the type required it, the validator required it, and the
 * Header screen refused to save without one.
 *
 * The row DECLARES itself, and keeps its address beside the flag rather than
 * dropping it. Three lines already on disk decide that:
 *
 *   - an OPTIONAL `href` makes "absent" mean both "deliberately menu-only" and
 *     "this document is malformed", and backup restore posts a hand-editable
 *     file to that endpoint, so something has to be able to refuse the second;
 *   - an optional `href` reaches `<Link href={undefined}>` in a header that
 *     renders on cart and checkout;
 *   - an EMPTY-STRING `href` makes `pathname.startsWith(item.href)` true on
 *     every page, so every marked row renders active at once.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  groupDraws,
  menuDraws,
  navRowOpensNothing,
} from "@/features/site-layout/lib/menu-links";
import { headerSchema } from "@/features/site-layout/server/site-layout.validators";
import { routes } from "@/constants/routes";
import type { HeaderNavItem, MegaMenuGroup } from "@/types/site-layout";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const LINK = { id: "l1", label: "Cream Cakes", href: "/store/collections/cream-cakes" };
const group = (over: Partial<MegaMenuGroup> = {}): MegaMenuGroup => ({
  id: "g1",
  heading: "",
  sortOrder: 1,
  isVisible: true,
  links: [LINK],
  ...over,
});
const row = (over: Partial<HeaderNavItem> = {}): HeaderNavItem => ({
  id: "nav-1",
  label: "Cakes",
  href: "/store/cakes",
  isVisible: true,
  sortOrder: 1,
  ...over,
});

describe("when a row that only opens a menu has nothing to open", () => {
  it("is exactly the six cases, and not one more", () => {
    /* A row that was never marked is untouched, whatever else is true of it. */
    expect(navRowOpensNothing(row())).toBe(false);
    expect(navRowOpensNothing(row({ menu: [] }))).toBe(false);

    /* Marked, with a menu that draws: fine. */
    expect(navRowOpensNothing(row({ menuOnly: true, menu: [group()] }))).toBe(false);

    /* Marked, with nothing to open: not a link and not a menu. */
    expect(navRowOpensNothing(row({ menuOnly: true }))).toBe(true);
    expect(navRowOpensNothing(row({ menuOnly: true, menu: [] }))).toBe(true);
    expect(navRowOpensNothing(row({ menuOnly: true, menu: [group({ links: [] })] }))).toBe(true);

    /*
      AND THE ONE BOTH DESIGNS MISSED: a group holding links but switched OFF.
      `drawableGroups` drops it, so a check that counts only `links.length`
      blesses a row the storefront cannot draw.
    */
    expect(
      navRowOpensNothing(row({ menuOnly: true, menu: [group({ isVisible: false })] })),
      "a hidden group was counted as a menu",
    ).toBe(true);
  });

  it("but the taxonomy row always has a menu to open", () => {
    /*
      A row at the collections address with no groups of its own draws the
      shop's three axes, which IS a menu. So marking that row is the most
      useful thing a shop can do with the switch on day one — and it works only
      because the row KEEPS its address.
    */
    expect(navRowOpensNothing(row({ href: routes.store.collections, menuOnly: true }))).toBe(false);
  });

  it("asks one question about a group, in one place", () => {
    expect(groupDraws(group())).toBe(true);
    expect(groupDraws(group({ links: [] }))).toBe(false);
    expect(groupDraws(group({ isVisible: false }))).toBe(false);
    expect(menuDraws([group({ links: [] }), group()])).toBe(true);
    expect(menuDraws([])).toBe(false);
    expect(menuDraws(undefined)).toBe(false);

    /*
      And the menu component asks it rather than spelling it again. Written out
      twice is the shape of every bug this menu has had — it shipped with an
      occasion column on the desktop and none on the phone, and nothing went
      red.
    */
    const menu = code("components/storefront/mega-menu.tsx");
    expect(menu).toContain(".filter(groupDraws)");
    expect(menu, "the condition is spelled out again beside the shared one").not.toMatch(
      /isVisible !== false && [\s\S]{0,40}links\.length > 0/,
    );
  });
});

describe("the stored shape", () => {
  const header = (nav: unknown[]) => ({
    logoLetter: "S",
    showSearch: true,
    showCta: false,
    ctaLabel: "",
    ctaHref: "",
    nav,
  });

  it("refuses a flag that is not a flag", () => {
    /*
      THE LOAD-BEARING HALF. The object around it is `.passthrough()` over a
      Mongoose Mixed column, so a round-trip assertion passes with the field
      UNDECLARED — passthrough stores whatever it is handed, and a string is
      truthy, so the row would silently lose its destination with nothing on
      screen to say why. Backup restore posts a hand-editable file here.
    */
    const ok = headerSchema.safeParse(
      header([{ id: "n1", label: "Cakes", href: "/store/cakes", menuOnly: true }]),
    );
    expect(ok.success).toBe(true);

    const bad = headerSchema.safeParse(
      header([{ id: "n1", label: "Cakes", href: "/store/cakes", menuOnly: "yes" }]),
    );
    expect(bad.success, "a string was stored as the flag").toBe(false);
  });

  it("still requires an address, which is the whole model choice", () => {
    const missing = headerSchema.safeParse(
      header([{ id: "n1", label: "Cakes", isVisible: true, sortOrder: 1, menuOnly: true }]),
    );
    expect(missing.success, "a row without an address was accepted").toBe(false);
  });

  it("leaves a row that never saw the switch exactly as it was", () => {
    /*
      The six rows this shop actually stores, probed read-only. Every one has a
      present non-empty href, no menu and no flag — so nothing about this change
      may put a value on any of them.
    */
    const live = [
      { id: "n1", label: "Home", href: "/store", isVisible: true, sortOrder: 1 },
      { id: "n2", label: "Collections", href: "/store/collections", isVisible: true, sortOrder: 2 },
      { id: "n3", label: "Contact", href: "/store/contact", isVisible: false, sortOrder: 6 },
      { id: "n4", label: "FAQ", href: "/store/faq", isVisible: false, sortOrder: 7 },
      { id: "n5", label: "Birthday", href: "/store/occasions/birthday", isVisible: true, sortOrder: 8 },
      {
        id: "n6",
        label: "Cream Cakes",
        href: "/store/collections/cream-cakes",
        isVisible: true,
        sortOrder: 9,
      },
    ];

    const parsed = headerSchema.safeParse(header(live));
    expect(parsed.success).toBe(true);
    const out = (parsed as { data: { nav: HeaderNavItem[] } }).data.nav;

    for (const [index, item] of out.entries()) {
      expect(item.href, `row ${index} lost its address`).toBe(live[index].href);
      expect(item.menu, `row ${index} gained a menu`).toBeUndefined();
      expect(item.menuOnly, `row ${index} gained the flag`).toBeUndefined();
    }
  });
});

describe("both screens drop the row that opens nothing", () => {
  const navbar = code("apps/website/components/storefront-navbar.tsx");

  it("in the band and in the drawer, and nowhere by accident", () => {
    /*
      Counted AND scoped. A count alone cannot tell two filters in the band from
      one in each place, and the drawer is the screen this shop's customers
      actually use.
    */
    expect(navbar.match(/navRowOpensNothing\(item\)/g) ?? []).toHaveLength(2);

    const bandAt = navbar.indexOf("const bandRows =");
    const drawerAt = navbar.indexOf('id="storefront-mobile-nav"');
    expect(bandAt, "the band's row list moved").toBeGreaterThan(-1);
    expect(drawerAt, "the drawer moved").toBeGreaterThan(bandAt);

    const band = navbar.slice(bandAt, navbar.indexOf("bandRows.map", bandAt));
    const drawer = navbar.slice(drawerAt);
    expect(band, "the band still counts a row that opens nothing").toContain(
      "navRowOpensNothing(item)",
    );
    expect(drawer, "the drawer still draws it as a plain link").toContain(
      "navRowOpensNothing(item)",
    );
  });

  it("and the Header screen refuses to save one, by name", () => {
    const admin = code("apps/admin/header/components/header-admin-page.tsx");
    const at = admin.indexOf("const openingNothing");
    expect(at, "nothing refuses the row on save").toBeGreaterThan(-1);

    const guard = admin.slice(at, at + 600);
    expect(guard, "the row is counted rather than named").toContain("openingNothing.label");
    expect(guard).toContain("navRowOpensNothing(item)");
  });
});

describe("the trigger a customer actually gets", () => {
  // Without it React warns on every `act`, and the warning drowns a real one.
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
  });

  async function mount(Component: unknown, props: Record<string, unknown>) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(createElement(Component as never, props as never));
    });
    return container;
  }

  const PROPS = { isActive: false, groups: [group()], href: "/store/cakes", label: "Cakes" };

  it("is a button, and its destination is nowhere on the page", async () => {
    /*
      A link that does not navigate is a link a customer cannot open in a new
      tab and a screen reader announces wrongly — the reasoning the drawer's
      search row already carries. `type="button"` because a typeless button
      submits, and this renders inside a header that carries the search form.
    */
    const { MegaMenu } = await import("@/components/storefront/mega-menu");
    const el = await mount(MegaMenu, { ...PROPS, menuOnly: true });

    const trigger = el.querySelector("[data-mega-trigger]");
    expect(trigger, "the trigger has no marker to find it by").not.toBeNull();
    expect(trigger!.tagName).toBe("BUTTON");
    expect(trigger!.getAttribute("type"), "a typeless button submits the search form").toBe(
      "button",
    );
    expect(
      el.querySelector('a[href="/store/cakes"]'),
      "the row still offers the destination it says it does not have",
    ).toBeNull();
  });

  it("and stays a link for every row that was never marked", async () => {
    /*
      NOT UNCONDITIONAL. Every shop's Collections row still has its own page,
      and taking that away silently is not what this switch asked for.
    */
    const { MegaMenu } = await import("@/components/storefront/mega-menu");
    const el = await mount(MegaMenu, PROPS);

    const trigger = el.querySelector("[data-mega-trigger]");
    expect(trigger, "the trigger lost its marker").not.toBeNull();
    expect(trigger!.tagName).toBe("A");
    expect(trigger!.getAttribute("href")).toBe("/store/cakes");
  });

  it("says the same word either way", async () => {
    /*
      One definition for both arms. Two copies of that markup is how the same
      stored word once read "2 Hour" on a trigger and "2 HOUR" three pixels
      under it.
    */
    const { MegaMenu } = await import("@/components/storefront/mega-menu");

    const asLink = await mount(MegaMenu, { ...PROPS, badge: "New" });
    const linkText = asLink.querySelector("[data-mega-trigger]")!.textContent;
    const linkClass = asLink.querySelector("[data-mega-trigger]")!.className;
    act(() => root!.unmount());
    container!.remove();

    const asButton = await mount(MegaMenu, { ...PROPS, badge: "New", menuOnly: true });
    const buttonEl = asButton.querySelector("[data-mega-trigger]")!;

    expect(buttonEl.textContent).toBe(linkText);
    expect(buttonEl.className).toBe(linkClass);
  });
});
