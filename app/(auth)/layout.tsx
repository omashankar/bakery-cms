import { AuthLayoutShell } from "@/layouts/auth-layout";
import { getSiteIdentity } from "@/features/settings/server/site-identity.server";

/**
 * The shop's own name on the shop owner's front door.
 *
 * This screen — /login, /otp, /forgot-password, /reset-password, and the three
 * /auth/* outcomes — was headed with the CMS PRODUCT: a gold "B", an `<h1>`
 * naming the software, and "Internal staff access only" in the footer, all
 * under a browser tab that already read the shop's name. Two brands on one
 * screen, on the page a shop owner sees more often than any other.
 *
 * `getSiteIdentity` is request-cached and the root layout already awaits it for
 * the tab title, so this costs nothing extra.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { siteName, resolved } = await getSiteIdentity();

  return (
    <AuthLayoutShell siteName={resolved ? siteName : ""}>{children}</AuthLayoutShell>
  );
}
