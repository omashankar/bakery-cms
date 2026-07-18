/** Cake management feature module — Phase 14 */
export { ProductsListPage } from "./components/products-list-page";
export { ProductFormPage } from "./components/product-form-page";
export { ProductPreviewPage } from "./components/product-preview-page";
export { MediaPicker } from "./components/media-picker";
export {
  loadProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/features/products/lib/products-repository";
export { mapAdminProductToStorefront, getPublishedStorefrontProducts } from "@/features/products/lib/product-mapper";
