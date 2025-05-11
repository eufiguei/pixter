// src/app/pagamento/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
import CurrencyInput from "react-currency-input-field";
import Image from "next/image"; // Import Image for avatar

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

type Profile = {
  id: string;
  nome?: string;
  avatar_url?: string;
  profissao?: string;
  celular?: string;
};

function formatDisplayPhoneNumber(e164Phone?: string): string {
  if (!e164Phone) return "";
  const digits = e164Phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length === 13) {
    return `(${digits.substring(2, 4)}) ${digits.substring(4, 9)}-${digits.substring(9)}`;
  }
  if (digits.startsWith("55") && digits.length === 12) {
    return `(${digits.substring(2, 4)}) ${digits.substring(4, 8)}-${digits.substring(8)}`;
  }
  return e164Phone;
}

export default function PaginaPagamento() {
  const { data: session } = useSession();
  const { id: driverIdentifier } = useParams() as { id: string }; // Renamed for clarity
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [ephemeralKeySecret, setEphemeralKeySecret] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(true);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // Fetch driver info using the identifier (could be phone or cpf_cnpj)
  useEffect(() => {
    async function fetchDriver() {
      if (!driverIdentifier) {
        setError("Identificador do vendedor não encontrado na URL.");
        setLoadingProfile(false);
        return;
      }
      try {
        setLoadingProfile(true);
        const res = await fetch(`/api/public/driver-info/${driverIdentifier}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erro ${res.status}: ${res.statusText}`);
        setProfile(json.profile);
      } catch (err: any) {
        console.error("Erro ao buscar vendedor:", err);
        setError(err.message);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchDriver();
  }, [driverIdentifier]);

  // Create/Fetch a PaymentIntent on mount
  useEffect(() => {
    async function createIntent() {
      if (!profile?.id) return;
      try {
        setLoadingIntent(true);
        setError(null);
        const res = await fetch(
          `/api/stripe/create-payment-intent?driverId=${profile.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
            credentials: "include",
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erro ${res.status}: ${res.statusText}`);
        setClientSecret(json.clientSecret);
        setPaymentIntentId(json.paymentIntentId);
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
    if (profile?.id) {
      createIntent();
    }
  }, [profile]);

  // Loading and Error States
  if (loadingProfile) {
    return <div className="min-h-screen flex items-center justify-center">Carregando informações...</div>;
  }
  if (!profile && !loadingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error || "Não foi possível carregar o perfil."}</p>
        <Link href="/" className="text-indigo-600 hover:text-indigo-800 underline">Voltar</Link>
      </div>
    );
  }
  if (loadingIntent) {
    return <div className="min-h-screen flex items-center justify-center">Preparando pagamento...</div>;
  }
  if (error && !clientSecret) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href="/" className="text-indigo-600 hover:text-indigo-800 underline">Voltar</Link>
      </div>
    );
  }
  if (!profile || !clientSecret || !paymentIntentId) {
    return <div className="min-h-screen flex items-center justify-center">Erro inesperado ao carregar a página.</div>;
  }

  // Stripe Elements options
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: { theme: "stripe" },
    ...(ephemeralKeySecret && { customerId: session?.user?.id, ephemeralKeySecret }), // Add customer context if available
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center pt-12 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
        {/* Driver Info Header */}
        <div className="flex items-center mb-6">
          <div className="flex-shrink-0 mr-4">
            <Image
              src={profile.avatar_url || "/images/avatars/avatar_1.png"} // Fallback avatar
              alt={profile.nome || "Avatar"}
              width={64}
              height={64}
              className="rounded-full object-cover border"
            />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{profile.nome || "Vendedor"}</h2>
            {profile.profissao && <p className="text-sm text-gray-600">{profile.profissao}</p>}
            {profile.celular && <p className="text-sm text-gray-500">{formatDisplayPhoneNumber(profile.celular)}</p>}
          </div>
        </div>

        {/* Stripe Elements Form */}
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm paymentIntentId={paymentIntentId} />
        </Elements>
      </div>
    </main>
  );
}

// CheckoutForm Component with updated amount handling
function CheckoutForm({ paymentIntentId }: { paymentIntentId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { id: driverIdentifier } = useParams() as { id: string };

  // State for the raw integer value (cents)
  const [amountInCents, setAmountInCents] = useState<number | undefined>(undefined);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle changes from CurrencyInput
  const handleAmountChange = (value: string | undefined, name?: string, values?: {float: number | null, formatted: string, value: string}) => {
    // The `value` from react-currency-input-field is the formatted string (e.g., "12,34")
    // The `values.float` is the numeric value (e.g., 12.34)
    // We want to store the value in cents based on the raw input digits

    // Get the raw digits string
    const rawValue = value?.replace(/\D/g, "") || "";
    const cents = rawValue ? parseInt(rawValue, 10) : undefined;

    setAmountInCents(cents);

    // Basic validation
    if (cents === undefined || cents <= 0) {
      setAmountError("Por favor, insira um valor válido.");
    } else {
      setAmountError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !amountInCents) return;

    // Validate amount before proceeding
    if (amountInCents <= 0) {
      setAmountError("Por favor, insira um valor maior que zero.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setAmountError(null);

    try {
      // 1. Update the Payment Intent with the final amount in cents
      const updateRes = await fetch("/api/stripe/update-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId, amount: amountInCents }), // Use amountInCents directly
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
              ? `${window.location.origin}/pagamento/sucesso?driverId=${driverIdentifier}` // Use identifier
              : undefined,
        },
      });

      if (stripeError) {
        console.error("Stripe confirmation error:", stripeError);
        throw new Error(stripeError.message || "Ocorreu um erro durante a confirmação do pagamento.");
      }
      // Stripe automatically redirects on success

    } catch (err: any) {
      console.error("Payment submission error:", err);
      setError(err.message || "Ocorreu um erro.");
      setSubmitting(false);
    }
  };

  // Calculate the display value (BRL) from cents for the CurrencyInput
  const displayValue = amountInCents !== undefined ? (amountInCents / 100).toFixed(2) : undefined;

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
          // Use the calculated display value (string)
          value={displayValue}
          decimalsLimit={2}
          intlConfig={{ locale: "pt-BR", currency: "BRL" }}
          // Use onValueChange to update the cents state
          onValueChange={handleAmountChange}
          // Allow decimals to be entered, but logic treats raw digits as cents
          allowDecimals={true} 
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${amountError ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-indigo-500"}`}
        />
        {amountError && <p className="text-xs text-red-600 mt-1">{amountError}</p>}
      </div>

      {/* Stripe Payment Element */}
      <PaymentElement id="payment-element" options={{ layout: "tabs" }} />

      {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}

      <button
        type="submit"
        disabled={!stripe || !elements || submitting || !!amountError || !amountInCents || amountInCents <= 0}
        className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white transition duration-150 ease-in-out ${
          !stripe || !elements || submitting || !!amountError || !amountInCents || amountInCents <= 0
            ? "bg-indigo-300 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        }`}
      >
        {submitting ? "Processando..." : "Pagar"}
      </button>
    </form>
  );
}

