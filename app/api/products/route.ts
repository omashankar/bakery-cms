import { NextResponse } from "next/server";

import { createProduct, getProducts } from "@/features/products/data/products-service";
import { productFormSchema } from "@/features/products/server/product.validators";
import { requireProductAdmin } from "@/features/products/server/guard";
import { validate, readJson } from "@/lib/server/http/validate";
import { AppError } from "@/lib/server/http/errors";
import { writeAuditLog, requestContext } from "@/lib/server/audit/audit-log";
import type { ProductFormData } from "@/types/product";

/**
 * Product collection endpoint.
 *
 * The admin panel is a client app, so it reads and writes through here rather
 * than touching the store directly. The storefront renders on the server and
 * calls the service directly — no HTTP hop needed.
 *
 * Data now lives in MongoDB (via products-service → the store). Reads are open;
 * writes require an authenticated admin and pass server-side Zod validation.
 * The response shape stays `{ products }` / `{ product }` / `{ error }` so the
 * existing product client keeps working.
 */

export async function GET() {
  try {
    return NextResponse.json({ products: await getProducts() });
  } catch {
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireProductAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: ProductFormData;
  try {
    body = validate(productFormSchema, await readJson(request)) as ProductFormData;
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: error.status });
    }
    return NextResponse.json({ error: "Invalid product data" }, { status: 400 });
  }

  try {
    const existing = await getProducts();
    if (existing.some((product) => product.slug === body.slug)) {
      return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });
    }

    const product = await createProduct(body);
    await writeAuditLog({
      action: "product.create",
      actorId: auth.sub,
      actorEmail: auth.email,
      target: { type: "product", id: product.id },
      ...requestContext(request),
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
