"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Telling the kitchen and a rider that something new is on their list.
 *
 * Both screens refreshed themselves quietly: a new order slid into the list
 * and nobody looked up. A tablet on a counter and a phone in a pocket need to
 * be TOLD — a short tone, a buzz on a phone, a note on screen, and a count in
 * the tab's title for a screen that is not in front.
 *
 * Browsers will not play a sound until the page has been touched, so the
 * tone is armed by the first tap — the staff tap these screens all shift. If
 * it is not armed, the note and the title still arrive.
 */

let audio: AudioContext | null = null;
let unseen = 0;
let baseTitle = "";

function tone() {
  try {
    if (!audio || audio.state !== "running") return;
    const now = audio.currentTime;
    for (const [at, freq] of [
      [0, 880],
      [0.18, 1175],
    ] as const) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.3, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.35);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.4);
    }
  } catch {
    // No sound is not a failure; the note and the title still say it.
  }
}

function clearBadge() {
  if (unseen === 0) return;
  unseen = 0;
  if (baseTitle) document.title = baseTitle;
}

/** Ring, buzz, note and badge — for `message`, `count` new things. */
export function announceArrivals(message: string, count = 1): void {
  if (typeof window === "undefined" || count <= 0) return;
  tone();
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Not every browser lets a page vibrate.
  }
  toast(message, { duration: 10_000 });
  if (!baseTitle || unseen === 0) baseTitle = document.title.replace(/^\(\d+\)\s*/, "");
  unseen += count;
  document.title = `(${unseen}) ${baseTitle}`;
}

/** Arms the tone on the first tap, and clears the title badge once someone is looking. */
export function useArrivalAlerts(): void {
  useEffect(() => {
    const arm = () => {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!audio && Ctx) audio = new Ctx();
        void audio?.resume();
      } catch {
        // Sound stays off; everything else still works.
      }
      clearBadge();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") clearBadge();
    };
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      document.removeEventListener("visibilitychange", onVisible);
      clearBadge();
    };
  }, []);
}
