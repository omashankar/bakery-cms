import mongoose from "mongoose";

/**
 * The shop's WhatsApp Business connection — server side, singleton.
 *
 * The access token here is a permanent Meta System User token with
 * `whatsapp_business_messaging`. It can send messages to any number that has
 * messaged the business, read the business account's templates, and it does not
 * expire — which is exactly why it is stored here and not, as the payment keys
 * once were, in the admin's browser.
 *
 * A single document (`_id: "default"`) rather than a collection: a shop has one
 * WhatsApp sender. Multi-tenant would key this the way `GatewayCredential` keys
 * by gateway id, and the shape below would not have to change.
 */
const whatsappConnectionSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "default" },
    /** Meta's id for the sending number. Not secret — identifies the account. */
    phoneNumberId: { type: String, default: "" },
    /** The WhatsApp Business Account id. Needed to list approved templates. */
    businessAccountId: { type: String, default: "" },
    /** SECRET. Never projected into a client-facing response. */
    accessToken: { type: String, default: "" },
    /**
     * Off means the templates are drafts and nothing is sent.
     *
     * Separate from "configured" on purpose: a shop mid-setup, or one pausing
     * messages for a week, must be able to stop sending without deleting the
     * token and re-entering it from Meta's dashboard afterwards.
     */
    enabled: { type: Boolean, default: false },
    updatedAt: { type: String },
  },
  { versionKey: false, _id: false },
);

export type WhatsAppConnectionDoc = mongoose.InferSchemaType<
  typeof whatsappConnectionSchema
> & { _id: string };

export const WhatsAppConnectionModel =
  (mongoose.models.WhatsAppConnection as mongoose.Model<WhatsAppConnectionDoc>) ||
  mongoose.model<WhatsAppConnectionDoc>("WhatsAppConnection", whatsappConnectionSchema);
