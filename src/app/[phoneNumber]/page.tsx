// src/app/[celular]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useBRLFormatter } from '@/components/useBRLFormatter';

export default function DriverPaymentPage({
  params,
}: {
  params: { celular: string };
}) {
  const { celular } = params;
  const [driver, setDriver] = useState<{ nome?: string; avatar_url?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { value: valor, onChange: handleValorChange } = useBRLFormatter('');

  useEffect(() => {
    async function fetchDriver() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public-profile?celular=${celular}`);
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const { profile } = await res.json();
        setDriver(profile);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDriver();
  }, [celular]);

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
          <Link href="/">Voltar à página inicial</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* your NavBar lives in layout.tsx, no need to repeat here */}

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          {/* Driver info */}
          <div className="flex flex-col items-center mb-8">
            <Image
              src={driver.avatar_url ?? '/images/avatars/avatar_1.png'}
              alt={driver.nome || 'Motorista'}
              width={96}
              height={96}
              className="rounded-full"
            />
            <h2 className="mt-4 text-xl font-bold">{driver.nome}</h2>
            <p className="text-gray-600">
              {celular.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
            </p>
          </div>

          {/* Valor input only */}
          <div>
            <label
              htmlFor="valor"
              className="block text-sm text-gray-700 text-center mb-2"
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
              onChange={(e) => handleValorChange(e.target.value)}
              className="w-full py-3 text-2xl text-center border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* …later, when you have clientSecret, you can mount your Stripe <Elements> here */}
        </div>
      </main>
    </div>
  );
}
