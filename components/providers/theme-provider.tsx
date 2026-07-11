"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import {
  applyAppearanceSettings,
  loadAppearanceSettings,
} from "@/features/admin/appearance";
import {
  THEME_STORAGE_KEY,
  THEME_OPTIONS,
  applyThemeToDocument,
  isLightLockedPath,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemeSetting,
} from "@/lib/theme";

interface ThemeContextValue {
  theme?: ThemeSetting;
  resolvedTheme?: ResolvedTheme;
  setTheme: Dispatch<SetStateAction<ThemeSetting>>;
  themes: ThemeSetting[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeSetting;
  storageKey?: string;
}

function commitTheme(resolved: ResolvedTheme, forceStorefrontLight: boolean) {
  if (forceStorefrontLight) {
    applyThemeToDocument("light");
    applyAppearanceSettings(loadAppearanceSettings(), { forceSemantics: true });
    return;
  }

  applyThemeToDocument(resolved);
  applyAppearanceSettings(loadAppearanceSettings());
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const pathname = usePathname() ?? "";
  const lightLocked = isLightLockedPath(pathname);
  const [theme, setThemeState] = useState<ThemeSetting | undefined>(undefined);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme | undefined>(
    undefined
  );

  useEffect(() => {
    const stored = readStoredTheme(storageKey, defaultTheme);
    setThemeState(stored);
    setResolvedTheme(resolveTheme(stored));
  }, [defaultTheme, storageKey]);

  // useLayoutEffect: apply before paint so UI + DOM never disagree (no flicker).
  useLayoutEffect(() => {
    if (!theme) return;

    if (lightLocked) {
      setResolvedTheme("light");
      commitTheme("light", true);
      return;
    }

    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    commitTheme(resolved, false);
    persistTheme(storageKey, theme);
  }, [storageKey, theme, lightLocked]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const nextTheme = readStoredTheme(storageKey, defaultTheme);
      setThemeState(nextTheme);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [defaultTheme, storageKey]);

  const setTheme = useCallback<Dispatch<SetStateAction<ThemeSetting>>>(
    (value) => {
      setThemeState((current) =>
        typeof value === "function" ? value(current ?? defaultTheme) : value
      );
    },
    [defaultTheme]
  );

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      themes: [...THEME_OPTIONS],
    }),
    [resolvedTheme, setTheme, theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    return {
      theme: undefined,
      resolvedTheme: undefined,
      setTheme: () => {},
      themes: [...THEME_OPTIONS],
    };
  }

  return context;
}
