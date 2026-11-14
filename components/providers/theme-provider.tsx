"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import { useExternalValue, windowEvents } from "@/hooks/use-external-value";
import { applyAppearanceSettings } from "@/features/site-layout/lib/appearance-utils";
import { loadAppearanceSettings } from "@/features/site-layout/lib/appearance-repository";
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

/** Said in this tab when the theme is chosen; another tab says "storage". */
const THEME_CHANGED_EVENT = "bakery-theme-changed";
const themeChanges = windowEvents("storage", THEME_CHANGED_EVENT);

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
  /*
    THE CHOSEN THEME LIVES IN STORAGE and is read from there: undefined on the
    server and in the hydrating render, as before, then the stored choice. A
    choice made here, or in another tab, is written to storage and announced,
    and the read follows it. (It was a copy in state, filled by an effect after
    the first render and by a second effect listening for "storage".)
  */
  const readTheme = useCallback(
    (): ThemeSetting | undefined => readStoredTheme(storageKey, defaultTheme),
    [storageKey, defaultTheme]
  );
  const theme = useExternalValue(readTheme, themeChanges, undefined);
  const resolvedTheme: ResolvedTheme | undefined = theme
    ? lightLocked
      ? "light"
      : resolveTheme(theme)
    : undefined;

  // useLayoutEffect: apply before paint so UI + DOM never disagree (no flicker).
  useLayoutEffect(() => {
    if (!theme) return;

    if (lightLocked) {
      commitTheme("light", true);
      return;
    }

    commitTheme(resolveTheme(theme), false);
    persistTheme(storageKey, theme);
  }, [storageKey, theme, lightLocked]);

  const setTheme = useCallback<Dispatch<SetStateAction<ThemeSetting>>>(
    (value) => {
      const current = readStoredTheme(storageKey, defaultTheme);
      persistTheme(storageKey, typeof value === "function" ? value(current) : value);
      window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
    },
    [defaultTheme, storageKey]
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
