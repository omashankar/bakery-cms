import * as repo from "@/features/products/server/product.repository";
import type { Product } from "@/types/product";

/**
 * Server-side product store — now backed by MongoDB (was a JSON file).
 *
 * The four exports keep their original signatures, so every caller
 * (products-service, the /api/products routes, storefront SSR) moves to the
 * database without a single change. `mutateProducts` still serialises through an
 * in-process queue so concurrent read-modify-writes cannot lose each other.
 */

let queue: Promise<unknown> = Promise.resolve();

export function readProducts(): Promise<Product[]> {
  return repo.listAll();
}

export function saveProducts(products: Product[]): Promise<void> {
  const run = queue.then(() => repo.replaceAll(products));
  queue = run.catch(() => undefined);
  return run;
}

export function mutateProducts<R>(
  mutator: (current: Product[]) => { next: Product[]; result: R },
): Promise<R> {
  const run = queue.then(async () => {
    const current = await repo.listAll();
    const { next, result } = mutator(current);
    await repo.replaceAll(next);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Test helper: drop every product so the next read re-seeds. */
export function resetProductStore(): Promise<void> {
  return repo.reset();
}
