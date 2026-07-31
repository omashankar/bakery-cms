import {
  fractionDigits,
  getActiveLocale,
  localeForCurrency,
} from "@/features/settings/lib/active-locale";

/**
 * Format currency for display, in the currency chosen in General settings.
 *
 * The currency used to be hard-coded to INR here, which made the admin's
 * currency picker decorative — a shop set to USD still priced everything in
 * rupees. Callers may still pass an explicit currency (the server does, where
 * there is no `<html>` to read it from); the locale then follows that currency,
 * so an explicit EUR is grouped and placed the way EUR is written.
 */
export function formatCurrency(
  amount: number,
  currency?: string,
  locale?: string
): string {
  const resolved = currency ?? getActiveLocale().currency;
  const digits = fractionDigits(resolved);

  return new Intl.NumberFormat(locale ?? localeForCurrency(resolved), {
    style: "currency",
    currency: resolved,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

/**
 * Format a date string for display, in the timezone chosen in General settings.
 *
 * Without an explicit `timeZone` this rendered in whatever zone the machine ran
 * in — the server's, for anything server-rendered — so a 9pm order could show
 * as the previous day to an admin in Kolkata.
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  }
): string {
  const { locale, timezone } = getActiveLocale();
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, ...options }).format(
    new Date(date)
  );
}

/**
 * Format relative time (e.g. "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

/**
 * Get initials from a name string
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
