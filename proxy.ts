import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isKnownStorePath, STORE_NOT_FOUND_PATH } from "@/lib/store-routes";

/**
 * Route protection (Next.js 16 renamed Middleware -> Proxy; same behaviour).
 *
 * This is an OPTIMISTIC gate only — it checks for the presence of the refresh
 * cookie to redirect obviously-unauthenticated visitors away from /admin, and
 * signed-in visitors away from the auth pages. It intentionally does NO database
 * work and does NOT fully verify the token (per Next.js guidance, proxy runs on
 * every request incl. prefetches). The real, secure check happens in the DAL
 * (`requireSession`) inside route handlers and server components.
 */

const REFRESH_COOKIE = "refresh_token";
const AUTH_PAGES = ["/login", "/forgot-password", "/otp", "/reset-password"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  const isAdminRoute = pathname.startsWith("/admin");
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Unauthenticated visitor hitting an admin route → send to login (remember where).
  if (isAdminRoute && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Already-signed-in visitor hitting an auth page → send to the dashboard.
  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  // A /store URL no page answers → the shop's not-found screen with a REAL
  // 404 (under /store the status is already 200 by the time a page could say
  // so). A table lookup, no database — see `lib/store-routes.ts`.
  if (pathname.startsWith("/store/") && !isKnownStorePath(pathname)) {
    return NextResponse.rewrite(new URL(STORE_NOT_FOUND_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
