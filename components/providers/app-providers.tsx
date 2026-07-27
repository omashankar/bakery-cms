"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppearanceThemeSync } from "@/components/shared/appearance-theme-sync";
import { SettingsServerSync } from "@/components/shared/settings-server-sync";
import { CatalogServerSync } from "@/components/shared/catalog-server-sync";
import { CommerceServerSync } from "@/components/shared/commerce-server-sync";
import { ContentServerSync } from "@/components/shared/content-server-sync";
import { SiteLayoutServerSync } from "@/components/shared/site-layout-server-sync";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider defaultTheme="light">
      <AppearanceThemeSync />
      <SettingsServerSync />
      <CatalogServerSync />
      <CommerceServerSync />
      <ContentServerSync />
      <SiteLayoutServerSync />
      <TooltipProvider delay={200}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "font-sans",
            },
          }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
