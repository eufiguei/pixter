
'use client';

import React, { useState, useRef, ChangeEvent, KeyboardEvent, ClipboardEvent } from 'react';

interface OtpInputProps {
  length: number;
  onChange: (otp: string) => void;
}

const OtpInput: React.FC<OtpInputProps> = ({ length, onChange }) => {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (element: HTMLInputElement, index: number) => {
    const value = element.value;
    // Allow only digits and take the last digit entered
    if (/^[0-9]$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      onChange(newOtp.join(''));

      // Move focus to the next input if available
      if (index < length - 1 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (value === '') {
      // Handle clearing the input
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      onChange(newOtp.join(''));
      // Optionally move focus back on clear, handled by backspace
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      // If current input is empty and we press backspace, move focus to previous input and clear it
      if (otp[index] === '' && index > 0 && inputRefs.current[index - 1]) {
        const newOtp = [...otp];
        newOtp[index - 1] = ''; // Clear previous input as well
        setOtp(newOtp);
        onChange(newOtp.join(''));
        inputRefs.current[index - 1]?.focus();
      } else {
        // If current input has value, just clear it
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
        onChange(newOtp.join(''));
        // Keep focus here, user might want to type a new digit
      }
      e.preventDefault(); // Prevent default backspace behavior
    } else if (e.key === 'ArrowLeft') {
      if (index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      if (index < length - 1 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }
      e.preventDefault();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/[^0-9]/g, ''); // Get only digits
    if (pasteData.length === length) {
      const newOtp = pasteData.split('');
      setOtp(newOtp);
      onChange(newOtp.join(''));
      // Optionally move focus to the last input
      inputRefs.current[length - 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center space-x-2" onPaste={handlePaste}>
      {otp.map((data, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text" // Use text to handle single char input better
          inputMode="numeric" // Hint for mobile keyboards
          maxLength={1}
          value={data}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(e.target, index)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleKeyDown(e, index)}
          onFocus={(e) => e.target.select()} // Select all text on focus
          className="w-10 h-12 sm:w-12 sm:h-14 border border-gray-300 rounded-md text-center text-lg sm:text-xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      ))}
    </div>
  );
};

export default OtpInput;

