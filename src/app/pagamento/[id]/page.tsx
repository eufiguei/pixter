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

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

type Profile = {
  id: string;
  nome?: string;
  avatar_url?: string;
};

// Wrapper that fetches clientSecret & ephemeralKey and renders Elements
export default function PaginaPagamento() {
  const { data: session } = useSession();
  const { id: driverId } = useParams() as { id: string };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [ephemeralKeySecret, setEphemeralKeySecret] = useState<string | null>(
    null
  );
  const [loadingIntent, setLoadingIntent] = useState(true);

  // 1️⃣ Fetch driver info
  useEffect(() => {
    async function fetchDriver() {
      try {
        setLoadingProfile(true);
        const res = await fetch(`/api/public-profile?id=${driverId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || res.statusText);
        setProfile(json.profile);
      } catch (err: any) {
        console.error("Erro ao buscar motorista:", err);
        setError(err.message);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchDriver();
  }, [driverId]);

  // 2️⃣ Create/Fetch a PaymentIntent on mount
  useEffect(() => {
    async function createIntent() {
      try {
        setLoadingIntent(true);
        setError(null);

        // Pass driverId, and let the server decide:
        // - If session.user.tipo==='cliente', server creates with customer & ephemeral key
        // - Else (guest) server creates a basic one
        const res = await fetch(
          `/api/stripe/create-payment-intent?driverId=${driverId}`,
          {
            credentials: "include",
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || res.statusText);

        setClientSecret(json.clientSecret);
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
    createIntent();
  }, [driverId]);

  // Loading states
  if (loadingProfile || loadingIntent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando…
      </div>
    );
  }
  if (error) {
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
  if (!profile || !clientSecret) {
    return null;
  }

  // Stripe Elements options
  const options: StripeElementsOptions = {
    clientSecret,
    // only include ephemeralKeySecret if the server returned one _and_ there's a logged-in client
    ...(ephemeralKeySecret && session?.user?.tipo === "cliente"
      ? { customerEphemeralKeySecret: ephemeralKeySecret }
      : {}),
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 space-y-6">
        {/* Driver info */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full overflow-hidden mb-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Avatar de ${profile.nome}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-500 text-sm">Sem Foto</span>
              </div>
            )}
          </div>
          <h3 className="text-xl font-medium text-gray-800">
            {profile.nome || "Motorista"}
          </h3>
        </div>

        {/* Payment Element */}
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm />
        </Elements>
      </div>
    </main>
  );
}

// The actual form that renders the Stripe Payment Element
function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { id: driverId } = useParams() as { id: string };
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // After payment, return here:
        return_url:
          typeof window !== "undefined"
            ? window.location.origin + "/pagamento/sucesso"
            : undefined,
      },
    });

    if (stripeError) {
      console.error("Stripe error:", stripeError);
      setError(stripeError.message || "Erro no pagamento.");
      setSubmitting(false);
    }
    // If no error, Stripe will redirect to return_url for you.
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && <p className="text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium text-lg transition ${
          !stripe || submitting ? "opacity-70 cursor-not-allowed" : "hover:bg-purple-700"
        }`}
      >
        {submitting ? "Processando..." : "Pagar"}
      </button>
    </form>
  );
}
