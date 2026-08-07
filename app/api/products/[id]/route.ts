import { NextResponse } from "next/server";

import {
  deleteProduct,
  getProductById,
  updateProduct,
} from "@/features/products/data/products-service";
import { productFormSchema } from "@/features/products/server/product.validators";
import { slugExists } from "@/features/products/server/product.repository";
import { requireProductAdmin } from "@/features/products/server/guard";
import { validate, readJson } from "@/lib/server/http/validate";
import { AppError } from "@/lib/server/http/errors";
import { writeAuditLog, requestContext } from "@/lib/server/audit/audit-log";
import type { ProductFormData } from "@/types/product";

/** Next 16 delivers dynamic route params as a Promise — await before use. */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * One product. Unpublished ones are admin-only — see the note on the collection
 * GET; a per-id read was the same leak with a guessable address.
 *
 * An anonymous caller gets 404 rather than 403 for a draft, so the endpoint does
 * not confirm that an unreleased product exists.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (product.status !== "published") {
      const auth = await requireProductAdmin();
      if (auth instanceof NextResponse) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
    }
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireProductAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

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
    // Slug must stay unique across OTHER products.
    if (await slugExists(body.slug, id)) {
      return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });
    }

    const updated = await updateProduct(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    await writeAuditLog({
      action: "product.update",
      actorId: auth.sub,
      actorEmail: auth.email,
      target: { type: "product", id },
      ...requestContext(request),
    });
    return NextResponse.json({ product: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireProductAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const removed = await deleteProduct(id);
    if (!removed) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    await writeAuditLog({
      action: "product.delete",
      actorId: auth.sub,
      actorEmail: auth.email,
      target: { type: "product", id },
      ...requestContext(_request),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
