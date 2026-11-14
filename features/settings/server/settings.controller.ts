import { ok } from "@/lib/server/http/response";
import { withErrorHandler, AppError, NotFoundError, ConflictError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requirePermission, requireStaff, type Actor } from "@/lib/server/auth/access";
import { requestContext } from "@/lib/server/audit/audit-log";

import { sendTestEmail } from "@/lib/server/mail/send-test-email";
import { runDeliveryCheck } from "@/lib/server/mail/delivery-check";
import { rateLimit } from "@/lib/server/http/rate-limit";

import * as service from "./settings.service";
import { StaleSectionError } from "./settings.repository";
import { sectionSchemas } from "./settings.validators";
import { allowlisted } from "@/lib/server/http/allowlist";

/**
 * The permission a section needs to be CHANGED. The sign-in policy is security,
 * not shop configuration — "Change settings" must not be a way to switch off
 * the login lockout.
 */
function writePermission(section: string) {
  return section === "security" ? ("security.manage" as const) : ("settings.manage" as const);
}

/**
 * The settings as THIS person may see them.
 *
 * Every admin screen reads the settings — business labels, modules, the shop
 * name in the header — so every active member gets them. The mail server's
 * address and username are configuration of the shop's mail account; without
 * settings.view they are left out entirely, not just the password.
 */
export function settingsForActor(
  settings: Awaited<ReturnType<typeof service.getSettings>>,
  actor: Pick<Actor, "permissions">,
) {
  const redacted = redactMailPassword(settings);
  if (actor.permissions.has("settings.view")) return redacted;
  const { smtp: _smtp, ...rest } = redacted as Record<string, unknown>;
  void _smtp;
  return rest as typeof redacted;
}

type SectionContext = { params: Promise<{ section: string }> };

/**
 * The mail password never leaves the server.
 *
 * `getSettings()` returns the whole document because the MAIL TRANSPORT reads it
 * — but this is the HTTP boundary, and everything past it is a browser. The
 * password used to cross it in cleartext, and from there it was written to
 * `localStorage` by the settings store, survived logout (only the session key is
 * cleared), rode along to every device that admin signed in from, was readable
 * by any script on any admin page, and was swept into every downloadable backup
 * file — up to eight archived copies of it in localStorage at a time.
 *
 * This codebase already decided that is not acceptable, for the other secret it
 * holds: `features/payments/server/gateway-credentials.server.ts` keeps the
 * Razorpay key secret server-side and tells the browser only WHICH fields are
 * set. This is the same treatment for the same reason. The form is given
 * `passwordSet` so it can say "saved" without being told what was saved, and a
 * blank password on the way back in means "keep the stored one" (see
 * `updateSection`), so a save that does not touch the field cannot wipe it.
 */
export function redactMailPassword(settings: Awaited<ReturnType<typeof service.getSettings>>) {
  const smtp = (settings as { smtp?: Record<string, unknown> }).smtp;
  if (!smtp) return settings;

  return {
    ...settings,
    smtp: {
      ...smtp,
      password: "",
      passwordSet: Boolean(typeof smtp.password === "string" && smtp.password),
    },
  };
}

/**
 * The one way a settings document may become a response.
 *
 * `redactMailPassword` was applied at exactly ONE of the three places that hand
 * the document to a browser — the GET — and the two write endpoints returned it
 * whole. So the password was redacted when the admin opened Settings and sent
 * back in cleartext the moment they saved ANY section: a PUT about Google
 * Analytics answered with the shop's live mail credential in its body, and so
 * did every reset. It sat in the browser's network log, in whatever proxy or
 * CDN log the response passed through, and readable by any script on the page.
 *
 * The redaction is not the problem; remembering to call it was. Every settings
 * response goes through here now, so a fourth endpoint cannot quietly skip it.
 */
function settingsResponse(
  settings: Awaited<ReturnType<typeof service.getSettings>>,
  message: string,
) {
  return ok(redactMailPassword(settings), message);
}

