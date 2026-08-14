import { NextResponse } from "next/server";

/**
 * Standard API response envelope — EVERY new backend endpoint returns this shape
 * so clients can rely on one contract. Legacy routes (/api/products etc.) keep
 * their old shape until their module is migrated.
 */

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FieldError {
  field: string;
  message: string;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  pagination: Pagination | null;
  errors: FieldError[] | null;
  timestamp: string;
}

function envelope<T>(partial: Partial<Envelope<T>> & { success: boolean; message: string }): Envelope<T> {
  return {
    data: null,
    pagination: null,
    errors: null,
    // Note: real timestamp is stamped at response time in a route handler
    // (request-time), never at module load — safe here.
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

export function ok<T>(
  data: T,
  message = "Success",
  init?: { status?: number; pagination?: Pagination; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json(
    envelope<T>({ success: true, message, data, pagination: init?.pagination ?? null }),
    { status: init?.status ?? 200, headers: init?.headers },
  );
}

export function created<T>(data: T, message = "Created successfully"): NextResponse {
  return ok(data, message, { status: 201 });
}

export function fail(
  message: string,
  init?: { status?: number; errors?: FieldError[] },
): NextResponse {
  return NextResponse.json(
    envelope({ success: false, message, errors: init?.errors ?? null }),
    { status: init?.status ?? 400 },
  );
}
