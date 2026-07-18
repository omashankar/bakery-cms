import type { Metadata } from "next";
import { TaxesAdminPage } from "@/apps/admin/commerce/pages/taxes-admin-page";

export const metadata: Metadata = {
  title: "Taxes",
  description: "GST, platform charges, and tax breakdown rules.",
};

export default function Page() {
  return <TaxesAdminPage />;
}
