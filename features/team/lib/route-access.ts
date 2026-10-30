import { routes } from "@/constants/routes";

import type { Permission } from "./permissions";

/**
 * Which admin SCREENS a member may open — one table, read by the sidebar, the
 * command search and the route guard, so the three cannot disagree about
 * where someone is allowed to go.
 *
 * A screen is a door, not the data behind it: every screen's data is fetched
 * from an API that checks its own permission, and its first render's data is
 * read through `whenAllowed`. This table decides what is OFFERED; the server
 * decides what is served.
 *
 * Rules are matched most-specific first: the first rule whose pattern matches
 * wins, so `/admin/products/add` is listed before `/admin/products`.
 * `anyOf: []` means "any signed-in member" (their own profile). A path no rule
 * matches is refused — a new screen is closed until someone lists it here.
 */

interface RouteRule {
  /** Exact path, or a prefix ending in "/" — or a pattern for dynamic segments. */
  match: string | RegExp;
  anyOf: readonly Permission[];
  /**
   * What it takes to CHANGE things on this screen, when that is more than
   * opening it — "View settings" opens Settings, "Change settings" saves them.
   * The shared save controls read this and go read-only without it.
   */
  write?: Permission;
}

const ADMIN = routes.admin;

const RULES: readonly RouteRule[] = [
  // /admin itself only redirects — the guard sends a member to their home.
  { match: ADMIN.root, anyOf: [] },
  { match: ADMIN.profile, anyOf: [] },
  { match: `${ADMIN.profile}/`, anyOf: [] },

  { match: ADMIN.dashboard, anyOf: ["dashboard.view"] },
  { match: ADMIN.kitchen, anyOf: ["orders.view_kitchen"] },
  { match: ADMIN.deliveries, anyOf: ["orders.view_assigned"] },

  { match: ADMIN.orders.list, anyOf: ["orders.view"] },
  { match: `${ADMIN.orders.list}/`, anyOf: ["orders.view"] },

  { match: ADMIN.commerce.notifications, anyOf: ["dashboard.view", "orders.view", "inventory.view", "inquiries.view"] },
  { match: ADMIN.commerce.refunds, anyOf: ["payments.view", "orders.refund"] },
  { match: ADMIN.commerce.gateways, anyOf: ["payments.manage"] },
  { match: `${ADMIN.commerce.gateways}/`, anyOf: ["payments.manage"] },
  { match: ADMIN.commerce.payments, anyOf: ["payments.view"], write: "payments.manage" },
  { match: `${ADMIN.commerce.payments}/`, anyOf: ["payments.view"], write: "payments.manage" },
  { match: ADMIN.commerce.invoices, anyOf: ["payments.view"], write: "payments.manage" },
  { match: ADMIN.commerce.coupons, anyOf: ["coupons.view"], write: "coupons.manage" },
  { match: ADMIN.commerce.inventory, anyOf: ["inventory.view"], write: "inventory.manage" },
  { match: ADMIN.commerce.reviews, anyOf: ["reviews.manage"] },
  { match: ADMIN.commerce.deliveryZones, anyOf: ["settings.view"], write: "settings.manage" },
  { match: ADMIN.commerce.deliverySlots, anyOf: ["settings.view"], write: "settings.manage" },
  { match: ADMIN.commerce.taxes, anyOf: ["settings.view"], write: "settings.manage" },
  { match: ADMIN.commerce.shippingRules, anyOf: ["settings.view"], write: "settings.manage" },
  { match: ADMIN.commerce.emails, anyOf: ["settings.view"], write: "settings.manage" },
  { match: ADMIN.commerce.whatsapp, anyOf: ["settings.view"], write: "settings.manage" },

  { match: ADMIN.customers.list, anyOf: ["customers.view"], write: "customers.update" },
  { match: `${ADMIN.customers.list}/`, anyOf: ["customers.view"], write: "customers.update" },
  { match: ADMIN.inquiries.overview, anyOf: ["inquiries.view"], write: "inquiries.manage" },
  { match: `${ADMIN.inquiries.overview}/`, anyOf: ["inquiries.view"], write: "inquiries.manage" },

  { match: ADMIN.cakes.add, anyOf: ["products.create"] },
  { match: /^\/admin\/products\/[^/]+\/edit\/?$/, anyOf: ["products.update"] },
  { match: ADMIN.cakes.list, anyOf: ["products.view"] },
  { match: `${ADMIN.cakes.list}/`, anyOf: ["products.view"] },
  { match: ADMIN.catalog, anyOf: ["catalog.manage"] },

  { match: ADMIN.builders.homepage, anyOf: ["homepage.manage"] },
  { match: ADMIN.pages.add, anyOf: ["pages.manage"] },
  { match: /^\/admin\/pages\/[^/]+\/edit\/?$/, anyOf: ["pages.manage"] },
  { match: ADMIN.pages.list, anyOf: ["pages.view"], write: "pages.manage" },
  { match: ADMIN.media, anyOf: ["media.view"], write: "media.manage" },
  { match: ADMIN.banners, anyOf: ["banners.manage"] },
  { match: ADMIN.testimonials, anyOf: ["testimonials.manage"] },
  { match: ADMIN.faq, anyOf: ["faq.manage"] },
  { match: ADMIN.header, anyOf: ["settings.view"], write: "settings.manage" },
  { match: ADMIN.footer, anyOf: ["settings.view"], write: "settings.manage" },
  { match: ADMIN.seo, anyOf: ["settings.view"], write: "settings.manage" },
  { match: ADMIN.appearance, anyOf: ["settings.view"], write: "settings.manage" },

  { match: ADMIN.reports, anyOf: ["reports.view"] },

  { match: ADMIN.settings.permissions, anyOf: ["team.view", "roles.view"] },
  { match: ADMIN.settings.security, anyOf: ["security.view"], write: "security.manage" },
  { match: ADMIN.settings.activity, anyOf: ["security.view"] },
  // The Settings hub lists only the cards a member may open.
  { match: ADMIN.settings.overview, anyOf: ["settings.view", "security.view", "team.view", "roles.view"] },
  { match: `${ADMIN.settings.overview}/`, anyOf: ["settings.view"], write: "settings.manage" },
];

