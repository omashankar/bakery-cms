"use client";

import { Menu } from "lucide-react";
import { SettingsPlaceholder } from "./settings-placeholder";

export function NavigationSettingsPage() {
  return (
    <SettingsPlaceholder
      title="Navigation Menus"
      description="Build and reorder storefront navigation menus."
      icon={Menu}
      features={[
        "Create custom menus (header, footer, mobile)",
        "Drag-and-drop menu items and nesting",
        "Link to pages, collections, or custom URLs",
        "Show or hide menus per location",
      ]}
      note="For now, the storefront header and footer menus are managed from Settings → Website → Header and Footer."
    />
  );
}
