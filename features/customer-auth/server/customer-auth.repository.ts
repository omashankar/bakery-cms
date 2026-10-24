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
}): Promise<{ id: string; email: string; name: string; phone: string; avatarUrl: string }> {
  await connectDB();
  const doc = await CustomerAccountModel.create({
    ...input,
    emailVerifiedAt: new Date(),
    lastLoginAt: new Date(),
  });
  // `applyBaseTransform` renames `_id` to `id` on the way out; the inferred doc
  // type does not know that, so the shape is stated rather than asserted.
  const json = doc.toJSON() as unknown as CustomerAccountDoc & { id: string };
  return { id: String(json.id), email: json.email, name: json.name, phone: json.phone, avatarUrl: "" };
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

/** The account as the storefront may see it, read fresh — after a write, say. */
export async function findIdentity(
  id: string,
): Promise<{ id: string; email: string; name: string; phone: string; avatarUrl: string } | null> {
  await connectDB();
  const doc = (await CustomerAccountModel.findById(id, {
    email: 1,
    name: 1,
    phone: 1,
    avatarUrl: 1,
  }).lean()) as { email: string; name?: string; phone?: string; avatarUrl?: string } | null;
  if (!doc) return null;
  return {
    id,
    email: doc.email,
    name: doc.name ?? "",
    phone: doc.phone ?? "",
    avatarUrl: doc.avatarUrl ?? "",
  };
}

/**
 * Point the account at a new photo, or at none, and hand back the asset id of
 * the one it replaced so the caller can delete it from Cloudinary.
 */
export async function replaceAvatar(
  id: string,
  next: { url: string; publicId: string } | null,
): Promise<string> {
  await connectDB();
  const before = (await CustomerAccountModel.findOneAndUpdate(
    { _id: id },
    { $set: { avatarUrl: next?.url ?? "", avatarPublicId: next?.publicId ?? "" } },
    { projection: { avatarPublicId: 1 } },
  ).lean()) as { avatarPublicId?: string } | null;
  return before?.avatarPublicId ?? "";
}

/** The account's address book as stored, and when it was last written (null: never). */
export async function findAddresses(
  id: string,
): Promise<{ addresses: unknown[]; savedAt: Date | null }> {
  await connectDB();
  const doc = (await CustomerAccountModel.findById(id, {
    addresses: 1,
    addressesSavedAt: 1,
  }).lean()) as { addresses?: unknown[]; addressesSavedAt?: Date | null } | null;
  return {
    addresses: Array.isArray(doc?.addresses) ? doc.addresses : [],
    savedAt: doc?.addressesSavedAt ?? null,
  };
}

/** Replace the whole book in one write — the browser sends the list it shows. */
export async function replaceAddresses(id: string, addresses: unknown[]): Promise<void> {
  await connectDB();
  await CustomerAccountModel.updateOne(
    { _id: id },
    { $set: { addresses, addressesSavedAt: new Date() } },
  );
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
