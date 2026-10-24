import mongoose, { type Model, type Schema } from "mongoose";

/**
 * Every path a schema declares, subdocuments included, as one comparable
 * string. Names only: a path whose TYPE changed is not seen, which is rare
 * next to a path being added.
 */
function shapeOf(schema: Schema): string {
  return Object.keys(schema.paths)
    .sort()
    .map((path) => {
      const child = (schema.paths[path] as { schema?: Schema }).schema;
      return child ? `${path}{${shapeOf(child)}}` : path;
    })
    .join(",");
}

/**
 * THE MODEL FOR THIS SCHEMA — not whichever one the process compiled first.
 *
 * Every model used to end `mongoose.models.X || mongoose.model("X", schema)`.
 * `mongoose.models` lives on the mongoose singleton, which survives Next's hot
 * reload, so a `next dev` started before a path existed kept the model without
 * it for the life of the process: writes to the new path were dropped and the
 * route still answered 200. A customer's profile photo uploaded six times,
 * said "updated" six times, and was never saved.
 *
 * The cached model is reused only while its schema has the same paths as this
 * one; otherwise it is replaced. In production the module is evaluated once,
 * so there is never a cached model to compare with and this is exactly
 * `mongoose.model(name, schema)`.
 */
export function defineModel<T>(name: string, typedSchema: object): Model<T> {
  // `object`, not `Schema`: checking each model's fully inferred schema type
  // against `Schema` ran the type checker out of memory.
  const schema = typedSchema as Schema;
  const cached = mongoose.models[name];
  if (cached && shapeOf(cached.schema) === shapeOf(schema)) return cached as unknown as Model<T>;
  if (cached) mongoose.deleteModel(name);
  return mongoose.model(name, schema) as unknown as Model<T>;
}
