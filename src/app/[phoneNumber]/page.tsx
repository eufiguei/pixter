// File: src/app/[phoneNumber]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement } from '@stripe/react-stripe-js';
import CurrencyInput from 'react-currency-input-field';

// 1️⃣ Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

// 2️⃣ Inline PaymentForm (you can extract this if you prefer)
function PaymentForm() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError('');

    try {
      // confirmPayment will automatically pick up the PaymentElement
      // if you prefer client-side confirm:
      // const stripe = await stripePromise;
      // const { error } = await stripe!.confirmPayment({ … })
      // but here we’ll let Stripe.js handle it via redirect/if_required
      // (no extra code needed)
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-red-500">{error}</p>}

      {/* This renders the card / wallet / ApplePay / Pix UI */}
      <PaymentElement />

      <button
        type="submit"
        disabled={isProcessing}
        className="w-full py-2 bg-purple-600 text-white rounded disabled:opacity-50"
      >
        {isProcessing ? 'Processando…' : 'Pagar com Pix, Apple Pay ou Cartão'}
      </button>
    </form>
  );
}

export default function DriverPaymentPage({
  params,
}: {
  params: { phoneNumber: string };
}) {
  const { phoneNumber } = params;

  const [driverProfile, setDriverProfile] = useState<{
    id: string;
    nome?: string;
    avatar_url?: string;
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState('');

  const [amount, setAmount] = useState('');       // e.g. "50,00"
  const [clientSecret, setClientSecret] = useState<string>('');
  const [loadingIntent, setLoadingIntent] = useState(false);

  // ── 1) Load driver profile ────────────────────────
  useEffect(() => {
    async function fetchDriver() {
      setLoadingProfile(true);
      setError('');
      try {
        const res = await fetch(`/api/public-profile?id=${phoneNumber}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Motorista não encontrado');
        setDriverProfile(json.profile);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchDriver();
  }, [phoneNumber]);

  // ── 2) Create PaymentIntent when amount ≥ R$1,00 ──
  useEffect(() => {
    const numeric = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(numeric) || numeric < 1) {
      setClientSecret('');
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingIntent(true);
      try {
        const res = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Math.round(numeric * 100),
            driverId: driverProfile?.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao iniciar pagamento');
        setClientSecret(data.clientSecret);
      } catch (err: any) {
        setError(err.message);
        setClientSecret('');
      } finally {
        setLoadingIntent(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, driverProfile?.id]);

  // ── RENDER ─────────────────────────────────────────
  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error && !driverProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/">Voltar à página inicial</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Your NavBar component */}
      {/* <NavBar /> */}

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white shadow-md rounded-lg p-8">
          {/* Driver info */}
          <div className="flex flex-col items-center mb-8">
            <Image
              src={driverProfile!.avatar_url ?? '/images/avatars/avatar_1.png'}
              alt={driverProfile!.nome || 'Motorista'}
              width={96}
              height={96}
              className="rounded-full"
            />
            <h2 className="mt-4 text-xl font-bold">
              {driverProfile!.nome}
            </h2>
            <p className="text-gray-600">
              {phoneNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
            </p>
          </div>

          {/* Amount input */}
          <CurrencyInput
            placeholder="0,00"
            value={amount}
            onValueChange={(v) => setAmount(v ?? '')}
            intlConfig={{ locale: 'pt-BR', currency: 'BRL' }}
            decimalScale={2}
            allowNegativeValue={false}
            className="w-full text-center text-3xl border rounded mb-4 py-2"
            inputMode="decimal"
            type="tel"
          />

          {/* Show loader while fetching Intent */}
          {loadingIntent && (
            <p className="text-center text-gray-500">
              Carregando opções de pagamento…
            </p>
          )}

          {/* Once we have a clientSecret, mount Stripe Elements */}
          {clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm />
            </Elements>
          )}
        </div>
      </main>
    </div>
  );
}
