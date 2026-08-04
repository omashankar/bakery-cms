import type { Metadata } from "next";
import { ContactPage } from "@/apps/website";
import { buildRouteMetadataServer } from "@/features/seo/server/seo-store.server";
import { getStorefrontContact } from "@/apps/website/lib/storefront-contact.server";
import { getStorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";

/**
 * Per request, not at module load.
 *
 * `export const metadata = ...` is evaluated once when this module loads, so
 * it could never reflect what the admin saved — and the builder it called
 * read a module variable that only client code writes, i.e. the demo seed.
 */
export async function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadataServer("store-contact");
}

interface PageProps {
  searchParams: Promise<{ cake?: string }>;
}

export default async function Page(props: PageProps) {
  const { cake } = await props.searchParams;
  const defaultSubject = cake ? `Order inquiry: ${cake}` : undefined;
  const contact = await getStorefrontContact();
  const chrome = await getStorefrontChrome();
  return (
    <ContactPage
      defaultSubject={defaultSubject}
      contact={contact}
      showMap={chrome.footer.showMap}
    />
  );
}
