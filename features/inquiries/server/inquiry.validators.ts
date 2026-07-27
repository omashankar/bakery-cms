import { z } from "zod";

const inquiryType = z.enum(["wedding", "contact", "newsletter"]);
const inquiryStatus = z.enum(["new", "in_progress", "replied", "closed"]);

/**
 * Public create (contact form). The storefront builds the full record locally
 * and dual-writes it, so id/status/timestamps are accepted verbatim when present
 * (keeps local + server copies in agreement); otherwise the service fills them.
 */
export const createInquirySchema = z.object({
  id: z.string().min(1).optional(),
  type: inquiryType,
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(1),
  status: inquiryStatus.optional(),
  eventDate: z.string().optional(),
  guestCount: z.number().int().nonnegative().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/** Admin patch — status/notes and the editable metadata fields. */
export const updateInquirySchema = z
  .object({
    status: inquiryStatus.optional(),
    notes: z.string().optional(),
    subject: z.string().optional(),
    eventDate: z.string().optional(),
    guestCount: z.number().int().nonnegative().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No fields to update",
  });

export const deleteInquiriesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
export type UpdateInquiryInput = z.infer<typeof updateInquirySchema>;
