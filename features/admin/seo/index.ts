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
} from "./lib/seo-repository";
export { buildRouteMetadata, buildCanonicalUrl, resolveRouteTitle } from "./lib/seo-metadata";
