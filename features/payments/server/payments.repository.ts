import { connectDB } from "@/lib/server/db/mongoose";
import { InvoiceSettingsModel } from "@/lib/server/db/models/invoice-settings.model";

/** Payments repository — the invoice settings singleton. */

const SINGLETON = "singleton";

export async function getOrCreateInvoiceSettings() {
  await connectDB();
  const existing = await InvoiceSettingsModel.findOne({ key: SINGLETON });
  if (existing) return existing;
  return InvoiceSettingsModel.create({ key: SINGLETON });
}

export async function updateInvoiceSettings(fields: Record<string, unknown>) {
  const doc = await getOrCreateInvoiceSettings();
  doc.set(fields);
  await doc.save();
  return doc;
}
