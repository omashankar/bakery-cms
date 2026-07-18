import fs from "node:fs/promises";
import path from "node:path";

/**
 * Server-side JSON store.
 *
 * This is the seam the real database will replace. Callers already await, so
 * swapping a store's backing implementation does not change a single call site.
 *
 * Data lives on the SERVER, shared by every visitor and admin — unlike the
 * localStorage repositories, where each browser held its own private copy and
 * the server could not see any of it.
 */

const DATA_DIR = path.join(process.cwd(), ".data");

let tmpCounter = 0;

function isTransientRenameError(error: unknown): boolean {
  // Windows raises EPERM/EBUSY when the destination is momentarily open by
  // another handle (a concurrent reader, an indexer, or antivirus).
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === "EPERM" || code === "EACCES" || code === "EBUSY";
}

export interface JsonStore<T> {
  /** Read current contents, seeding on first use. Does not take the lock. */
  read(): Promise<T>;
  /** Replace contents wholesale, serialised against other writers. */
  write(value: T): Promise<void>;
  /**
   * Read → transform → write under a single lock.
   *
   * Every mutation must go through here. Doing the read and the write as
   * separate awaited steps looks fine but loses updates: two concurrent
   * mutations both read the same value, then each writes its own copy and the
   * second silently discards the first. Synchronous localStorage could never do
   * that; async can, so the whole cycle has to hold the lock.
   */
  mutate<R>(mutator: (current: T) => { next: T; result: R }): Promise<R>;
  /** Test helper: drop the file so the next read re-seeds. */
  reset(): Promise<void>;
}

export function createJsonStore<T>(options: {
  /** File name under .data/ — e.g. "products.json". */
  file: string;
  /** Produces the initial contents when no file exists yet. */
  seed: () => T;
  /** Optional upgrade/repair applied to whatever was read from disk. */
  normalize?: (value: T) => T;
  /** Returns false for contents that should be discarded and re-seeded. */
  isValid?: (value: T) => boolean;
}): JsonStore<T> {
  const filePath = path.join(DATA_DIR, options.file);
  let queue: Promise<unknown> = Promise.resolve();

  async function commit(tmp: string, attempt = 0): Promise<void> {
    try {
      await fs.rename(tmp, filePath);
    } catch (error) {
      if (isTransientRenameError(error) && attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
        return commit(tmp, attempt + 1);
      }
      // Rename is not going to succeed — write in place so the save is not
      // lost, then clean up the temp file.
      const contents = await fs.readFile(tmp, "utf8");
      await fs.writeFile(filePath, contents, "utf8");
      await fs.rm(tmp, { force: true });
    }
  }

  async function writeToDisk(value: T): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // Unique temp name: two writes racing through the fallback path above would
    // otherwise clobber each other's temp file.
    const tmp = `${filePath}.${process.pid}.${tmpCounter++}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
    await commit(tmp);
  }

  async function readRaw(): Promise<T | null> {
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as T;
      if (options.isValid && !options.isValid(parsed)) return null;
      return options.normalize ? options.normalize(parsed) : parsed;
    } catch {
      // Missing or corrupt — fall back to the seed rather than throwing.
      return null;
    }
  }

  /** Safe to call from inside a mutation, which already holds the lock. */
  async function readUnlocked(): Promise<T> {
    const stored = await readRaw();
    if (stored !== null) return stored;

    const seeded = options.seed();
    await writeToDisk(seeded);
    return seeded;
  }

  return {
    read: readUnlocked,

    async write(value) {
      const run = queue.then(() => writeToDisk(value));
      queue = run.catch(() => undefined);
      return run;
    },

    async mutate(mutator) {
      const run = queue.then(async () => {
        const current = await readUnlocked();
        const { next, result } = mutator(current);
        await writeToDisk(next);
        return result;
      });
      queue = run.catch(() => undefined);
      return run;
    },

    async reset() {
      // Wait for in-flight writes so a late one cannot resurrect the file.
      await queue.catch(() => undefined);
      await fs.rm(filePath, { force: true });
    },
  };
}
