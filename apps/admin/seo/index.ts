/** SEO admin feature module — Phase 18 */
export { SeoAdminPage } from "./components/seo-admin-page";
export {
  loadSeoStore,
  getGlobalSeo,
  saveGlobalSeo,
  getSeoRoutes,
  getRouteSeo,
  updateSeoRoute,
  resetSeoStore,
} from "@/features/seo/lib/seo-repository";
export { buildRouteMetadata, buildCanonicalUrl, resolveRouteTitle } from "@/features/seo/lib/seo-metadata";
