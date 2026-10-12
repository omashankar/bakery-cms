import { describe, expect, it } from "vitest";

import { formatCurrency, formatInrWhole, groupIndian } from "@/utils/format";

/**
 * RUPEES ARE WRITTEN WITHOUT `Intl`, AND EXACTLY AS `Intl` WOULD WRITE THEM.
 *
 * The first `Intl` formatter a page builds in the browser loads the locale
 * data — ~100ms of a phone's main thread during hydration, just to print a
 * price. `formatInrWhole` writes whole rupees by hand. That is only safe if
 * it is indistinguishable from Intl: the server renders prices too, and a
 * customer comparing the cart to the invoice must never see two spellings.
 */
const intl = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const EDGES = [
  0, -0, 0.4, 0.5, 0.6, 1.5, 2.5, -0.4, -0.5, -1.5, -2.5, 9, 99, 999, 1000, 1099.5, 9999,
  12345, 99999, 100000, 999999.5, 1234567, 12345678, 123456789, -4500, -100000,
  Number.MAX_SAFE_INTEGER / 100,
];

describe("whole rupees", () => {
  it.each(EDGES)("writes %s exactly as Intl does", (value) => {
    expect(formatInrWhole(value)).toBe(intl.format(value));
  });

  it("agrees with Intl across thousands of prices, fractions and refunds included", () => {
    // Deterministic, so a failure names the same value every run.
    let seed = 20261012;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 5000; i++) {
      const magnitude = 10 ** Math.floor(next() * 9);
      const value = (next() - 0.2) * magnitude;
      expect(formatInrWhole(value), String(value)).toBe(intl.format(value));
    }
  });

  it("hands back what it cannot write, so Intl writes it", () => {
    expect(formatInrWhole(Number.NaN)).toBeNull();
    expect(formatInrWhole(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatInrWhole(1e21)).toBeNull();
    expect(formatCurrency(Number.NaN, "INR")).toBe(intl.format(Number.NaN));
    expect(formatCurrency(1e21, "INR")).toBe(intl.format(1e21));
  });

  it("is what formatCurrency answers for rupees", () => {
    for (const value of [0, 899, 1099, 125000, -80]) {
      expect(formatCurrency(value, "INR")).toBe(intl.format(value));
    }
  });

  it("leaves every other currency to Intl", () => {
    expect(formatCurrency(1234.5, "USD")).toBe(
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.5),
    );
  });

  it("groups digits the Indian way", () => {
    expect(groupIndian(1234567)).toBe("12,34,567");
    expect(groupIndian(999)).toBe("999");
  });
});
