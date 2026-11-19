import { getStorefrontHome } from "@/apps/website/lib/storefront-home.server";
import { withErrorHandler } from "@/lib/server/http/errors";
import { ok } from "@/lib/server/http/response";

/**
 * The shop's PUBLISHED homepage as data, for the phone app.
 *
 * Public on purpose, and safe to be: it serves exactly what /store already
 * shows any visitor — the published snapshot, never the draft, with nothing of
 * the builder (schedule, revisions, version) in it. The builder's own
 * /api/homepage-sections stays admin-only, because that one returns drafts.
 *
 * No cache header: the countdown band is answered for the moment of the
 * request, and the shop's other public reads (/api/catalog) set none either.
 */
export const GET = withErrorHandler(async () => ok(await getStorefrontHome(), "Storefront home"));
