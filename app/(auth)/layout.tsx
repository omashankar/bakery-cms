import { AuthLayoutShell } from "@/layouts/auth-layout";
import { getSiteIdentity } from "@/features/settings/server/site-identity.server";
import { chosenFavicon } from "@/features/settings/lib/settings-utils";

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
  const { siteName, logo, favicon, resolved } = await getSiteIdentity();

  // Nothing at all when the read failed. Half an identity — a logo with no name,
  // or a name the database did not actually supply — is worse than none.
  return (
    <AuthLayoutShell
      siteName={resolved ? siteName : ""}
      logo={resolved ? logo : ""}
      // `chosenFavicon`, not the raw value: the shipped default is `/favicon.ico`,
      // the stock Create Next App icon, so passing it straight through would put
      // that in the badge of a fresh install's own login screen.
      favicon={resolved ? chosenFavicon(favicon) : ""}
    >
      {children}
    </AuthLayoutShell>
  );
}
