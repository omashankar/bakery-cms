import type { BaseEntity } from "./common";

export type TemplateCategory = "transactional" | "marketing" | "utility" | "system";

export type TemplateStatus = "draft" | "active";

export interface CommunicationTemplateBase extends BaseEntity {
  slug: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  body: string;
  status: TemplateStatus;
  variables: string[];
}

export interface EmailTemplateRecord extends CommunicationTemplateBase {
  subject: string;
  previewText?: string;
}

export type WhatsAppTemplateRecord = CommunicationTemplateBase;

export type EmailTemplateFormData = Omit<
  EmailTemplateRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type WhatsAppTemplateFormData = Omit<
  WhatsAppTemplateRecord,
  "id" | "createdAt" | "updatedAt"
>;
