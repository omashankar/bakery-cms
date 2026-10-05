import type { ResolvedLabels } from "@/config/business-labels";
import { routes } from "@/constants/routes";
import { isSettingsOwnedPath } from "@/lib/admin-settings-pages";

/**
 * The two nouns a breadcrumb can need. A crumb never says a collections
 * heading, so this is deliberately narrower than `ResolvedLabels`.
 */
export type BreadcrumbLabels = Pick<ResolvedLabels, "productWord" | "productWordPlural">;

export interface AdminBreadcrumb {
  label: string;
  href?: string;
}

/**
 * Segments whose wording is FIXED. `cakes`, `add` and `edit` were here too,
 * reading "Cakes", "Add Cake" and "Edit Cake" — the only three entries that
 * name what the shop sells rather than a feature of the admin. This is a
 * module-level constant, so they could never be anything else: a shop that had
 * renamed its products got a sidebar saying "Flowers" beside a breadcrumb
 * saying "Dashboard > Cakes > Add Cake". They are built per call now, from the
 * labels the caller passes.
 *
 * Only /admin/cakes/* reaches `add` and `edit` — /admin/pages/* is handled
 * ahead of this map, and no other admin route has those segments.
 */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  profile: "My Profile",
  password: "Change Password",
  preview: "Preview",
  catalog: "Catalog",
  banners: "Banners",
  testimonials: "Testimonials",
  faq: "FAQ",
  builders: "Builders",
  homepage: "Homepage Builder",
  wedding: "Wedding",
  pages: "Pages",
  header: "Header",
  footer: "Footer",
  seo: "SEO",
  media: "Media Library",
  inquiries: "Inquiries",
  contact: "Contact",
  newsletter: "Newsletter",
  appearance: "Appearance",
  settings: "Settings",
  general: "General",
  modules: "Modules",
  social: "Social",
  security: "Security",
  smtp: "SMTP",
  analytics: "Analytics",
  maintenance: "Maintenance",
  backup: "Backup",
  activity: "Activity",
  permissions: "Permissions",
  commerce: "Commerce",
  orders: "Orders",
  customers: "Customers",
  reports: "Reports",
  inventory: "Inventory",
  payments: "Payments",
  "delivery-zones": "Delivery Zones",
  "delivery-slots": "Delivery Slots",
  coupons: "Coupons",
  taxes: "Taxes",
  "shipping-rules": "Shipping Rules",
  invoices: "Invoices",
  emails: "Email Templates",
  whatsapp: "WhatsApp Templates",
  notifications: "Notifications",
  refunds: "Refunds",
};

/** Segments that are path groups only — no real index page */
const NON_ROUTABLE_SEGMENTS = new Set(["commerce", "builders"]);

function isDynamicSegment(segment: string, prev?: string): boolean {
  if (!prev) return false;
  if (prev === "cakes" && !["add", "edit", "preview"].includes(segment)) {
    return true;
  }
  if (prev === "pages" && segment !== "add" && segment !== "edit") {
    return true;
  }
  if (prev === "orders" || prev === "customers") {
    return true;
  }
  return false;
}

/**
 * Build human-readable admin breadcrumbs from a pathname and the shop wording.
 *
 * `labels` is REQUIRED rather than defaulted. There is one caller and it has
 * the hook; making it optional would let the next one silently reintroduce the
 * bug this parameter exists to fix.
 */
export function getAdminBreadcrumbs(
  pathname: string,
  labels: BreadcrumbLabels,
): AdminBreadcrumb[] {
  const segmentLabels: Record<string, string> = {
    ...SEGMENT_LABELS,
    cakes: labels.productWordPlural,
    add: `Add ${labels.productWord}`,
    edit: `Edit ${labels.productWord}`,
  };
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length <= 1 || (parts.length === 1 && parts[0] === "admin")) {
    return [{ label: "Dashboard" }];
  }

  if (parts.length === 2 && parts[0] === "admin" && parts[1] === "dashboard") {
    return [{ label: "Dashboard" }];
  }

  const crumbs: AdminBreadcrumb[] = [
    { label: "Dashboard", href: routes.admin.dashboard },
  ];

  // Config pages moved into Settings show a "Settings" crumb (their routes are unchanged).
  const settingsOwned = isSettingsOwnedPath(pathname);
  if (settingsOwned) {
    crumbs.push({ label: "Settings", href: routes.admin.settings.overview });
  }

  let href = "/admin";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === "admin") continue;
    if (part === "dashboard") continue;

    href += `/${part}`;
    // "commerce" and "builders" are legacy URL groups (/admin/commerce/*, /admin/builders/*)
    // — they are NOT sidebar sections, so they never render as crumbs. Only skip the
    // top-level group segment: "/admin/settings/commerce" has a real "Commerce" page.
    if ((part === "commerce" || part === "builders") && parts[i - 1] === "admin") continue;
    const prev = parts[i - 1];
    const next = parts[i + 1];

    if (isDynamicSegment(part, prev)) {
      if (next === "edit") {
        crumbs.push({
          label: prev === "pages" ? "Edit Page" : `Edit ${labels.productWord}`,
          href: `${href}/edit`,
        });
        i += 1;
        continue;
      }
      if (next === "preview") {
        crumbs.push({ label: "Preview", href: `${href}/preview` });
        i += 1;
        continue;
      }
      crumbs.push({
        label:
          prev === "pages"
            ? "Page Details"
            : prev === "orders"
              ? "Order Details"
              : prev === "customers"
                ? "Customer Details"
                : `${labels.productWord} Details`,
      });
      continue;
    }

    const label =
      part === "add" && prev === "pages"
        ? "Add Page"
        : part === "wedding" && prev === "builders"
          ? "Wedding Builder"
          : part === "wedding" && prev === "inquiries"
            ? "Wedding"
            : segmentLabels[part] ??
              part.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const isLast = i === parts.length - 1;
    const routable = !NON_ROUTABLE_SEGMENTS.has(part);

    crumbs.push(isLast || !routable ? { label } : { label, href });
  }

  return crumbs;
}
