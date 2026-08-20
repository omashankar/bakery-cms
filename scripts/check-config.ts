/**
 * Is this deployment ready to take a real customer?
 *
 * Run:  npm run check
 *
 * Answers the question the README cannot: not "does the app build" but "is this
 * shop configured". Each line either passes, warns, or blocks, and a blocking
 * line says what breaks if it is left alone — because most of these fail
 * SILENTLY. An unset webhook secret does not crash anything; it just means the
 * one route that notices money taken with no order attached answers 503 to
 * every delivery, and nobody finds out until a customer asks where their cake is.
 *
 * Reads only. Prints no secret values — only whether each is set, and for the
 * payment keys which MODE they are in, because "still on test keys" is the
 * single most expensive thing to discover after opening.
 */

import Module from "node:module";

/**
 * `server-only` throws by design when it is imported outside a React Server
 * Component, and several modules this script wants to REUSE rather than
 * reimplement pull it in. Point it at the no-op build Next ships for the server
 * bundle: this file only ever runs on a terminal, which is the one place the
 * guard exists to protect and is already safe.
 */
const resolveFilename = (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })
  ._resolveFilename;
(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  request: string,
  ...rest: unknown[]
) {
  const target =
    request === "server-only" || request === "client-only"
      ? "next/dist/compiled/server-only/empty.js"
      : request;
  return resolveFilename.call(this, target, ...rest);
};

import mongoose from "mongoose";

type Level = "ok" | "warn" | "block";

interface Line {
  level: Level;
  label: string;
  detail: string;
  /** What to do, when it is not already fine. */
  fix?: string;
}

const lines: Line[] = [];
const add = (level: Level, label: string, detail: string, fix?: string) =>
  lines.push({ level, label, detail, fix });

const isSet = (v: string | undefined) => Boolean(v && v.trim());

