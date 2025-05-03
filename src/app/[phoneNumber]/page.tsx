'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import CurrencyInput from 'react-currency-input-field';
import QRCode from 'qrcode';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// Default avatar placeholder
const defaultAvatar = '/images/avatars/avatar_1.png';

// --- PaymentForm child component ---
function PaymentForm({ clientSecret }: { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);
    setPaymentError('');

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setPaymentError(error.message || 'Ocorreu um erro ao processar o pagamento.');
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {paymentError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {paymentError}
        </div>
      )}
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processando...' : 'Pagar com Pix, Apple Pay ou Cartão'}
      </button>
      <p className="text-center text-xs text-gray-500 mt-2">
        Pagamento processado com segurança via Stripe
      </p>
    </form>
  );
}

// --- Main page component ---
export default function DriverPaymentPage({ params }: { params: { phonenumber: string } }) {
  const { phonenumber } = params;
  const [amount, setAmount] = useState('');               // raw BRL string
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const debounceRef = useRef<NodeJS.Timeout>();

  // Fetch driver info once
  useEffect(() => {
    if (!phonenumber) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/driver-info/${phonenumber}`);
        if (!res.ok) throw new Error((await res.json()).error || 'Motorista não encontrado');
        setDriverInfo(await res.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [phonenumber]);

  // Create PaymentIntent when amount ≥ 1 and debounced
  useEffect(() => {
    clearTimeout(debounceRef.current!);
    const numeric = parseFloat(amount.replace(/[^\d,]/g, '').replace(',', '.'));
    if (numeric >= 1) {
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        setError('');
        try {
          const res = await fetch('/api/stripe/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: Math.round(numeric * 100),
              driverPhoneNumber: phonenumber,
            }),
          });
          if (!res.ok) throw new Error((await res.json()).error || 'Falha ao iniciar pagamento');
          setClientSecret((await res.json()).clientSecret);
        } catch (err: any) {
          setError(err.message);
          setClientSecret('');
        } finally {
          setLoading(false);
        }
      }, 500);
    } else {
      setClientSecret('');
    }
    return () => clearTimeout(debounceRef.current!);
  }, [amount, phonenumber]);

  // Loading driver info
  if (loading && !driverInfo && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin h-12 w-12 border-b-2 border-purple-600 rounded-full" />
      </div>
    );
  }

  // Error fetching driver
  if (error && !driverInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-sm">
          <h1 className="text-2xl font-semibold text-red-600 mb-4">Erro</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <Link href="/" className="text-indigo-600 hover:underline">
            Voltar à página inicial
          </Link>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <main className="min-h-screen bg-white flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md overflow-hidden">
        {/* Driver header */}
        <div className="p-8 text-center">
          <div className="mx-auto mb-4 w-24 h-24 rounded-full overflow-hidden relative">
            <Image
              src={driverInfo.avatar_url || defaultAvatar}
              alt={driverInfo.nome || 'Avatar'}
              fill
              sizes="96px"
              style={{ objectFit: 'cover' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = defaultAvatar; }}
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{driverInfo.nome}</h1>
          {driverInfo.profissao && (
            <p className="text-gray-600">{driverInfo.profissao}</p>
          )}
          <p className="text-gray-600 mt-1">
            {(() => {
              const d = phonenumber.replace(/\D/g, '');
              const local = d.startsWith('55') && d.length === 13 ? d.slice(2) : d;
              return local.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            })()}
          </p>
        </div>

        {/* Payment input */}
        <div className="px-8 pb-8">
          <h2 className="text-center text-3xl font-semibold text-gray-800 mb-6">
            Qual valor pago?
          </h2>
          <CurrencyInput
            className="block w-full rounded-md border-gray-300 py-3 px-4 text-center text-3xl focus:ring-purple-500 focus:border-purple-500 appearance-none"
            placeholder="R$ 0,00"
            value={amount}
            decimalsLimit={2}
            intlConfig={{ locale: 'pt-BR', currency: 'BRL' }}
            onValueChange={(v) => setAmount(v || '')}
            inputMode="decimal"
            type="tel"
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
          )}

          {/* Stripe Elements */}
          {clientSecret && (
            <div className="mt-6">
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm clientSecret={clientSecret} />
              </Elements>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
