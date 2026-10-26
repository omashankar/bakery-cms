import "server-only";

import { matchStateName } from "@/features/commerce/lib/india-states";
import { listDistricts, lookUpPincode, placesInDistrict } from "./pincode-directory";

/**
 * DOES THE ADDRESS AGREE WITH ITS PIN?
 *
 * The zone is decided by the PIN alone, so an address in Kota with Sangod's
 * PIN was priced, accepted and sent to Sangod's zone (owner's test order,
 * 2026-10-26). The owner chose to REFUSE such an order, not to warn.
 *
 * Refused only on what India Post's list can prove, because a refusal here
 * stops a real customer:
 *
 * - the State box names a state the PIN is not in;
 * - the City box names a district that is in another state;
 * - the street lines name a post-office area of ANOTHER PIN in the same
 *   district, and none of this PIN's own areas. "Borkheda, Kota" at 325601 is
 *   refused: Borkheda is 324002. "Royal Sun City, Kota" is not — a colony
 *   India Post does not list proves nothing, and a district's name is no area.
 *
 * What is NOT read for areas, because it names some other PIN's town on a
 * perfectly good address: the City box (a village's tehsil town), the
 * landmark and any "near …" part ("near Kota Jn" is often the next PIN), and
 * any "Tehsil …" / "District …" / "Via …" part. Other districts' areas are not
 * searched: "Ram Nagar" is in hundreds of them. The directory keeps at most
 * five areas per PIN, towns first, so a village's own office may be missing —
 * which is why naming a foreign area is needed, not just missing an own one.
 * An unknown PIN is not judged; checkout lets it through, since the list can
 * miss a new one.
 */

export interface AddressToCheck {
  pincode?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
}

/** Words an area name can be, that an address uses for something else. */
const TOO_COMMON = new Set([
  "nagar",
  "colony",
  "mandi",
  "bazar",
  "bazaar",
  "market",
  "sadar",
  "station",
  "city",
  "town",
  "road",
  "chowk",
  "sector",
  "extension",
  "kalan",
  "khurd",
  "village",
  "tehsil",
  "cantt",
  "court",
]);

/** A part of the address that names somewhere else on purpose. */
const ELSEWHERE =
  /\b(near|nr|opp|opposite|behind|beside|paas|samne|tehsil|tahsil|teh|taluka|taluk|tq|mandal|block|district|dist|distt|zila|jila|via)\b/i;

/** Lower case, letters and digits only, one space between words. */
const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** A name worth matching: no initials ("P.I.P."), not a bare common word. */
function matchable(area: string): string | null {
  if (area.includes(".")) return null;
  const key = fold(area);
  if (key.length < 5 || TOO_COMMON.has(key)) return null;
  return key;
}

/** Whole words, with the spaces inside a name optional: "Ram Ganj Mandi" is "Ramganj Mandi". */
const names = (text: string, key: string) =>
  new RegExp(`(?:^| )${key.replace(/ /g, " ?")}(?: |$)`).test(text);

/** Every state this PIN lies in — a PIN on a state line lists both districts. */
function statesOf(place: { state: string; districts: string[] }): Set<string> {
  const states = new Set([place.state]);
  for (const district of listDistricts()) {
    if (place.districts.includes(district.name)) states.add(district.state);
  }
  return states;
}

/**
 * Why this address cannot be at this PIN, as a sentence for the customer —
 * or null when nothing in India Post's list says it is wrong.
 */
export function addressPincodeConflict(address: AddressToCheck): string | null {
  const pincode = (address.pincode ?? "").replace(/\D/g, "");
  const place = /^\d{6}$/.test(pincode) ? lookUpPincode(pincode) : null;
  if (!place) return null;

  const states = statesOf(place);
  const typedState = matchStateName(address.state ?? "");
  if (typedState && ![...states].some((state) => matchStateName(state) === typedState)) {
    return `PIN ${pincode} is in ${place.state}, not ${typedState}. Please correct the PIN code or the state.`;
  }

  const city = fold(address.city ?? "");
  if (city) {
    const sameName = listDistricts().filter((district) => fold(district.name) === city);
    if (sameName.length > 0 && !sameName.some((district) => states.has(district.state))) {
      return `${sameName[0].name} is in ${sameName[0].state}, but PIN ${pincode} is in ${place.state}. Please correct the PIN code or the city.`;
    }
  }

  const text = [address.addressLine1, address.addressLine2]
    .flatMap((line) => (line ?? "").split(/[,;/\n]+/))
    .filter((part) => !ELSEWHERE.test(part))
    .map(fold)
    .join(" ");
  if (!text) return null;

  // The district's and state's own names say nothing about which PIN it is:
  // "Devbhumi Dwarka" is not the town of Dwarka, and "Kota City" is not 324006
  // because that PIN's office happens to be called so. Taken out only where
  // they hold the whole area name — "kota" must not be cut out of "Kota Jn".
  const neutral = [...place.districts.flatMap((name) => [`${name} city`, name]), place.state].map(fold);
  const named = (key: string) => {
    let rest = ` ${text} `;
    for (const name of neutral.filter((phrase) => names(phrase, key))) {
      // Looped: one pass misses the second of "kota kota", which shared a space.
      while (rest.includes(` ${name} `)) rest = rest.replaceAll(` ${name} `, " ");
    }
    return names(rest.trim(), key);
  };

  const districtNames = new Set(listDistricts().map((district) => fold(district.name)));
  const own = new Set(place.areas.map(matchable).filter((key): key is string => Boolean(key)));
  if ([...own].some(named)) return null;

  const homeDistricts = listDistricts().filter(
    (district) => place.districts.includes(district.name) && states.has(district.state),
  );
  for (const district of homeDistricts) {
    for (const other of placesInDistrict(district.name, district.state)) {
      if (other.pincode === pincode) continue;
      for (const area of other.areas) {
        const key = matchable(area);
        if (key && !own.has(key) && !districtNames.has(key) && named(key)) {
          const here = place.areas.find((name) => !name.includes(".")) ?? place.districts[0];
          return `${area} is in PIN ${other.pincode}, but PIN ${pincode} is ${here}. Please correct the PIN code or the address.`;
        }
      }
    }
  }
  return null;
}
