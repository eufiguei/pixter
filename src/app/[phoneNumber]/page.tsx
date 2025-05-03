// src/app/[phoneNumber]/page.tsx
"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadStripe, StripePaymentRequest } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
  PaymentRequestButtonElement,
} from "@stripe/react-stripe-js";
import CurrencyInput from "react-currency-input-field";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

// ────────────────────────────────────────────────────────────────────────────
// Child component that renders Apple Pay / Google Pay button *and* card form
// ────────────────────────────────────────────────────────────────────────────
function StripeCheckout({
  clientSecret,
  amountInCents,
}: {
  clientSecret: string;
  amountInCents: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentRequest, setPaymentRequest] =
    useState<StripePaymentRequest | null>(null);
  const [error, setError] = useState<string>("");

  // build the PaymentRequest for Apple Pay / Google Pay
  useEffect(() => {
    if (!stripe || amountInCents < 1) return;

    const pr = stripe.paymentRequest({
      country: "BR",
      currency: "brl",
      total: { label: "Total", amount: amountInCents },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
        pr.on("paymentmethod", async (ev) => {
          // confirm via Payment Request API
          const { error: err } = await stripe.confirmPayment({
            elements,
            confirmParams: {
              return_url: `${window.location.origin}/payment-success`,
            },
            payment_method: ev.paymentMethod.id,
          });
          if (err) {
            ev.complete("fail");
            setError(err.message || "Erro no pagamento");
          } else {
            ev.complete("success");
          }
        });
      }
    });
  }, [stripe, amountInCents, elements]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!stripe || !elements) return;

    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
    });
    if (err) setError(err.message || "Erro no pagamento");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {paymentRequest && (
        <PaymentRequestButtonElement
          options={{ paymentRequest }}
          className="w-full"
        />
      )}
      <PaymentElement />
      {error && (
        <p className="text-red-600 text-sm text-center">{error}</p>
      )}
      <button
        type="submit"
        disabled={!stripe}
        className="w-full bg-purple-600 text-white py-3 rounded-md hover:bg-purple-700 disabled:opacity-50"
      >
        Pagar R${(amountInCents / 100).toFixed(2)}
      </button>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main page component
// ────────────────────────────────────────────────────────────────────────────
export default function DriverPaymentPage({
  params,
}: {
  params: { phoneNumber: string };
}) {
  const router = useRouter();
  const { phoneNumber } = params;

  const [driverProfile, setDriverProfile] = useState<{
    id: string;
    nome: string;
    avatar_url?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [amount, setAmount] = useState(""); // raw string like "50,00"
  const [amountInCents, setAmountInCents] = useState(0);
  const [clientSecret, setClientSecret] = useState("");
  const debounceRef = useRef<NodeJS.Timeout>();

  // 1) Fetch public driver info
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setFetchError("");
      try {
        const res = await fetch(
          `/api/public/driver-info/${phoneNumber}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setDriverProfile(json.profile);
      } catch (err: any) {
        setFetchError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [phoneNumber]);

  // 2) Debounce amount → cents + create PaymentIntent
  useEffect(() => {
    // parse "50,00" → 5000
    const numeric = parseFloat(
      amount.replace(/\./g, "").replace(",", ".")
    );
    const cents = isNaN(numeric) ? 0 : Math.round(numeric * 100);
    setAmountInCents(cents);

    // only if >= 1 BRL
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (cents >= 100) {
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            "/api/stripe/create-payment-intent",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                amount: cents,
                driverId: driverProfile!.id,
              }),
            }
          );
          const json = await res.json();
          if (!res.ok) throw new Error(json.error);
          setClientSecret(json.clientSecret);
        } catch (err: any) {
          console.error(err);
        }
      }, 500);
    } else {
      setClientSecret("");
    }
  }, [amount, driverProfile]);

  // handle raw input change
  const onAmountChange = (val: string) => {
    // enforce max two decimals
    const [i, d] = val.split(",");
    let s = i.replace(/\D/g, "");
    if (d != null) s += "," + d.slice(0, 2);
    setAmount(s);
  };

  // ─── rendering ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (fetchError || !driverProfile) {
    return (
      <div className="min-h-screen p-4 text-center text-red-600">
        {fetchError || "Motorista não encontrado."}
        <div className="mt-4">
          <Link href="/" className="text-purple-600 hover:underline">
            Voltar à página inicial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-between items-center bg-white shadow">
        <Link href="/">
          <span className="text-2xl font-bold">Pixter</span>
        </Link>
        <nav className="space-x-4">
          <Link href="/login" className="hover:text-purple-600">
            Entrar
          </Link>
          <Link href="/cadastro" className="hover:text-purple-600">
            Criar Conta
          </Link>
        </nav>
      </header>

      {/* Payment form */}
      <main className="flex-grow flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-6">
            <img
              src={driverProfile.avatar_url}
              alt={driverProfile.nome}
              className="mx-auto w-24 h-24 rounded-full"
            />
            <h2 className="mt-4 text-2xl font-semibold">
              {driverProfile.nome}
            </h2>
          </div>

          <label
            htmlFor="amount"
            className="block text-center text-gray-700 mb-2"
          >
            Qual valor pago?
          </label>
          <CurrencyInput
            id="amount"
            placeholder="0,00"
            value={amount}
            onValueChange={onAmountChange}
            intlConfig={{ locale: "pt-BR", currency: "BRL" }}
            decimalScale={2}
            allowNegativeValue={false}
            className="w-full py-3 px-4 text-2xl text-center border rounded-md mb-6"
          />

          {clientSecret && amountInCents >= 100 ? (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <StripeCheckout
                clientSecret={clientSecret}
                amountInCents={amountInCents}
              />
            </Elements>
          ) : (
            <p className="text-center text-gray-500">
              Digite pelo menos R$ 1,00 para ver opções de pagamento
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
