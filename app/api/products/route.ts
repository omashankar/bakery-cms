import { NextResponse } from "next/server";

import { createProduct, getProducts } from "@/features/products/data/products-service";
import type { ProductFormData } from "@/types/product";

/**
 * Product collection endpoint.
 *
 * The admin panel is a client app, so it reads and writes through here rather
 * than touching the store directly. The storefront renders on the server and
 * calls the service directly — no HTTP hop needed.
 */

export async function GET() {
  try {
    return NextResponse.json({ products: await getProducts() });
  } catch {
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: ProductFormData;
  try {
    body = (await request.json()) as ProductFormData;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.name?.trim() || !body?.slug?.trim()) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }

  try {
    const existing = await getProducts();
    if (existing.some((product) => product.slug === body.slug)) {
      return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });
    }

    return NextResponse.json({ product: await createProduct(body) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
