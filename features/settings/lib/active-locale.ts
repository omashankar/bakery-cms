import { defaultGeneralSettings } from "./settings-utils";

/**
 * The store's currency and timezone, resolved the same way everywhere.
 *
 * Both are General settings, and both were dead fields: `formatCurrency` was
 * hard-coded to INR/en-IN and `formatDate` to en-IN in whatever timezone the
 * machine happened to run in. Switching either in the admin changed nothing on
 * any screen.
 *
 * Formatting is synchronous and happens in hundreds of places, so neither value
 * can be fetched at the point of use. The root layout reads the settings
 * document once per request and publishes the pair through `setActiveLocale`.
 *
 * It has to be published TWICE, because a Next app has two module graphs: the
 * RSC graph that renders server components, and the client graph that renders
 * client components — including on the server, during SSR. Each gets its own
 * copy of this module. The layout covers the RSC graph directly; `LocaleSync`
 * covers the client graph by setting the same values during its render, above
 * everything that formats. Miss the second and a shop on USD ships rupees in
 * its HTML and swaps them for dollars on hydration — a mismatch on every price.
 *
 * A module-level value is shared between concurrent requests. That is sound
 * here and only here: settings are a single document for the whole CMS, so
 * every request in flight resolves the same currency and timezone.
 */

/** Display locale per supported currency: grouping, symbol and placement. */
const CURRENCY_LOCALE: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

const DEFAULT_CURRENCY = defaultGeneralSettings.currency;
const DEFAULT_TIMEZONE = defaultGeneralSettings.timezone;

export interface ActiveLocale {
  currency: string;
  locale: string;
  timezone: string;
}

/** The locale that renders a given currency the way its users expect. */
export function localeForCurrency(currency: string): string {
  return CURRENCY_LOCALE[currency] ?? CURRENCY_LOCALE.INR;
}

/**
 * A currency code `Intl` will accept, or undefined.
 *
 * `Object.hasOwn`, not `in`: `in` walks the prototype chain, so `"toString"`
 * and `"constructor"` would both answer true and be handed straight to
 * `Intl.NumberFormat`, which is the RangeError this exists to prevent.
 *
 * Exported because the explicit-currency path needs the same filter the
 * ambient one gets — see `formatCurrency`.
 */
export function usableCurrencyCode(currency?: string): string | undefined {
  if (!currency) return undefined;
  return Object.hasOwn(CURRENCY_LOCALE, currency) ? currency : undefined;
}

/**
 * Neither value may reach `Intl` unchecked.
 *
 * `Intl.NumberFormat` throws a RangeError on a currency code it does not know,
 * and `Intl.DateTimeFormat` on an unknown timezone — from inside a render, that
 * is every page in the app down. The Zod enum on the settings section only
 * constrains FUTURE writes, and the Mongoose model stores both as a bare
 * `String`, so a document written before that enum existed can still hold "Rs".
 * Guarding at the point of use means no caller can take the site out.
 */
function resolve(currency: string, timezone: string): ActiveLocale {
  const safeCurrency = usableCurrencyCode(currency) ?? DEFAULT_CURRENCY;
  return {
    currency: safeCurrency,
    timezone: isUsableTimezone(timezone) ? timezone : DEFAULT_TIMEZONE,
    locale: localeForCurrency(safeCurrency),
  };
}

function isUsableTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export const FALLBACK_LOCALE = resolve(
  defaultGeneralSettings.currency,
  defaultGeneralSettings.timezone,
);

let active: ActiveLocale = FALLBACK_LOCALE;

export function setActiveLocale(currency: string, timezone: string): void {
  active = resolve(currency || DEFAULT_CURRENCY, timezone || DEFAULT_TIMEZONE);
}

/** Rupees are conventionally shown whole; the others carry minor units. */
export function fractionDigits(currency: string): number {
  return currency === "INR" ? 0 : 2;
}

export function getActiveLocale(): ActiveLocale {
  return active;
}
