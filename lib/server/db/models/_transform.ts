import type { Schema } from "mongoose";

/**
 * Shared toJSON transform applied to every model.
 *
 * - `_id` -> `id` (string), drops `__v` — matches the frontend `BaseEntity` shape.
 * - Date fields serialise to ISO strings (frontend types use `string` dates).
 * - Strips any field named in `hidden` (e.g. passwordHash, tokenHash) so secrets
 *   never leak through a serialised document.
 */
export function applyBaseTransform(schema: Schema, hidden: string[] = []): void {
  schema.set("timestamps", true);
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform(_doc: unknown, ret: Record<string, unknown>) {
      ret.id = ret._id?.toString();
      delete ret._id;
      for (const field of hidden) delete ret[field];
      for (const key of Object.keys(ret)) {
        if (ret[key] instanceof Date) ret[key] = (ret[key] as Date).toISOString();
      }
      return ret;
    },
  });
}
