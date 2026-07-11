"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import type { ThemeSetting } from "@/lib/theme";

interface ThemeToggleProps {
  className?: string;
}

function nextTheme(current: ThemeSetting | undefined): ThemeSetting {
  return current === "dark" ? "light" : "dark";
}

/** Icon-only theme control. Toggles light ↔ dark (admin / design-system). */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  // Prefer explicit theme — avoid resolvedTheme lag flipping the icon.
  const active: ThemeSetting | undefined = theme ?? resolvedTheme;
  const isDark = mounted && active === "dark";

  const label = !mounted
    ? "Theme"
    : isDark
      ? "Theme: dark. Click for light."
      : "Theme: light. Click for dark.";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(className)}
      disabled={!mounted}
      onClick={() => {
        if (!mounted) return;
        setTheme(nextTheme(active));
      }}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}
