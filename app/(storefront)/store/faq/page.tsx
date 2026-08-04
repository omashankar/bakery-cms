import type { Metadata } from "next";
import { FaqPage } from "@/apps/website";
import { buildRouteMetadataServer } from "@/features/seo/server/seo-store.server";
import { getContent } from "@/features/content/server/content.service";
import { getStorefrontContact } from "@/apps/website/lib/storefront-contact.server";
import type { FaqItem } from "@/types/content";

/**
 * Per request, not at module load.
 *
 * `export const metadata = ...` is evaluated once when this module loads, so
 * it could never reflect what the admin saved — and the builder it called
 * read a module variable that only client code writes, i.e. the demo seed.
 */
export async function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadataServer("store-faq");
}

export default async function Page() {
  const [faqsRaw, contact] = await Promise.all([
    getContent("faq"),
    getStorefrontContact(),
  ]);
  return (
    <FaqPage
      faqs={(faqsRaw ?? []) as FaqItem[]}
      contact={{ phone: contact.phone, email: contact.email }}
    />
  );
}
