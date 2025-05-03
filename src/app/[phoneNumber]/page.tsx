// src/app/[phoneNumber]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement } from '@stripe/react-stripe-js';
import CurrencyInput from 'react-currency-input-field';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export default function DriverPaymentPage({
  params,
}: {
  params: { phoneNumber: string };
}) {
  const { phoneNumber } = params;
  const [amount, setAmount] = useState('');               // raw string "123,45"
  const [clientSecret, setClientSecret] = useState('');
  const [ephemeralKey, setEphemeralKey] = useState<string>();
  const [error, setError] = useState('');

  // 1) Whenever `amount` changes and is ≥ R$ 1,00, create a PaymentIntent:
  useEffect(() => {
    const numeric = parseFloat(
      amount.replace(/[^\d,]/g, '').replace(',', '.')
    );
    if (isNaN(numeric) || numeric < 1) {
      setClientSecret('');
      return;
    }
    const createIntent = async () => {
      try {
        const res = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Math.round(numeric * 100), // in cents
            driverId: phoneNumber,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setClientSecret(data.clientSecret);
        setEphemeralKey(data.ephemeralKeySecret);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Erro ao iniciar pagamento');
      }
    };
    const tid = setTimeout(createIntent, 500);
    return () => clearTimeout(tid);
  }, [amount, phoneNumber]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* HEADER */}
      <header className="bg-white shadow">
        <div className="max-w-3xl mx-auto flex justify-between p-4">
          <Link href="/">
            <span className="font-bold text-xl">Pixter</span>
          </Link>
          <div className="space-x-4">
            <Link href="/login">
              <span className="hover:underline">Entrar</span>
            </Link>
            <Link href="/cadastro">
              <span className="hover:underline">Criar Conta</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded shadow">
          {/* DRIVER INFO */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full overflow-hidden mb-4">
              <Image
                src={`/images/avatars/${phoneNumber}.png`} // or fetch via your public API
                alt="Avatar"
                width={96}
                height={96}
                className="object-cover"
              />
            </div>
            <h2 className="text-2xl font-semibold">{phoneNumber}</h2>
            <p className="text-gray-600">{`(${phoneNumber.slice(
              0,
              2
            )}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7)}`}</p>
          </div>

          {/* AMOUNT INPUT */}
          <div className="mb-4">
            <label htmlFor="amount" className="block text-center mb-2">
              Qual valor pago?
            </label>
            <CurrencyInput
              id="amount"
              name="amount"
              placeholder="0,00"
              value={amount}
              onValueChange={(value) => setAmount(value || '')}
              intlConfig={{ locale: 'pt-BR', currency: 'BRL' }}
              decimalScale={2}
              allowNegativeValue={false}
              inputMode="decimal"
              className="w-full text-3xl text-center border rounded py-2"
            />
          </div>

          {/* STRIPE ELEMENTS */}
          {error && <p className="text-red-500 mb-2">{error}</p>}
          {clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                ...(ephemeralKey && { ephemeralKeySecret: ephemeralKey }),
              }}
            >
              <div className="space-y-4">
                <PaymentElement />
                <button className="w-full bg-purple-600 text-white py-2 rounded">
                  Pagar com Pix, Apple Pay ou Cartão
                </button>
              </div>
            </Elements>
          ) : (
            <p className="text-center text-gray-500">
              Digite um valor ≥ R$ 1,00 para ver opções de pagamento…
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
