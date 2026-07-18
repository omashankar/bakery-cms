/** Testimonials admin feature module — Phase 15 */
export { TestimonialsAdminPage } from "./components/testimonials-admin-page";
export {
  loadTestimonials,
  getPublishedTestimonials,
  toLandingTestimonial,
  createTestimonial,
  updateTestimonial,
  deleteTestimonials,
} from "@/features/content/lib/testimonials-repository";
