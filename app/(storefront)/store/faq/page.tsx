import type { Metadata } from "next";
import { FaqPage } from "@/apps/website";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";
import { getContent } from "@/features/content/server/content.service";
import { getStorefrontContact } from "@/apps/website/lib/storefront-contact.server";
import type { FaqItem } from "@/types/content";

export const metadata: Metadata = buildRouteMetadata("store-faq");

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
