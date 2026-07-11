/** Cake management feature module — Phase 14 */
export { CakesListPage } from "./components/cakes-list-page";
export { CakeFormPage } from "./components/cake-form-page";
export { CakePreviewPage } from "./components/cake-preview-page";
export { CakeMediaPicker } from "./components/cake-media-picker";
export {
  loadCakes,
  getCakeById,
  getCakeBySlug,
  createCake,
  updateCake,
  deleteCake,
} from "./lib/cakes-repository";
export { mapAdminCakeToStorefront, getPublishedStorefrontCakes } from "./lib/cake-mapper";
