"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ProductBlockRender,
  ProductVariantGroup,
  ProductVariantGroupType,
} from "@/types/product";
import {
  blockRenderIsAchievable,
  createVariantGroup,
  createVariantOption,
  resolveBlockRender,
} from "@/features/products/lib/variant-utils";
import { getActiveLocale } from "@/features/settings/lib/active-locale";
import { AdminSelect } from "./admin-field";
import { useBusinessLabels } from "@/hooks/use-business-labels";

interface ProductVariantManagerProps {
  groups: ProductVariantGroup[];
  onChange: (groups: ProductVariantGroup[]) => void;
}

/**
 * The three shapes a block can take, in the words a shop owner uses.
 *
 * `needs` is what the options underneath have to be for the answer to hold —
 * printed inside the disabled entry, so the dropdown explains itself rather
 * than simply refusing. A shop asking why "Already true" is greyed out has the
 * answer in the same line it is reading.
 */
const RENDER_CHOICES: { value: ProductBlockRender; label: string; needs: string }[] = [
  { value: "buttons", label: "Buttons — pick one", needs: "needs two choices or more" },
  { value: "checkbox", label: "Tickbox — have it if you ask", needs: "needs one choice, or two with a default" },
  { value: "stated", label: "Already true — just says so", needs: "needs exactly one choice, ticked Default" },
];

const renderIsPossible = (group: ProductVariantGroup, render: ProductBlockRender) =>
  blockRenderIsAchievable(group, render);

/**
 * One line saying what this block turns into on the customer's page.
 *
 * Built from `resolveBlockRender`'s own answer, so the admin cannot describe one
 * thing while the storefront draws another — and it uses the labels the shop
 * typed, not examples of ours.
 */
function previewOf(
  group: ProductVariantGroup,
  drawn: ReturnType<typeof resolveBlockRender>,
): string {
  const labelled = group.options.map((option) => option.label.trim()).filter(Boolean);
  if (labelled.length === 0) return "Name the choices to see how this will look.";

  if (drawn.render === "stated") return `The page will say: ✓ ${labelled[0]}`;
  if (drawn.render === "checkbox") {
    return `The page will show a tickbox: ${drawn.tick.on.label.trim() || labelled[0]}`;
  }
  return `The page will show buttons: ${labelled.join(" · ")}`;
}

