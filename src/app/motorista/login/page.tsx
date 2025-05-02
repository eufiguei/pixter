// src/app/motorista/login/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import OTPInput from "@/components/OTPInput";

export default function MotoristaLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [countryCode] = useState("55");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sendCode = async () => {
    if (!phone) return setError("Informe seu número de WhatsApp");
    try {
      setLoading(true); setError(""); setSuccess("");
      const res = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar código");
      setCodeSent(true);
      setSuccess("Código enviado! Verifique seu WhatsApp.");
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Falha ao enviar código");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.length < 6) return setError("Insira os 6 dígitos completos");
    setLoading(true); setError(""); setSuccess("");
    // let NextAuth handle cookie + redirect
    await signIn("phone-otp", {
      phone,
      code,
      countryCode,
      callbackUrl: "/motorista/dashboard",
      redirect: true,
    });
    // no need to manually router.push — NextAuth will redirect you
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <div className="text-center mb-6">
          <Link href="/" className="text-3xl font-bold">Pixter</Link>
          <h2 className="mt-4 text-2xl">Login de Motorista</h2>
          <p className="text-sm text-gray-600">Use seu WhatsApp para entrar</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded mb-4">{success}</div>}

        {!codeSent ? (
          <>
            <label className="block text-sm font-medium text-gray-700">WhatsApp (com DDD)</label>
            <div className="flex mb-4">
              <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 rounded-l">
                +{countryCode}
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={loading}
                placeholder="11 98765-4321"
                className="flex-1 border border-gray-300 rounded-r px-3"
              />
            </div>
            <button
              onClick={sendCode}
              disabled={loading || !phone}
              className={`w-full py-2 rounded text-white ${
                loading || !phone ? "bg-purple-300 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {loading ? "Enviando…" : "Enviar código"}
            </button>
          </>
        ) : (
          <>
            <p className="text-center text-gray-700 mb-2">Insira o código de 6 dígitos</p>
            <OTPInput length={6} onChange={setCode} />
            <button
              onClick={verifyCode}
              disabled={loading || code.length < 6}
              className={`w-full mt-4 py-2 rounded text-white ${
                loading || code.length < 6 ? "bg-purple-300 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {loading ? "Verificando…" : "Entrar"}
            </button>
            {countdown > 0 ? (
              <p className="text-sm text-gray-500 mt-3 text-center">Reenviar em {countdown}s</p>
            ) : (
              <button
                onClick={sendCode}
                disabled={loading}
                className="mt-3 text-sm text-purple-600 hover:underline"
              >
                Reenviar código
              </button>
            )}
          </>
        )}

        <div className="mt-6 text-center text-sm text-gray-500">
          Não tem conta?{" "}
          <Link href="/motorista/cadastro" className="text-purple-600 hover:underline">
            Cadastre-se
          </Link>
        </div>
      </div>
    </main>
  );
}
