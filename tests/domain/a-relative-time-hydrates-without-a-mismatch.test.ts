import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

import { RelativeTime } from "@/components/shared/relative-time";

/**
 * "3m ago" IN THE HTML, "15h ago" IN THE BROWSER.
 *
 * The admin products list threw a hydration error (2026-10-27): a tab whose
 * HTML was rendered three minutes after a save was hydrated the next morning.
 * Any "x ago" rendered on the server meets the same thing at a minute's
 * boundary. The element must hydrate without an error AND end up showing the
 * browser's words — silencing the warning alone leaves yesterday's on screen.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RENDERED = Date.parse("2026-10-26T13:05:53.000Z");
const SAVED = new Date(RENDERED - 3 * 60_000).toISOString();

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("a relative time", () => {
  it("hydrates hours later without an error, and then says the browser's words", async () => {
    vi.spyOn(Date, "now").mockReturnValue(RENDERED);
    const html = renderToString(createElement("p", null, "Updated ", createElement(RelativeTime, { date: SAVED })));
    expect(html).toContain("3m ago");

    vi.spyOn(Date, "now").mockReturnValue(RENDERED + 15 * 3_600_000);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    const errors: unknown[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));
    await act(async () => {
      hydrateRoot(container, createElement("p", null, "Updated ", createElement(RelativeTime, { date: SAVED })), {
        onRecoverableError: (error) => errors.push(error),
      });
    });

    expect(errors).toEqual([]);
    expect(container.textContent).toBe("Updated 15h ago");
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe(SAVED);
  });

  it("is the only way a component prints one — 46 places used to call the formatter", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (file.endsWith(".tsx") && !file.endsWith("relative-time.tsx")) {
          if (fs.readFileSync(file, "utf8").includes("formatRelativeTime(")) offenders.push(file);
        }
      }
    };
    for (const dir of ["apps", "components", "features", "app"]) walk(dir);
    expect(offenders).toEqual([]);
  });

  it("says nothing it cannot read as a date, and claims no dateTime for it", () => {
    const html = renderToString(createElement(RelativeTime, { date: "not a date" }));
    expect(html).not.toContain("datetime");
  });
});
