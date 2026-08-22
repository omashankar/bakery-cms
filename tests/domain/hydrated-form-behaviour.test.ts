/**
 * `useHydratedForm` RUN, not read.
 *
 * Nine admin screens replace a whole stored document when they save — the SEO
 * record, the header, the footer, appearance, inventory settings, custom code,
 * the admin profile, the invoice design. All of them go through this hook, and
 * until now nothing exercised it: `settings-form-gating.test.ts` checks that
 * each screen CALLS it, which is a statement about imports, not about what
 * happens when the server's copy arrives late.
 *
 * That is the wrong way round for the most safety-critical client hook in the
 * admin. Its whole job is to stop a browser that has not read the server yet
 * from pushing the demo seed over a real shop's identity — and the failures
 * below are not hypothetical, they are the ones this hook was written after,
 * each found in production code that looked correct.
 *
 * React is rendered here for the first time in this suite. The environment is
 * already jsdom (the repositories persist through localStorage), so the harness
 * is a root, a probe component and `act` — no new dependency.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { useHydratedForm, type HydratedForm } from "@/features/settings/lib/use-hydrated-form";
import type { HydrationGate } from "@/lib/hydration-gate";

interface Identity {
  name: string;
}

const SEED: Identity = { name: "Demo Bakery" };
const SERVER: Identity = { name: "Sweet Crumbs Kota" };
const UPDATED_EVENT = "test-store-updated";

/** A gate that has NOT settled — the cold-load case every one of these is about. */
const shutGate: HydrationGate = {
  hasSettled: () => false,
  markSettled: () => undefined,
  waitForSettled: async () => false,
};

interface Harness {
  /** The hook's latest return value. */
  form: HydratedForm<Identity>;
  unmount: () => void;
}

/**
 * Renders the hook and keeps a LIVE handle on its return value.
 *
 * A getter rather than a snapshot: every assertion below is about a value that
 * changed since the last one, and a captured object would answer with the state
 * from before the thing being tested happened.
 */
