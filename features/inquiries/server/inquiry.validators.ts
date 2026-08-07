import { z } from "zod";

const inquiryType = z.enum(["wedding", "contact", "newsletter"]);
const inquiryStatus = z.enum(["new", "in_progress", "replied", "closed"]);

/**
 * Public create (contact form). The storefront builds the full record locally
 * and dual-writes it, so id/status/timestamps are accepted verbatim when present
 * (keeps local + server copies in agreement); otherwise the service fills them.
 */
/**
 * Public create — the contact and wedding forms. Anonymous, so it decides
 * nothing about its own identity or its place in the admin's queue.
 *
 * `id`, `status`, `createdAt` and `updatedAt` were accepted here because the
 * storefront built the record locally and dual-wrote it. Every one of them was
 * a power this endpoint has no session to justify:
 *
 *   - `id` reached a repository that UPSERTS on it, and the ids are `inq-1`,
 *     `inq-7`, `inq-11`. So an anonymous POST carrying a guessed id rewrote that
 *     enquiry outright. Verified against a running shop: a real wedding enquiry
 *     from "Priya Sharma" came back as "Overwritten By A Stranger", with no
 *     cookie attached.
 *   - `status` let the same request set it to "closed", so the enquiry it
 *     replaced never appeared in the admin's queue at all.
 *   - `createdAt` is the queue's sort key.
 *
 * All four are minted server-side now. The response carries the created record,
 * which is where the caller gets the authoritative id.
 */
export const createInquirySchema = z.object({
  type: inquiryType,
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(1),
  eventDate: z.string().optional(),
  guestCount: z.number().int().nonnegative().optional(),
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
