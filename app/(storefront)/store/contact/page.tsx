import type { Metadata } from "next";
import { ContactPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-contact");

interface PageProps {
  searchParams: Promise<{ cake?: string }>;
}

export default async function Page(props: PageProps) {
  const { cake } = await props.searchParams;
  const defaultSubject = cake ? `Order inquiry: ${cake}` : undefined;
  return <ContactPage defaultSubject={defaultSubject} />;
}
