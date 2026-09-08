/**
 * Fill in the cards under the product photo, from what the shop already stores.
 *
 * Run:  node --env-file=.env.local scripts/set-product-trust-cards.mjs
 *       node --env-file=.env.local scripts/set-product-trust-cards.mjs --apply
 *
 * DRY RUN unless --apply is passed.
 *
 * The reference storefront shows three cards there, and two of its three are
 * claims this shop cannot make: "20M Happy Customers + 100% Satisfaction!" is
 * somebody else's number, and "Assured Quality" names a guarantee nobody has
 * described. Neither is written here.
 *
 * What is written is READ BACK OUT of the shop's own commerce settings, so each
 * card is true at the moment it is created:
 *
 *   payment methods -> "Secure payments / UPI, card or cash on delivery"
 *   freeDeliveryThreshold -> "Free delivery / On orders over ₹999"
 *
 * The third card is not written at all: the product page renders "Timely
 * Delivery" from `deliveryLeadDays` itself, so it says "Same-day delivery"
 * today and would say "Next-day delivery" the moment the shop changed its lead
 * time. A typed card cannot do that.
 *
 * WHICH IS THE CATCH WORTH KNOWING. These two ARE typed. If the shop later
 * raises the free-delivery threshold or turns off a payment method, the card
 * keeps saying what it said — the settings screen is where to correct it.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const settings = mongoose.connection.db.collection("settings");

const doc = await settings.findOne({});
if (!doc) throw new Error("no settings document");

const commerce = doc.commerce ?? {};
const methods = commerce.paymentMethods ?? {};

/** Only the methods this shop actually has switched on, in the order a customer meets them. */
const enabled = [
  methods.upi ? "UPI" : "",
  methods.card || methods.razorpay ? "card" : "",
  methods.cod ? "cash on delivery" : "",
].filter(Boolean);

const cards = [];

if (enabled.length > 0) {
  cards.push({
    id: "card-payments",
    icon: "CreditCard",
    title: "Secure payments",
    subtitle:
      enabled.length === 1
        ? enabled[0]
        : `${enabled.slice(0, -1).join(", ")} or ${enabled[enabled.length - 1]}`,
  });
}

const threshold = Number(commerce.freeDeliveryThreshold);
if (Number.isFinite(threshold) && threshold > 0) {
  cards.push({
    id: "card-free-delivery",
    icon: "Truck",
    title: "Free delivery",
    subtitle: `On orders over ₹${threshold}`,
  });
}

console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===");
console.log(`\nread from this shop's own settings:`);
console.log(`   paymentMethods         = ${JSON.stringify(methods)}`);
console.log(`   freeDeliveryThreshold  = ${commerce.freeDeliveryThreshold}`);
console.log(`   deliveryLeadDays       = ${commerce.deliveryLeadDays}  (the third card reads this)`);

console.log(`\ncards to write (${cards.length}):`);
for (const card of cards) {
  console.log(`   [${card.icon}]  ${card.title}  —  ${card.subtitle}`);
}
console.log(`   [Truck]  Timely Delivery  —  rendered from deliveryLeadDays, not stored`);

const existing = commerce.productTrustCards ?? [];
if (existing.length > 0) {
  console.log(`\nNOTE: ${existing.length} card(s) already stored — this replaces them:`);
  for (const card of existing) console.log(`   ${card.title}`);
}

if (APPLY) {
  const result = await settings.updateOne(
    { _id: doc._id },
    { $set: { "commerce.productTrustCards": cards, updatedAt: new Date().toISOString() } },
  );
  console.log(`\nmatched=${result.matchedCount} modified=${result.modifiedCount}`);
} else {
  console.log("\nnothing written");
}

await mongoose.disconnect();
