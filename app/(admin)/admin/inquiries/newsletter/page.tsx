import type { Metadata } from "next";
import { NewsletterSubscribersPage } from "@/apps/admin/inquiries/components/newsletter-subscribers-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getSubscribers } from "@/features/newsletter/server/newsletter.service";

export const metadata: Metadata = {
  title: "Newsletter Subscribers",
  description: "Newsletter subscriber list.",
};

/** Every subscriber, read with the page. */
export default async function Page() {
  const initial = await whenAdmin(async () => JSON.parse(JSON.stringify(await getSubscribers())));
  return <NewsletterSubscribersPage initial={initial} />;
}
