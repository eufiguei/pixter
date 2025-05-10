"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Mail, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

export default function ConfirmationPending() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});

  const handleResendEmail = async () => {
    if (!email || resending) return;

    setResending(true);
    setResendStatus({});

    try {
      const response = await fetch("/api/auth/signup-confirmation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendStatus({
          success: true,
          message:
            data.message || "Email de confirmação reenviado com sucesso!",
        });
      } else {
        // Handle specific error cases
        if (response.status === 429) {
          // Rate limited
          setResendStatus({
            success: false,
            message: data.error || "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
          });
        } else if (response.status === 400 && data.error?.includes("já está verificado")) {
          // Already verified
          setResendStatus({
            success: true,
            message: "Email já verificado! Você pode fazer login agora.",
          });
        } else {
          // General error
          setResendStatus({
            success: false,
            message: data.error || "Falha ao reenviar o email de confirmação.",
          });
        }
      }
    } catch (error) {
      setResendStatus({
        success: false,
        message: "Falha ao reenviar o email de confirmação. Tente novamente.",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <Link href="/" className="text-3xl font-bold text-gray-900">
            Pixter
          </Link>
        </div>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">
          Confirmação Pendente
        </h2>

        <p className="mt-4 text-gray-700">Cadastro iniciado com sucesso!</p>

        <p className="mt-2 text-gray-600">
          Enviamos um email de confirmação para{" "}
          {email ? (
            <span className="font-medium">{email}</span>
          ) : (
            "o endereço fornecido"
          )}
          . Por favor, verifique sua caixa de entrada (e a pasta de spam) e
          clique no link para ativar sua conta.
        </p>

        {resendStatus.message && (
          <div
            className={`mt-4 text-sm px-4 py-3 rounded-md flex items-start ${
              resendStatus.success
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {resendStatus.success ? (
              <div className="flex-shrink-0 mr-2 mt-0.5">✓</div>
            ) : (
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            )}
            <span>{resendStatus.message}</span>
          </div>
        )}

        <div className="mt-6 flex flex-col space-y-4">
          {email && (
            <button
              onClick={handleResendEmail}
              disabled={resending}
              className={`inline-flex items-center justify-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                resending ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {resending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reenviando...
                </>
              ) : (
                "Reenviar email de confirmação"
              )}
            </button>
          )}

          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-800"
          >
            Já confirmou? Faça login aqui
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </main>
  );
}