export const getSettingsController = withErrorHandler(async () => {
  const actor = await requireStaff();
  return ok(settingsForActor(await service.getSettings(), actor), "Settings");
});

export const getPublicSettingsController = withErrorHandler(async () => {
  // No auth — the storefront needs branding/labels/commerce config to render.
  return ok(await service.getPublicSettings(), "Public settings");
});

export const getLabelsController = withErrorHandler(async () => {
  return ok(await service.getLabels(), "Business labels");
});

export const updateSectionController = withErrorHandler(
  async (request: Request, context: SectionContext) => {
    const { section } = await context.params;
    const session = await requirePermission(writePermission(section));

    /**
     * `in` on the OWN keys, not a bare index.
     *
     * `sectionSchemas[section]` reaches the prototype chain, so `__proto__`,
     * `constructor` and `toString` all answered with something truthy and walked
     * straight past this guard — then `validate()` was handed `Object.prototype`
     * and the route answered 500 instead of 404. The reset endpoint beside it
     * had the same shape and no validate step to stop it, so it returned 200
     * "Settings reset" for a section that does not exist and wrote an audit row
     * saying so.
     */
    const schema = allowlisted(sectionSchemas, section);
    if (!schema) throw new NotFoundError("Unknown settings section");

    const value = validate(schema, await readJson(request));
    const ctx = requestContext(request);
    // The section version this save was composed against; see
    // `sectionVersions` on the settings model.
    const header = request.headers.get("X-Section-Version");
    const expected = header !== null && header !== "" ? Number(header) : undefined;
    try {
      const updated = await service.updateSection(
        section,
        value,
        { ...ctx, actorId: session.sub, actorEmail: session.email },
        Number.isFinite(expected) ? expected : undefined,
      );
      return settingsResponse(updated, "Settings updated");
    } catch (error) {
      if (error instanceof StaleSectionError) throw new ConflictError(error.message);
      throw error;
    }
  },
);

export const resetSectionController = withErrorHandler(
  async (request: Request, context: SectionContext) => {
    const { section } = await context.params;
    const session = await requirePermission(writePermission(section));
    const ctx = requestContext(request);
    const updated = await service.resetSection(section, {
      ...ctx,
      actorId: session.sub,
      actorEmail: session.email,
    });
    return settingsResponse(updated, "Settings reset");
  },
);

/**
 * Sends a real test email to the signed-in admin, using the saved SMTP settings.
 *
 * The button that calls this used to toast "Test email queued (demo — no backend
 * connected)" without a network call of any kind. Now it verifies the connection
 * and delivers an actual message, so a wrong port or password fails HERE rather
 * than silently on the next customer's order confirmation.
 */
/**
 * "Is mail reaching inboxes?" — the From domain's DNS, and for Brevo (with
 * BREVO_API_KEY on the server) the account, the sender and Brevo's own log.
 * A server that accepts a message has not delivered it; this is the rest.
 */
export const deliveryCheckController = withErrorHandler(async (request: Request) => {
  const session = await requirePermission("settings.manage");
  rateLimit(`delivery-check:${session.sub}`, { limit: 20, windowMs: 10 * 60_000 });
  void request;
  const settings = (await service.getSettings()) as { smtp?: { host?: string; fromEmail?: string } };
  return ok(await runDeliveryCheck(settings.smtp ?? {}), "Delivery check");
});

export const sendTestEmailController = withErrorHandler(async (request: Request) => {
  const session = await requirePermission("settings.manage");

  // Only ever to the caller's own address. Accepting a recipient from the body
  // would turn an admin endpoint into a way to send mail from the shop's domain
  // to anyone.
  const result = await sendTestEmail(session.email);
  if (!result.sent) throw new AppError(result.error ?? "Could not send the test email", 502);

  void requestContext(request);
  return ok({ to: session.email }, "Test email sent");
});
