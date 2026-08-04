import type { BaseEntity } from "./common";
import type { WhatsAppMetaBinding } from "./whatsapp-provider";

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

/**
 * A WhatsApp template is two things at once.
 *
 * `body` is the copy an admin writes, previews, and reads on this screen. What
 * the customer actually receives is the wording META approved, under the name in
 * `metaName` — WhatsApp does not accept free text to a customer outside a
 * 24-hour support window. So the Meta half is not decoration: without it the
 * local copy is a document nobody can send.
 *
 * Optional because a shop with no provider connected still has a list of drafts,
 * and because every template that existed before this was added has none.
 */
export type WhatsAppTemplateRecord = CommunicationTemplateBase &
  Partial<WhatsAppMetaBinding>;

export type EmailTemplateFormData = Omit<
  EmailTemplateRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type WhatsAppTemplateFormData = Omit<
  WhatsAppTemplateRecord,
  "id" | "createdAt" | "updatedAt"
>;
