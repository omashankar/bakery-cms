import type { BaseEntity } from "./common";

export type InquiryStatus = "new" | "in_progress" | "replied" | "closed";
export type InquiryType = "wedding" | "contact" | "newsletter";

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
}

export interface NewsletterSubscriber extends BaseEntity {
  email: string;
  isActive: boolean;
  source?: string;
}
