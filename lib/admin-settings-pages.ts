/**
 * Config pages that live under the Settings control center but keep their original
 * routes (e.g. /admin/header, /admin/commerce/payments). Used to show a "Settings"
 * breadcrumb crumb and keep the sidebar "Settings" item active on these pages.
 */
export const SETTINGS_OWNED_PATHS = [
  "/admin/header",
  "/admin/footer",
  "/admin/appearance",
  "/admin/seo",
  "/admin/commerce/payments",
  "/admin/commerce/delivery-zones",
  "/admin/commerce/delivery-slots",
  "/admin/commerce/shipping-rules",
  "/admin/commerce/taxes",
  "/admin/commerce/invoices",
  "/admin/commerce/emails",
  "/admin/commerce/whatsapp",
] as const;

export function isSettingsOwnedPath(pathname: string): boolean {
  return SETTINGS_OWNED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}
