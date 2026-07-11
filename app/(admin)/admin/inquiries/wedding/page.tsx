import type { Metadata } from "next";
import { InquiriesListPage } from "@/features/admin/inquiries";

export const metadata: Metadata = {
  title: "Wedding Inquiries",
  description: "Wedding cake inquiry management.",
};

export default function Page() {
  return (
    <InquiriesListPage
      fixedType="wedding"
      title="Wedding Inquiries"
      description="Wedding cake requests"
    />
  );
}
