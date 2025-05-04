// src/app/pagamento/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react"; // Need this for session
import {
  loadStripe,
  StripeElementsOptions,
  StripeError,
} from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import Link from "next/link";
import CurrencyInput from "react-currency-input-field"; // Import the currency input

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

// Updated Profile type to include profession and phone
type Profile = {
  id: string;
  nome?: string;
  avatar_url?: string;
  profissao?: string; // Added profession
  celular?: string; // Added phone number (E.164 format from API)
};

// Helper to format E.164 phone number for display
function formatDisplayPhoneNumber(e164Phone?: string): string {
  if (!e164Phone) return "";
  const digits = e164Phone.replace(/\D/g, "");
  // Basic formatting for Brazilian numbers (assuming +55)
  if (digits.startsWith("55") && digits.length === 13) { // +55 XX 9XXXX-XXXX
    return `(${digits.substring(2, 4)}) ${digits.substring(4, 9)}-${digits.substring(9)}`;
  }
  if (digits.startsWith("55") && digits.length === 12) { // +55 XX XXXX-XXXX
     return `(${digits.substring(2, 4)}) ${digits.substring(4, 8)}-${digits.substring(8)}`;
  }
  // Fallback for other formats or non-Brazilian numbers
  return e164Phone;
}

// Wrapper that fetches clientSecret & ephemeralKey and renders Elements
export default function PaginaPagamento() {
  /* --- Start Incremental Debug --- */

  const { data: session } = useSession();
  // Assuming the [id] parameter in the URL is the phone number
  const { id: driverPhoneNumber } = useParams() as { id: string };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [ephemeralKeySecret, setEphemeralKeySecret] = useState<string | null>(
    null
  );
  const [loadingIntent, setLoadingIntent] = useState(true);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // 1️⃣ Fetch driver info using the correct API endpoint
  useEffect(() => {
    async function fetchDriver() {
      if (!driverPhoneNumber) {
        setError("Número do motorista não encontrado na URL.");
        setLoadingProfile(false);
        return;
      }
      try {
        setLoadingProfile(true);
        // Use the correct API endpoint with the phone number
        const res = await fetch(`/api/public/driver-info/${driverPhoneNumber}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erro ${res.status}: ${res.statusText}`);
        setProfile(json.profile);
      } catch (err: any) {
        console.error("Erro ao buscar motorista:", err);
        setError(err.message);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchDriver();
  }, [driverPhoneNumber]);

  // 2️⃣ Create/Fetch a PaymentIntent on mount (initially without amount)
  useEffect(() => {
    async function createIntent() {
      if (!profile?.id) return; // Wait until profile is loaded to get the actual driver ID
      try {
        setLoadingIntent(true);
        setError(null);

        // Pass the actual driver profile ID (UUID) to create-payment-intent
        // The API will create an intent without a specific amount initially
        const res = await fetch(
          `/api/stripe/create-payment-intent?driverId=${profile.id}`,
          {
            method: "POST", // Specify POST method
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ }),
            credentials: "include", // Send cookies for session check
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erro ${res.status}: ${res.statusText}`);

        setClientSecret(json.clientSecret);
        setPaymentIntentId(json.paymentIntentId); // Store the Payment Intent ID
        if (json.ephemeralKeySecret) {
          setEphemeralKeySecret(json.ephemeralKeySecret);
        }
      } catch (err: any) {
        console.error("Erro criando PaymentIntent:", err);
        setError(err.message);
      } finally {
        setLoadingIntent(false);
      }
    }
    // Only run when profile is loaded and has an ID
    if (profile?.id) {
        createIntent();
    }
  }, [profile]); // Depend on profile object

  // Loading states
  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando informações do motorista…
      </div>
    );
  }
  // Handle profile fetch error separately
  if (!profile && !loadingProfile) {
     return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error || "Não foi possível carregar o perfil do motorista."}</p>
        <Link
          href="/"
          className="text-indigo-600 hover:text-indigo-800 underline"
        >
          Voltar
        </Link>
      </div>
    );
  }
  // Now wait for payment intent
  if (loadingIntent) {
     return (
      <div className="min-h-screen flex items-center justify-center">
        Preparando pagamento…
      </div>
    );
  }
  // Handle payment intent error
  if (error && !clientSecret) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link
          href="/"
          className="text-indigo-600 hover:text-indigo-800 underline"
        >
          Voltar
        </Link>
      </div>
    );
  }
  // Ensure we have profile and clientSecret before rendering Elements
  if (!profile || !clientSecret || !paymentIntentId) {
    return (
       <div className="min-h-screen flex items-center justify-center">
        Erro inesperado ao carregar a página.
      </div>
    );
  }

  /* --- Commented out options ---
  // Stripe Elements options - Temporarily commented out for debugging
  
  // Define a minimal options object for now
  const options: StripeElementsOptions = { clientSecret: clientSecret || "" }; // Provide default empty string
  */
  /* --- End Incremental Debug --- */

  // Minimal return for debugging
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div>Minimal Content for Debugging - Conditional Rendering Added</div>
    </main>
  );
}

// The actual form that renders the Stripe Payment Element
function CheckoutForm({ paymentIntentId }: { paymentIntentId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { id: driverPhoneNumber } = useParams() as { id: string }; // Get phone number again if needed
  
  const [amountValue, setAmountValue] = useState<string | undefined>(undefined); // Store amount as string from input
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAmountChange = (value: string | undefined, name?: string) => {
    setAmountValue(value);
    if (value && parseFloat(value) > 0) {
      setAmountError(null); // Clear error if value is valid
    } else {
      setAmountError("Por favor, insira um valor válido.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    // Validate amount before proceeding
    const numericAmount = amountValue ? parseFloat(amountValue) : 0;
    if (numericAmount <= 0) {
      setAmountError("Por favor, insira um valor maior que zero.");
      return;
    }
    const amountInCents = Math.round(numericAmount * 100);

    setSubmitting(true);
    setError(null);
    setAmountError(null);

    try {
      // 1. Update the Payment Intent with the final amount
      const updateRes = await fetch("/api/stripe/update-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId, amount: amountInCents }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        throw new Error(updateData.error || "Erro ao atualizar valor do pagamento.");
      }

      // 2. Confirm the payment with Stripe
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url:
            typeof window !== "undefined"
              ? `${window.location.origin}/pagamento/sucesso?driverPhone=${driverPhoneNumber}`
              : undefined,
        },
      });

      if (stripeError) {
        // Common errors: card_declined, processing_error, authentication_required
        console.error("Stripe confirmation error:", stripeError);
        throw new Error(stripeError.message || "Ocorreu um erro durante a confirmação do pagamento.");
      }
      // If no error, Stripe automatically redirects to return_url.

    } catch (err: any) {
      console.error("Payment submission error:", err);
      setError(err.message || "Ocorreu um erro.");
      setSubmitting(false);
    } 
    // Do not set submitting to false here if successful, as redirection should happen
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Amount Input */} 
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
          Valor a Pagar
        </label>
        <CurrencyInput
          id="amount"
          name="amount"
          placeholder="R$ 0,00"
          value={amountValue}
          decimalsLimit={2}
          intlConfig={{ locale: "pt-BR", currency: "BRL" }}
          onValueChange={handleAmountChange}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${amountError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'}`}
        />
        {amountError && <p className="text-xs text-red-600 mt-1">{amountError}</p>}
      </div>

      {/* Stripe Payment Element */} 
      <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
      
      {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}
      
      <button
        type="submit"
        disabled={!stripe || !elements || submitting || !!amountError || !amountValue}
        className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white transition duration-150 ease-in-out ${
          !stripe || !elements || submitting || !!amountError || !amountValue
            ? "bg-indigo-300 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        }`}
      >
        {submitting ? "Processando..." : "Pagar"}
      </button>
    </form>
  );
}

