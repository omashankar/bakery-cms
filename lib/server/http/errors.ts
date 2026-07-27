import { fail, type FieldError } from "./response";

/**
 * Typed application errors. Services and repositories throw these; the
 * controller's `withErrorHandler` maps them to the right HTTP status + envelope.
 * This keeps status codes out of business logic and responses consistent.
 */
export class AppError extends Error {
  readonly status: number;
  readonly errors: FieldError[] | null;

  constructor(message: string, status = 500, errors: FieldError[] | null = null) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.errors = errors;
  }
}

export class ValidationError extends AppError {
  constructor(errors: FieldError[], message = "Validation failed") {
    super(message, 422, errors);
  }
}

export class AuthError extends AppError {
  constructor(message = "Not authenticated") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do this") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Already exists") {
    super(message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many attempts. Please try again later.") {
    super(message, 429);
  }
}

/**
 * Wraps a controller handler so any thrown error becomes a consistent response.
 * Known AppErrors keep their status/message; anything else is a masked 500
 * (the raw error is logged server-side, never leaked to the client).
 */
export function withErrorHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AppError) {
        return fail(error.message, { status: error.status, errors: error.errors ?? undefined });
      }
      console.error("[api] Unhandled error:", error);
      return fail("Something went wrong. Please try again.", { status: 500 });
    }
  };
}
