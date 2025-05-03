// src/hooks/useBRLFormatter.ts
import { useState, ChangeEvent } from 'react';

/**
 * Hook to format any numeric input as BRL currency (e.g. 1234 → "12,34")
 */
export function useBRLFormatter(initial = '') {
  const [value, setValue] = useState(initial);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    // strip non‐digits
    let digits = e.target.value.replace(/\D/g, '');
    if (!digits) {
      setValue('');
      return;
    }
    // ensure at least two digits for cents
    if (digits.length === 1) digits = '0' + digits;
    // split integer vs cents
    const cents = digits.slice(-2);
    const integerPart = digits.slice(0, -2);
    // format integer part with thousands separators
    const intFormatted = parseInt(integerPart, 10).toLocaleString('pt-BR');
    setValue(`${intFormatted},${cents}`);
  };

  return { value, onChange };
}
