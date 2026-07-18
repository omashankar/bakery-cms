import type { Metadata } from "next";
import { PagesListPage } from "@/apps/admin/pages";

export const metadata: Metadata = {
  title: "Pages",
  description: "Manage static pages like About, Privacy, and Terms.",
};

export default function Page() {
  return <PagesListPage />;
}
