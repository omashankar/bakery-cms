import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BUSINESS_TYPE_LABELS, DEFAULT_LABELS, resolveLabels } from "@/config/business-labels";
import {
  businessTypeOptions,
  defaultGeneralSettings,
} from "@/features/settings/lib/settings-utils";
import { SettingsModel } from "@/lib/server/db/models/settings.model";

/**
 * THE BUSINESS TYPE IS BACK, AND MAY ONLY EVER PICK WORDS.
 *
 * It was deleted once. As a closed enum it had to grow a row every time a shop
 * turned out to be a trade nobody had listed, and a shop selling cakes AND
 * chargers AND flowers had no honest value to pick — an audit found it gated
 * exactly one thing, the Wedding Builder, and otherwise decided nothing.
 *
 * It came back because a shop has an identity and a new owner should not start
 * from a blank page, on the one condition that makes it safe: IT SETS DEFAULTS
 * AND RESTRICTS NOTHING. The first thing a field like this grows is a second
 * job — a page that only florists see, a product type only bakeries can add —
 * and that is the version that gets deleted again.
 *
 * So this file is the condition, written down. It is the guard that has to fail
 * before the mistake ships, not a description of what the code happens to do
 * today.
 */

const ROOTS = ["app", "apps", "features", "components", "lib", "hooks", "constants"];

/** Every TS/TSX file under the app's own source, excluding tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|[.]next|[.]git/.test(entry.name)) sourceFiles(full, out);
    } else if (/[.]tsx?$/.test(entry.name) && !/[.]test[.]/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Source with comments stripped — a comment about the field is not a read of it. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("it decides wording, and only wording", () => {
  /**
   * The allowlist is every file entitled to read the field, and why. It is
   * short on purpose: adding a line here is the decision this test exists to
   * make somebody make deliberately.
   */
  const MAY_READ = [
    // Resolves the trade's preset under the shop's own words.
    join("config", "business-labels.ts"),
    // The stored value, its default, its options list, its Zod shape.
    join("features", "settings", "lib", "settings-utils.ts"),
    join("features", "settings", "lib", "settings-repository.ts"),
    join("features", "settings", "server", "settings.validators.ts"),
    // Ships it to the client and layers it into `labels`.
    join("features", "settings", "server", "settings.service.ts"),
    // The select itself.
    join("apps", "admin", "settings", "components", "general-settings-page.tsx"),
    // Declares the Mongoose path.
    join("lib", "server", "db", "models", "settings.model.ts"),
    // A decorative list of trades on the public marketing page — no shop data.
    join("features", "marketing", "landing-data.ts"),
    join("features", "marketing", "landing-page.tsx"),
  ];

  it("is read nowhere but the places that turn it into words", () => {
    /**
     * A read outside this list is the field growing a second job. The failure
     * message names the file, because the fix is almost never "add it to the
     * allowlist" — it is "do not gate that on the shop's trade".
     */
    const readers = ROOTS.flatMap((root) => sourceFiles(root))
      .filter((path) => /\bbusinessType\b/.test(code(path)))
      .filter((path) => !MAY_READ.some((allowed) => path.endsWith(allowed)))
      .map((path) => path.replace(/\\/g, "/"));

    expect(
      readers,
      "these read the business type, which may only ever choose default wording",
    ).toEqual([]);
  });

  it("gates no feature — the wedding module is the switch alone", () => {
    /**
     * The one thing it ever did gate. The gate did not come back with the
     * field, deliberately: a shop that sells cakes and flowers should not lose
     * its Wedding Builder for calling itself a florist.
     */
    const repository = code(join("features", "settings", "lib", "settings-repository.ts"));
    const gate = repository.slice(repository.indexOf("export function isWeddingEnabled"));

    expect(gate.slice(0, 300)).not.toContain("businessType");
  });
});

describe("every trade is only a starting point", () => {
  it("offers exactly the trades the presets have wording for", () => {
    // A select row with no preset silently falls back to neutral, which looks
    // like the shop's choice doing nothing.
    const offered = businessTypeOptions.map((option) => option.value).sort();
    const priced = Object.keys(BUSINESS_TYPE_LABELS).sort();

    expect(offered).toEqual(priced);
  });

  it("puts what the shop typed over what its trade suggests", () => {
    const labels = resolveLabels({ productWord: "Gateau" }, "bakery");

    expect(labels.productWord).toBe("Gateau");
    // And the rest of the trade's wording still stands underneath.
    expect(labels.productWordPlural).toBe("Cakes");
  });

  it("leaves a shop that has not chosen exactly where it was", () => {
    /**
     * `"other"` is the default, and it has to resolve to the neutral wording —
     * otherwise re-introducing this field renamed every existing shop's
     * products on the day it deployed, which is the harm the deletion was
     * careful to avoid in the other direction.
     */
    expect(defaultGeneralSettings.businessType).toBe("other");
    expect(resolveLabels({}, "other").productWord).toBe(DEFAULT_LABELS.productWord);
    expect(resolveLabels({}, "other").productWordPlural).toBe(DEFAULT_LABELS.productWordPlural);
  });

  it("and a document written before the field returned still reads", () => {
    // No special case, no migration: absent means neutral.
    expect(resolveLabels({}, undefined)).toEqual(resolveLabels({}, "other"));
  });
});

describe("the choice survives being saved", () => {
  it("has a Mongoose path, or the select reverts on every load", () => {
    /**
     * The trap this codebase has fallen into three times — `sameDayCutoff`,
     * `productImageNote`, `deliveryTiers`. Mongoose strict mode drops an
     * undeclared path silently, so the form says saved and the value is gone.
     * Checked here as well as in the general sweep, because for this field the
     * symptom is the owner's own choice quietly reverting.
     */
    const general = SettingsModel.schema.path("general") as unknown as {
      schema?: { paths: Record<string, unknown> };
    };

    expect(Object.keys(general?.schema?.paths ?? {})).toContain("businessType");
  });

  it("and nothing in the repair rules deletes it", () => {
    /**
     * A repair that `$unset` this field ran on every settings read while the
     * enum was deleted. It is gone, and it must not come back with the field
     * live — see `the-wedding-gate-is-wired-where-it-claims` for the case that
     * proves a read writes nothing at all.
     */
    const utils = code(join("features", "settings", "lib", "settings-utils.ts"));

    expect(utils).not.toContain('path: "general.businessType"');
  });
});
