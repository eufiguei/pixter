// src/components/OTPInput.tsx
"use client";

import { useState, useRef, useEffect, ChangeEvent, ClipboardEvent } from "react";

interface OTPInputProps {
  length: number;
  onChange: (code: string) => void;
}

export default function OTPInput({ length, onChange }: OTPInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputsRef = useRef<HTMLInputElement[]>([]);

  // whenever values changes, notify parent
  useEffect(() => {
    onChange(values.join(""));
  }, [values, onChange]);

  const focusNext = (idx: number) => {
    if (idx < length - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };
  const focusPrev = (idx: number) => {
    if (idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>, idx: number) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 1);
    const newVals = [...values];
    newVals[idx] = val;
    setValues(newVals);
    if (val) focusNext(idx);
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Backspace") {
      e.preventDefault(); // Prevent default backspace behavior
      const newVals = [...values];
      
      if (values[idx]) {
        // If current box has a value, clear it
        newVals[idx] = "";
        setValues(newVals);
      } else {
        // If current box is empty, clear previous box and move focus there
        if (idx > 0) {
          newVals[idx - 1] = "";
          setValues(newVals);
          focusPrev(idx);
        }
      }
    } else if (e.key === "ArrowLeft") {
      focusPrev(idx);
    } else if (e.key === "ArrowRight") {
      focusNext(idx);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const paste = e.clipboardData.getData("Text").trim();
    if (!/^\d+$/.test(paste)) return;
    const digits = paste.slice(0, length).split("");
    const newVals = values.map((_, i) => digits[i] || "");
    setValues(newVals);
    // after paste, move focus to last filled
    const lastFilled = Math.min(digits.length, length) - 1;
    inputsRef.current[lastFilled]?.focus();
    e.preventDefault();
  };

  return (
    <div className="flex space-x-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          maxLength={1}
          className="w-10 h-10 text-center border rounded focus:outline-none"
          ref={(el) => (inputsRef.current[i] = el!)}
          value={values[i]}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
        />
      ))}
    </div>
  );
}
