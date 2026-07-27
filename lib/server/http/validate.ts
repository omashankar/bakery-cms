import type { z } from "zod";

import { ValidationError } from "./errors";
import type { FieldError } from "./response";

/**
 * Parse unknown input against a Zod schema, or throw a ValidationError carrying
 * per-field messages (which the error handler renders into the envelope).
 * Every endpoint validates its input through here — never trust the client.
 */
export function validate<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors: FieldError[] = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "_",
      message: issue.message,
    }));
    throw new ValidationError(errors);
  }
  return result.data;
}

/** Safely read a JSON body; returns {} for empty/invalid bodies. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
