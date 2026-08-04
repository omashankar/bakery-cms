/**
 * The allow-list rules for maintenance mode, kept pure so the browser and the
 * server apply the same ones and both can be tested without a request.
 *
 * The invariant everything here exists to hold: if `isValidIp(x)` is true, then
 * `normalizeIp(x)` must equal `normalizeIp(y)` for every OTHER spelling `y` of
 * the same address. A validator that accepts a form the normaliser cannot
 * canonicalise is worse than no validator — the entry saves clean, the admin
 * believes they have access, and they find out otherwise when they are locked
 * out of their own closed shop.
 */

/** Strips a port and unwraps brackets, without touching the address itself. */
function stripHostDecoration(value: string): string {
  let ip = value.trim().toLowerCase();
  if (!ip) return "";

  // [::1]:443 -> ::1
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracketed) return bracketed[1];

  // Exactly one colon means host:port, never bare IPv6.
  if ((ip.match(/:/g)?.length ?? 0) === 1) ip = ip.split(":")[0];
  return ip;
}

function canonicalIpv4(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    return n <= 255 ? n : null;
  });

  if (octets.some((o) => o === null)) return null;
  // Rebuilt from the numbers, so 192.168.001.010 and 192.168.1.10 become the
  // same string. Comparing the raw text meant a zero-padded entry saved fine and
  // never matched a single visitor.
  return octets.join(".");
}

function canonicalIpv6(value: string): string | null {
  if (!value.includes(":")) return null;
  if (!/^[0-9a-f:.]*$/.test(value)) return null;
  if ((value.match(/::/g)?.length ?? 0) > 1) return null;

  const [head, tail, ...rest] = value.split("::");
  if (rest.length > 0) return null;

  const expand = (part: string): string[] | null => {
    if (!part) return [];
    const groups = part.split(":");
    const out: string[] = [];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      // A trailing IPv4 tail (::ffff:127.0.0.1) is legal only in the last group.
      if (group.includes(".")) {
        if (i !== groups.length - 1) return null;
        const v4 = canonicalIpv4(group);
        if (!v4) return null;
        const [a, b, c, d] = v4.split(".").map(Number);
        out.push(((a << 8) | b).toString(16), ((c << 8) | d).toString(16));
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      // Leading zeros dropped, so 2001:0db8 and 2001:db8 agree.
      out.push(parseInt(group, 16).toString(16));
    }
    return out;
  };

  const headGroups = expand(head);
  const tailGroups = value.includes("::") ? expand(tail ?? "") : [];
  if (!headGroups || !tailGroups) return null;

  const total = headGroups.length + tailGroups.length;
  if (value.includes("::")) {
    if (total > 7) return null;
    const fill = new Array(8 - total).fill("0");
    return [...headGroups, ...fill, ...tailGroups].join(":");
  }

  if (total !== 8) return null;
  return headGroups.join(":");
}

/**
 * Puts an address into the one form both sides compare on.
 *
 * Three things make a naive string comparison miss a match the admin expects:
 * `x-forwarded-for` often carries a port (`203.0.113.7:54321`); IPv6 arrives
 * bracketed (`[::1]:443`) and in mixed case; and a proxy may present an IPv4
 * client in its IPv6-mapped form. Leading zeros and IPv6 zero-compression add
 * two more spellings of the same address.
 *
 * Returns "" for anything that is not an address, so a non-address can never
 * accidentally equal another non-address.
 */
export function normalizeIp(value: string): string {
  const bare = stripHostDecoration(value);
  if (!bare) return "";

  const v4 = canonicalIpv4(bare);
  if (v4) return v4;

  const v6 = canonicalIpv6(bare);
  if (!v6) return "";

  // ::ffff:127.0.0.1 is the same machine as 127.0.0.1.
  const mapped = /^0:0:0:0:0:ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6);
  if (mapped) {
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }

  return v6;
}

/**
 * True when this is an address the server could ever match a visitor against.
 *
 * Defined AS "the normaliser understood it", so the two can never disagree.
 */
export function isValidIp(value: string): boolean {
  return normalizeIp(value) !== "";
}

/** Splits the admin's comma-separated field into addresses. */
export function parseAllowedIps(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
