"use client";

import { FileCode2 } from "lucide-react";
import { SettingsPlaceholder } from "./settings-placeholder";

export function SeoFilesSettingsPage() {
  return (
    <SettingsPlaceholder
      title="Robots.txt & Sitemap"
      description="Control how search engines crawl and index your store."
      icon={FileCode2}
      features={[
        "Edit robots.txt rules (allow / disallow paths)",
        "Auto-generated XML sitemap for pages and products",
        "Submit sitemap URL to search consoles",
        "Toggle indexing for staging vs live",
      ]}
      note="Meta titles and descriptions are already editable in Settings → Website → SEO."
    />
  );
}
