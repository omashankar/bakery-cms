/** Inquiry management feature module — Phase 14 */
export { InquiriesListPage } from "./components/inquiries-list-page";
export { NewsletterSubscribersPage } from "./components/newsletter-subscribers-page";
export {
  loadInquiries,
  getInquiryById,
  addInquiry,
  updateInquiry,
  deleteInquiries,
  countNewInquiries,
  getRecentInquiries,
  createInquiryFromForm,
} from "./lib/inquiries-repository";
export {
  loadNewsletterSubscribers,
  addNewsletterSubscriber,
  updateNewsletterSubscriber,
  deleteNewsletterSubscribers,
} from "./lib/newsletter-repository";
