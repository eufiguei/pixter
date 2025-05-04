// src/app/cadastro/confirmacao-pendente/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation"; // Optional: To potentially show the email address

export default function ConfirmationPending() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email"); // Optional: Pass email as query param if needed

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <Link href="/" className="text-3xl font-bold text-gray-900">
            Pixter
          </Link>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Confirmação Pendente</h2>
        <p className="mt-4 text-gray-700">
          Cadastro iniciado com sucesso!
        </p>
        <p className="mt-2 text-gray-600">
          Enviamos um email de confirmação para {email ? <strong>{email}</strong> : "o endereço fornecido"}. Por favor, verifique sua caixa de entrada (e a pasta de spam) e clique no link para ativar sua conta.
        </p>
        <p className="mt-6 text-sm text-gray-500">
          Já confirmou? <Link href="/login" className="text-purple-600 hover:text-purple-800">Faça login aqui</Link>
        </p>
        {/* Optional: Add a button to resend confirmation email if needed */}
      </div>
    </main>
  );
}

