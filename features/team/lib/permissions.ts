/**
 * THE permission registry — the one list every check in the app is written
 * against.
 *
 * Code asks "may this person do X?", never "is this person a Manager?". A role is
 * only a named bundle of the ids below, so a shop can invent its own roles
 * without a line of code changing, and a check can never silently go stale
 * because somebody renamed a role.
 *
 * Client-safe on purpose: the sidebar, the permission matrix and the action
 * buttons read the same list the server enforces, so the UI cannot offer a
 * permission the server does not know.
 *
 * The SERVER is the authority. Hiding a button is a courtesy; every API route
 * checks these ids again (see lib/server/auth/access.ts).
 */

/** Where a permission sits in the Roles matrix. */
export type PermissionColumn =
  | "view"
  | "create"
  | "edit"
  | "status"
  | "delete"
  | "refund"
  | "special";

export interface PermissionDefinition {
  id: string;
  module: PermissionModuleId;
  column: PermissionColumn;
  /** Short — it sits beside a checkbox. */
  label: string;
  description: string;
  /**
   * Destroys, refunds, exposes or hands out access. Shown with a warning in the
   * matrix so an owner does not tick it the way they would tick "view".
   */
  sensitive?: boolean;
  /**
   * Meaningless without at least ONE of these. Saving a role that breaks this
   * is refused by the server, and the matrix ticks the first one for you.
   */
  requiresAnyOf?: readonly string[];
}

export type PermissionModuleId =
  | "orders"
  | "products"
  | "inventory"
  | "customers"
  | "inquiries"
  | "payments"
  | "website"
  | "marketing"
  | "reports"
  | "settings"
  | "team";

export interface PermissionModule {
  id: PermissionModuleId;
  label: string;
  description: string;
}

export const PERMISSION_MODULES: readonly PermissionModule[] = [
  { id: "orders", label: "Orders", description: "The order list, fulfilment, cancellations and refunds." },
  { id: "products", label: "Products & catalog", description: "What the shop sells, how it is filed, and its reviews." },
  { id: "inventory", label: "Inventory", description: "Stock levels and adjustments." },
  { id: "customers", label: "Customers", description: "Customer profiles and their history." },
  { id: "inquiries", label: "Inquiries", description: "Contact-form messages and newsletter sign-ups." },
  { id: "payments", label: "Payments", description: "Transactions, invoices and the payment gateway." },
  { id: "website", label: "Website & content", description: "Homepage, pages, banners, media, testimonials and FAQs." },
  { id: "marketing", label: "Marketing", description: "Coupons and offers." },
  { id: "reports", label: "Reports & dashboard", description: "Analytics, including revenue." },
  { id: "settings", label: "Settings & security", description: "Shop configuration, sign-in policy and the activity log." },
  { id: "team", label: "Team", description: "Who can sign in, and what each role may do." },
];

const ORDER_SCOPES = ["orders.view", "orders.view_kitchen", "orders.view_assigned"] as const;

