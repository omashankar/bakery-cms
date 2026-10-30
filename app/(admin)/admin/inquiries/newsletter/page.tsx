import type { Metadata } from "next";
import { NewsletterSubscribersPage } from "@/apps/admin/inquiries/components/newsletter-subscribers-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { getSubscribers } from "@/features/newsletter/server/newsletter.service";

export const metadata: Metadata = {
  title: "Newsletter Subscribers",
  description: "Newsletter subscriber list.",
};

/** Every subscriber, read with the page. */
export default async function Page() {
  const initial = await whenAllowed("inquiries.view", async () => JSON.parse(JSON.stringify(await getSubscribers())));
  return <NewsletterSubscribersPage initial={initial} />;
}
