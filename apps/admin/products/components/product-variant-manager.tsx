"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductVariantGroup, ProductVariantGroupType } from "@/types/product";
import type { ModuleSettings } from "@/types/settings";
import { formatCurrency } from "@/utils/format";
import {
  createVariantGroup,
  createVariantOption,
} from "@/features/products/lib/variant-utils";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import { getActiveLocale } from "@/features/settings/lib/active-locale";
import { cn } from "@/lib/utils";
import {
  getModuleSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { AdminSelect } from "./admin-field";
import { useBusinessLabels } from "@/hooks/use-business-labels";

interface ProductVariantManagerProps {
  groups: ProductVariantGroup[];
  basePrice: number;
  onChange: (groups: ProductVariantGroup[]) => void;
}

const groupTypeLabels: Record<ProductVariantGroupType, string> = {
  shape: "Shape",
  custom: "Custom",
};

export function ProductVariantManager({ groups, basePrice, onChange }: ProductVariantManagerProps) {
  const labels = useBusinessLabels();
  // Egg / photo variant presets are bakery modules — hide those type options when
  // the module is off, but never for a group that already uses the type (so a
  // product's existing variant data stays fully editable).
  const [modules, setModules] = useState<ModuleSettings>(defaultModuleSettings);

  useEffect(() => {
    const sync = () => setModules(getModuleSettings());
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  function updateGroup(groupId: string, patch: Partial<ProductVariantGroup>) {
    onChange(groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)));
  }

  function removeGroup(groupId: string) {
    onChange(groups.filter((group) => group.id !== groupId));
  }

  function addGroup(type: ProductVariantGroupType = "custom") {
    onChange([
      ...groups,
      createVariantGroup(
        type === "custom" ? "Custom option" : groupTypeLabels[type],
        type,
        [createVariantOption("Option 1", 0, false)],
        true
      ),
    ]);
  }


  /**
   * Whether to offer the typed-group control for a group of this type.
   *
   * A group already using shape always keeps it, so switching the module off
   * never strands data an admin can no longer edit.
   */
  const showTypeControl = (type: ProductVariantGroupType): boolean =>
    modules.shape || type === "shape";


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
            What the customer chooses before buying — a size, a colour, a storage
            capacity. Each choice can add to or subtract from the base price.
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
          {groups.map((group) => (
            <div key={group.id} className="rounded-xl border border-border bg-card p-4">
              <div
                className={cn(
                  "mb-4 grid gap-3",
                  showTypeControl(group.type)
                    ? "sm:grid-cols-[1fr_160px_auto]"
                    : "sm:grid-cols-[1fr_auto]",
                )}
              >
                <div className="space-y-2">
                  <Label>Option name</Label>
                  <Input
                    value={group.name}
                    onChange={(event) => updateGroup(group.id, { name: event.target.value })}
                  />
                </div>
                {/*
                  The Type control is a BAKERY control, and only a bakery sees it.
                  `type` drives exactly one thing now, and it is not generic:
                  which module hides the group. It used to drive a second — the
                  product flag derived from what an option meant — and it used to
                  offer three answers. A shop selling chargers was made to pick
                  "Egg preference / Photo cake / Custom" on every option group it
                  created, which is the single loudest reason the options tab read
                  as a cake feature. Shape is the last one left.

                  Shown when either module is on, and always for a group that
                  already uses one of those types — the same data-preservation
                  carve-out the options below it use, so existing bakery data stays
                  fully editable after a module is switched off.
                */}
                {showTypeControl(group.type) ? (
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <AdminSelect
                      value={group.type}
                      onChange={(event) =>
                        updateGroup(group.id, {
                          type: event.target.value as ProductVariantGroupType,
                        })
                      }
                    >

                      {/*
                        Typed, so `modules.shape` can still hide these the way
                        it hid the old checkbox list — and so a shop that
                        switches the module off does not lose the ability to
                        EDIT a shape group it already has.
                      */}
                      {modules.shape || group.type === "shape" ? (
                        <option value="shape">Shape</option>
                      ) : null}
                      <option value="custom">Custom</option>
                    </AdminSelect>
                  </div>
                ) : null}
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGroup(group.id)}
                    aria-label="Remove option"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>

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
                {group.options.map((option) => (
                  <div
                    key={option.id}
                    className="grid gap-3 rounded-lg border border-border px-3 py-3 sm:grid-cols-[1fr_140px_auto_auto]"
                  >
                    <div className="space-y-1">
                      <Label>Option label</Label>
                      <Input
                        value={option.label}
                        onChange={(event) =>
                          updateOption(group.id, option.id, { label: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      {/* The shop's own currency, not a hardcoded rupee. */}
                      <Label>Price +/- ({getActiveLocale().currency})</Label>
                      <Input
                        type="number"
                        value={option.priceAdjustment}
                        onChange={(event) =>
                          updateOption(group.id, option.id, {
                            priceAdjustment: Number(event.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 self-end pb-2 text-xs">
                      <Checkbox
                        checked={option.isDefault === true}
                        onCheckedChange={() => setDefaultOption(group.id, option.id)}
                      />
                      Default
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="self-end"
                      onClick={() => removeOption(group.id, option.id)}
                      disabled={group.options.length <= 1}
                      aria-label="Remove option"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addOption(group.id)}>
                  <Plus className="size-4" />
                  Add option
                </Button>
                <p className="text-xs text-muted-foreground">
                  Example total from base {formatCurrency(basePrice)} + default option adjustment
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