export const PERMISSIONS = [
  // ---- Orders ----
  { id: "orders.view", module: "orders", column: "view", label: "View all orders", description: "Every order, with prices, payment and customer details." },
  { id: "orders.view_kitchen", module: "orders", column: "special", label: "Kitchen queue", description: "Orders waiting to be made — items and instructions only. No prices, payments or customer contact." },
  { id: "orders.view_assigned", module: "orders", column: "special", label: "Own deliveries", description: "Only orders assigned to this person for delivery, with the address and contact needed to deliver them." },
  { id: "orders.manage", module: "orders", column: "edit", label: "Edit orders", description: "Internal notes, refund notes and raising a refund request.", requiresAnyOf: ["orders.view"] },
  { id: "orders.update_status", module: "orders", column: "status", label: "Update status", description: "Move orders through their steps. Kitchen and delivery staff may only make the moves of their own step.", requiresAnyOf: ORDER_SCOPES },
  { id: "orders.cancel", module: "orders", column: "special", label: "Cancel orders", description: "Cancel an order and put its stock back.", sensitive: true, requiresAnyOf: ["orders.view"] },
  { id: "orders.refund", module: "orders", column: "refund", label: "Refund orders", description: "Send money back to a customer, or decline a refund request.", sensitive: true, requiresAnyOf: ["orders.view"] },
  { id: "orders.assign_delivery", module: "orders", column: "special", label: "Assign delivery", description: "Choose who delivers an order.", requiresAnyOf: ["orders.view"] },

  // ---- Products & catalog ----
  { id: "products.view", module: "products", column: "view", label: "View products", description: "The product list and each product's details." },
  { id: "products.create", module: "products", column: "create", label: "Add products", description: "Create new products.", requiresAnyOf: ["products.view"] },
  { id: "products.update", module: "products", column: "edit", label: "Edit products", description: "Change products, prices and whether they are on sale.", requiresAnyOf: ["products.view"] },
  { id: "products.delete", module: "products", column: "delete", label: "Delete products", description: "Remove a product for good.", sensitive: true, requiresAnyOf: ["products.view"] },
  { id: "catalog.manage", module: "products", column: "special", label: "Categories & tags", description: "Categories, occasions, themes and departments." },
  { id: "reviews.manage", module: "products", column: "special", label: "Moderate reviews", description: "Approve, hide and delete customer reviews." },

  // ---- Inventory ----
  { id: "inventory.view", module: "inventory", column: "view", label: "View stock", description: "Stock levels and history." },
  { id: "inventory.manage", module: "inventory", column: "edit", label: "Adjust stock", description: "Change stock levels and inventory settings.", requiresAnyOf: ["inventory.view"] },

  // ---- Customers ----
  { id: "customers.view", module: "customers", column: "view", label: "View customers", description: "Customer profiles, contact details and order history." },
  { id: "customers.update", module: "customers", column: "edit", label: "Edit customers", description: "Tags and notes on a customer.", requiresAnyOf: ["customers.view"] },
  { id: "customers.export", module: "customers", column: "special", label: "Export customers", description: "Download the customer list.", sensitive: true, requiresAnyOf: ["customers.view"] },

  // ---- Inquiries ----
  { id: "inquiries.view", module: "inquiries", column: "view", label: "View inquiries", description: "Contact-form messages and newsletter subscribers." },
  { id: "inquiries.manage", module: "inquiries", column: "edit", label: "Handle inquiries", description: "Reply status, delete messages and subscribers.", requiresAnyOf: ["inquiries.view"] },

  // ---- Payments ----
  { id: "payments.view", module: "payments", column: "view", label: "View payments", description: "Transactions, invoices and refund cases." },
  { id: "payments.manage", module: "payments", column: "edit", label: "Manage payments", description: "Gateway keys, payment status and invoice settings.", sensitive: true, requiresAnyOf: ["payments.view"] },
  { id: "payments.refund", module: "payments", column: "refund", label: "Settle payments", description: "Mark a stray gateway payment as refunded.", sensitive: true, requiresAnyOf: ["payments.view"] },

  // ---- Website & content ----
  { id: "pages.view", module: "website", column: "view", label: "View pages", description: "The site's custom pages." },
  { id: "media.view", module: "website", column: "view", label: "View media", description: "The media library." },
  { id: "pages.manage", module: "website", column: "edit", label: "Edit pages", description: "Create, edit and delete custom pages.", requiresAnyOf: ["pages.view"] },
  { id: "media.manage", module: "website", column: "edit", label: "Manage media", description: "Upload, organise and delete media.", requiresAnyOf: ["media.view"] },
  { id: "homepage.manage", module: "website", column: "special", label: "Homepage builder", description: "Edit and publish the homepage." },
  { id: "banners.manage", module: "website", column: "special", label: "Banners", description: "Create and schedule banners." },
  { id: "testimonials.manage", module: "website", column: "special", label: "Testimonials", description: "Approve and edit testimonials." },
  { id: "faq.manage", module: "website", column: "special", label: "FAQ", description: "Edit the FAQ." },

  // ---- Marketing ----
  { id: "coupons.view", module: "marketing", column: "view", label: "View coupons", description: "Coupons and their usage." },
  { id: "coupons.manage", module: "marketing", column: "edit", label: "Manage coupons", description: "Create, change and switch off coupons.", requiresAnyOf: ["coupons.view"] },

  // ---- Reports & dashboard ----
  { id: "dashboard.view", module: "reports", column: "view", label: "Dashboard", description: "The dashboard. Revenue figures on it need the revenue permission too." },
  { id: "reports.view", module: "reports", column: "view", label: "Reports", description: "The reports screen." },
  { id: "reports.revenue.view", module: "reports", column: "special", label: "Revenue figures", description: "Sales totals, revenue trends and average order value.", sensitive: true, requiresAnyOf: ["dashboard.view", "reports.view"] },

  // ---- Settings & security ----
  { id: "settings.view", module: "settings", column: "view", label: "View settings", description: "Shop configuration screens." },
  { id: "settings.manage", module: "settings", column: "edit", label: "Change settings", description: "Shop details, delivery, taxes, emails, header, footer, appearance and SEO.", sensitive: true, requiresAnyOf: ["settings.view"] },
  { id: "security.view", module: "settings", column: "special", label: "View security", description: "Sign-in history and the activity log." },
  { id: "security.manage", module: "settings", column: "special", label: "Change security", description: "Sign-in policy and session timeouts.", sensitive: true, requiresAnyOf: ["security.view"] },

  // ---- Team ----
  { id: "team.view", module: "team", column: "view", label: "View team", description: "Who has an account and their role." },
  { id: "roles.view", module: "team", column: "view", label: "View roles", description: "Each role and what it allows." },
  { id: "team.invite", module: "team", column: "create", label: "Invite members", description: "Send, resend and revoke invitations.", sensitive: true, requiresAnyOf: ["team.view"] },
  { id: "team.manage", module: "team", column: "edit", label: "Manage members", description: "Change a member's role, block, deactivate or remove them.", sensitive: true, requiresAnyOf: ["team.view"] },
  { id: "roles.manage", module: "team", column: "special", label: "Manage roles", description: "Create, edit and delete custom roles.", sensitive: true, requiresAnyOf: ["roles.view"] },
] as const satisfies readonly PermissionDefinition[];

