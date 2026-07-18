/** FAQ admin feature module — Phase 15 */
export { FaqAdminPage } from "./components/faq-admin-page";
export {
  loadFaqs,
  getPublishedFaqs,
  toLandingFaq,
  createFaq,
  updateFaq,
  deleteFaqs,
} from "@/features/content/lib/faq-repository";
export { faqCategoryOptions, formatFaqCategory } from "@/features/content/lib/faq-utils";
