import { ok } from "@/lib/server/http/response";
import { withErrorHandler, AppError, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import { sendTestEmail } from "@/lib/server/mail/send-test-email";

import * as service from "./settings.service";
import { sectionSchemas, type SettingsSection } from "./settings.validators";

/** Roles allowed to read/write settings (owner + legacy admin). */
const SETTINGS_ROLES = ["owner", "admin"] as const;

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
  await requireRole(...SETTINGS_ROLES);
  return settingsResponse(await service.getSettings(), "Settings");
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
    const session = await requireRole(...SETTINGS_ROLES);
    const { section } = await context.params;

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
    if (!Object.hasOwn(sectionSchemas, section)) {
      throw new NotFoundError("Unknown settings section");
    }
    const schema = sectionSchemas[section as SettingsSection];

    const value = validate(schema, await readJson(request));
    const ctx = requestContext(request);
    const updated = await service.updateSection(section, value, {
      ...ctx,
      actorId: session.sub,
      actorEmail: session.email,
    });
    return settingsResponse(updated, "Settings updated");
  },
);

export const resetSectionController = withErrorHandler(
  async (request: Request, context: SectionContext) => {
    const session = await requireRole(...SETTINGS_ROLES);
    const { section } = await context.params;
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
export const sendTestEmailController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...SETTINGS_ROLES);

  // Only ever to the caller's own address. Accepting a recipient from the body
  // would turn an admin endpoint into a way to send mail from the shop's domain
  // to anyone.
  const result = await sendTestEmail(session.email);
  if (!result.sent) throw new AppError(result.error ?? "Could not send the test email", 502);

  void requestContext(request);
  return ok({ to: session.email }, "Test email sent");
});
