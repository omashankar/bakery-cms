import mongoose from "mongoose";

/**
 * Cached Mongoose connection.
 *
 * Next.js dev hot-reloads modules and serverless spins up many isolated
 * invocations — both would open a new connection on every request without a
 * cache. We stash a single connection (and its in-flight promise) on the global
 * object so the whole process shares one pool.
 *
 * This is the server-side seam that replaced the old JSON/localStorage stores.
 */

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// eslint-disable-next-line no-var
declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache =
  global._mongooseCache ?? (global._mongooseCache = { conn: null, promise: null });

export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local.");
  }

  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      // Fail fast instead of buffering queries while disconnected — surfaces
      // config problems immediately rather than hanging the request.
      bufferCommands: false,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Reset so the next call retries instead of reusing a rejected promise.
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}
