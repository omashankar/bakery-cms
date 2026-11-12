import {
  permissionDefinition,
  permissionsInModule,
  sortPermissions,
  withPrerequisites,
  type Permission,
  type PermissionModuleId,
} from "./permissions";

/**
 * The SIMPLE way to say what a role may do: per part of the admin, one choice —
 * No access, View, or Full. Orders has two more, because the kitchen and the
 * riders each see only their own slice of it.
 *
 * A level is only a named set of the same permission ids the server checks.
 * A role whose ids match no level is "custom" and is left exactly as it is
 * until someone picks a level.
 */

export interface AccessLevel {
  id: "none" | "view" | "full" | "kitchen" | "deliveries";
  label: string;
  /** Plain-words line shown under the module when this level is chosen. */
  hint?: string;
  permissions: readonly Permission[];
}

function modulePermissions(module: PermissionModuleId): Permission[] {
  return permissionsInModule(module).map((p) => p.id as Permission);
}

export function accessLevels(module: PermissionModuleId): AccessLevel[] {
  const all = modulePermissions(module);
  const none: AccessLevel = { id: "none", label: "No access", permissions: [] };
  const full: AccessLevel = { id: "full", label: "Full", permissions: all };
  if (module === "orders") {
    return [
      none,
      {
        id: "kitchen",
        label: "Kitchen only",
        hint: "Sees orders to make, marks them preparing and ready. No prices or customer contact.",
        permissions: ["orders.view_kitchen", "orders.update_status"],
      },
      {
        id: "deliveries",
        label: "Own deliveries",
        hint: "Sees only orders assigned to them, with the address. Marks them out for delivery and delivered.",
        permissions: ["orders.view_assigned", "orders.update_status"],
      },
      { id: "view", label: "View", hint: "Sees every order, but cannot change anything.", permissions: ["orders.view"] },
      full,
    ];
  }
  const view = permissionsInModule(module)
    .filter((p) => p.column === "view")
    .map((p) => p.id as Permission);
  return [none, { id: "view", label: "View", permissions: view }, full];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** The level a role currently has in a module, or null when its ticks match none ("custom"). */
export function currentLevel(module: PermissionModuleId, held: readonly string[]): AccessLevel | null {
  const inModule = held.filter((p) => permissionDefinition(p)?.module === module);
  return accessLevels(module).find((level) => sameSet(level.permissions, inModule)) ?? null;
}

/**
 * The role's permissions with one module set to `level` — every other module
 * untouched. Permissions the editor may not grant (`locked`) are left out.
 */
export function applyLevel(
  held: readonly Permission[],
  module: PermissionModuleId,
  level: AccessLevel,
  locked: readonly string[] = [],
): Permission[] {
  const outside = held.filter((p) => permissionDefinition(p)?.module !== module);
  const add = level.permissions.filter((p) => !locked.includes(p));
  return sortPermissions(withPrerequisites([...outside, ...add]));
}
