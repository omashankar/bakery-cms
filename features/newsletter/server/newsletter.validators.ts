import { z } from "zod";

/**
 * Public subscribe.
 *
 * `id`, `createdAt` and `updatedAt` are the server's to set, and they were
 * accepted from the caller — the exact three fields the inquiry and review
 * submit schemas already strip. A chosen `createdAt` pins a spam row above
 * every real subscriber in a list sorted newest-first, and a chosen `id` that
 * collides surfaces as a 500 rather than a duplicate.
 */
export const subscribeSchema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
  isActive: z.boolean().optional(),
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
