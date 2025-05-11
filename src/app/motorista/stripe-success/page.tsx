// src/app/motorista/stripe-success/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StripeSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect back to the dashboard after a short delay
    const timer = setTimeout(() => {
      router.push("/motorista/dashboard");
    }, 3000); // 3 seconds delay

    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
        <h1 className="text-2xl font-semibold text-green-600 mb-4">
          Stripe Conectado com Sucesso!
        </h1>
        <p className="text-gray-700 mb-6">
          Sua conta Stripe foi conectada com sucesso. Você será redirecionado para o seu dashboard em breve.
        </p>
        <Link href="/motorista/dashboard">
          <span className="text-indigo-600 hover:underline cursor-pointer">
            Voltar para o Dashboard agora
          </span>
        </Link>
      </div>
    </div>
  );
}
