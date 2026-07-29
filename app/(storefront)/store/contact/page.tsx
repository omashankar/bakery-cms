import type { Metadata } from "next";
import { ContactPage } from "@/apps/website";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";
import { getStorefrontContact } from "@/apps/website/lib/storefront-contact.server";

export const metadata: Metadata = buildRouteMetadata("store-contact");

interface PageProps {
  searchParams: Promise<{ cake?: string }>;
}

export default async function Page(props: PageProps) {
  const { cake } = await props.searchParams;
  const defaultSubject = cake ? `Order inquiry: ${cake}` : undefined;
  const contact = await getStorefrontContact();
  return <ContactPage defaultSubject={defaultSubject} contact={contact} />;
}
