import mongoose, { type Model } from "mongoose";

import { connectDB } from "./mongoose";
import type { JsonStore } from "@/lib/server/json-store";

/**
 * MongoDB-backed drop-in replacement for `createJsonStore`.
 *
 * Each "store" holds one value T (an array like pages, or a singleton object
 * like the homepage builder state) as a single document keyed by `key`, in the
 * shared `cms_stores` collection. It exposes the SAME interface as the old JSON
 * file store — read / write / mutate / reset — so a `.server.ts` file migrates
 * by swapping `createJsonStore` for `createMongoStore` and `file` for `key`.
 *
 * `mutate` serialises through a per-store in-process queue (as the JSON store
 * did) so concurrent read-modify-writes in one process cannot lose each other.
 */

interface CmsStoreShape {
  _id: string;
  data: unknown;
  /** Bumped by every versioned write — see `writeVersioned`. */
  version?: number;
}

const cmsStoreSchema = new mongoose.Schema(
  {
    _id: { type: String },
    data: { type: mongoose.Schema.Types.Mixed },
    version: { type: Number },
  },
  { minimize: false, versionKey: false },
);

/**
 * A write composed against a state that has since moved on.
 *
 * The admin content stores are replace-all: a save sends the WHOLE list. With
 * nothing to compare against, a second tab — or the same tab left open — sends
 * its older list and silently reverts everything done in between, while both
 * report success.
 */
export class StoreConflictError extends Error {
  readonly currentVersion: number;

  constructor(currentVersion: number) {
    super("This was changed somewhere else after you loaded it.");
    this.name = "StoreConflictError";
    this.currentVersion = currentVersion;
  }
}

const CmsStoreModel: Model<CmsStoreShape> =
  (mongoose.models.CmsStore as Model<CmsStoreShape>) ||
  mongoose.model<CmsStoreShape>("CmsStore", cmsStoreSchema);

/**
 * A cms-store, plus the two operations that make a replace-all write safe.
 *
 * Kept off JsonStore because the file-backed store has no version column and
 * nothing needs one there — only the shared admin collections do.
 */
export interface VersionedStore<T> extends JsonStore<T> {
  readVersioned(): Promise<{ value: T; version: number }>;
  writeVersioned(value: T, expectedVersion?: number): Promise<{ value: T; version: number }>;
}

export function createMongoStore<T>(options: {
  /** Unique key for this store, e.g. "pages" (was the JSON file name). */
  key: string;
  seed: () => T;
  normalize?: (value: T) => T;
  isValid?: (value: T) => boolean;
}): VersionedStore<T> {
  const { key } = options;
  let queue: Promise<unknown> = Promise.resolve();

  async function writeToDb(value: T): Promise<void> {
    await connectDB();
    await CmsStoreModel.updateOne({ _id: key }, { $set: { data: value } }, { upsert: true });
  }

  async function readRaw(): Promise<T | null> {
    await connectDB();
    const doc = await CmsStoreModel.findById(key).lean();
    if (!doc) return null;
    const value = doc.data as T;
    if (options.isValid && !options.isValid(value)) return null;
    return options.normalize ? options.normalize(value) : value;
  }

  async function readUnlocked(): Promise<T> {
    const stored = await readRaw();
    if (stored !== null) return stored;
    const seeded = options.seed();
    await writeToDb(seeded);
    return seeded;
  }

  /** The stored value together with the version it is at (0 before any versioned write). */
  async function readVersionedUnlocked(): Promise<{ value: T; version: number }> {
    await connectDB();
    const doc = await CmsStoreModel.findById(key).lean();
    const raw = doc ? (doc.data as T) : null;
    const usable = raw !== null && (!options.isValid || options.isValid(raw));

    if (!usable) {
      const seeded = options.seed();
      await writeToDb(seeded);
      return { value: seeded, version: 0 };
    }

    return {
      value: options.normalize ? options.normalize(raw as T) : (raw as T),
      version: (doc as { version?: number } | null)?.version ?? 0,
    };
  }

  return {
    read: readUnlocked,

    readVersioned() {
      const run = queue.then(readVersionedUnlocked);
      queue = run.catch(() => undefined);
      return run;
    },

    /**
     * Replace the value, refusing if the version moved since the caller read it.
     *
     * `expectedVersion` is optional so a caller with nothing to compare is not
     * forced to invent one; passing it is what makes a replace-all safe.
     */
    writeVersioned(value, expectedVersion) {
      const run = queue.then(async () => {
        const current = await readVersionedUnlocked();
        if (expectedVersion !== undefined && current.version !== expectedVersion) {
          throw new StoreConflictError(current.version);
        }
        const version = current.version + 1;
        await connectDB();
        await CmsStoreModel.updateOne(
          { _id: key },
          { $set: { data: value, version } },
          { upsert: true },
        );
        return { value, version };
      });
      queue = run.catch(() => undefined);
      return run;
    },

    async write(value) {
      const run = queue.then(() => writeToDb(value));
      queue = run.catch(() => undefined);
      return run;
    },

    async mutate(mutator) {
      const run = queue.then(async () => {
        const current = await readUnlocked();
        const { next, result } = mutator(current);
        await writeToDb(next);
        return result;
      });
      queue = run.catch(() => undefined);
      return run;
    },

    async reset() {
      await queue.catch(() => undefined);
      await connectDB();
      await CmsStoreModel.deleteOne({ _id: key });
    },
  };
}

/**
 * Has this collection ever been seeded with demo data?
 *
 * A repository that seeds "when the collection is empty" cannot tell a brand new
 * shop from one that deliberately deleted everything — so emptying it resurrects
 * the demo rows on the next read, and for delivery zones those demo rows go on
 * to PRICE live checkouts. The marker is what separates "never set up" from
 * "set up, and the answer is none".
 *
 * Kept in the same key/value collection as the other CMS stores rather than as a
 * flag on the data itself, so an empty list stays an empty list.
 */
export async function hasSeeded(key: string): Promise<boolean> {
  await connectDB();
  return (await CmsStoreModel.exists({ _id: `seeded:${key}` })) !== null;
}

export async function markSeeded(key: string): Promise<void> {
  await connectDB();
  await CmsStoreModel.updateOne(
    { _id: `seeded:${key}` },
    { $set: { data: { at: new Date().toISOString() } } },
    { upsert: true },
  );
}
