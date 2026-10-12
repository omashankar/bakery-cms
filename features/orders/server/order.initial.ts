import "server-only";

import { getSettings } from "@/features/settings/server/settings.service";
import { FALLBACK_LOCALE } from "@/features/settings/lib/active-locale";
import { isValidTimeZone } from "@/features/orders/lib/viewer-time";
import type { ReportDateRange } from "@/features/orders/lib/order-analytics";

import { getCommerceOverviews, getOrderAnalytics } from "./order.analytics";
import { orderAnalyticsQuerySchema } from "./order.validators";

/**
 * The zone the admin's browser sends with its analytics requests
 * (`getActiveLocale().timezone`): the shop's General timezone, or the shipped
 * default when that is unusable. Not the API's own default — that is UTC, so a
 * server page reading with it would draw different days than the browser's
 * next refresh.
 */
async function shopTimeZone(): Promise<string> {
  const zone: unknown = (await getSettings()).general?.timezone;
  return typeof zone === "string" && isValidTimeZone(zone) ? zone : FALLBACK_LOCALE.timezone;
}

/** What `GET /api/orders/analytics?range=…` answers this admin's browser. */
export async function readOrderAnalytics(range: ReportDateRange) {
  const query = orderAnalyticsQuerySchema.parse({ range, timeZone: await shopTimeZone() });
  return getOrderAnalytics(query.range, query.timeZone);
}

/** What `GET /api/orders/overviews` answers this admin's browser. */
export async function readCommerceOverviews() {
  const query = orderAnalyticsQuerySchema.parse({ timeZone: await shopTimeZone() });
  return getCommerceOverviews(query.timeZone);
}
