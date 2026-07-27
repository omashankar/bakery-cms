import { z } from "zod";

/** Public subscribe. The storefront builds the record and dual-writes it. */
export const subscribeSchema = z.object({
  id: z.string().min(1).optional(),
  email: z.string().email(),
  source: z.string().optional(),
  isActive: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/** Admin patch — activate/deactivate or relabel the source. */
export const updateSubscriberSchema = z
  .object({
    isActive: z.boolean().optional(),
    source: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update" });

export const deleteSubscribersSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type UpdateSubscriberInput = z.infer<typeof updateSubscriberSchema>;
