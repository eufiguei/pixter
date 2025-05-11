// src/app/cliente/payment-methods/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CreditCard, PlusCircle, Trash2 } from "lucide-react"; // Added icons

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

// Helper to get a simple icon or text for card brand
const CardBrandIcon = ({ brand }: { brand: string }) => {
  const lowerBrand = brand.toLowerCase();
  if (lowerBrand.includes("visa")) {
    return <span className="font-bold text-blue-600">VISA</span>; // Placeholder, ideally an SVG icon
  }
  if (lowerBrand.includes("mastercard")) {
    return <span className="font-bold text-orange-500">MC</span>; // Placeholder
  }
  // Add more brands as needed
  return <CreditCard className="w-6 h-6 text-gray-400" />;
};

export default function WalletPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/cliente/payment-methods");
    }

    if (status === "authenticated") {
      const fetchPaymentMethods = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch("/api/stripe/list-payment-methods"); // Updated API endpoint based on project structure
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || "Erro ao buscar métodos de pagamento.");
          }
          const data = await response.json();
          setPaymentMethods(data.paymentMethods || []); // Assuming API returns { paymentMethods: [...] }
        } catch (err: any) {
          setError(err.message);
          console.error("Failed to fetch payment methods:", err);
          setPaymentMethods([]);
        } finally {
          setLoading(false);
        }
      };
      fetchPaymentMethods();
    }
  }, [status, router]);

  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm("Tem certeza que deseja remover este método de pagamento?")) return;

    setLoading(true); 
    setError(null);
    try {
      // TODO: Implement actual API endpoint for deleting payment method from Stripe
      const response = await fetch(`/api/stripe/payment-methods/${paymentMethodId}`, { // Placeholder for delete endpoint
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Erro ao remover método de pagamento.");
      }
      setPaymentMethods(prev => prev.filter(pm => pm.id !== paymentMethodId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && loading)) {
    return <div className="p-6 text-center text-gray-600">Carregando sua carteira...</div>;
  }
  
  if (status === "unauthenticated") {
    return <div className="p-6 text-center text-gray-600">Você precisa estar logado para ver sua carteira.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Minha Carteira</h1>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-md shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                {/* <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" /> */}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {paymentMethods.length === 0 && !loading && !error && (
          <div className="text-center text-gray-500 bg-white p-8 rounded-lg shadow-md">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum cartão adicionado</p>
            <p className="text-sm">Você ainda não adicionou nenhum método de pagamento.</p>
          </div>
        )}

        {paymentMethods.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <ul role="list" className="divide-y divide-gray-200">
              {paymentMethods.map((pm) => (
                <li key={pm.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mr-4">
                        <CardBrandIcon brand={pm.card.brand} />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-purple-700 truncate">
                          {pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1)} •••• {pm.card.last4}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Válido até {String(pm.card.exp_month).padStart(2, "0")}/{pm.card.exp_year.toString().slice(-2)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(pm.id)}
                      disabled={loading} 
                      className="ml-4 p-2 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-full disabled:opacity-50 transition-colors duration-150"
                      aria-label="Remover cartão"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8">
          <Link
            href="/cliente/payment-methods/add" // Ensure this route exists and works
            className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-transform transform hover:scale-105"
          >
            <PlusCircle className="-ml-1 mr-3 h-5 w-5" aria-hidden="true" />
            Adicionar Novo Cartão
          </Link>
        </div>
      </div>
    </div>
  );
}

