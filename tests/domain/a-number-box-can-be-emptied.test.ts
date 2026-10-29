import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";

/**
 * A number box the form parses on every keystroke — `Number(value) || 0` —
 * could not be emptied: Backspace on "0" made "", the form stored 0, and React
 * wrote "0" straight back. The delivery-zone days, every fee, sort order and
 * stock box in the admin had it. The shared Input now shows the person's own
 * text while they type and the form's number once they leave the box.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function Form({
  initial,
  parse,
  inputMode,
}: {
  initial: number;
  parse: (text: string) => number;
  inputMode?: "decimal";
}) {
  const [stored, setStored] = useState(initial);
  return createElement(
    "div",
    null,
    createElement(Input, {
      type: inputMode ? undefined : "number",
      inputMode,
      value: inputMode ? String(stored) : stored,
      onChange: (event) => setStored(parse(event.target.value)),
    }),
    createElement("output", null, String(stored)),
  );
}

function mount(props: Parameters<typeof Form>[0]) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(createElement(Form, props)));
  const input = container.querySelector("input")!;
  const output = container.querySelector("output")!;
  return { input, output };
}

function type(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    input.focus();
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function leave(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    input.blur();
  });
}

describe("a number box can be emptied", () => {
  it("Backspace on 0 leaves the box empty, and the form still holds 0", () => {
    const { input, output } = mount({ initial: 0, parse: (t) => Math.max(0, Number(t) || 0) });
    type(input, "");
    expect(input.value).toBe("");
    expect(output.textContent).toBe("0");
    type(input, "3");
    expect(input.value).toBe("3");
    expect(output.textContent).toBe("3");
  });

  it("a box that falls back to a default stays empty while typing, then shows it on blur", () => {
    const { input, output } = mount({ initial: 5, parse: (t) => Number(t) || 1 });
    type(input, "");
    expect(input.value).toBe("");
    expect(output.textContent).toBe("1");
    leave(input);
    expect(input.value).toBe("1");
  });

  it("the form's own number wins when it disagrees with the text", () => {
    const { input, output } = mount({ initial: 2, parse: (t) => Math.max(0, Math.floor(Number(t) || 0)) });
    type(input, "2.7");
    expect(output.textContent).toBe("2");
    expect(input.value).toBe("2");
  });

  it("a decimal text box keeps the point while it is typed", () => {
    const { input, output } = mount({ initial: 0, parse: (t) => Number(t), inputMode: "decimal" });
    type(input, "24.");
    expect(input.value).toBe("24.");
    expect(output.textContent).toBe("24");
    type(input, "24.9");
    expect(input.value).toBe("24.9");
  });
});
