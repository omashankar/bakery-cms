import { routes } from "@/constants/routes";
import type {
  HeaderNavItem,
  MegaMenuGroup,
  MegaMenuLinkItem,
  MenuLinkRef,
} from "@/types/site-layout";

/**
 * A MENU LINK CAN BE A ROW OF THE CATALOGUE RATHER THAN A STRING ABOUT ONE.
 *
 * `HeaderNavItem.menu` has existed, been validated and been rendered by both
 * the desktop band and the phone drawer since before this file — and it was
 * empty on every row of every shop, because filling it meant hand-typing a
 * label and a URL per link into a text box.
 *
 * That is tedious, which is why nobody did it. The reason it was also WRONG is
 * this: nothing in this repository fixes those two strings up afterwards.
 * `updateCategory` merges a patch and writes; `deleteCategories` filters the
 * array and writes; neither tells any consumer. So a typed menu says "Cream
 * Cakes" for ever after the shop renames it, and opens an empty grid after the
 * shop deletes it — exactly the defect the taxonomy columns were fixed for,
 * arriving through a different door.
 *
 * So a picked link stores WHICH ROW it is, and the server rebuilds the label
 * and the address from the live catalogue on every render.
 *
 * PURE, and it takes the three lists as an argument rather than reaching for
 * them. The header renders on every storefront and /account route, cart and
 * checkout among them; the lists its caller already holds are the only ones it
 * may have. Nothing here may reach a product.
 */

/** One row of one axis, as much of it as a link needs. */
export interface MenuAxisRow {
  id: string;
  name: string;
  slug: string;
}

/** The three lists a menu can point into — the ones the chrome already holds. */
export interface MenuAxes {
  category: readonly MenuAxisRow[];
  occasion: readonly MenuAxisRow[];
  collection: readonly MenuAxisRow[];
}

/**
 * WHERE A ROW OF THAT AXIS LIVES.
 *
 * An occasion has its own address; a category and a collection share
 * /store/collections/<slug>. Getting that wrong is not hypothetical — this
 * shop shipped a menu where Birthday, Wedding and Anniversary opened the
 * CATEGORY of that name and the occasion's own products were never shown as a
 * set. The note recording it is in components/storefront/mega-menu.tsx.
 */
export function routeForAxis(axis: MenuLinkRef["axis"], slug: string): string {
  return axis === "occasion" ? routes.store.occasion(slug) : routes.store.collection(slug);
}

/**
 * DOES THIS GROUP DRAW?
 *
 * ONE condition with several readers: `drawableGroups` in both menus,
 * `menuDraws` below, and the Header screen's own warning. Written out twice is
 * the shape of every bug this menu has had — it shipped with an occasion
 * column on the desktop and none on the phone and nothing went red.
 *
 * `isVisible !== false` is load-bearing and not tidiness: a group holding
 * links but switched OFF draws nothing, so a check that only counts
 * `links.length` blesses a row the storefront cannot draw.
 */
export function groupDraws(group: MegaMenuGroup): boolean {
  return group.isVisible !== false && group.links.length > 0;
}

/** Whether a row's menu has anything at all to open. */
export function menuDraws(menu?: readonly MegaMenuGroup[]): boolean {
  return (menu ?? []).some(groupDraws);
}

/**
 * A ROW THAT DECLARES ITSELF A MENU AND HAS NO MENU TO OPEN.
 *
 * THE ONE PLACE the two fields are reconciled, and the only place any consumer
 * may ask the question. `menuOnly` beats `href` everywhere — a marked row
 * never renders its destination — so the only disagreement left is a marked
 * row with nothing to open. That row is neither a link nor a menu, and both
 * renderers drop it.
 *
 * THE TAXONOMY ROW IS NOT ONE OF THEM. A row at the collections address with
 * no groups of its own draws the shop's three axes, which IS a menu — so
 * marking that row is the most useful thing a shop can do with the switch, and
 * it needs no rule beyond the last line here. That works only because the row
 * KEEPS its `href`, which is also why the navbar's taxonomy branch needs no
 * change at all.
 */
export function navRowOpensNothing(item: HeaderNavItem): boolean {
  if (!item.menuOnly) return false;
  if (menuDraws(item.menu)) return false;
  return item.href !== routes.store.collections;
}

/**
 * One link, resolved against the catalogue.
 *
 *  - NO `ref` — returned untouched. That is every link stored before today,
 *    and a shop that wants a page, an external site or its own wording still
 *    types one.
 *  - `ref` HITS — the label and the address come from the live row. The stored
 *    pair is left in place as a record of what was picked, which is what lets
 *    an unresolved link still say which row it meant.
 *  - `ref` MISSES — `null`, and the caller drops the link. The row is switched
 *    off, deleted, emptied, or its address was claimed by another axis; every
 *    one of those makes this link a promise the shop cannot keep. A group left
 *    with no links is dropped by `drawableGroups`, so no heading is left
 *    standing over nothing.
 */
