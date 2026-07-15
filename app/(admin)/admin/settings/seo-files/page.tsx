import type { Metadata } from "next";
import { SeoFilesSettingsPage } from "@/features/admin/settings";

export const metadata: Metadata = {
  title: "Robots.txt & Sitemap",
  description: "Control search-engine crawling and indexing.",
};

export default function Page() {
  return <SeoFilesSettingsPage />;
}
