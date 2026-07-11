import type { Metadata } from "next";
import { InquiriesListPage } from "@/features/admin/inquiries";

export const metadata: Metadata = {
  title: "Contact Inquiries",
  description: "Contact form submissions.",
};

export default function Page() {
  return (
    <InquiriesListPage
      fixedType="contact"
      title="Contact Inquiries"
      description="Contact form messages"
    />
  );
}
