// src/app/motorista/login/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function MotoristaLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [countryCode] = useState("55");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --- OTP state & refs ---
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // 1) Send the 6-digit code via your API
  const enviarCodigo = async () => {
    if (!phone.trim()) {
      return setError("Por favor, informe seu número de WhatsApp");
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
      setSuccess("Código enviado! Verifique seu WhatsApp.");

      // start 60s countdown
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

  // 2) Verify the joined OTP via NextAuth
  const verificarCodigo = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      return setError("Por favor, insira o código completo");
    }
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      console.log('Attempting phone OTP sign in with:', { phone, code, countryCode });
      
      const result = await signIn("phone-otp", {
        redirect: false,
        phone,
        code,
        countryCode,
        callbackUrl: "/motorista/dashboard/overview"
      });

      console.log('Sign in result:', result);

      if (result?.error) {
        console.error('Sign in error:', result.error);
        if (result.error === 'CredentialsSignin') {
          setError('Código inválido ou expirado. Por favor, tente novamente.');
        } else {
          setError(result.error);
        }
      } else if (result?.ok) {
        // always land on driver dashboard
        router.push("/motorista/dashboard/overview");
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

  // handle a single-digit change
  const handleChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    // auto-advance
    if (val && inputsRef.current[idx + 1]) {
      inputsRef.current[idx + 1]!.focus();
    }
  };

  // handle full 6-digit paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("Text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const next = pasted.split("");
    while (next.length < 6) next.push("");
    setOtp(next);

    // focus next empty or last
    const pos = pasted.length >= 6 ? 5 : pasted.length;
    inputsRef.current[pos]?.focus();
  };

  // if user clears all boxes, reset focus to the first
  useEffect(() => {
    if (otp.every((d) => d === "")) {
      inputsRef.current[0]?.focus();
    }
  }, [otp]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <div className="text-center mb-6">
          <Link href="/" className="text-3xl font-bold">
            Pixter
          </Link>
          <h2 className="mt-4 text-2xl">Login de Motorista</h2>
          <p className="text-sm text-gray-600">Use seu WhatsApp para entrar</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded mb-4">
            {success}
          </div>
        )}

        {!codeSent ? (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp (com DDD)
            </label>
            <div className="flex mb-4">
              <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l">
                +{countryCode}
              </span>
              <input
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                placeholder="11 98765-4321"
                className={`flex-1 border border-gray-300 rounded-r px-4 py-3 text-base ${ // Increased padding and text size
                  loading ? "bg-gray-100" : ""
                }`}
              />
            </div>
            <button
              onClick={enviarCodigo}
              disabled={loading || !phone.trim()}
              className={`w-full py-3 rounded text-white font-medium ${ // Increased padding
                loading || !phone.trim()
                  ? "bg-purple-300 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {loading ? "Enviando…" : "Enviar código"}
            </button>
          </>
        ) : (
          <>
            <p className="text-center text-gray-700 mb-4">
              Insira o código de 6 dígitos que enviamos
            </p>
            {/* --- Improved OTP Input Styling --- */}
            <div className="flex justify-center gap-3 mb-6"> { /* Increased gap */}
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputsRef.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onPaste={handlePaste}
                  className="w-12 h-14 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-2xl font-semibold" // Larger size, bigger text, focus style
                />
              ))}
            </div>
            {/* --- End of Improved Styling --- */}
            <button
              onClick={verificarCodigo}
              disabled={loading || otp.join("").length < 6}
              className={`w-full mt-2 py-3 rounded text-white font-medium ${ // Increased padding
                loading || otp.join("").length < 6
                  ? "bg-purple-300 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {loading ? "Verificando…" : "Entrar"}
            </button>
            {countdown > 0 ? (
              <p className="text-sm text-gray-500 mt-3 text-center">
                Reenviar em {countdown}s
              </p>
            ) : (
              <button
                onClick={enviarCodigo}
                disabled={loading}
                className="mt-3 text-sm text-purple-600 hover:underline w-full text-center" // Centered resend button
              >
                Reenviar código
              </button>
            )}
          </>
        )}

        <div className="mt-6 text-center text-sm text-gray-500">
          Não tem conta?{" "}
          <Link
            href="/motorista/cadastro"
            className="text-purple-600 hover:underline"
          >
            Cadastre-se
          </Link>
        </div>
      </div>
    </main>
  );
}

