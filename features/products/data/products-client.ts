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
    // The server sends per-field detail in `errors` and the route sends a
    // summary in `error`. Only the summary was read, so a product rejected for
    // one bad field toasted a bare "Validation failed" and the admin had no way
    // to learn which field, or why.
    const detail = Array.isArray(payload?.errors)
      ? payload.errors
          .map((item: { path?: unknown; message?: unknown }) => {
            const path = Array.isArray(item?.path) ? item.path.join(".") : item?.path;
            return path ? `${path}: ${item?.message}` : String(item?.message ?? "");
          })
          .filter(Boolean)
          .join("; ")
      : "";

    throw new Error(detail || payload?.error || `Request failed (${response.status})`);
  }

  return payload as T;
}

/**
 * Publish or archive many products at once.
 *
 * Not `updateProductRequest` per row: that sends a full product body built from
 * the browser's list, so every field another admin changed since that list
 * loaded is written back to its old value. This changes the status and nothing
 * else.
 */
export async function setProductStatusRequest(
  ids: string[],
  status: Product["status"]
): Promise<number> {
  const { updated } = await request<{ updated: number }>("/api/products/status", {
    method: "POST",
    body: JSON.stringify({ ids, status }),
  });
  return updated;
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