function normalise(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? "";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function matches(rule: RouteRule, path: string): boolean {
  if (rule.match instanceof RegExp) return rule.match.test(path);
  if (rule.match.endsWith("/")) return path.startsWith(rule.match);
  return path === rule.match;
}

/** The permissions that open this admin path (any one of them), or null if no screen is there. */
export function routePermissions(pathname: string): readonly Permission[] | null {
  const path = normalise(pathname);
  const rule = RULES.find((r) => matches(r, path));
  return rule ? rule.anyOf : null;
}

export function canOpenRoute(pathname: string, held: (p: Permission) => boolean): boolean {
  const need = routePermissions(pathname);
  if (need === null) return false;
  return need.length === 0 || need.some(held);
}

/**
 * Where a member lands: the first screen of theirs in this order. Kitchen staff
 * land on the kitchen, riders on their deliveries, everyone else on the
 * dashboard if they have it.
 */
const HOMES: readonly string[] = [
  ADMIN.dashboard,
  ADMIN.kitchen,
  ADMIN.deliveries,
  ADMIN.orders.list,
  ADMIN.cakes.list,
  ADMIN.builders.homepage,
  ADMIN.pages.list,
  ADMIN.customers.list,
  ADMIN.inquiries.overview,
  ADMIN.commerce.inventory,
  ADMIN.commerce.payments,
  ADMIN.commerce.coupons,
  ADMIN.reports,
  ADMIN.media,
  ADMIN.banners,
  ADMIN.settings.overview,
  ADMIN.profile,
];

export function homeRoute(held: (p: Permission) => boolean): string {
  return HOMES.find((path) => canOpenRoute(path, held)) ?? ADMIN.profile;
}

/**
 * Whether a member may CHANGE things on this screen. True where the screen
 * names no separate write permission — opening it was the whole check.
 */
export function canEditRoute(pathname: string, held: (p: Permission) => boolean): boolean {
  if (!canOpenRoute(pathname, held)) return false;
  const path = normalise(pathname);
  const rule = RULES.find((r) => matches(r, path));
  return !rule?.write || held(rule.write);
}
