"use client";

import { accessLevels, applyLevel, currentLevel } from "@/features/team/lib/access-levels";
import { PERMISSION_MODULES, permissionDefinition, type Permission } from "@/features/team/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * One choice per part of the admin — No access, View or Full (and, for
 * orders, Kitchen only or Own deliveries). See features/team/lib/access-levels.ts.
 */
export function SimplePermissionPicker({
  value,
  onChange,
  readOnly = false,
  locked = [],
}: {
  value: readonly Permission[];
  onChange: (next: Permission[]) => void;
  readOnly?: boolean;
  /** Permissions the editor may not hand out. A choice that needs one is disabled. */
  locked?: readonly Permission[];
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {PERMISSION_MODULES.map((module) => {
        const current = currentLevel(module.id, value);
        const held = value.filter((p) => permissionDefinition(p)?.module === module.id);
        return (
          <li
            key={module.id}
            className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                {module.label}
                {!current ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    Custom
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {!current
                  ? held.map((p) => permissionDefinition(p)?.label).join(" · ")
                  : (current.hint ?? module.description)}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label={`${module.label} access`}
              className="flex shrink-0 flex-wrap gap-1 rounded-lg bg-muted p-1"
            >
              {accessLevels(module.id).map((level) => {
                const selected = current?.id === level.id;
                const blocked = level.permissions.some((p) => locked.includes(p));
                return (
                  <button
                    key={level.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={readOnly || (blocked && !selected)}
                    title={blocked ? "Needs permissions you don't have yourself" : undefined}
                    onClick={() => !readOnly && onChange(applyLevel(value, module.id, level, locked))}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                      selected
                        ? level.id === "none"
                          ? "bg-card text-foreground shadow-xs"
                          : "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    {level.label}
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
