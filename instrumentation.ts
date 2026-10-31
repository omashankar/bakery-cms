import type { Instrumentation } from "next";

/**
 * Every failure Next.js catches on the server — a page that threw while
 * rendering, a route handler or a server action — is recorded where the shop
 * can see it (Settings → Error log). API handlers that catch their own errors
 * record them in `withErrorHandler` instead; those never reach this hook.
 *
 * Node runtime only: the recorder writes to MongoDB.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("@/lib/server/errors/record-error");
  const err = error as { message?: unknown; stack?: unknown; digest?: unknown } | null;
  const userAgent = request.headers["user-agent"];
  await recordError({
    source: "server",
    kind: context.routeType === "render" ? "page" : context.routeType === "route" ? "api" : context.routeType,
    message: typeof err?.message === "string" ? err.message : String(error),
    stack: typeof err?.stack === "string" ? err.stack : "",
    path: request.path,
    method: request.method,
    route: context.routePath,
    digest: typeof err?.digest === "string" ? err.digest : "",
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
  });
};