function render(options: {
  read: () => Identity;
  ensureHydrated: () => Promise<boolean>;
  updatedEvent?: string;
}): Harness {
  let latest: HydratedForm<Identity> | null = null;

  function Probe() {
    latest = useHydratedForm<Identity>({
      read: options.read,
      fallback: SEED,
      gate: shutGate,
      ensureHydrated: options.ensureHydrated,
      updatedEvent: options.updatedEvent,
    });
    return null;
  }

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(Probe));
  });

  return {
    get form() {
      if (!latest) throw new Error("the probe never rendered");
      return latest;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  // React 19 refuses to apply updates made outside `act` without this, and says
  // so rather than silently dropping them.
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("a form whose server copy is still in flight", () => {
  it("adopts the arriving values BEFORE it unlocks", async () => {
    /**
     * The failure this hook exists for.
     *
     * The local store answers with the demo seed while the server read is in
     * flight. If the gate opens without re-reading, the admin is looking at
     * placeholder values on an unlocked form — and Save is a replace-all.
     */
    let store = SEED;
    let settle: (ok: boolean) => void = () => undefined;

    const harness = render({
      read: () => store,
      ensureHydrated: () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    });

    expect(harness.form.hydration).toBe("pending");
    expect(harness.form.value).toEqual(SEED);

    // The server's copy lands in the store, exactly as a *ServerSync writes it.
    store = SERVER;
    await act(async () => {
      settle(true);
    });

    expect(harness.form.hydration).toBe("ready");
    expect(harness.form.value, "the form unlocked still holding the seed").toEqual(SERVER);
    expect(harness.form.saved, "a save now would look like an edit of the seed").toEqual(SERVER);
    expect(harness.form.isDirty).toBe(false);

    harness.unmount();
  });

  it("says so when the read never lands, instead of unlocking anyway", async () => {
    let settle: (ok: boolean) => void = () => undefined;

    const harness = render({
      read: () => SEED,
      ensureHydrated: () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    });

    await act(async () => {
      settle(false);
    });

    // "unavailable", not "ready" — the caller shows a notice and blocks the
    // save. Reporting "ready" here is how a seed gets pushed over real data
    // with no request having succeeded at all.
    expect(harness.form.hydration).toBe("unavailable");
    expect(harness.form.canSave).toBe(false);

    harness.unmount();
  });

  it("does not overwrite what the admin has already typed", async () => {
    /**
     * The other side of the same rule.
     *
     * Hydration arriving mid-word must not discard the edit — which is why the
     * callers hold their fields closed until `hydration !== "pending"`, and why
     * that gating is not optional.
     */
    let store = SEED;
    let settle: (ok: boolean) => void = () => undefined;

    const harness = render({
      read: () => store,
      ensureHydrated: () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    });

    act(() => {
      harness.form.edit((previous) => ({ ...previous, name: "Half-typed nam" }));
    });

    store = SERVER;
    await act(async () => {
      settle(true);
    });

    expect(harness.form.value.name, "hydration discarded an edit in progress").toBe(
      "Half-typed nam",
    );

    harness.unmount();
  });
});

describe("a write the server refused", () => {
  async function hydrated(updatedEvent?: string) {
    let store = SERVER;
    let settle: (ok: boolean) => void = () => undefined;

    const harness = render({
      read: () => store,
      ensureHydrated: () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
      updatedEvent,
    });

    await act(async () => {
      settle(true);
    });

    return {
      harness,
      setStore: (next: Identity) => {
        store = next;
      },
    };
  }

  it("leaves the form dirty, so Save stays live for a retry", async () => {
    const { harness } = await hydrated();

    act(() => {
      harness.form.edit(() => ({ name: "Renamed" }));
    });
    expect(harness.form.isDirty).toBe(true);

    await act(async () => {
      await harness.form.runWrite(async () => ({ value: { name: "Renamed" }, accepted: false }));
    });

    expect(harness.form.value, "the admin's text was thrown away").toEqual({ name: "Renamed" });
    expect(harness.form.saved, "a refused write moved the saved baseline").toEqual(SERVER);
    expect(harness.form.isDirty, "a refused write left the form looking clean").toBe(true);

    harness.unmount();
  });

  it("commits the baseline when the server DID accept it", async () => {
    // The counterpart, so the assertion above cannot be satisfied by a hook
    // that simply never moves `saved`.
    const { harness } = await hydrated();

    act(() => {
      harness.form.edit(() => ({ name: "Renamed" }));
    });

    await act(async () => {
      await harness.form.runWrite(async () => ({ value: { name: "Renamed" }, accepted: true }));
    });

    expect(harness.form.saved).toEqual({ name: "Renamed" });
    expect(harness.form.isDirty).toBe(false);

    harness.unmount();
  });

  it("is not re-baselined by the resync its own local write triggers", async () => {
    /**
     * The sharpest of them, and the one that hid the longest.
     *
     * These stores dual-write: the local copy is written and the store's
     * updated-event dispatched SYNCHRONOUSLY, before the server round-trip
     * resolves. So the resync listener fires while the save is still in flight
     * and sets `saved` to the value being written. The server then refuses it,
     * and the form looks clean: Save greyed out, nothing to retry, while the
     * toast says it saved nowhere.
     *
     * RESET, not an edit — and the difference is the whole test.
     *
     * The first version typed into the form first, which left it DIRTY, and the
     * resync's own "never clobber unsaved edits" rule then turned the listener
     * away before `writingRef` was ever consulted. It passed with the
     * suppression deleted: a test named after a guard, unable to fail for the
     * guard's absence. "Reset to defaults" is the real shape — the form is
     * pristine, so nothing else stands between the listener and the baseline.
     */
    const DEFAULTS: Identity = { name: "My Bakery" };
    const { harness, setStore } = await hydrated(UPDATED_EVENT);

    expect(harness.form.isDirty, "the reset case starts pristine").toBe(false);

    let finish: (result: { value: Identity; accepted: boolean }) => void = () => undefined;
    const writing = act(async () => {
      await harness.form.runWrite(
        () =>
          new Promise<{ value: Identity; accepted: boolean }>((resolve) => {
            finish = resolve;
          }),
      );
    });

    // The local half of the dual-write has landed and announced itself, while
    // the request is still open.
    setStore(DEFAULTS);
    act(() => {
      window.dispatchEvent(new Event(UPDATED_EVENT));
    });

    finish({ value: DEFAULTS, accepted: false });
    await writing;

    expect(harness.form.value, "the reset is not even shown").toEqual(DEFAULTS);
    expect(harness.form.saved, "the in-flight value became the baseline").toEqual(SERVER);
    expect(harness.form.isDirty, "a refused reset ended up looking clean").toBe(true);

    harness.unmount();
  });
});
