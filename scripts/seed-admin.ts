/**
 * Seed script: creates the RBAC roles and the first admin user.
 *
 * Run:  npm run seed
 * Env:  ADMIN_EMAIL / ADMIN_PASSWORD (optional) override the defaults below.
 *
 * Idempotent — re-running updates roles and leaves an existing admin untouched.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- Load .env.local manually (standalone scripts don't get Next's env) ---
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
    console.warn("[seed] .env.local not found — relying on process env");
  }
}
loadEnvLocal();

async function main() {
  const { connectDB } = await import("@/lib/server/db/mongoose");
  const { UserModel } = await import("@/lib/server/db/models/user.model");
  const { RoleModel } = await import("@/lib/server/db/models/role.model");
  const { hashPassword } = await import("@/lib/server/auth/password");
  const { placeholderRoles } = await import("@/types/permissions");
  const mongoose = (await import("mongoose")).default;

  await connectDB();
  console.info("[seed] connected to MongoDB");

  // 1. Roles — upsert by slug (derived from "role-owner" -> "owner").
  for (const role of placeholderRoles) {
    const slug = role.id.replace(/^role-/, "");
    await RoleModel.updateOne(
      { slug },
      {
        $set: {
          slug,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          permissions: role.permissions,
        },
      },
      { upsert: true },
    );
    console.info(`[seed] role ready: ${slug}`);
  }

  // 2. Admin user — create only if missing.
  const email = (process.env.ADMIN_EMAIL || "admin@bakery.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin@12345";

  const existing = await UserModel.findOne({ email });
  if (existing) {
    console.info(`[seed] admin already exists: ${email} (unchanged)`);
  } else {
    await UserModel.create({
      name: "Store Admin",
      email,
      passwordHash: await hashPassword(password),
      role: "owner",
      status: "active",
    });
    console.info(`[seed] admin created: ${email}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.warn(`[seed] default password used: "${password}" — change it after first login`);
    }
  }

  await mongoose.disconnect();
  console.info("[seed] done");
  process.exit(0);
}

main().catch((error) => {
  console.error("[seed] failed:", error);
  process.exit(1);
});
