// src/app/vendedor/stripe-refresh/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StripeRefreshPage() {
  const router = useRouter();

  // Optional: Redirect back to dashboard automatically after a delay
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     router.push("/vendedor/dashboard");
  //   }, 5000); // 5 seconds delay
  //   return () => clearTimeout(timer);
  // }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
        <h1 className="text-2xl font-semibold text-orange-600 mb-4">
          Link Expirado ou Inválido
        </h1>
        <p className="text-gray-700 mb-6">
          O link para conectar sua conta Stripe expirou ou ocorreu um problema. Por favor, volte ao seu dashboard e tente conectar novamente.
        </p>
        <Link href="/vendedor/dashboard">
          <span className="inline-block bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 cursor-pointer">
            Voltar para o Dashboard
          </span>
        </Link>
      </div>
    </div>
  );
}