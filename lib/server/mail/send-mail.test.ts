// @vitest-environment node
/**
 * End-to-end proof that this codebase can actually send an email.
 *
 * Everything else about outbound mail could be verified by reading — types,
 * template rendering, whether a caller checks the result. This could not. So it
 * runs a real SMTP conversation against a real socket: nodemailer connects,
 * greets, hands over an envelope and a body, and the assertions are made on what
 * the server received rather than on what the client was asked to do.
 *
 * The stub server below speaks only the verbs nodemailer uses. That is the point
 * — a fake that accepted anything would prove nothing about the transport.
 */
import net from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SmtpSettings } from "@/types/settings";

/** Settings the mocked `getSettings` returns. Mutated per test. */
let smtp: SmtpSettings;

vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: () => Promise.resolve({ smtp }),
}));

const { sendMail, verifyMailConnection } = await import("./send-mail");
const { resetMailTransport } = await import("./transport");

interface Captured {
  from: string;
  to: string[];
  /** The raw DATA payload: headers, blank line, body. */
  data: string;
}

interface StubServer {
  port: number;
  received: Captured[];
  close: () => Promise<void>;
}

/**
 * A minimal SMTP server: 220 greeting, EHLO, MAIL FROM, RCPT TO, DATA, QUIT.
 *
 * `failAt` makes it refuse one verb, which is how the failure paths are checked
 * against a server that really says no rather than a stubbed rejection.
 */
