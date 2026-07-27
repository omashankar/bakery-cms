import { z } from "zod";

/** Zod contract for saving admin-managed customer metadata. */
export const customerMetaSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("A valid email is required")),
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().default(""),
  marketingOptIn: z.boolean().default(true),
  blocked: z.boolean().optional().default(false),
});

export type CustomerMetaInput = z.infer<typeof customerMetaSchema>;
