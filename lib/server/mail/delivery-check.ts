import "server-only";

import { promises as dns } from "node:dns";

/**
 * "Is mail actually reaching inboxes?" — answered with what can be checked.
 *
 * A mail server that ACCEPTS a message has not delivered it: the shop's
 * provider took every invitation and order confirmation ("250 queued") and
 * customers still saw nothing. What decides the rest is the sending domain's
 * DNS and the provider's own account, so this reads both:
 *
 * - the DNS of the From address's domain (SPF, DKIM, DMARC) — no key needed;
 * - for Brevo, with BREVO_API_KEY set on the server: the account, whether the
 *   From address is a verified sender and its domain authenticated, and
 *   Brevo's own log of what happened to recent messages.
 *
 * Read-only, and the API key never leaves the server.
 */

export interface DnsCheck {
  ok: boolean;
  record: string;
  note: string;
}

export interface BrevoReport {
  error?: string;
  account?: { email: string; company: string; plan: string; credits: number | null };
  sender?: { email: string; verified: boolean } | null;
  domain?: { name: string; authenticated: boolean; verified: boolean } | null;
  events?: { date: string; email: string; subject: string; event: string; reason: string }[];
}

export interface DeliveryCheck {
  fromEmail: string;
  domain: string;
  provider: "brevo" | "other";
  spf: DnsCheck;
  dkim: DnsCheck;
  dmarc: DnsCheck;
  /** null when the provider is not Brevo; `{ error }` when no key is set. */
  brevo: BrevoReport | null;
}

async function txt(name: string): Promise<string[]> {
  try {
    return (await dns.resolveTxt(name)).map((parts) => parts.join(""));
  } catch {
    return [];
  }
}

async function cname(name: string): Promise<string[]> {
  try {
    return await dns.resolveCname(name);
  } catch {
    return [];
  }
}

export async function checkDns(domain: string, provider: DeliveryCheck["provider"]) {
  const [rootTxt, dmarcTxt, brevo1, brevo2, brevo1Txt] = await Promise.all([
    txt(domain),
    txt(`_dmarc.${domain}`),
    cname(`brevo1._domainkey.${domain}`),
    cname(`brevo2._domainkey.${domain}`),
    txt(`mail._domainkey.${domain}`),
  ]);

  const spfRecord = rootTxt.find((r) => r.toLowerCase().startsWith("v=spf1")) ?? "";
  const spfHasBrevo = /include:(spf\.brevo\.com|spf\.sendinblue\.com)/i.test(spfRecord);
  const spf: DnsCheck =
    provider !== "brevo"
      ? { ok: Boolean(spfRecord), record: spfRecord, note: spfRecord ? "An SPF record is published." : "No SPF record." }
      : spfHasBrevo
        ? { ok: true, record: spfRecord, note: "SPF names Brevo." }
        : {
            ok: false,
            record: spfRecord,
            note: spfRecord
              ? `Recommended: add include:spf.brevo.com — e.g. ${spfRecord.replace(/\s+([~-]all)\s*$/i, " include:spf.brevo.com $1")}`
              : "Recommended: add a TXT record on the domain: v=spf1 include:spf.brevo.com ~all",
          };

  const dkimTargets = [...brevo1, ...brevo2];
  const dkim: DnsCheck =
    provider === "brevo"
      ? dkimTargets.length === 2
        ? { ok: true, record: dkimTargets.join(", "), note: "Brevo's two DKIM keys are published." }
        : brevo1Txt.some((r) => /k=rsa|p=/i.test(r))
          ? { ok: true, record: "mail._domainkey", note: "A DKIM key is published (mail._domainkey)." }
          : { ok: false, record: dkimTargets.join(", "), note: "Missing: Brevo's DKIM records (brevo1/brevo2._domainkey). Brevo → Senders, Domains → Authenticate shows the exact values." }
      : { ok: dkimTargets.length > 0 || brevo1Txt.length > 0, record: dkimTargets.join(", "), note: "Check your provider's DKIM instructions." };

  const dmarcRecord = dmarcTxt.find((r) => r.toLowerCase().startsWith("v=dmarc1")) ?? "";
  const dmarc: DnsCheck = dmarcRecord
    ? { ok: true, record: dmarcRecord, note: `DMARC is published (policy ${/p=(\w+)/i.exec(dmarcRecord)?.[1] ?? "?"}).` }
    : { ok: false, record: "", note: "Missing: a DMARC record at _dmarc — Gmail and Yahoo expect one. Start with: v=DMARC1; p=none" };

  return { spf, dkim, dmarc };
}

async function brevo<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    headers: { "api-key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(res.status === 401 ? "Brevo refused the API key." : body?.message || `Brevo answered ${res.status}.`);
  }
  return (await res.json()) as T;
}

export async function checkBrevo(fromEmail: string, key: string | undefined): Promise<BrevoReport> {
  if (!key) {
    return {
      error:
        "Add BREVO_API_KEY to the server's environment (Brevo → SMTP & API → API Keys) to see Brevo's own delivery log here.",
    };
  }
  try {
    const domainName = fromEmail.split("@")[1]?.toLowerCase() ?? "";
    const [account, senders, domains, events] = await Promise.all([
      brevo<{ email?: string; companyName?: string; plan?: { type?: string; credits?: number }[] }>("/account", key),
      brevo<{ senders?: { email?: string; active?: boolean }[] }>("/senders", key),
      brevo<{ domains?: { domain_name?: string; authenticated?: boolean; verified?: boolean }[] }>("/senders/domains", key).catch(
        () => ({ domains: [] }),
      ),
      brevo<{ events?: { date?: string; email?: string; subject?: string; event?: string; reason?: string }[] }>(
        "/smtp/statistics/events?limit=25&days=7&sort=desc",
        key,
      ),
    ]);
    const plan = account.plan?.[0];
    const sender = (senders.senders ?? []).find((s) => s.email?.toLowerCase() === fromEmail.toLowerCase());
    const domain = (domains.domains ?? []).find((d) => d.domain_name?.toLowerCase() === domainName);
    return {
      account: {
        email: account.email ?? "",
        company: account.companyName ?? "",
        plan: plan?.type ?? "",
        credits: typeof plan?.credits === "number" ? plan.credits : null,
      },
      sender: sender ? { email: sender.email ?? fromEmail, verified: Boolean(sender.active) } : null,
      domain: domain
        ? { name: domain.domain_name ?? domainName, authenticated: Boolean(domain.authenticated), verified: Boolean(domain.verified) }
        : null,
      events: (events.events ?? []).map((e) => ({
        date: e.date ?? "",
        email: e.email ?? "",
        subject: e.subject ?? "",
        event: e.event ?? "",
        reason: e.reason ?? "",
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not reach Brevo." };
  }
}

export async function runDeliveryCheck(smtp: { host?: string; fromEmail?: string }): Promise<DeliveryCheck> {
  const fromEmail = (smtp.fromEmail ?? "").trim();
  const domain = fromEmail.split("@")[1]?.toLowerCase() ?? "";
  const provider = /brevo|sendinblue/i.test(smtp.host ?? "") ? "brevo" : "other";
  const dnsResult = domain
    ? await checkDns(domain, provider)
    : {
        spf: { ok: false, record: "", note: "Set a From email first." },
        dkim: { ok: false, record: "", note: "Set a From email first." },
        dmarc: { ok: false, record: "", note: "Set a From email first." },
      };
  return {
    fromEmail,
    domain,
    provider,
    ...dnsResult,
    brevo: provider === "brevo" ? await checkBrevo(fromEmail, process.env.BREVO_API_KEY?.trim() || undefined) : null,
  };
}
