import type { Metadata } from "next";
import { NewsletterSubscribersPage } from "@/apps/admin/inquiries";

export const metadata: Metadata = {
  title: "Newsletter Subscribers",
  description: "Newsletter subscriber list.",
};

export default function Page() {
  return <NewsletterSubscribersPage />;
}
