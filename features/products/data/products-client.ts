import type { Product, ProductFormData } from "@/types/product";

/**
 * Browser-side product access for the admin panel.
 *
 * The admin is a client app, so it talks to the API rather than the store. The
 * storefront renders on the server and calls products-service directly.
 *
 * Errors are thrown with the server's message so callers can surface something
 * useful in a toast instead of a generic failure.
 */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }

  return payload as T;
}

export async function fetchProducts(): Promise<Product[]> {
  const { products } = await request<{ products: Product[] }>("/api/products");
  return products;
}

export async function fetchProduct(id: string): Promise<Product> {
  const { product } = await request<{ product: Product }>(`/api/products/${id}`);
  return product;
}

export async function createProductRequest(data: ProductFormData): Promise<Product> {
  const { product } = await request<{ product: Product }>("/api/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return product;
}

export async function updateProductRequest(
  id: string,
  data: ProductFormData
): Promise<Product> {
  const { product } = await request<{ product: Product }>(`/api/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return product;
}

export async function deleteProductRequest(id: string): Promise<void> {
  await request<{ ok: true }>(`/api/products/${id}`, { method: "DELETE" });
}
