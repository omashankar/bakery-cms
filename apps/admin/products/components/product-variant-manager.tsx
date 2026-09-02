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
  createDefaultVariantGroups,
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
  egg: "Egg preference",
  photo: "Photo cake",
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
        [createVariantOption("Option 1", 0, true)],
        type !== "photo"
      ),
    ]);
  }

  /** True when this product already carries the bakery's egg group. */
  const hasEggGroup = groups.some((group) => group.type === "egg");

  /**
   * Whether to offer the bakery-only Type control for a group of this type.
   *
   * A group already using egg or photo always keeps it, so switching a module
   * off never strands data an admin can no longer edit.
   */
  const showTypeControl = (type: ProductVariantGroupType): boolean =>
    modules.eggEggless || modules.photoCake || type === "egg" || type === "photo";

  /**
   * Give a bakery its egg/eggless group — without taking anything away.
   *
   * The button this replaces called `createDefaultVariantGroups()` and passed
   * the result straight to `onChange`, which REPLACES. So "Reset defaults" on a
   * phone charger deleted Storage and Colour and left an egg question in their
   * place, and on a photo cake it discarded the photo group the Commerce tab
   * had just added. Appending is the only thing this was ever wanted for.
   */
  function addEggOptions() {
    if (hasEggGroup) return;
    onChange([
      ...groups,
      ...createDefaultVariantGroups().filter((group) => group.type === "egg"),
    ]);
  }

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

  function setDefaultOption(groupId: string, optionId: string) {
    onChange(
      groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          options: group.options.map((option) => ({
            ...option,
            isDefault: option.id === optionId,
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
            createVariantOption(`Option ${group.options.length + 1}`, 0, group.options.length === 0),
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
          if (!options.some((option) => option.isDefault)) {
            options[0] = { ...options[0], isDefault: true };
          }
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
            "Reset defaults" was here, and it was a trap rather than a shortcut.
            It called `createDefaultVariantGroups()` with no arguments and
            REPLACED the array, so one click on a phone charger deleted Storage
            and Colour and installed "Egg preference / Regular / Eggless +80" —
            no confirm, and not even gated on the egg module being on.

            It is now additive, gated on the module, and disabled once the group
            exists, so it can only ever give a bakery something it is missing.
          */}
          {modules.eggEggless && !hasEggGroup ? (
            <Button type="button" variant="outline" size="sm" onClick={addEggOptions}>
              <Plus className="size-4" />
              Add egg / eggless
            </Button>
          ) : null}
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
                  `type` drives two things and neither is generic: which module
                  hides the group, and which legacy flag `syncLegacyFlagsFromVariants`
                  derives. A shop selling chargers was made to answer
                  "Egg preference / Photo cake / Custom" on every option group it
                  created, which is the single loudest reason the options tab read
                  as a cake feature.

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
                      {modules.eggEggless || group.type === "egg" ? (
                        <option value="egg">Egg preference</option>
                      ) : null}
                      {modules.photoCake || group.type === "photo" ? (
                        <option value="photo">Photo cake</option>
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
