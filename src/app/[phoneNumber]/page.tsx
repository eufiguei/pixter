// src/app/[phoneNumber]/page.tsx
'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Driver = {
  id: string;
  nome?: string;
  avatar_url?: string;
  profissao?: string;
};

export default function PublicPaymentPage({
  params,
}: {
  params: { phoneNumber: string };
}) {
  const { phoneNumber } = params;
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [valor, setValor] = useState('');

  // 1️⃣ Fetch the driver profile
  useEffect(() => {
    async function fetchDriver() {
      try {
        const res = await fetch(
          `/api/public/driver-info/${encodeURIComponent(phoneNumber)}`
        );
        if (!res.ok) {
          const { error } = await res.json();
          throw new Error(error || `Erro ${res.status}`);
        }
        const { profile } = await res.json();
        setDriver(profile);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDriver();
  }, [phoneNumber]);

  // 2️⃣ Handle BRL input: dots → commas, only digits/comma, max two decimals
  const handleValorChange = (e: ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value
      .replace(/\./g, ',')
      .replace(/[^\d,]/g, '');

    const [intPart, decPart] = v.split(',');
    if (decPart && decPart.length > 2) {
      v = intPart + ',' + decPart.slice(0, 2);
    }
    setValor(v);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Motorista não encontrado'}</p>
          <Link href="/" className="text-purple-600 hover:underline">
            Voltar à página inicial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 space-y-8">
        {/* Driver Info */}
        <div className="flex flex-col items-center space-y-2">
          <Image
            src={driver.avatar_url || '/images/avatars/avatar_1.png'}
            alt={driver.nome || 'Motorista'}
            width={96}
            height={96}
            className="rounded-full"
            priority
          />
          <h2 className="text-xl font-semibold">{driver.nome}</h2>
          {driver.profissao && (
            <p className="text-gray-600">{driver.profissao}</p>
          )}
          <p className="text-gray-600">
            {phoneNumber
              .replace(/\D/g, '')
              .replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
          </p>
        </div>

        {/* Amount Input */}
        <div>
          <label
            htmlFor="valor"
            className="block text-sm font-medium text-gray-700 text-center mb-1"
          >
            Qual valor pago?
          </label>
          <input
            id="valor"
            name="valor"
            type="text"
            inputMode="decimal"
            lang="pt-BR"
            pattern="[0-9]*[.,]?[0-9]{0,2}"
            placeholder="0,00"
            value={valor}
            onChange={handleValorChange}
            className="w-full text-2xl text-center py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* TODO: Once you have your clientSecret from Stripe, mount <Elements> + <PaymentElement> here */}
      </div>
    </main>
  );
}