async function startSmtpServer(failAt?: "MAIL" | "AUTH"): Promise<StubServer> {
  const received: Captured[] = [];

  const server = net.createServer((socket) => {
    let current: Captured = { from: "", to: [], data: "" };
    let inData = false;
    let buffer = "";

    socket.write("220 localhost ESMTP test\r\n");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      // DATA mode ends at a lone dot on its own line.
      if (inData) {
        const terminator = buffer.indexOf("\r\n.\r\n");
        if (terminator === -1) return;
        current.data = buffer.slice(0, terminator);
        buffer = buffer.slice(terminator + 5);
        inData = false;
        received.push(current);
        current = { from: "", to: [], data: "" };
        socket.write("250 2.0.0 Ok: queued\r\n");
      }

      let newline = buffer.indexOf("\r\n");
      while (!inData && newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        const verb = line.split(" ")[0].toUpperCase();

        if (verb === "EHLO" || verb === "HELO") {
          socket.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n");
        } else if (verb === "AUTH") {
          socket.write(
            failAt === "AUTH"
              ? "535 5.7.8 Authentication credentials invalid\r\n"
              : "235 2.7.0 Authentication successful\r\n"
          );
        } else if (verb === "MAIL") {
          if (failAt === "MAIL") {
            socket.write("550 5.1.0 Sender rejected\r\n");
          } else {
            current.from = /<(.*)>/.exec(line)?.[1] ?? "";
            socket.write("250 2.1.0 Ok\r\n");
          }
        } else if (verb === "RCPT") {
          current.to.push(/<(.*)>/.exec(line)?.[1] ?? "");
          socket.write("250 2.1.5 Ok\r\n");
        } else if (verb === "DATA") {
          inData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (verb === "QUIT") {
          socket.write("221 2.0.0 Bye\r\n");
          socket.end();
          return;
        } else {
          socket.write("250 2.0.0 Ok\r\n");
        }

        newline = buffer.indexOf("\r\n");
      }
    });

    socket.on("error", () => {
      // A client hanging up mid-conversation is not a test failure.
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) throw new Error("no port");

  return {
    port: address.port,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/** Points the saved settings at the stub. `none` keeps the socket plain. */
function configure(port: number, overrides: Partial<SmtpSettings> = {}) {
  smtp = {
    host: "127.0.0.1",
    port,
    username: "postmaster",
    password: "",
    fromEmail: "orders@bakery.test",
    fromName: "Sweet Crumb, Mumbai",
    encryption: "none",
    enabled: true,
    ...overrides,
  };
  resetMailTransport();
}

let stub: StubServer | null = null;

beforeEach(() => {
  smtp = {
    host: "",
    port: 0,
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
    encryption: "none",
    enabled: false,
  };
  resetMailTransport();
});

afterEach(async () => {
  await stub?.close();
  stub = null;
  resetMailTransport();
});

describe("sendMail against a real SMTP conversation", () => {
  it("delivers the message, and the server receives what was intended", async () => {
    stub = await startSmtpServer();
    configure(stub.port);

    const result = await sendMail({
      to: "asha@example.com",
      subject: "Order BK-20260730-1234 confirmed",
      html: "<p>Hi Asha,</p><p>Total: ₹1,250.00</p>",
    });

    expect(result).toEqual({ sent: true });
    expect(stub.received).toHaveLength(1);

    const [message] = stub.received;
    expect(message.from).toBe("orders@bakery.test");
    expect(message.to).toEqual(["asha@example.com"]);
    expect(message.data).toContain("To: asha@example.com");
    expect(message.data).toContain("Hi Asha,");
  });

  it("quotes a display name containing a comma so it cannot split the header", async () => {
    stub = await startSmtpServer();
    configure(stub.port, { fromName: "Sweet Crumb, Mumbai" });

    await sendMail({ to: "asha@example.com", subject: "From header", html: "<p>x</p>" });

    // Unquoted, "Sweet Crumb, Mumbai" <a@b> reads as two addresses and the
    // message is rejected or delivered from a mangled sender.
    const from = /^From: (.*)$/m.exec(stub.received[0].data)?.[1] ?? "";
    expect(from).toContain('"Sweet Crumb, Mumbai"');
    expect(from).toContain("<orders@bakery.test>");
  });

  it("sends a plain-text alternative alongside the HTML", async () => {
    stub = await startSmtpServer();
    configure(stub.port);

    await sendMail({
      to: "asha@example.com",
      subject: "Multipart",
      html: "<p>First line</p><p>Second line</p>",
    });

    const { data } = stub.received[0];
    expect(data).toContain("multipart/alternative");

    // Assert on the text/plain PART, not the whole message — the html part
    // legitimately still carries the tags. In the text part they are stripped and
    // the paragraph break has become a newline, so a text-only client shows
    // readable copy instead of markup or nothing.
    const parts = data.split(/Content-Type: /);
    const plain = parts.find((part) => part.startsWith("text/plain")) ?? "";
    expect(plain).toContain("First line\r\nSecond line");
    expect(plain).not.toContain("<p>");
  });

  it("reports the server's refusal instead of claiming delivery", async () => {
    stub = await startSmtpServer("MAIL");
    configure(stub.port);

    const result = await sendMail({
      to: "asha@example.com",
      subject: "Rejected",
      html: "<p>nope</p>",
    });

    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/Sender rejected|550/);
    expect(stub.received).toHaveLength(0);
  });

  it("never lets the SMTP password into the error text", async () => {
    stub = await startSmtpServer("AUTH");
    configure(stub.port, { password: "hunter2-super-secret" });

    const result = await sendMail({
      to: "asha@example.com",
      subject: "Auth failure",
      html: "<p>nope</p>",
    });

    expect(result.sent).toBe(false);
    // A credential in an error string ends up in a log and in an admin's toast.
    expect(result.error).not.toContain("hunter2-super-secret");
  });
});

describe("sendMail when there is nothing to send with", () => {
  it("says sending is switched off, rather than failing obscurely", async () => {
    smtp = { ...smtp, enabled: false, host: "127.0.0.1", port: 25, fromEmail: "a@b.test" };
    resetMailTransport();

    const result = await sendMail({ to: "a@b.test", subject: "x", html: "<p>x</p>" });

    expect(result.sent).toBe(false);
    expect(result.error).toContain("turned off");
  });

  it("names the missing fields when the configuration is half-filled", async () => {
    smtp = { ...smtp, enabled: true, host: "", port: 587, fromEmail: "" };
    resetMailTransport();

    const result = await sendMail({ to: "a@b.test", subject: "x", html: "<p>x</p>" });

    expect(result.sent).toBe(false);
    expect(result.error).toContain("incomplete");
  });

  it("does not require a password — an internal relay legitimately has none", async () => {
    stub = await startSmtpServer();
    configure(stub.port, { password: "" });

    await expect(
      sendMail({ to: "a@b.test", subject: "No auth", html: "<p>x</p>" })
    ).resolves.toEqual({ sent: true });
  });
});

describe("verifyMailConnection", () => {
  it("succeeds against a reachable server", async () => {
    stub = await startSmtpServer();
    configure(stub.port);

    await expect(verifyMailConnection()).resolves.toEqual({ sent: true });
  });

  it("fails against a port with nothing listening", async () => {
    // Bind then immediately release, so the port is almost certainly free.
    const throwaway = await startSmtpServer();
    const deadPort = throwaway.port;
    await throwaway.close();

    configure(deadPort);

    const result = await verifyMailConnection();
    expect(result.sent).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("the transport cache", () => {
  it("picks up new settings, so saving credentials takes effect at once", async () => {
    const first = await startSmtpServer();
    configure(first.port);
    await sendMail({ to: "a@b.test", subject: "first", html: "<p>1</p>" });
    expect(first.received).toHaveLength(1);
    await first.close();

    // A second server on a different port: without invalidation the cached
    // transport would keep dialling the old one.
    stub = await startSmtpServer();
    configure(stub.port);
    await sendMail({ to: "a@b.test", subject: "second", html: "<p>2</p>" });

    expect(stub.received).toHaveLength(1);
    expect(stub.received[0].data).toContain("second");
  });
});
