'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CurrencyInput from 'react-currency-input-field';

// Inline PaymentForm (you can also pull from a separate component)
function PaymentForm({ clientSecret }: { clientSecret: string }) {
  const stripe = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  const elements = stripe; // we'll just pass clientSecret into Elements
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe) return;
    setIsProcessing(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/confirm-payment', {
        // your own confirm route, or use stripe-js → confirmPayment client-side
      });
      // handle confirm...
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-500">{error}</p>}
      <PaymentElement />
      <button disabled={isProcessing} className="mt-4 w-full bg-purple-600 text-white py-2 rounded">
        {isProcessing ? 'Processando...' : 'Finalize o pagamento'}
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

  // 1) fetch driver info
  useEffect(() => {
    const fetchDriver = async () => {
      setLoadingProfile(true);
      setError('');
      try {
        // <-- use your existing public-profile route
        const res = await fetch(`/api/public-profile?id=${phoneNumber}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Motorista não encontrado');
        }
        setDriverProfile(json.profile);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingProfile(false);   // 🛠️ uncommented so we leave the spinner
      }
    };
    fetchDriver();
  }, [phoneNumber]);

  // 2) create payment intent whenever the user enters >= R$1,00
  useEffect(() => {
    // parse "50,34" → 50.34
    const numeric = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(numeric) || numeric < 1) {
      setClientSecret('');
      return;
    }

    const handler = setTimeout(async () => {
      setLoadingIntent(true);
      try {
        const response = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Math.round(numeric * 100),   // in cents
            driverId: driverProfile?.id,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao iniciar pagamento');
        }
        setClientSecret(data.clientSecret);
      } catch (err: any) {
        setError(err.message);
        setClientSecret('');
      } finally {
        setLoadingIntent(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [amount, driverProfile?.id]);

  // ── RENDER ─────────────────────────────────────────────────────

  // still loading driver?
  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // driver lookup failed?
  if (error && !driverProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/">Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* NavBar is your shared component */}
      {/* … */}

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="bg-white shadow-md rounded-lg max-w-md w-full p-8">
          {/* Driver Info */}
          <div className="flex flex-col items-center mb-8">
            <Image
              src={driverProfile!.avatar_url ?? '/images/avatars/avatar_1.png'}
              alt={driverProfile!.nome}
              width={96}
              height={96}
              className="rounded-full"
            />
            <h2 className="mt-4 text-xl font-bold">{driverProfile!.nome}</h2>
            <p className="text-gray-600">
              {phoneNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
            </p>
          </div>

          {/* Amount Input */}
          <div>
            <label htmlFor="amount" className="sr-only">
              Valor (R$)
            </label>
            <CurrencyInput
              id="amount"
              name="amount"
              placeholder="0,00"
              value={amount}
              onValueChange={(v) => setAmount(v ?? '')}
              intlConfig={{ locale: 'pt-BR', currency: 'BRL' }}
              decimalScale={2}
              allowNegativeValue={false}
              className="w-full text-3xl text-center border rounded-md py-2 mb-4"
              inputMode="decimal"
              type="tel"
            />
          </div>

          {/* Stripe Elements */}
          {loadingIntent && amount && (
            <p className="text-center text-gray-500">Carregando opções de pagamento...</p>
          )}
          {clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm clientSecret={clientSecret} />
            </Elements>
          )}
        </div>
      </main>
    </div>
  );
}
