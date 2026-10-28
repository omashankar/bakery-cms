import type { DeliveryLookup } from "@/features/commerce/lib/delivery-location";
import type { LatLng } from "@/types/delivery";

/**
 * A PLAIN YES OR NO FOR A PIN — even where the shop delivers by map area.
 *
 * The owner wants the product page's PIN box to answer as it always did
 * (2026-10-27: "pehle wala hi msg show hoga yes ya no"). A PIN alone cannot
 * say whether a drawn area holds a door, so the shop's server is asked about
 * the PIN itself: it puts every one of the PIN's post offices (India Post's
 * own locations) through the same zone rules checkout uses — see
 * features/commerce/server/pincode-answer.server.ts.
 *
 * This used to search OpenStreetMap for the PIN's area by NAME and ask about
 * the spot found — and "Borkhera, Kota" found a village of that name in
 * another tehsil (2026-10-28).
 *
 * An estimate, said as one by nothing more than checkout's map, which checks
 * the actual door before any order is priced. When the shop cannot be asked,
 * the answer is left as it was — "it depends on the exact address".
 */

interface PincodeReply {
  status: "eligible" | "outside" | "partly" | "unknown";
  charge?: number;
  minDeliveryDays?: number | null;
  priceMayVary?: boolean;
  /** One of the PIN's post offices that gets this answer — for pricing a cart, never a door. */
  at?: LatLng;
}

/** One question per PIN per visit: the cart's row and its PIN box ask about the same PIN at once. */
const asked = new Map<string, Promise<PincodeReply | null>>();

/** For tests: forget every answer. */
export function forgetPincodeAnswers(): void {
  asked.clear();
}

/** The shop's answer for a PIN, or null when it could not be asked. */
export function askAboutPincode(pincode: string): Promise<PincodeReply | null> {
  let answer = asked.get(pincode);
  if (!answer) {
    answer = fetchPincodeAnswer(pincode);
    asked.set(pincode, answer);
    // A failure is not remembered: the next look asks again.
    void answer.then((reply) => {
      if (!reply) asked.delete(pincode);
    });
  }
  return answer;
}

async function fetchPincodeAnswer(pincode: string): Promise<PincodeReply | null> {
  try {
    const res = await fetch("/api/checkout/delivery-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pincode }),
    });
    const body = (await res.json().catch(() => null)) as { data?: PincodeReply } | null;
    return res.ok && body?.data ? body.data : null;
  } catch {
    return null;
  }
}

export async function answerPinByArea(lookup: DeliveryLookup | null, pincode: string): Promise<DeliveryLookup | null> {
  // Only what a PIN could not answer alone: drawn areas, or a district whose drawn area may cost less.
  if (!lookup?.place || !(lookup.needsPin || lookup.priceMayVary)) return lookup;
  const reply = await askAboutPincode(pincode);
  if (!reply || reply.status === "unknown") return lookup;
  if (reply.status === "partly") return { ...lookup, served: true, needsPin: true, priceMayVary: false, charge: null, minDeliveryDays: null };
  if (reply.status === "outside") return { ...lookup, needsPin: false, priceMayVary: false, served: false, charge: null, minDeliveryDays: null };
  return {
    ...lookup,
    needsPin: false,
    served: true,
    zoneName: "",
    charge: typeof reply.charge === "number" ? reply.charge : null,
    minDeliveryDays: typeof reply.minDeliveryDays === "number" ? reply.minDeliveryDays : null,
    priceMayVary: Boolean(reply.priceMayVary),
  };
}
