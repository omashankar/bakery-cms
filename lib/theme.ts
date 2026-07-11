export const THEME_STORAGE_KEY = "bakery-cms-theme";

export const THEME_OPTIONS = ["light", "dark"] as const;

export type ThemeSetting = (typeof THEME_OPTIONS)[number];

export type ResolvedTheme = "light" | "dark";

/** Critical tokens forced on <html> so dark never keeps light muted/secondary fills. */
export const DARK_THEME_INLINE_VARS: Record<string, string> = {
  "--background": "#241810",
  "--foreground": "#faf8f4",
  "--card": "#3a281c",
  "--card-foreground": "#faf8f4",
  "--popover": "#3a281c",
  "--popover-foreground": "#faf8f4",
  "--primary": "#d4a373",
  "--primary-foreground": "#241810",
  "--secondary": "#5a3f2b",
  "--secondary-foreground": "#faf8f4",
  "--muted": "#4a3324",
  "--muted-foreground": "#e4d5c2",
  "--accent": "#5a3f2b",
  "--accent-foreground": "#faf8f4",
  "--destructive": "#f87171",
  "--border": "#5c4638",
  "--input": "#5c4638",
  "--ring": "#d4a373",
  "--sidebar": "#1a120c",
  "--sidebar-foreground": "#faf8f4",
  "--sidebar-primary": "#d4a373",
  "--sidebar-primary-foreground": "#241810",
  "--sidebar-accent": "#3a281c",
  "--sidebar-accent-foreground": "#faf8f4",
  "--sidebar-border": "#5c4638",
  "--sidebar-ring": "#d4a373",
  "--surface-cream": "#4a3324",
  "--beige": "#3a281c",
  "--text-primary": "#faf8f4",
  "--border-soft": "#5c4638",
};

const INLINE_VAR_KEYS = Object.keys(DARK_THEME_INLINE_VARS);

let themeSwitchClearTimer: ReturnType<typeof setTimeout> | null = null;

function applyInlineThemeVars(root: HTMLElement, resolved: ResolvedTheme) {
  if (resolved === "dark") {
    for (const [key, value] of Object.entries(DARK_THEME_INLINE_VARS)) {
      root.style.setProperty(key, value);
    }
    return;
  }

  for (const key of INLINE_VAR_KEYS) {
    root.style.removeProperty(key);
  }
}

/** Keep transitions/animations disabled until paints + appearance settle. */
function scheduleThemeSwitchUnlock(root: HTMLElement) {
  if (themeSwitchClearTimer) {
    clearTimeout(themeSwitchClearTimer);
  }
  themeSwitchClearTimer = setTimeout(() => {
    root.classList.remove("theme-switching");
    themeSwitchClearTimer = null;
  }, 120);
}

function legacySystemToResolved(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Public storefront / customer site — always light.
 * Admin, design-system, and architecture hub may use dark.
 */
export function isPublicStorefrontPath(pathname: string): boolean {
  if (!pathname) return false;
  return (
    pathname === "/landing" ||
    pathname.startsWith("/store") ||
    pathname.startsWith("/account")
  );
}

/** Staff auth screens — light form column; brand panel is solid bakery (not theme dark). */
export function isAuthPath(pathname: string): boolean {
  if (!pathname) return false;
  return (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/otp" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth/")
  );
}

/** Paths that must never inherit admin dark mode. */
export function isLightLockedPath(pathname: string): boolean {
  return isPublicStorefrontPath(pathname) || isAuthPath(pathname);
}

/** Inline script injected in the document head to prevent theme flash. */
export const THEME_BLOCKING_SCRIPT = `(function(){var root=document.documentElement,key="${THEME_STORAGE_KEY}",path=location.pathname,isLight=path==="/landing"||path.indexOf("/store")===0||path.indexOf("/account")===0||path==="/login"||path==="/forgot-password"||path==="/otp"||path==="/reset-password"||path.indexOf("/auth/")===0,dark={${Object.entries(
  DARK_THEME_INLINE_VARS
)
  .map(([k, v]) => `"${k}":"${v}"`)
  .join(",")}};function system(){return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}function apply(resolved){if(resolved==="dark"){for(var k in dark)root.style.setProperty(k,dark[k]);root.classList.add("dark");root.classList.remove("light")}else{root.classList.add("light");root.classList.remove("dark");for(var k2 in dark)root.style.removeProperty(k2)}root.style.colorScheme=resolved}try{if(isLight){apply("light");return}var stored=localStorage.getItem(key)||"light";if(stored==="system"){stored=system();try{localStorage.setItem(key,stored)}catch(e){}}apply(stored==="dark"?"dark":"light")}catch(e){apply("light")}})();`;

export function resolveTheme(theme: ThemeSetting): ResolvedTheme {
  return theme;
}

export function readStoredTheme(
  storageKey: string,
  defaultTheme: ThemeSetting
): ThemeSetting {
  if (typeof window === "undefined") return defaultTheme;

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    // Migrate legacy "system" preference to a concrete mode
    if (stored === "system") {
      const resolved = legacySystemToResolved();
      try {
        localStorage.setItem(storageKey, resolved);
      } catch {
        // ignore
      }
      return resolved;
    }
  } catch {
    // ignore storage errors
  }

  return defaultTheme;
}

export function applyThemeToDocument(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const nextIsDark = resolved === "dark";

  if (isDark === nextIsDark && root.style.colorScheme === resolved) {
    if (nextIsDark) applyInlineThemeVars(root, "dark");
    return;
  }

  root.classList.add("theme-switching");

  if (nextIsDark) {
    applyInlineThemeVars(root, "dark");
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
    applyInlineThemeVars(root, "light");
  }

  root.style.colorScheme = resolved;
  scheduleThemeSwitchUnlock(root);
}

export function persistTheme(storageKey: string, theme: ThemeSetting) {
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // ignore storage errors
  }
}
