import { connectDB } from "@/lib/server/db/mongoose";
import {
  CustomerAccountModel,
  type CustomerAccountDoc,
} from "@/lib/server/db/models/customer-account.model";
import { CustomerLoginCodeModel } from "@/lib/server/db/models/customer-login-code.model";

/** Every read and write here takes an already-normalised email. See the service. */

export async function findAccountByEmail(email: string) {
  await connectDB();
  return CustomerAccountModel.findOne({ email });
}

export async function createAccount(input: {
  email: string;
  name: string;
  phone: string;
}): Promise<{ id: string; email: string; name: string; phone: string }> {
  await connectDB();
  const doc = await CustomerAccountModel.create({
    ...input,
    emailVerifiedAt: new Date(),
    lastLoginAt: new Date(),
  });
  // `applyBaseTransform` renames `_id` to `id` on the way out; the inferred doc
  // type does not know that, so the shape is stated rather than asserted.
  const json = doc.toJSON() as unknown as CustomerAccountDoc & { id: string };
  return { id: String(json.id), email: json.email, name: json.name, phone: json.phone };
}

export async function markSignedIn(id: string): Promise<void> {
  await connectDB();
  await CustomerAccountModel.updateOne(
    { _id: id },
    { $set: { lastLoginAt: new Date(), emailVerifiedAt: new Date() } },
  );
}

export async function updateProfile(
  id: string,
  patch: { name?: string; phone?: string },
): Promise<void> {
  await connectDB();
  const set: Record<string, string> = {};
  if (typeof patch.name === "string") set.name = patch.name;
  if (typeof patch.phone === "string") set.phone = patch.phone;
  if (Object.keys(set).length === 0) return;
  await CustomerAccountModel.updateOne({ _id: id }, { $set: set });
}

/**
 * One live code per address.
 *
 * Requesting a new one invalidates the old, so "how many codes are valid right
 * now" is always 0 or 1. Without this, every request would widen the guessing
 * surface instead of replacing it, and the attempt counter on a single row
 * would stop meaning anything.
 */
export async function replaceLoginCode(input: {
  email: string;
  codeHash: string;
  expiresAt: Date;
  ip: string;
}): Promise<void> {
  await connectDB();
  await CustomerLoginCodeModel.deleteMany({ email: input.email });
  await CustomerLoginCodeModel.create(input);
}

export async function findLoginCode(email: string) {
  await connectDB();
  return CustomerLoginCodeModel.findOne({ email });
}

export async function countWrongGuess(id: string): Promise<number> {
  await connectDB();
  const updated = await CustomerLoginCodeModel.findOneAndUpdate(
    { _id: id },
    { $inc: { attempts: 1 } },
    { new: true },
  );
  return updated?.attempts ?? 0;
}

export async function consumeLoginCode(email: string): Promise<void> {
  await connectDB();
  await CustomerLoginCodeModel.deleteMany({ email });
}
