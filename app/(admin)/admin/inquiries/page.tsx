import type { Metadata } from "next";
import { InquiriesHubPage } from "@/apps/admin/inquiries";

export const metadata: Metadata = {
  title: "Inquiries",
  description: "Customer inquiries — wedding, contact, and newsletter.",
};

export default function Page() {
  return <InquiriesHubPage />;
}
