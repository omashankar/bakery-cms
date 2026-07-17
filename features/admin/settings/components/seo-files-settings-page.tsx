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
        "Edit robots.txt rules (allow / disallow specific paths)",
        "Tune sitemap priority and change frequency per route",
        "Submit the sitemap URL to search consoles",
        "Separate crawl rules for staging and live",
      ]}
      note="robots.txt and sitemap.xml are already generated and live — open them from Settings → Website → SEO, where global indexing and per-page meta are managed too."
    />
  );
}
