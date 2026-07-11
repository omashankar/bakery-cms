"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppearanceThemeSync } from "@/components/shared/appearance-theme-sync";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider defaultTheme="light">
      <AppearanceThemeSync />
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
