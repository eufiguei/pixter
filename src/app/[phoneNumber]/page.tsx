// src/app/[phoneNumber]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import CurrencyInput from 'react-currency-input-field';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const defaultAvatar = '/images/avatars/avatar_1.png';

function PaymentForm({ onSuccess, onError }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/payment-success` },
        redirect: 'if_required',
      });
      if (error) {
        setPaymentError(error.message || 'Ocorreu um erro.');
        onError(error);
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent);
      }
    } catch (err) {
      console.error(err);
      setPaymentError('Erro inesperado.');
      onError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {paymentError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {paymentError}
        </div>
      )}
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 bg-purple-600 text-white rounded disabled:opacity-50"
      >
        {isProcessing ? 'Processando...' : 'Pagar com Pix, Apple/Google Pay ou Cartão'}
      </button>
    </form>
  );
}

export default function DriverPaymentPage({ params }: { params: { phoneNumber: string } }) {
  const { phoneNumber } = params;
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [amount, setAmount] = useState('');  
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  const debounceRef = useRef<number>();

  // 1) load driver
  useEffect(() => {
    fetch(`/api/public/driver-info/${phoneNumber}`)
      .then(r => r.json())
      .then(json => setDriverInfo(json))
      .catch(e => setError(e.message));
  }, [phoneNumber]);

  // 2) create intent whenever amount ≥ 1.00 (debounced)
  useEffect(() => {
    const num = parseFloat(amount.replace(',', '.'));
    if (isNaN(num) || num < 1) {
      setClientSecret('');
      return;
    }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverId: phoneNumber, amount: Math.round(num * 100) }),
        });
        const { clientSecret, error: e } = await res.json();
        if (!res.ok) throw new Error(e);
        setClientSecret(clientSecret);
      } catch (err: any) {
        setError(err.message);
        setClientSecret('');
      }
    }, 400);
    return () => window.clearTimeout(debounceRef.current);
  }, [amount, phoneNumber]);

  if (!driverInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {error ? <p className="text-red-500">{error}</p> : <p>Carregando…</p>}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 space-y-6">
        {/* Driver header */}
        <div className="text-center">
          <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4">
            <Image
              src={driverInfo.avatar_url || defaultAvatar}
              alt={driverInfo.nome}
              width={96}
              height={96}
              className="object-cover"
              onError={(e) => (e.currentTarget.src = defaultAvatar)}
            />
          </div>
          <h2 className="text-2xl font-semibold">{driverInfo.nome}</h2>
          {driverInfo.profissao && <p className="text-gray-600">{driverInfo.profissao}</p>}
        </div>

        {/* Amount input */}
        <div>
          <label htmlFor="amount" className="block text-center mb-2">
            Qual valor pago?
          </label>
          <CurrencyInput
            id="amount"
            name="amount"
            placeholder="0,00"
            value={amount}
            onValueChange={(v) => setAmount(v || '')}
            intlConfig={{ locale: 'pt-BR', currency: 'BRL' }}
            decimalScale={2}
            allowNegativeValue={false}
            className="w-full text-3xl text-center border border-gray-300 rounded py-2 focus:ring-2 focus:ring-purple-500"
            inputMode="decimal"   // ← force Brazilian numeric keypad
            type="tel"            // ← on mobile you get the numeric keyboard
          />
        </div>

        {/* Stripe Elements */}
        {clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm
              onSuccess={() => {}}
              onError={() => {}}
            />
          </Elements>
        ) : (
          <p className="text-center text-gray-500">
            Digite pelo menos R$ 1,00 para ver opções…
          </p>
        )}
      </div>
    </main>
  );
}
