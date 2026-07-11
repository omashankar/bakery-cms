import type { Metadata } from "next";
import { BannersAdminPage } from "@/features/admin/banners";

export const metadata: Metadata = {
  title: "Banners",
  description: "Manage promotional banners and hero slides.",
};

export default function Page() {
  return <BannersAdminPage />;
}
