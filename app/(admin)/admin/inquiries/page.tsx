import type { Metadata } from "next";
import { InquiriesListPage } from "@/features/admin/inquiries";

export const metadata: Metadata = {
  title: "Inquiries",
  description: "All customer inquiries overview.",
};

export default function Page() {
  return <InquiriesListPage />;
}
