import fs from "node:fs/promises";
import path from "node:path";

import {
  normalizeCommerceFields,
  seedProducts,
} from "@/features/products/lib/products-repository";
import type { Product } from "@/types/product";

/**
 * Server-side product store.
 *
 * This is the seam the real database will replace. Everything above it already
 * awaits, so swapping this file for a DB adapter is the whole migration — no
 * caller changes.
 *
 * Today it persists to a gitignored JSON file (same approach as the Razorpay
 * credential store). That is deliberately unglamorous: the point is that
 * product data now lives on the SERVER, shared by every visitor and admin,
 * instead of in one browser's localStorage where nobody else could see it.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_PATH = path.join(DATA_DIR, "products.json");

/** Serialises mutations so concurrent read-modify-write cycles cannot lose updates. */
let writeQueue: Promise<unknown> = Promise.resolve();
let tmpCounter = 0;

function isTransientRenameError(error: unknown): boolean {
  // Windows raises EPERM/EBUSY when the destination is momentarily open by
  // another handle (a concurrent reader, an indexer, or antivirus).
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === "EPERM" || code === "EACCES" || code === "EBUSY";
}

async function commit(tmp: string, attempt = 0): Promise<void> {
  try {
    await fs.rename(tmp, DATA_PATH);
  } catch (error) {
    if (isTransientRenameError(error) && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
      return commit(tmp, attempt + 1);
    }
    // Rename is not going to succeed — write in place so the save is not lost,
    // then clean up the temp file.
    const contents = await fs.readFile(tmp, "utf8");
    await fs.writeFile(DATA_PATH, contents, "utf8");
    await fs.rm(tmp, { force: true });
  }
}

/** The actual disk write. Callers are responsible for holding the queue. */
async function writeToDisk(products: Product[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Unique temp name: two writes racing through the fallback path above would
  // otherwise clobber each other's temp file.
  const tmp = `${DATA_PATH}.${process.pid}.${tmpCounter++}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(products, null, 2), "utf8");
  await commit(tmp);
}

async function readRaw(): Promise<Product[] | null> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as Product[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map(normalizeCommerceFields);
  } catch {
    // Missing or corrupt — fall back to the seed rather than throwing.
    return null;
  }
}

/**
 * Read without taking the queue.
 *
 * Safe to call from inside a mutation (which already holds it); taking the
 * queue again there would deadlock.
 */
async function readProductsUnlocked(): Promise<Product[]> {
  const stored = await readRaw();
  if (stored) return stored;

  const seeded = seedProducts();
  await writeToDisk(seeded);
  return seeded;
}

/** Reads do not need the lock — a file read is atomic enough for our purposes. */
export async function readProducts(): Promise<Product[]> {
  return readProductsUnlocked();
}

/**
 * Read → transform → write, serialised end to end.
 *
 * Every mutation must go through here. Doing the read and the write as separate
 * awaited steps looks fine but loses updates: two concurrent creates both read
 * the same list, then each writes its own copy and the second silently discards
 * the first. Synchronous localStorage could never do that; async can, so the
 * whole cycle has to hold the lock.
 */
export async function mutateProducts<T>(
  mutator: (current: Product[]) => { next: Product[]; result: T }
): Promise<T> {
  const run = writeQueue.then(async () => {
    const current = await readProductsUnlocked();
    const { next, result } = mutator(current);
    await writeToDisk(next);
    return result;
  });

  writeQueue = run.catch(() => undefined);
  return run;
}

/** Test helper: drop the store so the next read re-seeds. */
export async function resetProductStore(): Promise<void> {
  // Wait for in-flight mutations so a late write cannot resurrect the file.
  await writeQueue.catch(() => undefined);
  await fs.rm(DATA_PATH, { force: true });
}
