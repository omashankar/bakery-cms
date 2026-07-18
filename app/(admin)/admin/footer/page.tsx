import type { Metadata } from "next";
import { FooterAdminPage } from "@/apps/admin/footer";

export const metadata: Metadata = {
  title: "Footer",
  description: "Configure footer columns and visibility.",
};

export default function Page() {
  return <FooterAdminPage />;
}