export type Permission = (typeof PERMISSIONS)[number]["id"];

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS.map((p) => p.id);

const BY_ID: ReadonlyMap<string, PermissionDefinition> = new Map(
  PERMISSIONS.map((p) => [p.id, p as PermissionDefinition]),
);

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && BY_ID.has(value);
}

export function permissionDefinition(id: string): PermissionDefinition | undefined {
  return BY_ID.get(id);
}

export function permissionsInModule(module: PermissionModuleId): PermissionDefinition[] {
  return PERMISSIONS.filter((p) => p.module === module) as PermissionDefinition[];
}

// ---- Roles ------------------------------------------------------------------

/** The one role that can never be narrowed. Holds every permission, always. */
export const OWNER_ROLE = "owner";

/**
 * What the account had before roles existed. Every controller allowed
 * `["owner", "admin"]`, so an `admin` was an owner in all but name; it is read
 * as one so no install loses access mid-upgrade. Nothing assigns it any more,
 * and scripts/migrate-rbac.ts renames it.
 */
export const LEGACY_OWNER_ROLES: readonly string[] = ["admin"];

export interface SystemRoleDefinition {
  slug: string;
  name: string;
  description: string;
  permissions: readonly Permission[];
}

export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    slug: OWNER_ROLE,
    name: "Owner",
    description: "Full access to everything, including the team and security.",
    permissions: ALL_PERMISSIONS,
  },
  {
    slug: "manager",
    name: "Manager",
    description: "Runs the shop day to day: orders, products, stock, customers and coupons. No refunds, team or settings.",
    permissions: [
      "dashboard.view",
      "reports.view",
      "reports.revenue.view",
      "orders.view",
      "orders.manage",
      "orders.update_status",
      "orders.cancel",
      "orders.assign_delivery",
      "products.view",
      "products.create",
      "products.update",
      "products.delete",
      "catalog.manage",
      "reviews.manage",
      "inventory.view",
      "inventory.manage",
      "customers.view",
      "customers.update",
      "inquiries.view",
      "inquiries.manage",
      "payments.view",
      "coupons.view",
      "coupons.manage",
      "media.view",
      "media.manage",
    ],
  },
  {
    slug: "kitchen-staff",
    name: "Kitchen Staff",
    description: "Sees the kitchen queue and marks orders as being made and ready. No prices, payments or customer contact.",
    permissions: ["orders.view_kitchen", "orders.update_status"],
  },
  {
    slug: "delivery-staff",
    name: "Delivery Staff",
    description: "Sees only the orders assigned to them, with the address to deliver to, and marks them out for delivery and delivered.",
    permissions: ["orders.view_assigned", "orders.update_status"],
  },
  {
    slug: "content-editor",
    name: "Content Editor",
    description: "Looks after the website: homepage, pages, banners, media, testimonials and FAQs.",
    permissions: [
      "homepage.manage",
      "pages.view",
      "pages.manage",
      "banners.manage",
      "media.view",
      "media.manage",
      "testimonials.manage",
      "faq.manage",
    ],
  },
];

