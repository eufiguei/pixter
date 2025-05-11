// src/app/vendedor/login/page.tsx
"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react"; // Added KeyboardEvent
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function VendedorLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [countryCode] = useState("55");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const enviarCodigo = async () => {
    if (!phone.trim()) {
      return setError("Por favor, informe seu número de Celular");
    }
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar código");

      setCodeSent(true);
      setCountdown(60);
      setSuccess("Código enviado! Verifique seu Celular.");
      inputsRef.current[0]?.focus(); // Focus first OTP input after code is sent

      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Falha ao enviar código");
    } finally {
      setLoading(false);
    }
  };

  const verificarCodigo = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      return setError("Por favor, insira o código completo");
    }
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await signIn("phone-otp", {
        redirect: false,
        phone,
        code,
        countryCode,
        callbackUrl: "/vendedor/dashboard/overview",
      });

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          setError("Código inválido ou expirado. Por favor, tente novamente.");
        } else {
          setError(result.error);
        }
      } else if (result?.ok) {
        router.push("/vendedor/dashboard/overview");
      } else {
        setError("Erro ao verificar código");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Erro ao verificar código");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return; // Allow only single digit or empty

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input if a digit is entered
    if (value && index < otp.length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault(); // Prevent default backspace behavior (like navigating back)
      const newOtp = [...otp];
      if (newOtp[index]) {
        newOtp[index] = ""; // Clear current input
        setOtp(newOtp);
        // Optionally, focus previous input if current was cleared and not the first one
        // if (index > 0) inputsRef.current[index -1]?.focus(); 
      } else if (index > 0) {
        // If current is empty and backspace is pressed, move to previous and clear it
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "Delete") {
        e.preventDefault();
        const newOtp = [...otp];
        if (newOtp[index]) {
            newOtp[index] = "";
            setOtp(newOtp);
            // No auto-focus change on delete, user might want to type in the same box
        }
    }
    // Arrow key navigation (optional, but good for UX)
    else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    else if (e.key === "ArrowRight" && index < otp.length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").replace(/\D/g, ""); // Get only digits
    if (!pastedData) return;

    const newOtp = [...otp]; // Start with current OTP state or empty array
    let currentFocusIndex = 0;

    // Determine where paste started if possible (tricky without knowing target directly here)
    // For simplicity, we assume paste can happen in any box but will try to fill from the first available or from box 0.
    // The logic below fills from the start of the OTP array.
    for (let i = 0; i < otp.length; i++) {
      if (i < pastedData.length) {
        newOtp[i] = pastedData[i];
      } else {
        // newOtp[i] = ""; // Clear remaining if pasted data is shorter, or keep existing
      }
    }
    setOtp(newOtp);

    // Focus the next empty input or the last input if all are filled
    currentFocusIndex = Math.min(pastedData.length, otp.length - 1);
    inputsRef.current[currentFocusIndex]?.focus();
    
    // If pasted data fills all, try to submit or just focus last
    if (pastedData.length >= otp.length) {
        inputsRef.current[otp.length - 1]?.focus();
        // Consider auto-submitting if full code is pasted and valid length
        // if (newOtp.join("").length === otp.length) {
        //   verificarCodigo(); // Be cautious with auto-submit
        // }
    }
  };

  useEffect(() => {
    if (otp.every((d) => d === "")) {
      // inputsRef.current[0]?.focus(); // This might be too aggressive if user is deleting intentionally
    }
  }, [otp]);
  
  // Auto-submit when OTP is complete
  useEffect(() => {
    const code = otp.join("");
    if (code.length === 6) {
      verificarCodigo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]); // Trigger when otp state changes

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-lg shadow-xl">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block mb-2">
            {/* Replace with Pixter Logo Component if available */}
            <span className="text-4xl font-bold text-purple-600">Pixter</span>
          </Link>
          <h2 className="text-2xl font-semibold text-gray-800">Login de Vendedor</h2>
          <p className="text-sm text-gray-500">
            {!codeSent ? "Use seu Celular para entrar" : "Código enviado! Verifique seu Celular."}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 text-red-700 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        {success && !codeSent && /* Show general success if not related to code sent */ (
          <div className="bg-green-50 border-l-4 border-green-400 text-green-700 p-3 rounded mb-4 text-sm">
            {success}
          </div>
        )}

        {!codeSent ? (
          <form onSubmit={(e) => { e.preventDefault(); enviarCodigo(); }} className="space-y-4">
            <div>
              <label htmlFor="phoneInput" className="block text-sm font-medium text-gray-700 mb-1">
                Celular (com DDD)
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-600">
                  +{countryCode}
                </span>
                <input
                  id="phoneInput"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, 	xt.slice(0,11)))} // Allow only digits, max 11 for BR phone
                  disabled={loading}
                  placeholder="11987654321"
                  className={`flex-1 block w-full border-gray-300 rounded-r-md px-3 py-2.5 text-base shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${loading ? "bg-gray-100" : ""}`}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !phone.trim() || phone.length < 10}
              className={`w-full py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-150 ${loading || !phone.trim() || phone.length < 10 ? "bg-purple-300 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"}`}
            >
              {loading ? "Enviando…" : "Enviar código"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); verificarCodigo(); }} className="space-y-4">
            {success && codeSent && (
                 <div className="bg-green-50 border-l-4 border-green-400 text-green-700 p-3 rounded mb-4 text-sm">
                    {success}
                 </div>
            )}
            <p className="text-center text-gray-600 text-sm">
              Insira o código de 6 dígitos que enviamos para o seu celular.
            </p>
            <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputsRef.current[i] = el)}
                  type="text" // Changed from "tel" to "text" with inputMode for better paste
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-10 h-12 sm:w-12 sm:h-14 text-center border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xl sm:text-2xl font-medium transition-all duration-150"
                  aria-label={`Dígito ${i + 1} do código OTP`}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={loading || otp.join("").length < 6}
              className={`w-full py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-150 ${loading || otp.join("").length < 6 ? "bg-purple-300 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"}`}
            >
              {loading ? "Verificando…" : "Entrar"}
            </button>
            <div className="text-center mt-3">
            {countdown > 0 ? (
              <p className="text-xs text-gray-500">
                Reenviar código em {countdown}s
              </p>
            ) : (
              <button
                type="button"
                onClick={enviarCodigo} // Resend code
                disabled={loading}
                className="text-xs text-purple-600 hover:text-purple-500 hover:underline disabled:text-gray-400 disabled:no-underline"
              >
                Reenviar código
              </button>
            )}
            </div>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">Não tem conta? </span>
          <Link
            href="/vendedor/cadastro"
            className="font-medium text-purple-600 hover:text-purple-500 hover:underline"
          >
            Cadastre-se
          </Link>
        </div>
         <div className="mt-4 text-center text-sm">
          <Link
            href="/"
            className="font-medium text-gray-500 hover:text-gray-700 hover:underline"
          >
            &larr; Voltar para o início
          </Link>
        </div>
      </div>
    </main>
  );
}

