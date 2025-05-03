// src/app/[phoneNumber]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

const defaultAvatar = '/images/avatars/avatar_1.png';

export default function DriverPaymentPage({ params }: { params: { phoneNumber: string } }) {
  const { phoneNumber } = params;

  const [driverInfo, setDriverInfo] = useState<{
    nome?: string;
    avatar_url?: string;
    profissao?: string;
  } | null>(null);

  const [valor, setValor] = useState('0,00');         // formatted display
  const [clientSecret, setClientSecret] = useState(''); 
  const [error, setError] = useState('');
  const debounceRef = useRef<number>();

  // Fetch public driver info
  useEffect(() => {
    fetch(`/api/public/driver-info/${phoneNumber}`)
      .then((res) => res.json())
      .then((data) => setDriverInfo(data))
      .catch((err) => setError(err.message));
  }, [phoneNumber]);

  // Format input as BRL on every change
  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, '');
    // cap length
    if (digits.length > 15) digits = digits.slice(0, 15);
    // pad so there's always at least 3 digits (e.g. "001" → "0,01")
    while (digits.length < 3) digits = '0' + digits;
    const intPart = digits.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
    const decPart = digits.slice(-2);
    setValor(`${intPart},${decPart}`);
  };

  // Create PaymentIntent any time valor ≥ R$1 updates (debounced)
  useEffect(() => {
    const numeric = parseFloat(valor.replace(',', '.'));
    if (isNaN(numeric) || numeric < 1) {
      setClientSecret('');
      return;
    }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId: phoneNumber,
            amount: Math.round(numeric * 100),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setClientSecret(json.clientSecret);
      } catch (err: any) {
        setError(err.message || 'Falha ao iniciar pagamento.');
        setClientSecret('');
      }
    }, 400);
    return () => window.clearTimeout(debounceRef.current);
  }, [valor, phoneNumber]);

  if (!driverInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <p>Carregando informações do motorista…</p>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 space-y-6">
        {/* Driver info */}
        <div className="text-center">
          <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4">
            <Image
              src={driverInfo.avatar_url || defaultAvatar}
              alt={driverInfo.nome || 'Motorista'}
              width={96}
              height={96}
              className="object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = defaultAvatar
              }}
            />
          </div>
          <h2 className="text-2xl font-semibold">{driverInfo.nome}</h2>
          {driverInfo.profissao && (
            <p className="text-gray-600">{driverInfo.profissao}</p>
          )}
        </div>

        {/* Amount input */}
        <div>
          <label htmlFor="valor" className="block text-center mb-2">
            Qual valor pago?
          </label>
          <input
            id="valor"
            type="tel"
            inputMode="numeric"
            pattern="\d*"
            value={valor}
            onChange={handleValorChange}
            className="w-full text-3xl text-center border border-gray-300 rounded py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="0,00"
          />
        </div>

        {/* Stripe Elements */}
        {clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <div className="space-y-4">
              <PaymentElement />
              <button
                type="button"
                onClick={undefined}
                className="w-full bg-purple-600 text-white py-2 rounded disabled:opacity-50"
              >
                Pagar com Pix, Apple/Google Pay ou Cartão
              </button>
            </div>
          </Elements>
        ) : (
          <p className="text-center text-gray-500">
            Digite R$ 1,00 ou mais para ver opções…
          </p>
        )}
      </div>
    </main>
  );
}
