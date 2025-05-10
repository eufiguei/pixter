// src/app/motorista/login/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function MotoristaLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --- OTP state & refs ---
  // @ts-ignore - Bypassing TypeScript errors for useState generic type
  const [otp, setOtp] = useState(["", "", "", "", "", ""] as string[]);
  // @ts-ignore - Bypassing TypeScript errors for useRef generic type
  const inputsRef = useRef([] as Array<HTMLInputElement | null>);

  // 1) Send the 6-digit code via your API
  const enviarCodigo = async () => {
    if (!phone.trim()) {
      return setError("Por favor, informe seu número de WhatsApp");
    }

    if (phone.length < 11) {
      return setError("Número inválido. Use o formato com DDD (00123456789)");
    }

    try {
      setIsLoading(true);
      setError("");

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao enviar código");
      }

      setSuccess(`Código enviado para ${phone}`);
      setShowOTP(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erro ao enviar código");
    } finally {
      setIsLoading(false);
    }
  };

  // 2) Verify the 6-digit code
  const verificarCodigo = async () => {
    const fullOtp = otp.join("");

    if (fullOtp.length !== 6 || !/^\d+$/.test(fullOtp)) {
      return setError("Por favor, insira o código de 6 dígitos");
    }

    try {
      setIsLoading(true);
      setError("");

      const result = await signIn("credentials", {
        redirect: false,
        phone,
        otp: fullOtp,
        role: "motorista",
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      // Success! Redirect to dashboard
      router.push("/motorista/dashboard/overview");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Código inválido");
      setIsLoading(false);
    }
  };

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const { value } = e.target;
    const newOtp = [...otp];

    // Ensure input is only a single digit
    newOtp[index] = value.substring(0, 1);
    setOtp(newOtp);

    // Auto-focus next input if value is entered
    if (value && index < 5 && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0 && inputsRef.current[index - 1]) {
        // If current field is empty and backspace is pressed, focus previous field
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  // Format phone for display
  const formatPhoneForDisplay = (phone: string): string => {
    if (!phone) return "";
    if (phone.length === 11) {
      return `(${phone.substring(0, 2)}) ${phone.substring(
        2,
        7
      )}-${phone.substring(7)}`;
    }
    return phone;
  };

  // Paste functionality for OTP
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();

    // Check if pasted content is a 6-digit number
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split("");
      setOtp(newOtp);

      // Focus the last input field
      if (inputsRef.current[5]) {
        inputsRef.current[5]?.focus();
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto max-w-md">
        <Link
          href="/"
          className="flex items-center mb-6 text-2xl font-semibold text-gray-800"
        >
          <span className="self-center text-3xl font-bold text-black">
            Pixter<span className="text-indigo-600">Driver</span>
          </span>
        </Link>

        <div className="w-full bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-xl font-bold text-gray-900">Acesso Motorista</h2>

          {error && (
            <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {success && !error && (
            <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm">
              {success}
            </div>
          )}

          {!showOTP ? (
            <>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="phone"
                    className="block mb-2 text-sm font-medium text-gray-900"
                  >
                    Seu WhatsApp com DDD
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-indigo-600 focus:border-indigo-600 block w-full p-2.5"
                    placeholder="exemplo: 11987654321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={enviarCodigo}
                  disabled={isLoading}
                  className="w-full text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300 font-medium rounded-lg px-5 py-2.5 text-center"
                >
                  {isLoading ? "Enviando..." : "Enviar código de acesso"}
                </button>
                <div className="text-sm text-center text-gray-500">
                  Enviaremos um código de 6 dígitos para seu WhatsApp
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-900">
                      Código de verificação
                    </label>
                    <span
                      className="text-xs text-indigo-600 cursor-pointer"
                      onClick={() => setShowOTP(false)}
                    >
                      Mudar número
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mb-3">
                    Enviado para {formatPhoneForDisplay(phone)}
                  </div>

                  {/* OTP Input Fields */}
                  <div className="flex space-x-2 mb-4" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="w-12 h-12 text-center text-xl font-semibold border border-gray-300 rounded-md focus:ring-indigo-600 focus:border-indigo-600"
                        value={digit}
                        onChange={(e) => handleChange(e, index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        ref={(el) => {
                          inputsRef.current[index] = el;
                        }}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={verificarCodigo}
                  disabled={isLoading}
                  className="w-full text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300 font-medium rounded-lg px-5 py-2.5 text-center"
                >
                  {isLoading ? "Verificando..." : "Verificar código"}
                </button>
                <div className="text-sm text-center text-gray-500">
                  Não recebeu o código?{" "}
                  <span
                    className="text-indigo-600 cursor-pointer"
                    onClick={enviarCodigo}
                  >
                    Reenviar
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="text-sm text-center text-gray-500 mt-4">
          Não é motorista?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:underline"
          >
            Acessar como cliente
          </Link>
        </div>
      </div>
    </div>
  );
}
