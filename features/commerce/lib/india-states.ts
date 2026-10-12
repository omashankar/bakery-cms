/**
 * India's states and union territories, and which one a PIN code is in.
 *
 * A state-wide delivery zone has to know the state of an address, and the
 * checkout's State box is free text — "Rajasthan", "rajasthan", "RJ" and
 * "Rajastan" are one state to a person and four to a string compare. The PIN
 * code is the part of the address that is reliable, and the PRODUCT PAGE's
 * delivery check has nothing else to go on; deciding the state from it means
 * that check and the checkout always give the same answer.
 *
 * WHAT THIS IS NOT: a PIN directory. India Post assigns the first three digits
 * (the sorting district) by postal circle, which follows state lines almost
 * everywhere. Where one three-digit block straddles a border — Saharanpur and
 * Roorkee share 247, Mohali and Chandigarh share 160 — the block is listed
 * under the state most of it is in. A shop that delivers right up to such a
 * border fixes it the way it fixes anything else: a zone of exact PIN codes
 * (which always outranks a state-wide one) or the zone's "leave out" list.
 */

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/**
 * First-three-digit ranges, inclusive. Checked in order, so a narrower block
 * listed before a wider one wins (Goa's 403 inside Maharashtra's 400–445).
 */
const PIN_RANGES: ReadonlyArray<readonly [number, number, IndianState]> = [
  // Exceptions first: blocks that sit inside another state's range.
  [160, 160, "Chandigarh"],
  [194, 194, "Ladakh"],
  [246, 246, "Uttarakhand"],
  [248, 249, "Uttarakhand"],
  [262, 263, "Uttarakhand"],
  [403, 403, "Goa"],
  [737, 737, "Sikkim"],
  [744, 744, "Andaman and Nicobar Islands"],
  [814, 816, "Jharkhand"],
  [822, 822, "Jharkhand"],
  [825, 835, "Jharkhand"],

  [110, 110, "Delhi"],
  [121, 136, "Haryana"],
  [140, 159, "Punjab"],
  [161, 169, "Punjab"],
  [171, 177, "Himachal Pradesh"],
  [180, 193, "Jammu and Kashmir"],
  [201, 285, "Uttar Pradesh"],
  [301, 345, "Rajasthan"],
  [360, 396, "Gujarat"],
  [400, 445, "Maharashtra"],
  [450, 488, "Madhya Pradesh"],
  [490, 497, "Chhattisgarh"],
  [500, 509, "Telangana"],
  [515, 535, "Andhra Pradesh"],
  [560, 591, "Karnataka"],
  [600, 643, "Tamil Nadu"],
  [670, 695, "Kerala"],
  [700, 743, "West Bengal"],
  [751, 770, "Odisha"],
  [781, 788, "Assam"],
  [790, 792, "Arunachal Pradesh"],
  [793, 794, "Meghalaya"],
  [795, 795, "Manipur"],
  [796, 796, "Mizoram"],
  [797, 798, "Nagaland"],
  [799, 799, "Tripura"],
  [800, 855, "Bihar"],
];

/**
 * Places smaller than a three-digit block, checked before the ranges: union
 * territories and pockets that sit inside a neighbouring state's block.
 */
const PREFIX_EXCEPTIONS: ReadonlyArray<readonly [string, IndianState]> = [
  ["68255", "Lakshadweep"],
  ["6050", "Puducherry"],
  ["6051", "Puducherry"],
  ["6096", "Puducherry"], // Karaikal
  ["533464", "Puducherry"], // Yanam
  ["673310", "Puducherry"], // Mahe
  ["39621", "Dadra and Nagar Haveli and Daman and Diu"], // Daman
  ["39623", "Dadra and Nagar Haveli and Daman and Diu"], // Silvassa
  ["36252", "Dadra and Nagar Haveli and Daman and Diu"], // Diu
  ["24471", "Uttarakhand"], // Udham Singh Nagar
];

/** The state a PIN code is in, or null when it is not a usable Indian PIN. */
export function stateForPincode(pincode: string): IndianState | null {
  const digits = pincode.replace(/\D/g, "");
  if (digits.length < 3) return null;
  for (const [prefix, state] of PREFIX_EXCEPTIONS) {
    if (digits.startsWith(prefix)) return state;
  }
  const block = Number(digits.slice(0, 3));
  for (const [from, to, state] of PIN_RANGES) {
    if (block >= from && block <= to) return state;
  }
  return null;
}

/** Names a person might type for a state, beyond its own name. */
const ALIASES: Record<string, IndianState> = {
  "new delhi": "Delhi",
  "nct of delhi": "Delhi",
  "orissa": "Odisha",
  "pondicherry": "Puducherry",
  "j&k": "Jammu and Kashmir",
  "jammu & kashmir": "Jammu and Kashmir",
  "andaman & nicobar": "Andaman and Nicobar Islands",
  "andaman and nicobar": "Andaman and Nicobar Islands",
  "uttaranchal": "Uttarakhand",
  "up": "Uttar Pradesh",
  "mp": "Madhya Pradesh",
  "tn": "Tamil Nadu",
  "wb": "West Bengal",
  "ap": "Andhra Pradesh",
  "rj": "Rajasthan",
  "gj": "Gujarat",
  "mh": "Maharashtra",
  "ka": "Karnataka",
  "dl": "Delhi",
};

const fold = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

/** A typed state name as one of `INDIAN_STATES`, or null. */
export function matchStateName(text: string): IndianState | null {
  const key = fold(text);
  if (!key) return null;
  const exact = INDIAN_STATES.find((state) => fold(state) === key);
  return exact ?? ALIASES[key] ?? null;
}
