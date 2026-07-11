"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  className?: string;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  className,
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  function updateDigit(index: number, digit: string) {
    const sanitized = digit.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = sanitized || " ";
    const joined = next.join("").replace(/ /g, "");
    onChange(joined);

    if (sanitized && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <div className={cn("flex justify-center gap-2", className)}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit.trim()}
          onChange={(e) => updateDigit(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          aria-label={`Digit ${index + 1}`}
          className="size-11 rounded-xl border border-input bg-white text-center text-lg font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ))}
    </div>
  );
}