async function main() {
  console.log("\n  Bakery CMS — configuration check\n");

  // ---------------------------------------------------------------- database
  const uri = process.env.MONGODB_URI;
  if (!isSet(uri)) {
    add("block", "Database", "MONGODB_URI is NOT SET", "Nothing can start without it.");
  } else {
    const dbName = (() => {
      try {
        return new URL(uri!).pathname.replace(/^\//, "") || "(default)";
      } catch {
        return "(unparseable)";
      }
    })();
    try {
      await mongoose.connect(uri!, { bufferCommands: false, serverSelectionTimeoutMS: 8000 });
      add("ok", "Database", `connected — "${dbName}"`);
      if (/localhost|127\.0\.0\.1/.test(uri!)) {
        add("warn", "Database host", "points at localhost", "A hosted deployment cannot reach it.");
      }
    } catch (error) {
      add(
        "block",
        "Database",
        `cannot connect — ${(error as Error).message.split("\n")[0]}`,
        "Check the URI, the password encoding, and Atlas → Network Access for this host's IP.",
      );
    }
  }

  const connected = mongoose.connection.readyState === 1;

  // ------------------------------------------------------------------ tokens
  const access = process.env.JWT_ACCESS_SECRET?.trim();
  const refresh = process.env.JWT_REFRESH_SECRET?.trim();
  const customer = process.env.JWT_CUSTOMER_SECRET?.trim();

  if (!isSet(access) || !isSet(refresh)) {
    add("block", "Token secrets", "JWT_ACCESS_SECRET / JWT_REFRESH_SECRET missing", "Generate with: openssl rand -base64 32");
  } else if (access === refresh) {
    add(
      "block",
      "Token secrets",
      "access and refresh secrets are IDENTICAL",
      "The signature is what separates the two token types. Use different values.",
    );
  } else {
    add("ok", "Token secrets", "access and refresh are set and differ");
  }

  if (!isSet(customer)) {
    add(
      "block",
      "Customer token secret",
      "JWT_CUSTOMER_SECRET is NOT SET — it falls back to the ADMIN access secret",
      "A storefront customer's token and an admin's are then signed with one key; only the `type` claim separates them. openssl rand -base64 32",
    );
  } else if (customer === access || customer === refresh) {
    add("block", "Customer token secret", "reuses the admin secret", "Give it its own value.");
  } else {
    add("ok", "Customer token secret", "set, and distinct from the admin secrets");
  }

  // ----------------------------------------------------------------- payment
  try {
    const { getRazorpayStatus } = await import("@/lib/server/payments/razorpay-credentials");
    const s = await getRazorpayStatus();

    if (!s.configured) {
      add("block", "Razorpay keys", "not configured", "The shop cannot take an online payment.");
    } else if (s.testMode) {
      add(
        "block",
        "Razorpay keys",
        `TEST mode (${s.keyId.slice(0, 12)}…, from ${s.source})`,
        "No real money moves. Switch to live keys before opening.",
      );
    } else {
      add("ok", "Razorpay keys", `LIVE mode (from ${s.source})`);
    }

    if (!s.webhookConfigured) {
      add(
        "block",
        "Razorpay webhook secret",
        "NOT SET — /api/razorpay/webhook answers 503 to every delivery",
        "That route is the only thing that notices money taken with no order attached (a customer whose tab dies mid-payment). Set RAZORPAY_WEBHOOK_SECRET or Admin → Payments → Gateway, and register the URL in Razorpay → Settings → Webhooks. Live mode is a SEPARATE registration with its own secret.",
      );
    } else {
      add("ok", "Razorpay webhook secret", "configured");
    }
  } catch (error) {
    add("warn", "Razorpay", `could not be read — ${(error as Error).message.split("\n")[0]}`);
  }

  // ------------------------------------------------------------- cloudinary
  try {
    const { isCloudinaryConfigured } = await import("@/lib/server/media/cloudinary");
    if (isCloudinaryConfigured()) {
      add("ok", "Cloudinary", "configured");
    } else {
      add(
        "block",
        "Cloudinary",
        "not configured — the shop cannot upload its own photos",
        "Set CLOUDINARY_URL or the three CLOUDINARY_* vars, then rebuild: next.config.ts reads the cloud name at BUILD time to let res.cloudinary.com through the image optimiser.",
      );
    }
  } catch {
    add("warn", "Cloudinary", "could not be read");
  }

  // ---------------------------------------------------------------- site URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (isSet(siteUrl)) {
    add("ok", "Public site URL", siteUrl!);
  } else {
    add(
      "warn",
      "Public site URL",
      "NEXT_PUBLIC_SITE_URL not set — invoice links fall back to the SEO store's canonical URL",
      "If that is still the seeded `.example` domain, every 'view your invoice' link points at a domain that by RFC 2606 never resolves. Set this, or set the canonical URL under Admin → SEO.",
    );
  }

  // ------------------------------------------------------------ proxy / rate
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    add("ok", "Proxy trust", "enabled — IP-keyed rate limits and the maintenance allow-list are active");
  } else {
    add(
      "warn",
      "Proxy trust",
      "TRUST_PROXY_HEADERS is not \"true\" — every IP-keyed rate limit is inert by design",
      "Set it ONLY behind a reverse proxy you control that rewrites x-forwarded-for. Also note lib/server/http/rate-limit.ts is a per-process Map, so on an autoscaled host each instance counts separately.",
    );
  }

  // ------------------------------------------------------------- seed admin
  /**
   * Asked of the DATABASE, not of the environment.
   *
   * The env var and the seed script's literal being equal proves nothing: the
   * seed only ever CREATES a missing account and never updates an existing one,
   * so a shop whose owner has since changed their password looks identical from
   * the outside. Only a bcrypt compare against the stored hash answers it, and
   * getting this wrong in the alarming direction sends someone rotating a
   * credential that was already fine.
   */
  const SHIPPED_DEFAULT = "Admin@12345";
  if (connected) {
    try {
      const { verifyPassword } = await import("@/lib/server/auth/password");
      const owners = (await mongoose.connection
        .db!.collection("users")
        .find({}, { projection: { email: 1, passwordHash: 1 } })
        .toArray()) as unknown as { email?: string; passwordHash?: string }[];

      const weak: string[] = [];
      for (const u of owners) {
        if (u.passwordHash && (await verifyPassword(SHIPPED_DEFAULT, u.passwordHash))) {
          weak.push(String(u.email ?? "(no email)"));
        }
      }

      if (weak.length > 0) {
        add(
          "block",
          "Admin password",
          `${weak.length} account(s) still open with the password hardcoded in this repo`,
          `Anyone holding this repository can sign in as ${weak.join(", ")}. Change it from Admin → Profile — editing ADMIN_PASSWORD does nothing, the seed never updates an existing account.`,
        );
      } else {
        add("ok", "Admin password", `${owners.length} account(s), none on the shipped default`);
      }
    } catch (error) {
      add("warn", "Admin password", `could not be checked — ${(error as Error).message.split("\n")[0]}`);
    }
  }

  if (!isSet(process.env.ADMIN_PASSWORD)) {
    add(
      "warn",
      "Seed admin password",
      "ADMIN_PASSWORD not set — a FRESH `npm run seed` would use the repo's hardcoded default",
      "Harmless for this install (the seed never touches an existing account), but set it before seeding anywhere new.",
    );
  }

  // ------------------------------------------------ things that live in Mongo
  if (connected) {
    try {
      const db = mongoose.connection.db!;
      const settings = (await db.collection("settings").findOne({ key: "singleton" })) as {
        smtp?: { host?: string; user?: string };
        maintenance?: { isEnabled?: boolean };
      } | null;

      const smtp = settings?.smtp ?? {};
      if (isSet(smtp.host) && isSet(smtp.user)) {
        add("ok", "Outbound mail (SMTP)", `configured — ${String(smtp.host)}`);
      } else {
        add(
          "block",
          "Outbound mail (SMTP)",
          "not configured in Admin → Settings → SMTP",
          "Order confirmations and invoices cannot be sent. Use a domain the bakery owns and publish SPF/DKIM, or mail lands in spam.",
        );
      }

      const maintenance = settings?.maintenance ?? {};
      if (maintenance.isEnabled) {
        add("warn", "Maintenance mode", "the storefront is currently CLOSED to customers");
      }

      // Demo content the owner has to replace — counted, not guessed.
      const [demoReviews, totalReviews, unsplash, totalProducts, noExpiry] = await Promise.all([
        db.collection("reviews").countDocuments({ authorEmail: { $regex: "@demo\\.com$", $options: "i" } }),
        db.collection("reviews").countDocuments({}),
        db.collection("products").countDocuments({ images: { $regex: "images.unsplash.com", $options: "i" } }),
        db.collection("products").countDocuments({}),
        db.collection("coupons").countDocuments({ isActive: true, expiresAt: { $in: [null, ""] } }),
      ]);

      if (demoReviews > 0) {
        add("warn", "Reviews", `${demoReviews} of ${totalReviews} are demo rows (@demo.com)`, "Invented names and ratings on a live shop.");
      } else {
        add("ok", "Reviews", `${totalReviews} real`);
      }

      if (unsplash > 0) {
        add("warn", "Product photos", `${unsplash} of ${totalProducts} are Unsplash stock`, "Needs Cloudinary configured first.");
      } else {
        add("ok", "Product photos", `${totalProducts} products, none on stock imagery`);
      }

      if (noExpiry > 0) {
        add("warn", "Coupons", `${noExpiry} active coupon(s) never expire`, "They will keep discounting for as long as the shop runs.");
      }
    } catch (error) {
      add("warn", "Database contents", `could not be inspected — ${(error as Error).message.split("\n")[0]}`);
    }
  }

  // ----------------------------------------------------------------- report
  const icon: Record<Level, string> = { ok: "  ok  ", warn: " warn ", block: "BLOCK " };

  for (const l of lines) {
    console.log(`  [${icon[l.level]}] ${l.label.padEnd(24)} ${l.detail}`);
    if (l.fix && l.level !== "ok") console.log(`            ↳ ${l.fix}`);
  }

  const blocking = lines.filter((l) => l.level === "block").length;
  const warning = lines.filter((l) => l.level === "warn").length;

  console.log("");
  if (blocking === 0 && warning === 0) {
    console.log("  Nothing outstanding — this deployment can take a real customer.\n");
  } else {
    console.log(
      `  ${blocking} blocking, ${warning} to look at. Blocking items mean a real customer` +
        `\n  would hit something broken — usually silently.\n`,
    );
  }

  if (connected) await mongoose.disconnect();
  process.exit(blocking > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("\n  check failed to run:", error);
  process.exit(2);
});
