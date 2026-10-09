import type { Metadata } from "next";
import { SeoFilesSettingsPage } from "@/apps/admin/settings/components/seo-files-settings-page";

export const metadata: Metadata = {
  title: "Robots.txt & Sitemap",
  description: "Control search-engine crawling and indexing.",
};

export default function Page() {
  return <SeoFilesSettingsPage />;
}