export function ProductVariantManager({ groups, onChange }: ProductVariantManagerProps) {
  const labels = useBusinessLabels();
  /*
    `modules` was read here to decide whether to OFFER the Shape/Custom control.
    That control is gone, so nothing on this screen branches on a module any
    more — which is the honest end state: what a block looks like is the shop's
    answer about this product, not a shop-wide switch.

    The gating itself is untouched. `variantGroupsEnabledBy` still hides a
    shape-typed block from customers when the module is off, on the server and
    on the storefront; the chip under the name says so.
  */

  function updateGroup(groupId: string, patch: Partial<ProductVariantGroup>) {
    onChange(groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)));
  }

  function removeGroup(groupId: string) {
    onChange(groups.filter((group) => group.id !== groupId));
  }

  function addGroup(type: ProductVariantGroupType = "custom") {
    onChange([
      ...groups,
      /*
        NOTHING IS PRE-NAMED.

        This opened with "Custom option" in the name box and "Option 1" in the
        label box — words the shop never typed, in boxes that then LOOK filled
        in. A product could be saved with a question literally called "Custom
        option", and one was: `groupTypeLabels`' other branch put "Shape" there
        too. An empty box reads as a box to fill.
      */
      createVariantGroup("", type, [createVariantOption("", 0, false)], true),
    ]);
  }

  /** Order is what the customer reads, so it has to be the shop's to set. */
  function moveGroup(index: number, by: -1 | 1) {
    const next = [...groups];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  function moveOption(groupId: string, index: number, by: -1 | 1) {
    onChange(
      groups.map((group) => {
        if (group.id !== groupId) return group;
        const options = [...group.options];
        const target = index + by;
        if (target < 0 || target >= options.length) return group;
        [options[index], options[target]] = [options[target]!, options[index]!];
        return { ...group, options };
      }),
    );
  }

  /**
   * Whether this group is one the Shape module can hide.
   *
   * The Shape/Custom SELECT that stood here is gone. It asked the shop to
   * classify its own question into two words that meant nothing to it, and it
   * was broken besides: the union is "shape" | "custom" while 26 of this
   * shop's 29 products carry groups typed `egg` or `photo`, so the box rendered
   * blank on most of the catalogue and one click silently retyped a group —
   * which is how a Heart ended up inside Egg preference.
   *
   * `type` is still CARRIED, untouched, in the object this component hands back:
   * `updateGroup` spreads the group, and the save is a whole-document replace,
   * so a form that stopped carrying it would delete it product by product. What
   * is gone is the ability to set it by hand. In its place, a chip that states
   * the one thing it does.
   */
  const isShapeGated = (type: ProductVariantGroupType): boolean => type === "shape";


  function updateOption(
    groupId: string,
    optionId: string,
    patch: Partial<ProductVariantGroup["options"][number]>
  ) {
    onChange(
      groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          options: group.options.map((option) =>
            option.id === optionId ? { ...option, ...patch } : option
          ),
        };
      })
    );
  }

  /**
   * Ticking one clears the others; ticking the ticked one clears them all.
   *
   * This could only ever SET a default, so every group had one for ever and an
   * opt-in was impossible to describe. No default now means what it looks
   * like: nothing is chosen until the customer chooses it, and nothing is
   * charged — which is how a shop says “Eggless +₹80” and gets one tickbox.
   */
  function setDefaultOption(groupId: string, optionId: string) {
    onChange(
      groups.map((group) => {
        if (group.id !== groupId) return group;
        const wasDefault =
          group.options.find((option) => option.id === optionId)?.isDefault === true;
        return {
          ...group,
          options: group.options.map((option) => ({
            ...option,
            isDefault: !wasDefault && option.id === optionId,
          })),
        };
      })
    );
  }

  function addOption(groupId: string) {
    onChange(
      groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          options: [
            ...group.options,
            // Never default. A group starts as an add-on the customer opts
            // into; the owner ticks Default when they want one chosen for
            // them.
            createVariantOption(`Option ${group.options.length + 1}`, 0, false),
          ],
        };
      })
    );
  }

  function removeOption(groupId: string, optionId: string) {
    onChange(
      groups
        .map((group) => {
          if (group.id !== groupId) return group;
          const options = group.options.filter((option) => option.id !== optionId);
          if (options.length === 0) return null;
          // No default is re-imposed here. Removing the ticked option leaves a
          // group nobody has answered, which is a state this now supports —
          // silently promoting the next one would charge for a choice the
          // owner had just deleted the reason for.
          return { ...group, options };
        })
        .filter((group): group is ProductVariantGroup => group !== null)
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Options</p>
          <p className="text-xs text-muted-foreground">
            What the customer chooses before buying — a colour, a capacity, a
            gift wrap. Each block is one question, and you say how it looks: a
            row of buttons, a tickbox, or a line that just states a fact.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/*
            "Reset defaults" stood here, then "Add egg / eggless".

            The first was a trap: it REPLACED the array, so one click on a phone
            charger deleted Storage and Colour and installed "Egg preference /
            Regular / Eggless +80". The second was the same button made
            additive — and it has gone with the special case it added. A shop
            that offers eggless adds an option group and names it, which is what
            "Add option" beside this does.
          */}
          <Button type="button" variant="outline" size="sm" onClick={() => addGroup("custom")}>
            <Plus className="size-4" />
            Add option
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
          No options yet. Add one if this {labels.productWord.toLowerCase()} comes in more than one version —
          a size, a colour, a capacity. {labels.productWordPlural} sold one way need none.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, groupIndex) => {
            const drawn = resolveBlockRender(group);
            const named = group.name.trim() || "this option";

            return (
            <div key={group.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_190px_auto]">
                <div className="space-y-2">
                  <Label htmlFor={`grp-name-${group.id}`}>Option name</Label>
                  <Input
                    id={`grp-name-${group.id}`}
                    value={group.name}
                    onChange={(event) => updateGroup(group.id, { name: event.target.value })}
                    placeholder="Size, Colour, Gift wrap"
                  />
                </div>
                {/*
                  HOW IT LOOKS, which the shop could never say before.

                  All three of these renderings already existed; the storefront
                  chose between them by reading the data — two options meant
                  buttons, one option with no Default meant a tickbox, one option
                  WITH a Default meant a stated fact. Nothing on this screen said
                  so, so ticking Default silently turned an offer into a claim.

                  The value shown is what the customer will ACTUALLY get, not
                  what is stored: `resolveBlockRender` falls back to the
                  derivation when a stored answer does not fit the options under
                  it, and a box showing an answer the page ignores is worse than
                  no box. The ones that cannot be drawn are disabled and say why.
                */}
                <div className="space-y-2">
                  <Label htmlFor={`grp-render-${group.id}`}>How it looks</Label>
                  <AdminSelect
                    id={`grp-render-${group.id}`}
                    value={drawn.render}
                    onChange={(event) =>
                      updateGroup(group.id, {
                        render: event.target.value as ProductBlockRender,
                      })
                    }
                  >
                    {RENDER_CHOICES.map((choice) => {
                      const possible = renderIsPossible(group, choice.value);
                      return (
                        <option key={choice.value} value={choice.value} disabled={!possible}>
                          {choice.label}
                          {possible ? "" : ` — ${choice.needs}`}
                        </option>
                      );
                    })}
                  </AdminSelect>
                </div>
                <div className="flex items-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={groupIndex === 0}
                    onClick={() => moveGroup(groupIndex, -1)}
                    aria-label={`Move ${named} up`}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={groupIndex === groups.length - 1}
                    onClick={() => moveGroup(groupIndex, 1)}
                    aria-label={`Move ${named} down`}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGroup(group.id)}
                    aria-label={`Remove ${named}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {/*
                What the Shape/Custom select used to decide, stated rather than
                asked. It is the only thing `type` does, it applies to 28 of this
                shop's groups, and it is not a question a shop selling anything
                else can answer.
              */}
              {isShapeGated(group.type) ? (
                <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                  Hidden from customers while the Shape module is off.
                </p>
              ) : null}

              {/*
                "Required on storefront" was here, and it decided nothing.

                Its only reader in the whole repository was the checkbox that
                wrote it: no picker blocks on it, and the server substitutes the
                group's default option whenever a selection is absent — so a
                merchant who ticked it was told a purchase would be stopped
                without one, and it never was. The same defect, in the same
                shape, as `PaymentMethodSettings.upi/card`, and removed the same
                way: the control goes, the stored field stays.
              */}
              <div className="space-y-3">
                {group.options.map((option, optionIndex) => (
                  <div
                    key={option.id}
                    className="grid gap-3 rounded-lg border border-border px-3 py-3 sm:grid-cols-[1fr_150px_auto_auto]"
                  >
                    <div className="space-y-1">
                      <Label htmlFor={`opt-label-${option.id}`}>Choice</Label>
                      <Input
                        id={`opt-label-${option.id}`}
                        value={option.label}
                        onChange={(event) =>
                          updateOption(group.id, option.id, { label: event.target.value })
                        }
                        placeholder="Red, 1 metre, Gift wrapped"
                      />
                    </div>
                    <div className="space-y-1">
                      {/*
                        "Price +/-" said the sign and not the meaning. This
                        number is added to the price the customer is already
                        paying — never the price itself. That distinction is the
                        one thing a shop has to hold on to here, because the size
                        rows a tab away hold FULL prices and read almost the
                        same.

                        The shop's own currency, not a hardcoded rupee.
                      */}
                      <Label htmlFor={`opt-price-${option.id}`}>
                        Adds to price ({getActiveLocale().currency})
                      </Label>
                      <Input
                        id={`opt-price-${option.id}`}
                        type="number"
                        value={option.priceAdjustment}
                        onChange={(event) =>
                          updateOption(group.id, option.id, {
                            priceAdjustment: Number(event.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    {/*
                      DEFAULT is what the customer gets without choosing — and on
                      a block drawn as a tickbox it is the UNticked side, which is
                      why it is worth saying out loud rather than leaving as one
                      word a shop has to guess the meaning of.
                    */}
                    <label className="flex items-center gap-2 self-end pb-2 text-xs">
                      <Checkbox
                        checked={option.isDefault === true}
                        onCheckedChange={() => setDefaultOption(group.id, option.id)}
                      />
                      {drawn.render === "checkbox" ? "Unticked" : "Default"}
                    </label>
                    <div className="flex items-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={optionIndex === 0}
                        onClick={() => moveOption(group.id, optionIndex, -1)}
                        aria-label={`Move ${option.label.trim() || "this choice"} up`}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={optionIndex === group.options.length - 1}
                        onClick={() => moveOption(group.id, optionIndex, 1)}
                        aria-label={`Move ${option.label.trim() || "this choice"} down`}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(group.id, option.id)}
                        disabled={group.options.length <= 1}
                        aria-label={`Remove ${option.label.trim() || "this choice"}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addOption(group.id)}>
                  <Plus className="size-4" />
                  Add a choice
                </Button>
                {/*
                  WHAT THE CUSTOMER WILL SEE, drawn from the same function the
                  product page draws it from.

                  This line used to read "Example total from base ₹999 + default
                  option adjustment" — a sentence about arithmetic, printed
                  under every block, that named no number and described no
                  outcome. And the arithmetic it gestured at is wrong the moment
                  a product has two blocks, which 27 of this shop's 29 do.
                */}
                <p className="text-xs text-muted-foreground">{previewOf(group, drawn)}</p>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
