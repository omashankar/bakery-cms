import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { locateDevice } from "@/lib/device-location";

/**
 * "MY LOCATION" WAITS FOR THE GPS.
 *
 * The owner (2026-10-28): "current location bhi shi se nhi dikhata". A
 * phone's first reading is its tower or Wi-Fi guess, hundreds of metres out;
 * GPS settles seconds later. The first reading was taken. Now the best of a
 * few seconds is, and a blocked permission says how to unblock it.
 */

type Success = (position: { coords: { latitude: number; longitude: number; accuracy: number } }) => void;
type Failure = (error: { code: number; PERMISSION_DENIED: number }) => void;

let onFix: Success = () => undefined;
let onError: Failure = () => undefined;
const clearWatch = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", {
    geolocation: {
      watchPosition: (ok: Success, fail: Failure) => {
        onFix = ok;
        onError = fail;
        return 7;
      },
      clearWatch,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearWatch.mockClear();
});

const fix = (latitude: number, accuracy: number) => ({ coords: { latitude, longitude: 75.84, accuracy } });

describe("locateDevice", () => {
  it("takes the GPS reading that follows a rough first one — not the first", async () => {
    const found = locateDevice();
    onFix(fix(25.2, 900)); // the tower's guess
    await vi.advanceTimersByTimeAsync(1_500);
    onFix(fix(25.1467, 12)); // GPS
    await expect(found).resolves.toEqual({ point: { lat: 25.1467, lng: 75.84 }, accuracy: 12 });
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("settles for the best it has a few seconds after the first, when nothing better comes — a computer", async () => {
    const found = locateDevice();
    onFix(fix(25.2, 3_000));
    await vi.advanceTimersByTimeAsync(3_100);
    await expect(found).resolves.toMatchObject({ accuracy: 3_000 });
  });

  it("keeps the better of two rough readings", async () => {
    const found = locateDevice();
    onFix(fix(25.2, 900));
    onFix(fix(25.15, 200));
    onFix(fix(25.3, 600));
    await vi.advanceTimersByTimeAsync(3_100);
    await expect(found).resolves.toMatchObject({ point: { lat: 25.15 }, accuracy: 200 });
  });

  it("says how to unblock a refused permission", async () => {
    const found = locateDevice();
    onError({ code: 1, PERMISSION_DENIED: 1 });
    await expect(found).rejects.toThrow(/blocked for this site.*address bar/);
  });

  it("gives up at the deadline when the device never answers", async () => {
    const found = locateDevice();
    const settled = expect(found).rejects.toThrow(/couldn't get your location/);
    await vi.advanceTimersByTimeAsync(10_100);
    await settled;
  });
});
