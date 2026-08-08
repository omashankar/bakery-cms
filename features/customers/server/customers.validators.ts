import { z } from "zod";

/** Zod contract for saving admin-managed customer metadata. */
/**
 * A PATCH of one customer's metadata — only the fields being changed.
 *
 * Every field used to carry a `.default()`, so an absent one arrived as its
 * default and was `$set` anyway: sending `{ email, notes }` also wrote
 * `tags: []`, `marketingOptIn: true` and `blocked: false`. The client sent a
 * full snapshot built from its own cache, so two admins editing the same
 * customer — one adding a tag, one writing a note — each carried the other's
 * field at its old value and overwrote it. Both were toasted as saved.
 *
 * Optional means "not mentioned", and the repository only writes what it is
 * given. `email` stays required: it is the key, not a field.
 */
export const customerMetaSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email("A valid email is required")),
    tags: z.array(z.string().trim().min(1)).optional(),
    notes: z.string().optional(),
    marketingOptIn: z.boolean().optional(),
    blocked: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "email"),
    { message: "No fields to update" },
  );

export type CustomerMetaInput = z.infer<typeof customerMetaSchema>;
