import type { Metadata } from "next";
import { InvoicesAdminPage } from "@/features/admin/commerce/pages/invoices-admin-page";

export const metadata: Metadata = {
  title: "Invoices",
  description: "Manage order invoices, print documents, and customize invoice design.",
};

export default function Page() {
  return <InvoicesAdminPage />;
}
