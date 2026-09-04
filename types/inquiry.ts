import type { BaseEntity } from "./common";

export type InquiryStatus = "new" | "in_progress" | "replied" | "closed";
/**
 * `product` is a question asked FROM a product page.
 *
 * It shares this record with the contact and wedding forms deliberately: the
 * shop already has one queue, one admin screen and one set of notifications
 * for “somebody wants an answer”, and a second table for questions would mean
 * a second inbox to remember to read.
 */
export type InquiryType = "wedding" | "contact" | "newsletter" | "product";

export interface Inquiry extends BaseEntity {
  type: InquiryType;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: InquiryStatus;
  notes?: string;
  eventDate?: string;
  guestCount?: number;
  /** Which product was being looked at. Set only for a `product` question. */
  productSlug?: string;
  /**
   * The shop’s answer, and the only thing that makes a question PUBLIC.
   *
   * An unanswered question is somebody’s message in the shop’s inbox; putting
   * it on the product page would publish a stranger’s words, unreviewed, under
   * the shop’s name. Answering it is the moderation step.
   */
  answer?: string;
  answeredAt?: string;
}

export interface NewsletterSubscriber extends BaseEntity {
  email: string;
  isActive: boolean;
  source?: string;
}
