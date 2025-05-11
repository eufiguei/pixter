// src/app/cliente/payment-methods/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// Define a type for the payment method (adjust based on your API response)
type PaymentMethod = {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  // Add other relevant fields like billing details if needed
};

export default function WalletPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not authenticated
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/cliente/payment-methods");
    }

    // Fetch payment methods when authenticated
    if (status === "authenticated") {
      const fetchPaymentMethods = async () => {
        setLoading(true);
        setError(null);
        try {
          // Assuming you have an API endpoint to fetch saved payment methods
          const response = await fetch("/api/client/payment-methods"); 
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || "Erro ao buscar métodos de pagamento.");
          }
          const data: PaymentMethod[] = await response.json();
          setPaymentMethods(data);
        } catch (err: any) {
          setError(err.message);
          console.error("Failed to fetch payment methods:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchPaymentMethods();
    }
  }, [status, router]);

  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm("Tem certeza que deseja remover este cartão?")) return;

    setLoading(true); // Indicate loading state for deletion
    setError(null);
    try {
      const response = await fetch(`/api/client/payment-methods?id=${paymentMethodId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Erro ao remover cartão.");
      }
      // Remove the card from the local state
      setPaymentMethods(prev => prev.filter(pm => pm.id !== paymentMethodId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return <div className="p-6 text-center">Carregando carteira...</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Minha Carteira</h1>
        <Link
          href="/cliente/payment-methods/add"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Adicionar Cartão
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {paymentMethods.length === 0 && !loading && (
        <div className="text-center text-gray-500 bg-white p-6 rounded-lg shadow">
          Você ainda não adicionou nenhum cartão.
        </div>
      )}

      {paymentMethods.length > 0 && (
        <div className="space-y-4">
          {paymentMethods.map((pm) => (
            <div key={pm.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
              <div>
                <span className="font-medium capitalize">{pm.card.brand}</span>
                <span className="text-gray-600"> terminando em {pm.card.last4}</span>
                <span className="block text-sm text-gray-500">
                  Expira em {String(pm.card.exp_month).padStart(2, "0")}/{pm.card.exp_year}
                </span>
              </div>
              <button
                onClick={() => handleDelete(pm.id)}
                disabled={loading} // Disable button during any loading state
                className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