export const SYSTEM_ROLE_SLUGS: readonly string[] = SYSTEM_ROLES.map((r) => r.slug);

export function isOwnerRole(slug: string | null | undefined): boolean {
  return slug === OWNER_ROLE || LEGACY_OWNER_ROLES.includes(slug ?? "");
}

// ---- Validation ---------------------------------------------------------------

export interface PermissionProblem {
  permission: string;
  message: string;
}

/**
 * Everything wrong with a permission list, or `[]`.
 *
 * Unknown ids are refused rather than dropped: a typo saved silently would be a
 * role that LOOKS like it grants something and does not. A permission whose
 * prerequisite is missing is refused for the opposite reason — "Delete
 * products" without "View products" grants a button on a screen the person can
 * never open.
 */
export function permissionProblems(list: readonly string[]): PermissionProblem[] {
  const problems: PermissionProblem[] = [];
  const held = new Set(list);
  for (const id of held) {
    const def = BY_ID.get(id);
    if (!def) {
      problems.push({ permission: id, message: `"${id}" is not a permission this shop knows.` });
      continue;
    }
    if (def.requiresAnyOf && !def.requiresAnyOf.some((need) => held.has(need))) {
      const names = def.requiresAnyOf.map((need) => BY_ID.get(need)?.label ?? need);
      problems.push({
        permission: id,
        message: `"${def.label}" also needs ${names.length > 1 ? "one of " : ""}${names.map((n) => `"${n}"`).join(" or ")}.`,
      });
    }
  }
  return problems;
}

/** De-duplicated, in registry order — so two saves of the same set compare equal. */
export function sortPermissions(list: Iterable<string>): Permission[] {
  const held = new Set(list);
  return ALL_PERMISSIONS.filter((id) => held.has(id));
}

/**
 * The list with every missing prerequisite added — what the matrix does when an
 * owner ticks "Delete products" on a role that cannot yet view them.
 */
export function withPrerequisites(list: Iterable<string>): Permission[] {
  const held = new Set(list);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...held]) {
      const need = BY_ID.get(id)?.requiresAnyOf;
      if (need && !need.some((n) => held.has(n))) {
        held.add(need[0]);
        changed = true;
      }
    }
  }
  return sortPermissions(held);
}

/**
 * The list with everything removed that depended on `removed` and no longer has
 * any prerequisite — unticking "View products" also unticks "Delete products".
 */
export function withoutDependents(list: Iterable<string>, removed: string): Permission[] {
  const held = new Set(list);
  held.delete(removed);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...held]) {
      const need = BY_ID.get(id)?.requiresAnyOf;
      if (need && !need.some((n) => held.has(n))) {
        held.delete(id);
        changed = true;
      }
    }
  }
  return sortPermissions(held);
}
