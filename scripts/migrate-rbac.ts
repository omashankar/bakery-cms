/**
 * Moves a database from the old role scheme to the permission registry.
 *
 * Run:  npx tsx scripts/migrate-rbac.ts            (dry run — prints, changes nothing)
 *       npx tsx scripts/migrate-rbac.ts --apply    (writes; saves a backup first)
 *       npx tsx scripts/migrate-rbac.ts --restore <backup.json>
 *
 * What "old" means: the roles seeded from the deleted types/permissions.ts held
 * module words ("orders", "settings") instead of permission ids, and every
 * controller allowed the role names "owner" and "admin". Concretely:
 *
 * 1. Users with role "admin" become "owner" — that is what "admin" meant.
 * 2. The five default roles are created if missing (never overwritten).
 * 3. Roles whose permissions are old module words are converted:
 *    - owner   → every permission (only for display; the owner is never
 *                limited by what is stored).
 *    - manager → the default Manager permissions, marked as a default role.
 *    - editor  → its members move to "content-editor", then it is removed.
 *    - anything else (e.g. viewer) → kept as a CUSTOM role, each module word
 *      turned into that module's VIEW permission only. Nothing gains the
 *      right to change anything it could not change before.
 *
 * Idempotent: a converted database has no old-style roles left, so a second
 * run finds nothing to do. Reversible: --apply writes every user and role it
 * touches to a backup file first, and --restore puts exactly those back.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    console.warn("[rbac] .env.local not found — relying on process env");
  }
}
loadEnvLocal();

/** Old module word → the VIEW permission of that module. Never a write. */
const LEGACY_TO_VIEW: Record<string, string> = {
  dashboard: "dashboard.view",
  orders: "orders.view",
  customers: "customers.view",
  products: "products.view",
  content: "pages.view",
  builders: "pages.view",
  media: "media.view",
  settings: "settings.view",
  reports: "reports.view",
};

function isLegacyList(list: string[]): boolean {
  return list.some((p) => !p.includes("."));
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const restoreAt = args.indexOf("--restore");

  const { connectDB } = await import("@/lib/server/db/mongoose");
  const { UserModel } = await import("@/lib/server/db/models/user.model");
  const { RoleModel } = await import("@/lib/server/db/models/role.model");
  const { SYSTEM_ROLES, ALL_PERMISSIONS, withPrerequisites } = await import("@/features/team/lib/permissions");
  const mongoose = (await import("mongoose")).default;
  await connectDB();

  if (restoreAt !== -1) {
    const file = args[restoreAt + 1];
    if (!file) throw new Error("--restore needs the backup file path");
    const backup = JSON.parse(readFileSync(file, "utf8")) as {
      users: Array<{ _id: string; role: string }>;
      roles: Array<Record<string, unknown> & { slug: string }>;
      createdRoles: string[];
    };
    for (const u of backup.users) await UserModel.updateOne({ _id: u._id }, { $set: { role: u.role } });
    for (const r of backup.roles) {
      const { _id, ...rest } = r;
      void _id;
      await RoleModel.replaceOne({ slug: r.slug }, rest, { upsert: true });
    }
    for (const slug of backup.createdRoles) await RoleModel.deleteOne({ slug });
    console.info(`[rbac] restored ${backup.users.length} users and ${backup.roles.length} roles; removed ${backup.createdRoles.length} created roles`);
    await mongoose.disconnect();
    return;
  }

  const plan: string[] = [];
  const backup = { takenAt: new Date().toISOString(), users: [] as unknown[], roles: [] as unknown[], createdRoles: [] as string[] };

  // 1. "admin" users → owner.
  const admins = await UserModel.find({ role: "admin" }).select("email role").lean();
  for (const u of admins) {
    plan.push(`user ${u.email}: role admin → owner`);
    backup.users.push({ _id: String(u._id), role: u.role });
  }

  // 2. Missing default roles.
  const roles = await RoleModel.find({}).lean();
  const present = new Set(roles.map((r) => r.slug));
  const missing = SYSTEM_ROLES.filter((r) => !present.has(r.slug));
  for (const r of missing) {
    plan.push(`role ${r.slug}: create (${r.permissions.length} permissions)`);
    backup.createdRoles.push(r.slug);
  }

  // 3. Old-style roles.
  const conversions: Array<{ slug: string; set?: Record<string, unknown>; deleteAfterMoving?: string }> = [];
  for (const role of roles) {
    const perms = role.permissions ?? [];
    if (!isLegacyList(perms)) continue;
    backup.roles.push(role);
    const system = SYSTEM_ROLES.find((r) => r.slug === role.slug);
    if (role.slug === "owner") {
      conversions.push({ slug: "owner", set: { permissions: [...ALL_PERMISSIONS], isSystem: true, name: "Owner" } });
      plan.push("role owner: old module words → every permission");
    } else if (system) {
      conversions.push({
        slug: role.slug,
        set: {
          permissions: [...system.permissions],
          isSystem: true,
          // Only the shipped old name is replaced; a name the shop chose stays.
          ...(role.name === "Store Manager" ? { name: system.name, description: system.description } : {}),
        },
      });
      plan.push(`role ${role.slug}: old module words → default ${system.name} permissions`);
    } else if (role.slug === "editor") {
      const members = await UserModel.find({ role: "editor" }).select("email role").lean();
      for (const u of members) {
        plan.push(`user ${u.email}: role editor → content-editor`);
        backup.users.push({ _id: String(u._id), role: u.role });
      }
      conversions.push({ slug: "editor", deleteAfterMoving: "content-editor" });
      plan.push("role editor: replaced by the default Content Editor role, then removed");
    } else {
      const mapped = withPrerequisites(perms.map((p) => LEGACY_TO_VIEW[p]).filter(Boolean));
      conversions.push({ slug: role.slug, set: { permissions: mapped, isSystem: false } });
      plan.push(`role ${role.slug}: kept as a custom role, view-only → [${mapped.join(", ")}]`);
    }
  }

  if (plan.length === 0) {
    console.info("[rbac] nothing to migrate — this database is already on the permission registry");
    await mongoose.disconnect();
    return;
  }

  console.info(`[rbac] ${apply ? "APPLYING" : "DRY RUN — nothing will change"}:`);
  for (const line of plan) console.info(`  - ${line}`);

  if (!apply) {
    console.info("[rbac] re-run with --apply to make these changes");
    await mongoose.disconnect();
    return;
  }

  const file = resolve(process.cwd(), `rbac-backup-${backup.takenAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.info(`[rbac] backup written: ${file}`);

  // Default roles first, so a member being moved always lands on a real role.
  for (const r of missing) {
    await RoleModel.updateOne(
      { slug: r.slug },
      { $setOnInsert: { slug: r.slug, name: r.name, description: r.description, isSystem: true, permissions: [...r.permissions] } },
      { upsert: true },
    );
  }
  if (admins.length > 0) await UserModel.updateMany({ role: "admin" }, { $set: { role: "owner" } });
  for (const c of conversions) {
    if (c.deleteAfterMoving) {
      await UserModel.updateMany({ role: c.slug }, { $set: { role: c.deleteAfterMoving } });
      await RoleModel.deleteOne({ slug: c.slug });
    } else if (c.set) {
      await RoleModel.updateOne({ slug: c.slug }, { $set: c.set });
    }
  }
  console.info("[rbac] done");
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("[rbac] failed:", error);
  process.exit(1);
});