export function resolveMenuLink(
  link: MegaMenuLinkItem,
  axes: MenuAxes,
): MegaMenuLinkItem | null {
  const ref = link.ref;
  if (!ref) return link;

  const row = axes[ref.axis]?.find((candidate) => candidate.id === ref.id);
  if (!row) return null;

  return { ...link, label: row.name, href: routeForAxis(ref.axis, row.slug) };
}

/**
 * Every nav row's menu, resolved.
 *
 * A ROW WITH NO `menu` COMES BACK WITH NO `menu`, never with `[]`. The type
 * and the validator both record why at length: absent means "this row is a
 * plain link" and `[]` means "this row has a menu the shop emptied". Default
 * one to the other and every row in every shop gains a menu, which the
 * renderer would then draw INSTEAD of the taxonomy columns the Collections row
 * has always shown.
 */
export function resolveNavMenus(
  nav: readonly HeaderNavItem[],
  axes: MenuAxes,
): HeaderNavItem[] {
  return nav.map((item) => {
    if (!item.menu) return item;
    return {
      ...item,
      menu: item.menu.map((group) => ({
        ...group,
        links: group.links
          .map((link) => resolveMenuLink(link, axes))
          .filter((link): link is MegaMenuLinkItem => link !== null),
      })),
    };
  });
}

/**
 * HOW FAR TO PULL A MEGA PANEL LEFT SO IT OPENS INSIDE THE WINDOW.
 *
 * The panel hangs `absolute left-0` off its nav row, and which edge it hung
 * from used to be chosen from the row's INDEX:
 *
 *   bandRows.length >= 6 && index >= Math.floor(bandRows.length / 2)
 *     ? "right" : "left"
 *
 * That cannot be right, and it is not a near miss. Measured in a browser at
 * 1024px — the narrowest width the band exists at, since it is `hidden lg:grid`
 * and `lg` is 1024 — with the band's rows cloned so the real flex layout placed
 * them:
 *
 *   row 3 starts at x=396 and is 139 wide. A 640px panel anchored LEFT ends at
 *   1036, 12px past the window. Anchored RIGHT it starts at -105. NEITHER EDGE
 *   FITS. Every position has some safe edge only when the window is at least
 *   2P - w wide, which for P=640 w=139 is 1141px. So at 1024 there is a band of
 *   x values with no answer at all, and row 3 is in it.
 *
 *   rows 7 and 8 WRAP onto a second line and restart at x=32 and x=175 — their
 *   trigger tops measured 131 against 95 for the first line. `index` keeps
 *   climbing while x goes back to the left margin, so the predicate called them
 *   right-anchored and put row 7's panel at [-487, 153]: 487px off-screen.
 *
 * THIS SHOP HAS THREE BAND ROWS, so none of that is on screen today. The FOURTH
 * row a shop adds is the one that breaks, and the shop's plan is to add rows for
 * each kind of thing it sells.
 *
 * SO IT IS MEASURED, AND IT IS ONE NUMBER rather than a choice of two edges.
 * `0` is "exactly where `left-0` puts it", which is what every row on a correct
 * shop gets and therefore what the server renders. A row that would overflow
 * gets a negative number: the panel slides left by just enough and no further,
 * so it stays under its own trigger as much as the window allows. The left case,
 * the right case and the band with no safe edge are all this one expression.
 *
 * WHAT IT DOES NOT DO: it does not move the panel vertically, and it must not.
 * The panel is a child of its own row's wrapper, so `top-full` follows a wrapped
 * row down to the second line on its own — measured at 163 against 127. Hanging
 * the panel off the BAND instead, which is the obvious way to get a wider panel,
 * is what breaks that: `top-full` would then resolve against the wrapping flex
 * row and every second-line row would open 36px above its own trigger.
 *
 * `gutter` defaults to 16 because the panel's own width is already capped at
 * `calc(100vw - 2rem)` — 1rem each side. The number is not invented here; it is
 * read off the cap that has always been on the element.
 */
export function panelShift(input: {
  /** Viewport x of the row wrapper the panel is positioned against. */
  triggerLeft: number;
  /** The panel's own measured width, after its `min()` cap has applied. */
  panelWidth: number;
  /** `document.documentElement.clientWidth` — never `window.innerWidth`. */
  clientWidth: number;
  /** Breathing room at each edge. Defaults to the panel's own 1rem cap. */
  gutter?: number;
}): number {
  const gutter = input.gutter ?? 16;
  const lowest = gutter;
  const highest = input.clientWidth - gutter - input.panelWidth;
  /*
    `Math.max(lowest, highest)` and not `highest` alone: a panel wider than the
    window leaves nothing to clamp into and would invert the bounds, returning a
    shift that pushes the panel off the LEFT instead. Its own `min(..., 100vw -
    2rem)` cap means that cannot happen through this component — which is
    exactly why the guard belongs here rather than being assumed away, since the
    cap lives in a different file and a map of class strings.
  */
  const want = Math.min(Math.max(input.triggerLeft, lowest), Math.max(lowest, highest));
  /*
    Rounded, because the value is written into a CSS pixel length and a
    sub-pixel string re-triggers a style recalculation on every measure for a
    move nobody can see.
  */
  return Math.round(want - input.triggerLeft);
}
